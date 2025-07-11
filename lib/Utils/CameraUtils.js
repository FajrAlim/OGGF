import * as THREE from 'three';
import TWEEN from '@tweenjs/tween.js';
import DEMUtils from "./DEMUtils.js";
import { MAIN_LOOP_EVENTS } from "../Core/MainLoop.js";
import { Coordinates, Ellipsoid } from '@itowns/geographic';
import OBB from "../Renderer/OBB.js";
import { VIEW_EVENTS } from "../Core/View.js";
THREE.Object3D.DEFAULT_UP.set(0, 0, 1);
const targetPosition = new THREE.Vector3();
const targetCoord = new Coordinates('EPSG:4326', 0, 0, 0);
const ellipsoid = new Ellipsoid();
const rigs = [];
const obb = new OBB();
const size = new THREE.Vector3();
const deferred = () => {
  let resolve;
  let reject;
  return {
    promise: new Promise((re, rej) => {
      resolve = re;
      reject = rej;
    }),
    resolve,
    reject
  };
};

// Wrap angle in degrees to [-180 180]
function wrapTo180(angle) {
  return angle - Math.floor((angle + 180.0) / 360) * 360;
}
function tileLayer(view) {
  return view.getLayers(l => l.isTiledGeometryLayer)[0];
}
export function getLookAtFromMath(view, camera) {
  const direction = new THREE.Vector3(0, 0, 0.5);
  direction.unproject(camera);
  direction.sub(camera.position).normalize();
  if (view.referenceCrs == 'EPSG:4978') {
    // Intersect Ellispoid
    return ellipsoid.intersection({
      direction,
      origin: camera.position
    });
  } else {
    // Intersect plane
    const distance = camera.position.z / direction.z;
    return direction.multiplyScalar(distance).add(camera.position);
  }
}
function proxyProperty(view, camera, rig, key) {
  rig.proxy.position[key] = camera.position[key];
  Object.defineProperty(camera.position, key, {
    get: () => rig.proxy.position[key],
    set: newValue => {
      rig.removeProxy(view, camera);
      camera.position[key] = newValue;
    }
  });
}

// the rig is used to manipulate the camera
// It consists of a tree of 3D objects, each element is assigned a task
//
//                      Transformation
//
// rig                  position on Coordinate  (for the globe is rotation)
// |
// └── sealevel         position on altitude zero
//     |
//     └── target       position on DEM, and rotation (pitch and heading)
//         |
//         └── camera   distance to target
//
// When all transformations are calculated,
// this.camera's transformation is applied to view.camera.camera
class CameraRig extends THREE.Object3D {
  constructor() {
    super();
    // seaLevel is on rig's z axis, it's at altitude zero
    this.seaLevel = new THREE.Object3D();
    // target is on seaLevel's z axis and target.position.z is the DEM altitude
    this.target = new THREE.Object3D();
    this.target.rotation.order = 'ZXY';
    // camera look at target
    this.camera = new THREE.Camera();
    this.add(this.seaLevel);
    this.seaLevel.add(this.target);
    this.target.add(this.camera);
    // target's geographic coordinate
    this.coord = new Coordinates('EPSG:4978', 0, 0);
    // sea level's worldPoistion
    this.targetWorldPosition = new THREE.Vector3();
    this.removeAll = () => {};
    this._onChangeCallback = null;
  }

