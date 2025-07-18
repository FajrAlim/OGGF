import { Vector2, Vector3 } from 'three';
import Protobuf from 'pbf';
import { VectorTile } from '@mapbox/vector-tile';
import { FeatureCollection, FEATURE_TYPES } from "../Core/Feature.js";
import { globalExtentTMS } from "../Core/Tile/TileGrid.js";
import { deprecatedParsingOptionsToNewOne } from "../Core/Deprecated/Undeprecator.js";
import { Coordinates } from '@itowns/geographic';
const worldDimension3857 = globalExtentTMS.get('EPSG:3857').planarDimensions();
const globalExtent = new Vector3(worldDimension3857.x, worldDimension3857.y, 1);
const lastPoint = new Vector2();
const firstPoint = new Vector2();

// Calculate the projected coordinates in EPSG:4326 of a given point in the VT local system
// adapted from @mapbox/vector-tile
function project(x, y, tileNumbers, tileExtent) {
  const size = tileExtent * 2 ** tileNumbers.z;
  const x0 = tileExtent * tileNumbers.x;
  const y0 = tileExtent * tileNumbers.y;
  return new Coordinates('EPSG:4326', (x + x0) * 360 / size - 180, 360 / Math.PI * Math.atan(Math.exp((180 - (y + y0) * 360 / size) * Math.PI / 180)) - 90);
}

