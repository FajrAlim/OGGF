import * as THREE from 'three';
import { Extent } from '@itowns/geographic';
const _countTiles = new THREE.Vector2();
const _dim = new THREE.Vector2();
export const globalExtentTMS = new Map();
export const schemeTiles = new Map();
const extent4326 = new Extent('EPSG:4326', -180, 180, -90, 90);
globalExtentTMS.set('EPSG:4326', extent4326);

// Compute global extent of TMS in EPSG:3857
// It's square whose a side is between -180° to 180°.
// So, west extent, it's 180 convert in EPSG:3857
const extent3857 = extent4326.as('EPSG:3857');
extent3857.clampSouthNorth(extent3857.west, extent3857.east);
globalExtentTMS.set('EPSG:3857', extent3857);
const defaultScheme = new THREE.Vector2(1, 1);
schemeTiles.set('EPSG:3857', defaultScheme);
schemeTiles.set('EPSG:4326', new THREE.Vector2(2, 1));

// TODO: For now we can only have a single TMS grid per proj4 identifier.
// This causes TMS identifier to be proj4 identifier.
export function getInfoTms(crs) {
  const globalExtent = globalExtentTMS.get(crs);
  if (!globalExtent) {
    throw new Error(`The tile matrix set ${crs} is not defined.`);
  }
  const globalDimension = globalExtent.planarDimensions(_dim);
  const sTs = schemeTiles.get(crs) ?? defaultScheme;
  // The isInverted parameter is to be set to the correct value, true or false
  // (default being false) if the computation of the coordinates needs to be
  // inverted to match the same scheme as OSM, Google Maps or other system.
  // See link below for more information
  // https://alastaira.wordpress.com/2011/07/06/converting-tms-tile-coordinates-to-googlebingosm-tile-coordinates/
  // in crs includes ':NI' => tms isn't inverted (NOT INVERTED)
  const isInverted = !crs.includes(':NI');
  return {
    epsg: crs,
    globalExtent,
    globalDimension,
    sTs,
    isInverted
  };
}
export function getCountTiles(crs, zoom) {
  const sTs = schemeTiles.get(crs) || defaultScheme;
  const count = 2 ** zoom;
  _countTiles.set(count, count).multiply(sTs);
  return _countTiles;
}