  // apply rig.camera's transformation to camera
  applyTransformToCamera(view, camera) {
    if (this.proxy) {
      camera.quaternion._onChange(this._onChangeCallback);
      this.camera.matrixWorld.decompose(this.proxy.position, camera.quaternion, camera.scale);
      camera.quaternion._onChange(() => this.removeProxy(view, camera));
    } else {
      this.camera.matrixWorld.decompose(camera.position, camera.quaternion, camera.scale);
    }
    view.dispatchEvent({
      type: VIEW_EVENTS.CAMERA_MOVED,
      coord: this.coord,
      range: this.range,
      heading: this.heading,
      tilt: this.tilt
    });
  }
  setProxy(view, camera) {
    if (!this.proxy && view && camera) {
      this.proxy = {
        position: new THREE.Vector3()
      };
      Object.keys(camera.position).forEach(key => proxyProperty(view, camera, this, key));
      this._onChangeCallback = camera.quaternion._onChangeCallback;
      camera.quaternion._onChange(() => this.removeProxy(view, camera));
    }
  }
  removeProxy(view, camera) {
    this.stop(view);
    if (this.proxy && view && camera) {
      Object.keys(camera.position).forEach(key => Object.defineProperty(camera.position, key, {
        value: this.proxy.position[key],
        writable: true
      }));
      camera.quaternion._onChange(this._onChangeCallback);
      this.proxy = null;
    }
  }
  setTargetFromCoordinate(view, coord) {
    // compute precise coordinate (coord) altitude and clamp it above seaLevel
    coord.as(tileLayer(view).extent.crs, this.coord);
    const altitude = Math.max(0, DEMUtils.getElevationValueAt(tileLayer(view), this.coord, DEMUtils.PRECISE_READ_Z) || this.coord.z);
    this.coord.z = altitude;
    // adjust target's position with clamped altitude
    this.coord.as(view.referenceCrs).toVector3(targetPosition);
    if (view.referenceCrs == 'EPSG:4978') {
      // ellipsoid geocentric projection
      this.lookAt(targetPosition);
      this.seaLevel.position.set(0, 0, targetPosition.length() - altitude);
    } else {
      // planar projection
      this.position.set(targetPosition.x, targetPosition.y, 0);
      this.seaLevel.position.set(0, 0, 0);
    }
    // place camera's target
    this.target.position.set(0, 0, altitude);
  }

  // set rig's objects transformation from camera's position and target's position
  setFromPositions(view, cameraPosition) {
    this.setTargetFromCoordinate(view, new Coordinates(view.referenceCrs).setFromVector3(targetPosition));
    this.target.rotation.set(0, 0, 0);
    this.updateMatrixWorld(true);
    this.camera.position.copy(cameraPosition);
    this.target.worldToLocal(this.camera.position);
    const range = this.camera.position.length();
    this.target.rotation.x = Math.asin(this.camera.position.z / range);
    const cosPlanXY = THREE.MathUtils.clamp(this.camera.position.y / (Math.cos(this.target.rotation.x) * range), -1, 1);
    this.target.rotation.z = Math.sign(-this.camera.position.x || 1) * Math.acos(cosPlanXY);
    this.camera.position.set(0, range, 0);
  }

