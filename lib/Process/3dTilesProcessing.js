import * as THREE from 'three';
import ObjectRemovalHelper from "./ObjectRemovalHelper.js";
import { C3DTilesBoundingVolumeTypes } from "../Core/3DTiles/C3DTilesEnums.js";
import { C3DTILES_LAYER_EVENTS } from "../Layer/C3DTilesLayer.js";

/** @module 3dTilesProcessing
*/

function requestNewTile(view, scheduler, geometryLayer, metadata, parent, redraw) {
  const command = {
    /* mandatory */
    view,
    requester: parent,
    layer: geometryLayer,
    priority: parent ? 1.0 / (parent.distance + 1) : 100,
    /* specific params */
    metadata,
    redraw
  };
  geometryLayer.dispatchEvent({
    type: C3DTILES_LAYER_EVENTS.ON_TILE_REQUESTED,
    metadata
  });
  return scheduler.execute(command);
}
function getChildTiles(tile) {
  // only keep children that have the same layer and a valid tileId
  return tile.children.filter(n => n.layer == tile.layer && n.tileId);
}
function subdivideNode(context, layer, node, cullingTest) {
  if (node.additiveRefinement) {
    // Additive refinement can only fetch visible children.
    _subdivideNodeAdditive(context, layer, node, cullingTest);
  } else {
    // Substractive refinement on the other hand requires to replace
    // node with all of its children
    _subdivideNodeSubstractive(context, layer, node);
  }
}
const tmpMatrix = new THREE.Matrix4();
function _subdivideNodeAdditive(context, layer, node, cullingTest) {
  for (const child of layer.tileset.tiles[node.tileId].children) {
    // child being downloaded => skip
    if (child.promise || child.loaded) {
      continue;
    }

    // 'child' is only metadata (it's *not* a THREE.Object3D). 'cullingTest' needs
    // a matrixWorld, so we compute it: it's node's matrixWorld x child's transform
    let overrideMatrixWorld = node.matrixWorld;
    if (child.transform) {
      overrideMatrixWorld = tmpMatrix.multiplyMatrices(node.matrixWorld, child.transform);
    }
    const isVisible = cullingTest ? !cullingTest(layer, context.camera, child, overrideMatrixWorld) : true;

    // child is not visible => skip
    if (!isVisible) {
      continue;
    }
    child.promise = requestNewTile(context.view, context.scheduler, layer, child, node, true).then(tile => {
      node.add(tile);
      tile.updateMatrixWorld();
      layer.onTileContentLoaded(tile);
      context.view.notifyChange(child);
      child.loaded = true;
      delete child.promise;
    });
  }
}
function _subdivideNodeSubstractive(context, layer, node) {
  if (!node.pendingSubdivision && getChildTiles(node).length == 0) {
    const childrenTiles = layer.tileset.tiles[node.tileId].children;
    if (childrenTiles === undefined || childrenTiles.length === 0) {
      return;
    }
    node.pendingSubdivision = true;
    const promises = [];
    for (let i = 0; i < childrenTiles.length; i++) {
      promises.push(requestNewTile(context.view, context.scheduler, layer, childrenTiles[i], node, false).then(tile => {
        childrenTiles[i].loaded = true;
        node.add(tile);
        tile.updateMatrixWorld();
        // TODO: remove because cannot happen?
        if (node.additiveRefinement) {
          context.view.notifyChange(node);
        }
        layer.tileset.tiles[tile.tileId].loaded = true;
        layer.onTileContentLoaded(tile);
      }));
    }
    Promise.all(promises).then(() => {
      node.pendingSubdivision = false;
      context.view.notifyChange(node);
    });
  }
}

/**
 * Check if the node is visible in the camera.
 *
 * @param      {C3DTilesLayer} layer       node 3D tiles layer
 * @param      {Camera}   camera           camera
 * @param      {THREE.Object3D}   node             The 3d tile node to check.
 * @param      {THREE.Matrix4}   tileMatrixWorld  The node matrix world
 * @return     {boolean}  return true if the node is visible
 */
export function $3dTilesCulling(layer, camera, node, tileMatrixWorld) {
  // For viewer Request Volume
  // https://github.com/AnalyticalGraphicsInc/3d-tiles-samples/tree/master/tilesets/TilesetWithRequestVolume
  if (node.viewerRequestVolume && node.viewerRequestVolume.viewerRequestVolumeCulling(camera, tileMatrixWorld)) {
    return true;
  }

  // For bounding volume
  return !!(node.boundingVolume && node.boundingVolume.boundingVolumeCulling(camera, tileMatrixWorld));
}

// Cleanup all 3dtiles|three.js starting from a given node n.
// n's children can be of 2 types:
//   - have a 'content' attribute -> it's a tileset and must
//     be cleaned with cleanup3dTileset()
//   - doesn't have 'content' -> it's a raw Object3D object,
//     and must be cleaned with _cleanupObject3D()
function cleanup3dTileset(layer, n) {
  let depth = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 0;
  // If this layer is not using additive refinement, we can only
  // clean a tile if all its neighbours are cleaned as well because
  // a tile can only be in 2 states:
  //   - displayed and no children displayed
  //   - hidden and all of its children displayed
  // So here we implement a conservative measure: if T is cleanable
  // we actually only clean its children tiles.
  const canCleanCompletely = n.additiveRefinement || depth > 0;
  for (let i = 0; i < n.children.length; i++) {
    // skip non-tiles elements
    if (!n.children[i].content) {
      if (canCleanCompletely) {
        ObjectRemovalHelper.removeChildrenAndCleanupRecursively(n.children[i].layer, n.children[i]);
      }
    } else {
      cleanup3dTileset(layer, n.children[i], depth + 1);
    }
  }
  if (canCleanCompletely) {
    if (n.dispose) {
      n.dispose();
    }
    delete n.content;
    layer.tileset.tiles[n.tileId].loaded = false;
    n.remove(...n.children);

    // and finally remove from parent
    if (depth == 0 && n.parent) {
      n.parent.remove(n);
    }
  } else {
    const tiles = getChildTiles(n);
    n.remove(...tiles);
  }
}

