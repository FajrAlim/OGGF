import proj4 from 'proj4';
import shp from 'shpjs';
import GeoJsonParser from "./GeoJsonParser.js";
import { deprecatedParsingOptionsToNewOne } from "../Core/Deprecated/Undeprecator.js";

/**
 * The ShapefileParser module provides a [parse]{@link
 * module:ShapefileParser.parse} method that takes a bunch of files constituing
 * a shapefile in and gives an object formateted for iTowns, containing all
 * necessary informations to display this shapefile.
 *
 * It uses the [shpjs](https://www.npmjs.com/package/shpjs) library to
 * parse all the files.
 *
 * @example
 * // Load all the necessary files for a shapefile, parse them and
 * // display them using a FileSource.
 * Promise.all([
 *     Fetcher.arrayBuffer('shapefile.shp'),
 *     Fetcher.arrayBuffer('shapefile.dbf'),
 *     Fetcher.arrayBuffer('shapefile.shx'),
 *     Fetcher.text('shapefile.prj'),
 * ]).then(function _(res) {
 *     return ShapefileParser.parse({
 *         shp: res[0],
 *         dbf: res[1],
 *         shx: res[2],
 *         prj: res[3],
 *     }, {
 *            in: {
 *              crs: 'EPSG:4326',
 *         },
 *         out: {
 *             crs: view.tileLayer.extent.crs,
 *         }
 *     });
 * }).then(function _(geojson) {
 *     var source = new FileSource({ features: geojson });
 *     var layer = new ColorLayer('velib', { source  });
 *     view.addLayer(layer);
 * });
 *
 *
 * @module ShapefileParser
 */
export default {
  /**
   * Parse a bunch of Shapefile files and return a {@link FeatureCollection}.
   *
   * @param {Object} data - All the data that can be specified in a shapefile.
   * @param {ArrayBuffer} data.shp - Data from the shapefile itself,
   * containing the feature geometry itself.
   * @param {ArrayBuffer} data.shx - A positional index of the feature
   * geometry.
   * @param {ArrayBuffer} data.dbf - Columnar attributes for each shape, in
   * [dBase](https://en.wikipedia.org/wiki/DBase) IV format.
   * @param {string} [data.prj] - The coordinate system and crs projection
   * information.
   * @param {ParsingOptions} [options]
   *
   * @return {Promise} A promise resolving with a {@link FeatureCollection}.
   */
  parse(data) {
    let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    options = deprecatedParsingOptionsToNewOne(options);
    let result;

    // If a zip is present, don't read anything else
    if (data.zip) {
      result = shp(data.zip);
    } else if (data.shp && data.shx && data.dbf) {
      result = shp(data);
    }
    options.in = options.in || {};
    options.in.crs = data.prj ? proj4(data.prj).oProj.datumName : options.in.crs;
    return Promise.resolve(result).then(res => GeoJsonParser.parse(res, options));
  }
};