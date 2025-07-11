import * as THREE from 'three';
import { geoidLayerIsVisible } from "../Layer/GeoidLayer.js";
import { tiledCovering } from "./Tile/Tile.js";

/**
 * A TileMesh is a THREE.Mesh with a geometricError and an OBB
 * The objectId property of the material is the with the id of the TileMesh
 * @param {TileGeometry} geometry - the tile geometry
 * @param {THREE.Material} material - a THREE.Material compatible with THREE.Mesh
 * @param {Layer} layer - the layer the tile is added to
 * @param {Extent} extent - the tile extent
 * @param {?number} level - the tile level (default = 0)
 */
class TileMesh extends THREE.Mesh {
  #_tms = (() => new Map())();
  #visible = true;
  constructor(geometry, material, layer, extent) {
    let level = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : 0;
    super(geometry, material);
    if (!extent) {
      throw new Error('extent is mandatory to build a TileMesh');
    }
    this.layer = layer;
    this.extent = extent;
    this.extent.zoom = level;
    this.level = level;
    this.material.objectId = this.id;
    this.obb = this.geometry.OBB.clone();
    this.boundingSphere = new THREE.Sphere();
    this.obb.box3D.getBoundingSphere(this.boundingSphere);
    for (const tms of layer.tileMatrixSets) {
      this.#_tms.set(tms, tiledCovering(this.extent, tms));
    }
    this.frustumCulled = false;
    this.matrixAutoUpdate = false;
    this.rotationAutoUpdate = false;
    this.layerUpdateState = {};
    this.isTileMesh = true;
    this.geoidHeight = 0;
    this.link = {};
    Object.defineProperty(this, 'visible', {
      get() {
        return this.#visible;
      },
      set(v) {
        if (this.#visible != v) {
          this.#visible = v;
          this.dispatchEvent({
            type: v ? 'shown' : 'hidden'
          });
        }
      }
    });
  }
  /**
   * If specified, update the min and max elevation of the OBB
   * and updates accordingly the bounding sphere and the geometric error
   *
   * @param {Object}  elevation
   * @param {number}  [elevation.min]
   * @param {number}  [elevation.max]
   * @param {number}  [elevation.scale]
   */
  setBBoxZ(elevation) {
    elevation.geoidHeight = geoidLayerIsVisible(this.layer) ? this.geoidHeight : 0;
    this.obb.updateZ(elevation);
    if (this.horizonCullingPointElevationScaled) {
      this.horizonCullingPointElevationScaled.setLength(this.obb.z.delta + this.horizonCullingPoint.length());
    }
    this.obb.box3D.getBoundingSphere(this.boundingSphere);
  }
  getExtentsByProjection(crs) {
    return this.#_tms.get(crs);
  }

  /**
   * Search for a common ancestor between this tile and another one. It goes
   * through parents on each side until one is found.
   *
   * @param {TileMesh} tile
   *
   * @return {TileMesh} the resulting common ancestor
   */
  findCommonAncestor(tile) {
    if (!tile) {
      return undefined;
    }
    if (tile.level == this.level) {
      if (tile.id == this.id) {
        return tile;
      } else if (tile.level != 0) {
        return this.parent.findCommonAncestor(tile.parent);
      } else {
        return undefined;
      }
    } else if (tile.level < this.level) {
      return this.parent.findCommonAncestor(tile);
    } else {
      return this.findCommonAncestor(tile.parent);
    }
  }
  onBeforeRender() {
    if (this.material.layersNeedUpdate) {
      this.material.updateLayersUniforms();
    }
  }
}
export default TileMesh;