// this is a layer
export function pre3dTilesUpdate(context) {
  if (!this.visible) {
    return [];
  }
  this.scale = context.camera._preSSE;

  // Elements removed are added in the layer._cleanableTiles list.
  // Since we simply push in this array, the first item is always
  // the oldest one.
  const now = Date.now();
  if (this._cleanableTiles.length && now - this._cleanableTiles[0].cleanableSince > this.cleanupDelay) {
    // Make sure we don't clean root tile
    this.root.cleanableSince = undefined;
    let i = 0;
    for (; i < this._cleanableTiles.length; i++) {
      const elt = this._cleanableTiles[i];
      if (now - elt.cleanableSince > this.cleanupDelay) {
        cleanup3dTileset(this, elt);
      } else {
        // later entries are younger
        break;
      }
    }
    // remove deleted elements from _cleanableTiles
    this._cleanableTiles.splice(0, i);
  }
  return [this.root];
}
const boundingVolumeBox = new THREE.Box3();
const boundingVolumeSphere = new THREE.Sphere();
export function computeNodeSSE(camera, node) {
  node.distance = 0;
  if (node.boundingVolume.initialVolumeType === C3DTilesBoundingVolumeTypes.box) {
    boundingVolumeBox.copy(node.boundingVolume.volume);
    boundingVolumeBox.applyMatrix4(node.matrixWorld);
    node.distance = boundingVolumeBox.distanceToPoint(camera.camera3D.position);
  } else if (node.boundingVolume.initialVolumeType === C3DTilesBoundingVolumeTypes.sphere || node.boundingVolume.initialVolumeType === C3DTilesBoundingVolumeTypes.region) {
    boundingVolumeSphere.copy(node.boundingVolume.volume);
    boundingVolumeSphere.applyMatrix4(node.matrixWorld);
    // TODO: see https://github.com/iTowns/itowns/issues/800
    node.distance = Math.max(0.0, boundingVolumeSphere.distanceToPoint(camera.camera3D.position));
  } else {
    return Infinity;
  }
  if (node.distance === 0) {
    // This test is needed in case geometricError = distance = 0
    return Infinity;
  }
  return camera._preSSE * (node.geometricError / node.distance);
}
export function init3dTilesLayer(view, scheduler, layer, rootTile) {
  return requestNewTile(view, scheduler, layer, rootTile, undefined, true).then(tile => {
    layer.object3d.add(tile);
    tile.updateMatrixWorld();
    layer.tileset.tiles[tile.tileId].loaded = true;
    layer.root = tile;
    layer.onTileContentLoaded(tile);
  });
}
function setDisplayed(node, display) {
  // The geometry of the tile is not in node, but in node.content
  // To change the display state, we change node.content.visible instead of
  // node.material.visible
  if (node.content) {
    node.content.visible = display;
  }
}
function markForDeletion(layer, elt) {
  if (!elt.cleanableSince) {
    elt.cleanableSince = Date.now();
    layer._cleanableTiles.push(elt);
  }
}

/**
 * This funcion builds the method to update 3d tiles node.
 *
 * The returned method checks the 3d tile visibility with `cullingTest` function.
 * It subdivises visible node if `subdivisionTest` return `true`.
 *
 * @param      {Function}  [cullingTest=$3dTilesCulling]                 The culling test method.
 * @param      {Function}  [subdivisionTest=$3dTilesSubdivisionControl]  The subdivision test method.
 * @return     {Function}    { description_of_the_return_value }
 */
export function process3dTilesNode() {
  let cullingTest = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : $3dTilesCulling;
  let subdivisionTest = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : $3dTilesSubdivisionControl;
  return function (context, layer, node) {
    // early exit if parent's subdivision is in progress
    if (node.parent.pendingSubdivision && !node.parent.additiveRefinement) {
      node.visible = false;
      return undefined;
    }

    // do proper culling
    const isVisible = cullingTest ? !cullingTest(layer, context.camera, node, node.matrixWorld) : true;
    node.visible = isVisible;
    if (isVisible) {
      if (node.cleanableSince) {
        layer._cleanableTiles.splice(layer._cleanableTiles.indexOf(node), 1);
        node.cleanableSince = undefined;
      }
      let returnValue;
      if (node.pendingSubdivision || subdivisionTest(context, layer, node)) {
        subdivideNode(context, layer, node, cullingTest);
        // display iff children aren't ready
        setDisplayed(node, node.pendingSubdivision || node.additiveRefinement);
        returnValue = getChildTiles(node);
      } else {
        setDisplayed(node, true);
        for (const n of getChildTiles(node)) {
          n.visible = false;
          markForDeletion(layer, n);
        }
      }
      return returnValue;
    }
    markForDeletion(layer, node);
  };
}

/**
 *
 *
 * the method returns true if the `node` should be subivised.
 *
 * @param      {object}   context  The current context
 * @param      {Camera}   context.camera  The current camera
 * @param      {C3DTilesLayer}   layer  The 3d tile layer
 * @param      {THREE.Object3D}  node  The 3d tile node
 * @return     {boolean}
 */
export function $3dTilesSubdivisionControl(context, layer, node) {
  if (layer.tileset.tiles[node.tileId].children === undefined) {
    return false;
  }
  if (layer.tileset.tiles[node.tileId].isTileset) {
    return true;
  }
  const sse = computeNodeSSE(context.camera, node);
  return sse > layer.sseThreshold;
}