  // set from target's coordinate, rotation and range between target and camera
  applyParams(view, params) {
    if (params.coord) {
      this.setTargetFromCoordinate(view, params.coord);
    }
    if (params.tilt != undefined) {
      this.target.rotation.x = THREE.MathUtils.degToRad(params.tilt);
    }
    if (params.heading != undefined) {
      this.target.rotation.z = THREE.MathUtils.degToRad(-wrapTo180(params.heading + 180));
    }
    if (params.range) {
      this.camera.position.set(0, params.range, 0);
    }
    this.camera.rotation.set(-Math.PI * 0.5, 0, Math.PI);
    this.updateMatrixWorld(true);
    this.targetWorldPosition.setFromMatrixPosition(this.seaLevel.matrixWorld);
  }
  getParams() {
    return {
      coord: this.coord.clone(),
      tilt: this.tilt,
      heading: this.heading,
      range: this.range,
      targetWorldPosition: this.targetWorldPosition
    };
  }
  setfromCamera(view, camera, pickedPosition) {
    camera.updateMatrixWorld(true);
    if (pickedPosition == undefined) {
      pickedPosition = view.getPickingPositionFromDepth() || getLookAtFromMath(view, camera);
    }
    const range = pickedPosition && !isNaN(pickedPosition.x) ? camera.position.distanceTo(pickedPosition) : 100;
    camera.localToWorld(targetPosition.set(0, 0, -range));
    this.setFromPositions(view, camera.position);
  }
  copyObject3D(rig) {
    this.copy(rig, false);
    this.seaLevel.copy(rig.seaLevel, false);
    this.target.copy(rig.target, false);
    this.camera.copy(rig.camera);
    return this;
  }
  animateCameraToLookAtTarget(view, camera, params) {
    params.easing = params.easing || TWEEN.Easing.Quartic.InOut;
    this.setfromCamera(view, camera);
    const tweenGroup = new TWEEN.Group();
    this.start = (this.start || new CameraRig()).copyObject3D(this);
    this.end = (this.end || new CameraRig()).copyObject3D(this);
    const time = params.time || 2500;
    const factor = {
      t: 0
    };
    const animations = [];
    const def = deferred();
    this.addPlaceTargetOnGround(view, camera, params.coord, factor);
    this.end.applyParams(view, params);
    // compute the angle along z-axis between the starting position and the end position
    const difference = this.end.target.rotation.z - this.start.target.rotation.z;
    // if that angle is superior to 180°, recompute the rotation as the complementary angle.
    if (Math.abs(difference) > Math.PI) {
      this.end.target.rotation.z = this.start.target.rotation.z + difference - Math.sign(difference) * 2 * Math.PI;
    }
    animations.push(new TWEEN.Tween(factor).to({
      t: 1
    }, time).easing(params.easing).onUpdate(d => {
      // rotate to coord destination in geocentric projection
      if (view.referenceCrs == 'EPSG:4978') {
        this.quaternion.slerpQuaternions(this.start.quaternion, this.end.quaternion, d.t);
      }
      // camera rotation
      this.camera.quaternion.slerpQuaternions(this.start.camera.quaternion, this.end.camera.quaternion, d.t);
      // camera's target rotation
      this.target.rotation.set(0, 0, 0);
      this.target.rotateZ(THREE.MathUtils.lerp(this.start.target.rotation.z, this.end.target.rotation.z, d.t));
      this.target.rotateX(THREE.MathUtils.lerp(this.start.target.rotation.x, this.end.target.rotation.x, d.t));
    }));

    // translate to coordinate destination in planar projection
    if (view.referenceCrs != 'EPSG:4978') {
      animations.push(new TWEEN.Tween(this.position).to(this.end.position, time).easing(params.easing));
    }

    // translate to altitude zero
    animations.push(new TWEEN.Tween(this.seaLevel.position).to(this.end.seaLevel.position, time).easing(params.easing));

    // translate camera position
    animations.push(new TWEEN.Tween(this.camera.position).to(this.end.camera.position, time).easing(params.easing));
    tweenGroup.add(...animations);

    // update animations, transformation and view
    this.animationFrameRequester = () => {
      tweenGroup.update();
      this.updateMatrixWorld(true);
      this.applyTransformToCamera(view, camera);
      this.targetWorldPosition.setFromMatrixPosition(this.seaLevel.matrixWorld);
      if (params.callback) {
        params.callback(this);
      }
      targetCoord.crs = view.referenceCrs;
      targetCoord.setFromVector3(this.targetWorldPosition).as(tileLayer(view).extent.crs, this.coord);
      view.notifyChange(camera);
    };
    this.removeAll = function (o) {
      this.removeAll = () => {};
      tweenGroup.removeAll();
      if (this.animationFrameRequester) {
        view.removeFrameRequester(MAIN_LOOP_EVENTS.BEFORE_RENDER, this.animationFrameRequester);
      }
      def.resolve(o !== undefined);
      this.animationFrameRequester = null;
    };

    // Waiting last animation complete,
    // we assume that the animation that completes last is the one that was started last
    animations[animations.length - 1].onComplete(this.removeAll);
    animations.forEach(anim => anim.start());
    view.addFrameRequester(MAIN_LOOP_EVENTS.BEFORE_RENDER, this.animationFrameRequester);
    view.notifyChange(camera);
    return def;
  }
  stop(view) {
    this.removePlaceTargetOnGround(view);
    this.removeAll();
  }

  // update target position to coordinate's altitude
  addPlaceTargetOnGround(view, camera, coord) {
    let options = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {
      t: 1.0
    };
    this.removePlaceTargetOnGround(view);
    if (view && camera) {
      const startAltitude = this.target.position.z;
      this.placeTargetOnGround = () => {
        const altitude = Math.max(0, DEMUtils.getElevationValueAt(tileLayer(view), coord || this.coord, DEMUtils.PRECISE_READ_Z) || 0);
        this.target.position.z = startAltitude * (1.0 - options.t) + altitude * options.t;
        this.target.updateMatrixWorld(true);
        this.applyTransformToCamera(view, camera);
      };
      this.placeTargetOnGround();
      view.addFrameRequester(MAIN_LOOP_EVENTS.BEFORE_RENDER, this.placeTargetOnGround);
    }
  }
  removePlaceTargetOnGround(view) {
    if (view && this.placeTargetOnGround) {
      view.removeFrameRequester(MAIN_LOOP_EVENTS.BEFORE_RENDER, this.placeTargetOnGround);
      this.placeTargetOnGround = null;
    }
  }
  get tilt() {
    return THREE.MathUtils.radToDeg(this.target.rotation.x);
  }
  get heading() {
    return -wrapTo180(THREE.MathUtils.radToDeg(this.target.rotation.z) + 180);
  }
  get range() {
    return this.camera.position.y;
  }
}
export function getRig(camera) {
  rigs[camera.uuid] = rigs[camera.uuid] || new CameraRig();
  return rigs[camera.uuid];
}

