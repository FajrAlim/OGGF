import Layer from "./Layer.js";
import Picking from "../Core/Picking.js";
import { CACHE_POLICIES } from "../Core/Scheduler/Cache.js";
import ObjectRemovalHelper from "../Process/ObjectRemovalHelper.js";

/**
 * Fires when the opacity of the layer has changed.
 * @event GeometryLayer#opacity-property-changed
 */

/**
 * @property {boolean} isGeometryLayer - Used to checkout whether this layer is
 * a GeometryLayer. Default is true. You should not change this, as it is used
 * internally for optimisation.
 * @property {number} [zoom.max=Infinity] - this is the maximum zoom beyond which it'll be hidden.
 * The `max` is constant and the value is `Infinity` because there's no maximum display level after which it is hidden.
 * This property is used only if the layer is attached to {@link TiledGeometryLayer}.
 * @property {number} [zoom.min=0] - this is the minimum zoom from which it'll be visible.
 * This property is used only if the layer is attached to {@link TiledGeometryLayer}.
 */
class GeometryLayer extends Layer {
  /**
   * A layer usually managing a geometry to display on a view. For example, it
   * can be a layer of buildings extruded from a a WFS stream.
   *
   * @param {string} id - The id of the layer, that should be unique. It is
   * not mandatory, but an error will be emitted if this layer is added a
   * {@link View} that already has a layer going by that id.
   * @param {THREE.Object3D} object3d - The object3D used to contain the
   * geometry of the GeometryLayer. It is usually a `THREE.Group`, but it can
   * be anything inheriting from a `THREE.Object3D`.
   * @param {Object} [config] - Optional configuration, all elements in it
   * will be merged as is in the layer. For example, if the configuration
   * contains three elements `name, protocol, extent`, these elements will be
   * available using `layer.name` or something else depending on the property
   * name.
   * @param {Source} config.source - Description and options of the source.
   * @param {number} [config.cacheLifeTime=Infinity] - set life time value in cache.
   * This value is used for [Cache]{@link Cache} expiration mechanism.
   * @param {boolean} [config.visible]
   *
   * @throws {Error} `object3d` must be a valid `THREE.Object3d`.
   *
   * @example
   * // Create a GeometryLayer
   * const geometry = new GeometryLayer('buildings', new THREE.Object3D(), {
   *      source: {
   *          url: 'http://server.geo/wfs?',
   *          protocol: 'wfs',
   *          format: 'application/json'
   *      },
   * });
   *
   * // Add the layer
   * view.addLayer(geometry);
   */
  constructor(id, object3d) {
    let config = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
    const {
      cacheLifeTime = CACHE_POLICIES.GEOMETRY,
      visible = true,
      opacity = 1.0,
      ...layerConfig
    } = config;
    super(id, {
      ...layerConfig,
      cacheLifeTime
    });

    /**
     * @type {boolean}
     * @readonly
     */
    this.isGeometryLayer = true;
    if (!object3d || !object3d.isObject3D) {
      throw new Error(`Missing/Invalid object3d parameter (must be a
                three.js Object3D instance)`);
    }
    if (object3d.type === 'Group' && object3d.name === '') {
      object3d.name = id;
    }

    /**
     * @type {THREE.Object3D}
     * @readonly
     */
    this.object3d = object3d;
    Object.defineProperty(this, 'object3d', {
      writable: false,
      configurable: true
    });

    /**
     * @type {number}
     */
    this.opacity = opacity;

    /**
     * @type {boolean}
     */
    this.wireframe = false;

    /**
     * @type {Layer[]}
     */
    this.attachedLayers = [];

    /**
     * @type {boolean}
     */
    this.visible = visible;
    Object.defineProperty(this.zoom, 'max', {
      value: Infinity,
      writable: false
    });

    // Feature options
    this.filteringExtent = !this.source.isFileSource;
    this.structure = '3d';
  }
  get visible() {
    return this.object3d.visible;
  }
  set visible(value) {
    if (this.object3d.visible !== value) {
      const event = {
        type: 'visible-property-changed',
        previous: {},
        new: {}
      };
      event.previous.visible = this.object3d.visible;
      event.new.visible = value;
      this.dispatchEvent(event);
      this.object3d.visible = value;
    }
  }

  // Attached layers expect to receive the visual representation of a
  // layer (= THREE object with a material).  So if a layer's update
  // function don't process this kind of object, the layer must provide a
  // getObjectToUpdateForAttachedLayers function that returns the correct
  // object to update for attached layer.
  // See 3dtilesLayer or PotreeLayer for examples.
  // eslint-disable-next-line arrow-body-style
  getObjectToUpdateForAttachedLayers(obj) {
    if (obj.parent && obj.material) {
      return {
        element: obj,
        parent: obj.parent
      };
    }
  }

  // Placeholder
  // eslint-disable-next-line
  postUpdate() {}

  // Placeholder
  // eslint-disable-next-line
  culling() {
    return true;
  }

  /**
   * Attach another layer to this one. Layers attached to a GeometryLayer will
   * be available in `geometryLayer.attachedLayers`.
   *
   * @param {Layer} layer - The layer to attach, that must have an `update`
   * method.
   */
  attach(layer) {
    if (!layer.update) {
      throw new Error(`Missing 'update' function -> can't attach layer
                ${layer.id}`);
    }
    this.attachedLayers.push(layer);
    // To traverse GeometryLayer object3d attached
    layer.parent = this;
  }

  /**
   * Detach a layer attached to this one. See {@link attach} to learn how to
   * attach a layer.
   *
   * @param {Layer} layer - The layer to detach.
   *
   * @return {boolean} Confirmation of the detachment of the layer.
   */
  detach(layer) {
    const count = this.attachedLayers.length;
    this.attachedLayers = this.attachedLayers.filter(attached => attached.id != layer.id);
    layer.parent = undefined;
    return this.attachedLayers.length < count;
  }

  /**
   * All layer's 3D objects are removed from the scene and disposed from the video device.
   * @param {boolean} [clearCache=false] Whether to clear the layer cache or not
   */
  delete(clearCache) {
    if (clearCache) {
      this.cache.clear();
    }

    // if Layer is attached
    if (this.parent) {
      ObjectRemovalHelper.removeChildrenAndCleanupRecursively(this, this.parent.object3d);
    }
    if (this.object3d.parent) {
      this.object3d.parent.remove(this.object3d);
    }
    ObjectRemovalHelper.removeChildrenAndCleanupRecursively(this, this.object3d);
  }

  /**
   * Picking method for this layer.
   *
   * @param {View} view - The view instance.
   * @param {Object} coordinates - The coordinates to pick in the view. It
   * should have at least `x` and `y` properties.
   * @param {number} radius - Radius of the picking circle.
   * @param {Array} target - target to push result.
   *
   * @return {Array} An array containing all targets picked under the
   * specified coordinates.
   */
  pickObjectsAt(view, coordinates) {
    let radius = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : this.options.defaultPickingRadius;
    let target = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : [];
    return Picking.pickObjectsAt(view, coordinates, radius, this.object3d, target);
  }
}
export default GeometryLayer;