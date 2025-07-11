import { gpx } from '@tmcw/togeojson';
import GeoJsonParser from "./GeoJsonParser.js";
import { deprecatedParsingOptionsToNewOne } from "../Core/Deprecated/Undeprecator.js";

/**
 * The GpxParser module provides a [parse]{@link module:GpxParser.parse}
 * method that takes a GPX in and gives an object formatted for iTowns
 * containing all necessary informations to display this GPX.
 *
 * @module GpxParser
 */
export default {
  /**
   * Parse a GPX file content and return a {@link FeatureCollection}.
   *
   * @param {XMLDocument} gpxFile - The GPX file content to parse.
   * @param {ParsingOptions} options - Options controlling the parsing.
   *
   * @return {Promise} A promise resolving with a {@link FeatureCollection}.
   */
  parse(gpxFile, options) {
    options = deprecatedParsingOptionsToNewOne(options);
    return GeoJsonParser.parse(gpx(gpxFile), options);
  }
};