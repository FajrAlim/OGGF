import Source from "./Source.js";
import Fetcher from "../Provider/Fetcher.js";

/**
 * OrientedImageSource is a specific source used to load oriented images.
 * @extends Source
 */
class OrientedImageSource extends Source {
  /**
   * @param { Object } source - Configuration object
   * @param { string } source.url - Url for all the textures.
   * @param { string } source.orientationsUrl - Json Url, using GeoJSon format to represent points,
   * it's a set of panoramic position and orientation.
   * @param { string } source.calibrationUrl - Json url, representing a set of camera.
   * see {@link CameraCalibrationParser}
   * This Url must contains {sensorId} and {cameraId}, and these pattern will be replaced to build the Url,
   * to find the good texture for each camera for each panoramic.
   */
  constructor(source) {
    super(source);
    this.isOrientedImageSource = true;

    // Fetch the two files
    const promises = [];
    promises.push(source.orientationsUrl ? Fetcher.json(source.orientationsUrl, this.networkOptions) : Promise.resolve());
    promises.push(source.calibrationUrl ? Fetcher.json(source.calibrationUrl, this.networkOptions) : Promise.resolve());
    this.whenReady = Promise.all(promises).then(data => ({
      orientation: data[0],
      calibration: data[1]
    }));
  }

  /**
   * Build the url of the texture, but not from extent.
   *
   * @param      {Object}  imageInfo - Information about the texture
   * @param      {string}  imageInfo.camera - Id of the camera
   * @param      {string}  imageInfo.pano - Id of the panoramic
   * @return     {string}  Url of the image
   */
  urlFromExtent(imageInfo) {
    return this.imageUrl(imageInfo.cameraId, imageInfo.panoId);
  }
  getDataKey(image) {
    return `c${image.cameraId}p${image.panoId}`;
  }

  /**
   * Build the url of the image, for a given panoramic id, and a given camera id.
   *
   * @param      {string}  cameraId  Id of the camera
   * @param      {string}  panoId   Id of the panoramic
   * @return     {string}  Url of the image
   */
  imageUrl(cameraId, panoId) {
    return this.url.replace('{cameraId}', cameraId).replace('{panoId}', panoId);
  }
}
export default OrientedImageSource;