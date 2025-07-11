import Layer from "./Layer.js";
import { removeLayeredMaterialNodeLayer } from "../Process/LayeredMaterialNodeProcessing.js";
import textureConverter from "../Converter/textureConverter.js";
import { CACHE_POLICIES } from "../Core/Scheduler/Cache.js";
class RasterLayer extends Layer {
  constructor(id, config) {
    const {
      cacheLifeTime = CACHE_POLICIES.TEXTURE,
      minFilter,
      magFilter,
      ...layerConfig
    } = config;
    super(id, {
      ...layerConfig,
      cacheLifeTime
    });
    this.minFilter = minFilter;
    this.magFilter = magFilter;
  }
  convert(data, extentDestination) {
    return textureConverter.convert(data, extentDestination, this);
  }

  /**
  * All layer's textures are removed from scene and disposed from video device.
  * @param {boolean} [clearCache=false] Whether to clear the layer cache or not
  */
  delete(clearCache) {
    if (clearCache) {
      this.cache.clear();
    }
    for (const root of this.parent.level0Nodes) {
      root.traverse(removeLayeredMaterialNodeLayer(this.id));
    }
  }
}
export default RasterLayer;