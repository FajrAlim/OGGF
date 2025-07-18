import { kml } from '@tmcw/togeojson';
import GeoJsonParser from "./GeoJsonParser.js";
import { deprecatedParsingOptionsToNewOne } from "../Core/Deprecated/Undeprecator.js";

/**
 * The KMLParser module provides a [parse]{@link module:KMLParser.parse}
 * method that takes a KML in and gives an object formatted for iTowns
 * containing all necessary informations to display this KML.
 *
 * @module KMLParser
 */
export default {
  /**
   * Parse a KML file content and return a {@link FeatureCollection}.
   *
   * @param {XMLDocument} kmlFile - The KML file content to parse.
   * @param {ParsingOptions} options - Options controlling the parsing.
   *
   * @return {Promise} A promise resolving with a {@link FeatureCollection}.
   */
  parse(kmlFile, options) {
    options = deprecatedParsingOptionsToNewOne(options);
    return GeoJsonParser.parse(kml(kmlFile), options);
  }
};