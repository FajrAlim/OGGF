import * as THREE from 'three';
import EntwinePointTileNode from "../Core/EntwinePointTileNode.js";
import PointCloudLayer from "./PointCloudLayer.js";
import { Extent } from '@itowns/geographic';
const bboxMesh = new THREE.Mesh();
const box3 = new THREE.Box3();
bboxMesh.geometry.boundingBox = box3;

/**
 * @property {boolean} isEntwinePointTileLayer - Used to checkout whether this
 * layer is a EntwinePointTileLayer. Default is `true`. You should not change
 * this, as it is used internally for optimisation.
 *
 * @extends PointCloudLayer
 */
class EntwinePointTileLayer extends PointCloudLayer {
  /**
   * Constructs a new instance of Entwine Point Tile layer.
   *
   * @example
   * // Create a new point cloud layer
   * const points = new EntwinePointTileLayer('EPT',
   *  {
   *      source: new EntwinePointTileSource({
   *          url: 'https://server.geo/ept-dataset',
   *      }
   *  });
   *
   * View.prototype.addLayer.call(view, points);
   *
   * @param {string} id - The id of the layer, that should be unique. It is
   * not mandatory, but an error will be emitted if this layer is added a
   * {@link View} that already has a layer going by that id.
   * @param {Object} config - Configuration, all elements in it
   * will be merged as is in the layer. For example, if the configuration
   * contains three elements `name, protocol, extent`, these elements will be
   * available using `layer.name` or something else depending on the property
   * name. See the list of properties to know which one can be specified.
   * @param {string} [config.crs='ESPG:4326'] - The CRS of the {@link View} this
   * layer will be attached to. This is used to determine the extent of this
   * layer. Default to `EPSG:4326`.
   */
  constructor(id, config) {
    super(id, config);

    /**
     * @type {boolean}
     * @readonly
     */
    this.isEntwinePointTileLayer = true;

    /**
     * @type {THREE.Vector3}
     */
    this.scale = new THREE.Vector3(1, 1, 1);
    const resolve = this.addInitializationStep();
    this.whenReady = this.source.whenReady.then(() => {
      this.root = new EntwinePointTileNode(0, 0, 0, 0, this, -1);
      this.root.bbox.min.fromArray(this.source.boundsConforming, 0);
      this.root.bbox.max.fromArray(this.source.boundsConforming, 3);
      this.minElevationRange = this.minElevationRange ?? this.source.boundsConforming[2];
      this.maxElevationRange = this.maxElevationRange ?? this.source.boundsConforming[5];
      this.extent = Extent.fromBox3(config.crs || 'EPSG:4326', this.root.bbox);
      return this.root.loadOctree().then(resolve);
    });
  }
  get spacing() {
    return this.source.spacing;
  }
}
export default EntwinePointTileLayer;