/**
 * @module CameraUtils
 */
export default {
  /**
   * @typedef {Object} CameraTransformOptions
   * @property {Coordinate} [coord=currentCoordinate] Camera look at geographic coordinate
   * @property {Number} [tilt=currentTilt] camera's tilt, in degree
   * @property {Number} [heading=currentHeading] camera's heading, in degree
   * @property {Number} [range=currentRange] camera distance to target coordinate, in meter
   * @property {Number} [time=2500] duration of the animation, in ms
   * @property {boolean} [proxy=true] use proxy to handling camera's transformation. if proxy == true, other camera's transformation stops rig's transformation
   * @property {Number} [easing=TWEEN.Easing.Quartic.InOut] in and out easing animation
   * @property {function} [callback] callback call each animation's frame (params are current cameraTransform and worldTargetPosition)
   * @property {boolean} [stopPlaceOnGroundAtEnd=false] stop place target on the ground at animation ending
   */
  /**
   * Default value for option to stop place target
   * on the ground at animation ending.
   * Default value is false.
   */
  defaultStopPlaceOnGroundAtEnd: false,
  Easing: TWEEN.Easing,
  /**
   * Stop camera's animation
   *
   * @param      {View}  view    The camera view
   * @param      {Camera}  camera  The camera to stop animation
   */
  stop(view, camera) {
    getRig(camera).stop(view);
  },
  /**
   * Gets the current parameters transform camera looking at target.
   *
   * @param      {View}  view    The camera view
   * @param      {Camera}  camera  The camera to get transform
   * @param      {THREE.Vector3} [target] - The optional target
   * @return     {CameraUtils~CameraTransformOptions}  The transform camera looking at target
   */
  getTransformCameraLookingAtTarget(view, camera, target) {
    const rig = getRig(camera);
    rig.setfromCamera(view, camera, target);
    return rig.getParams();
  },
  /**
   * Apply transform to camera
   *
   * @param      {View}  view    The camera view
   * @param      {Camera}  camera  The camera to transform
   * @param      {CameraUtils~CameraTransformOptions|Extent}  params  The parameters
   * @return     {Promise} promise with resolve final CameraUtils~CameraTransformOptions
   */
  transformCameraToLookAtTarget(view, camera) {
    let params = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
    if (params.isExtent) {
      params = this.getCameraTransformOptionsFromExtent(view, camera, params);
    }
    params.proxy = params.proxy === undefined || params.proxy;
    const rig = getRig(camera);
    rig.stop(view);
    rig.setfromCamera(view, camera);
    if (params.proxy) {
      rig.setProxy(view, camera);
    }
    rig.applyParams(view, params);
    rig.addPlaceTargetOnGround(view, camera, params.coord);
    rig.applyTransformToCamera(view, camera);
    view.notifyChange(camera);
    return Promise.resolve(rig.getParams());
  },
  /**
   * Compute the CameraTransformOptions that allow a given camera to display a given extent in its entirety.
   *
   * @param   {View}    view    The camera view
   * @param   {THREE.Camera}  camera  The camera to get the CameraTransformOptions from
   * @param   {Extent}  extent  The extent the camera must display
   *
   * @return  {CameraUtils~CameraTransformOptions}   The CameraTransformOptions allowing camera to display the extent.
   */
  getCameraTransformOptionsFromExtent(view, camera, extent) {
    const cameraTransformOptions = {
      coord: new Coordinates(extent.crs, 0, 0, 0),
      heading: 0,
      tilt: view.isPlanarView ? 90 : 89.9
    };
    let dimensions;
    if (view.isGlobeView) {
      extent = extent.as('EPSG:4326');
      // compute extent's bounding box dimensions
      obb.setFromExtent(extent);
      // /!\ WARNING x and y are inverted, see issue #XXXX
      obb.box3D.getSize(size);
      dimensions = {
        x: size.y,
        y: size.x
      };
    } else {
      extent = extent.as(view.referenceCrs);
      dimensions = extent.planarDimensions();
    }
    extent.center(cameraTransformOptions.coord);
    if (camera.isOrthographicCamera) {
      // setup camera zoom
      if (dimensions.x / dimensions.y > camera.aspect) {
        camera.zoom = (camera.right - camera.left) / dimensions.x;
      } else {
        camera.zoom = (camera.top - camera.bottom) / dimensions.y;
      }
      camera.updateProjectionMatrix();

      // setup camera placement
      cameraTransformOptions.range = 1000;
    } else if (camera.isPerspectiveCamera) {
      // setup range for camera placement
      const verticalFOV = THREE.MathUtils.degToRad(camera.fov);
      if (dimensions.x / dimensions.y > camera.aspect) {
        const focal = view.domElement.clientHeight * 0.5 / Math.tan(verticalFOV * 0.5);
        const horizontalFOV = 2 * Math.atan(view.domElement.clientWidth * 0.5 / focal);
        cameraTransformOptions.range = dimensions.x / (2 * Math.tan(horizontalFOV * 0.5));
      } else {
        cameraTransformOptions.range = dimensions.y / (2 * Math.tan(verticalFOV * 0.5));
      }
    }
    return cameraTransformOptions;
  },
  /**
   * Apply transform to camera with animation
   *
   * @param      {View}  view    The camera view
   * @param      {Camera}  camera  The camera to animate
   * @param      {CameraUtils~CameraTransformOptions}  params  The parameters
   * @return     {Promise} promise with resolve final CameraUtils~CameraTransformOptions
   */
  animateCameraToLookAtTarget(view, camera) {
    let params = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
    params.proxy = params.proxy === undefined || params.proxy;
    const rig = getRig(camera);
    rig.stop(view);
    if (params.proxy) {
      rig.setProxy(view, camera);
    }
    return rig.animateCameraToLookAtTarget(view, camera, params).promise.then(finished => {
      const stopPlaceOnGround = params.stopPlaceOnGroundAtEnd === undefined ? this.defaultStopPlaceOnGroundAtEnd : params.stopPlaceOnGroundAtEnd;
      const newTransformation = rig.getParams();
      if (stopPlaceOnGround) {
        rig.stop(view);
      }
      newTransformation.finished = finished;
      return newTransformation;
    });
  },
  /**
   * chain animation transform to camera
   *
   * @param      {View}  view    The camera view
   * @param      {Camera}  camera  The camera to animate
   * @param      {CameraUtils~CameraTransformOptions[]}  params  array parameters, each parameters transforms are apply to camera, in serial
   * @return     {Promise} promise with resolve final CameraUtils~CameraTransformOptions
   */
  sequenceAnimationsToLookAtTarget(view, camera) {
    let params = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [{}];
    // convert each param to a function
    const funcs = params.map(param => () => this.animateCameraToLookAtTarget(view, camera, param));

    // execute Promises in serial
    return (funcs => funcs.reduce((promise, func) => promise.then(result => {
      const finished = result.length ? result[result.length - 1].finished : true;
      if (finished) {
        return func().then(Array.prototype.concat.bind(result));
      } else {
        return Promise.resolve([{
          finished: false
        }]);
      }
    }), Promise.resolve([])))(funcs);
  },
  /**
   * Gets the difference camera transformation
   *
   * @param      {CameraUtils~CameraTransformOptions}  first  param to compare with the second
   * @param      {CameraUtils~CameraTransformOptions}  second param to compare with the first
   * @return     {object} The difference parameters
   */
  getDiffParams(first, second) {
    if (!first || !second) {
      return;
    }
    let diff;
    if (Math.abs(first.range - second.range) / first.range > 0.001) {
      diff = diff || {};
      diff.range = {
        previous: first.range,
        new: second.range
      };
    }
    if (Math.abs(first.tilt - second.tilt) > 0.1) {
      diff = diff || {};
      diff.tilt = {
        previous: first.tilt,
        new: second.tilt
      };
    }
    if (Math.abs(first.heading - second.heading) > 0.1) {
      diff = diff || {};
      diff.heading = {
        previous: first.heading,
        new: second.heading
      };
    }
    if (Math.abs(first.coord.x - second.coord.x) > 0.000001 || Math.abs(first.coord.y - second.coord.y) > 0.000001) {
      diff = diff || {};
      diff.coord = {
        previous: first.coord,
        new: second.coord
      };
    }
    return diff;
  }
};