// Classify option, it allows to classify a full polygon and its holes.
// Each polygon with its holes are in one FeatureGeometry.
// A polygon is determined by its clockwise direction and the holes are in the opposite direction.
// Clockwise direction is determined by Shoelace formula https://en.wikipedia.org/wiki/Shoelace_formula
// Draw polygon with canvas doesn't need to classify however it is necessary for meshs.
function vtFeatureToFeatureGeometry(vtFeature, feature) {
  let classify = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
  let geometry = feature.bindNewGeometry();
  const isPolygon = feature.type === FEATURE_TYPES.POLYGON;
  classify = classify && isPolygon;
  geometry.properties = vtFeature.properties;
  const pbf = vtFeature._pbf;
  pbf.pos = vtFeature._geometry;
  const end = pbf.readVarint() + pbf.pos;
  let cmd = 1;
  let length = 0;
  let x = 0;
  let y = 0;
  let count = 0;
  let sum = 0;
  while (pbf.pos < end) {
    if (length <= 0) {
      const cmdLen = pbf.readVarint();
      cmd = cmdLen & 0x7;
      length = cmdLen >> 3;
    }
    length--;
    if (cmd === 1 || cmd === 2) {
      x += pbf.readSVarint();
      y += pbf.readSVarint();
      if (cmd === 1) {
        if (count) {
          if (classify && sum > 0 && geometry.indices.length > 0) {
            feature.updateExtent(geometry);
            geometry = feature.bindNewGeometry();
            geometry.properties = vtFeature.properties;
          }
          geometry.closeSubGeometry(count, feature);
          geometry.getLastSubGeometry().ccw = sum < 0;
        }
        count = 0;
        sum = 0;
      }
      count++;
      const coordProj = project(x, y, vtFeature.tileNumbers, vtFeature.extent);
      geometry.pushCoordinatesValues(feature, {
        x,
        y
      }, coordProj);
      if (count == 1) {
        firstPoint.set(x, y);
        firstPoint.coordProj = coordProj;
        lastPoint.set(x, y);
      } else if (isPolygon && count > 1) {
        sum += (lastPoint.x - x) * (lastPoint.y + y);
        lastPoint.set(x, y);
      }
    } else if (cmd === 7) {
      if (count) {
        count++;
        geometry.pushCoordinatesValues(feature, {
          x: firstPoint.x,
          y: firstPoint.y
        }, firstPoint.coordProj);
        if (isPolygon) {
          sum += (lastPoint.x - firstPoint.x) * (lastPoint.y + firstPoint.y);
        }
      }
    } else {
      throw new Error(`unknown command ${cmd}`);
    }
  }
  if (count) {
    if (classify && sum > 0 && geometry.indices.length > 0) {
      feature.updateExtent(geometry);
      geometry = feature.bindNewGeometry();
      geometry.properties = vtFeature.properties;
    }
    geometry.closeSubGeometry(count, feature);
    geometry.getLastSubGeometry().ccw = sum < 0;
  }
  feature.updateExtent(geometry);
}
function readPBF(file, options) {
  options.out = options.out || {};
  const vectorTile = new VectorTile(new Protobuf(file));
  const vtLayerNames = Object.keys(vectorTile.layers);
  const collection = new FeatureCollection(options.out);
  if (vtLayerNames.length < 1) {
    return Promise.resolve(collection);
  }

  // x,y,z tile coordinates
  const x = options.extent.col;
  const z = options.extent.zoom;
  // We need to move from TMS to Google/Bing/OSM coordinates
  // https://alastaira.wordpress.com/2011/07/06/converting-tms-tile-coordinates-to-googlebingosm-tile-coordinates/
  // Only if the layer.origin is top
  const y = options.in.isInverted ? options.extent.row : (1 << z) - options.extent.row - 1;
  const vFeature0 = vectorTile.layers[vtLayerNames[0]];
  // TODO: verify if size is correct because is computed with only one feature (vFeature0).
  const size = vFeature0.extent * 2 ** z;
  const center = -0.5 * size;
  collection.scale.set(globalExtent.x / size, -globalExtent.y / size, 1);
  collection.position.set(vFeature0.extent * x + center, vFeature0.extent * y + center, 0).multiply(collection.scale);
  collection.updateMatrixWorld();
  vtLayerNames.forEach(vtLayerName => {
    if (!options.in.layers[vtLayerName]) {
      return Promise.resolve(collection);
    }
    const vectorTileLayer = vectorTile.layers[vtLayerName];
    for (let i = vectorTileLayer.length - 1; i >= 0; i--) {
      const vtFeature = vectorTileLayer.feature(i);
      vtFeature.tileNumbers = {
        x,
        y: options.extent.row,
        z
      };
      // Find layers where this vtFeature is used
      const layers = options.in.layers[vtLayerName].filter(l => l.filterExpression.filter({
        zoom: z
      }, vtFeature));
      for (const layer of layers) {
        const feature = collection.requestFeatureById(layer.id, vtFeature.type - 1);
        feature.id = layer.id;
        feature.order = layer.order;
        feature.style = options.in.styles[feature.id];
        vtFeatureToFeatureGeometry(vtFeature, feature);
      }

      /*
      // This optimization is not fully working and need to be reassessed
      // (see https://github.com/iTowns/itowns/pull/2469/files#r1861802136)
      let feature;
      for (const layer of layers) {
          if (!feature) {
              feature = collection.requestFeatureById(layer.id, vtFeature.type - 1);
              feature.id = layer.id;
              feature.order = layer.order;
              feature.style = options.in.styles[feature.id];
              vtFeatureToFeatureGeometry(vtFeature, feature);
          } else if (!collection.features.find(f => f.id === layer.id)) {
              feature = collection.newFeatureByReference(feature);
              feature.id = layer.id;
              feature.order = layer.order;
              feature.style = options.in.styles[feature.id];
          }
      }
      */
    }
  });
  collection.removeEmptyFeature();
  // TODO Some vector tiles are already sorted
  collection.features.sort((a, b) => a.order - b.order);
  // TODO verify if is needed to updateExtent for previous features.
  collection.updateExtent();
  collection.extent = options.extent;
  collection.isInverted = options.in.isInverted;
  return Promise.resolve(collection);
}

/**
 * @module VectorTileParser
 */
export default {
  /**
   * Parse a vector tile file and return a [Feature]{@link module:GeoJsonParser.Feature}
   * or an array of Features. While multiple formats of vector tile are
   * available, the only one supported for the moment is the
   * [Mapbox Vector Tile](https://www.mapbox.com/vector-tiles/specification/).
   *
   * @param {ArrayBuffer} file - The vector tile file to parse.
   *
   * @param {Object} options - Options controlling the parsing {@link ParsingOptions}.
   *
   * @param {Object} options.in - Object containing all styles,
   * layers and informations data, see {@link InformationsData}.
   *
   * @param {Object} options.in.styles - Object containing subobject with
   * informations on a specific style layer. Styles available is by `layer.id` and by zoom.
   *
   * @param {Object} options.in.layers - Object containing subobject with
   *
   * @param {FeatureBuildingOptions} options.out - options indicates how the features should be built,
   * see {@link FeatureBuildingOptions}.
   *
   * @return {Promise} A Promise resolving with a Feature or an array a
   * Features.
   */
  parse(file, options) {
    options = deprecatedParsingOptionsToNewOne(options);
    return Promise.resolve(readPBF(file, options));
  }
};