import * as THREE from 'three';
/* babel-plugin-inline-import './Chunk/color_layers_pars_fragment.glsl' */
const color_layers_pars_fragment = "struct Layer {\n    int textureOffset;\n    int crs;\n    int effect_type;\n    float effect_parameter;\n    float opacity;\n    bool transparent;\n};\n\n#include <itowns/custom_header_colorLayer>\n\nuniform sampler2D   colorTextures[NUM_FS_TEXTURES];\nuniform vec4        colorOffsetScales[NUM_FS_TEXTURES];\nuniform Layer       colorLayers[NUM_FS_TEXTURES];\nuniform int         colorTextureCount;\n\nvec3 uvs[NUM_CRS];\n\nfloat getBorderDistance(vec2 uv) {\n    vec2 p2 = min(uv, 1. -uv);\n    return min(p2.x, p2.y);\n}\n\nfloat tolerance = 0.99;\n\nvec4 applyWhiteToInvisibleEffect(vec4 color) {\n    float a = dot(color.rgb, vec3(0.333333333));\n    if (a >= tolerance) {\n        color.a = 0.0;\n    }\n    return color;\n}\n\nvec4 applyLightColorToInvisibleEffect(vec4 color, float intensity) {\n    float a = max(0.05,1. - length(color.xyz - 1.));\n    color.a *= 1.0 - pow(abs(a), intensity);\n    color.rgb *= color.rgb * color.rgb;\n    return color;\n}\n\n#if defined(DEBUG)\nuniform bool showOutline;\nuniform vec3 outlineColors[NUM_CRS];\nuniform float outlineWidth;\n\nvec4 getOutlineColor(vec3 outlineColor, vec2 uv) {\n    float alpha = 1. - clamp(getBorderDistance(uv) / outlineWidth, 0., 1.);\n    return vec4(outlineColor, alpha);\n}\n#endif\n\nuniform float minBorderDistance;\nvec4 getLayerColor(int textureOffset, sampler2D tex, vec4 offsetScale, Layer layer) {\n    if ( textureOffset >= colorTextureCount ) return vec4(0);\n\n    vec3 uv;\n    // #pragma unroll_loop\n    for ( int i = 0; i < NUM_CRS; i ++ ) {\n        if ( i == layer.crs ) uv = uvs[ i ];\n    }\n\n    float borderDistance = getBorderDistance(uv.xy);\n    if (textureOffset != layer.textureOffset + int(uv.z) || borderDistance < minBorderDistance ) return vec4(0);\n    vec4 color = texture2D(tex, pitUV(uv.xy, offsetScale));\n    if (layer.effect_type == 3) {\n        #include <itowns/custom_body_colorLayer>\n    } else {\n        if (layer.transparent && color.a != 0.0) {\n            color.rgb /= color.a;\n        }\n\n        if (layer.effect_type == 1) {\n            color = applyLightColorToInvisibleEffect(color, layer.effect_parameter);\n        } else if (layer.effect_type == 2) {\n            color = applyWhiteToInvisibleEffect(color);\n        }\n    }\n    color.a *= layer.opacity;\n    return color;\n}\n";
/* babel-plugin-inline-import './Chunk/elevation_pars_vertex.glsl' */
const elevation_pars_vertex = "#if NUM_VS_TEXTURES > 0\n    struct Layer {\n        float scale;\n        float bias;\n        int mode;\n        float zmin;\n        float zmax;\n    };\n\n    uniform Layer       elevationLayers[NUM_VS_TEXTURES];\n    uniform sampler2D   elevationTextures[NUM_VS_TEXTURES];\n    uniform vec4        elevationOffsetScales[NUM_VS_TEXTURES];\n    uniform int         elevationTextureCount;\n    uniform float       geoidHeight;\n\n    highp float decode32(highp vec4 rgba) {\n        highp float Sign = 1.0 - step(128.0,rgba[0])*2.0;\n        highp float Exponent = 2.0 * mod(rgba[0],128.0) + step(128.0,rgba[1]) - 127.0;\n        highp float Mantissa = mod(rgba[1],128.0)*65536.0 + rgba[2]*256.0 +rgba[3] + float(0x800000);\n        highp float Result =  Sign * exp2(Exponent) * (Mantissa * exp2(-23.0 ));\n        return Result;\n    }\n\n    float getElevationMode(vec2 uv, sampler2D tex, int mode) {\n        if (mode == ELEVATION_RGBA)\n            return decode32(texture2D( tex, uv ).abgr * 255.0);\n        if (mode == ELEVATION_DATA || mode == ELEVATION_COLOR)\n            return texture2D( tex, uv ).r;\n        return 0.;\n    }\n\n    float getElevation(vec2 uv, sampler2D tex, vec4 offsetScale, Layer layer) {\n        // Elevation textures are inverted along the y-axis\n        uv = vec2(uv.x, 1.0 - uv.y);\n        uv = uv * offsetScale.zw + offsetScale.xy;\n        float d = clamp(getElevationMode(uv, tex, layer.mode), layer.zmin, layer.zmax);\n        return d * layer.scale + layer.bias;\n    }\n#endif\n";
/* babel-plugin-inline-import './Chunk/elevation_vertex.glsl' */
const elevation_vertex = "#if NUM_VS_TEXTURES > 0\n    if(elevationTextureCount > 0) {\n        float elevation = getElevation(uv, elevationTextures[0], elevationOffsetScales[0], elevationLayers[0]);\n        transformed += elevation * normal;\n    }\n#endif\n";
/* babel-plugin-inline-import './Chunk/geoid_vertex.glsl' */
const geoid_vertex = "transformed += geoidHeight * normal;\n";
/* babel-plugin-inline-import './Chunk/fog_fragment.glsl' */
const fog_fragment = "#if defined(USE_FOG)\n    float fogFactor = 1. - min( exp(-vFogDepth / fogDistance), 1.);\n    gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor);\n#endif\n";
/* babel-plugin-inline-import './Chunk/fog_pars_fragment.glsl' */
const fog_pars_fragment = "#if defined(USE_FOG)\nuniform vec3  fogColor;\nuniform float fogDistance;\nvarying float vFogDepth;\n#endif\n";
/* babel-plugin-inline-import './Chunk/lighting_fragment.glsl' */
const lighting_fragment = "if (lightingEnabled) {\n    float light = min(2. * dot(vNormal, lightPosition), 1.);\n    gl_FragColor.rgb *= light;\n}\n";
/* babel-plugin-inline-import './Chunk/lighting_pars_fragment.glsl' */
const lighting_pars_fragment = "uniform bool lightingEnabled;\nuniform vec3 lightPosition;\nvarying vec3 vNormal;\n";
/* babel-plugin-inline-import './Chunk/mode_pars_fragment.glsl' */
const mode_pars_fragment = "#if MODE == MODE_ID || MODE == MODE_DEPTH\n#include <packing>\n#endif\n\n#if MODE == MODE_ID\nuniform int objectId;\n#endif\n";
/* babel-plugin-inline-import './Chunk/mode_depth_fragment.glsl' */
const mode_depth_fragment = "#if defined(USE_LOGDEPTHBUF)\ngl_FragColor = packDepthToRGBA(gl_FragDepthEXT);\n#else\nfloat fragCoordZ = 0.5 * vHighPrecisionZW[0] / vHighPrecisionZW[1] + 0.5;\ngl_FragColor = packDepthToRGBA(fragCoordZ);\n#endif\n";
/* babel-plugin-inline-import './Chunk/mode_id_fragment.glsl' */
const mode_id_fragment = "// 16777216.0 == 256.0 * 256.0 * 256.0\ngl_FragColor = packDepthToRGBA(float(objectId) / 16777216.0);\n";
/* babel-plugin-inline-import './Chunk/overlay_fragment.glsl' */
const overlay_fragment = "gl_FragColor.rgb = mix(gl_FragColor.rgb, overlayColor, overlayAlpha);\n";
/* babel-plugin-inline-import './Chunk/overlay_pars_fragment.glsl' */
const overlay_pars_fragment = "uniform vec3  overlayColor;\nuniform float overlayAlpha;\n";
/* babel-plugin-inline-import './Chunk/pitUV.glsl' */
const pitUV = "vec2 pitUV(vec2 uv, vec4 pit)\n{\n    return uv * pit.zw + vec2(pit.x, 1.0 - pit.w - pit.y);\n}\n\n";
/* babel-plugin-inline-import './Chunk/precision_qualifier.glsl' */
const precision_qualifier = "precision highp float;\nprecision highp int;\n";
/* babel-plugin-inline-import './Chunk/projective_texturing_vertex.glsl' */
const projective_texturing_vertex = "for(int i = 0; i < ORIENTED_IMAGES_COUNT; ++i)\n    projectiveTextureCoords[i] = projectiveTextureMatrix[i] * mvPosition;\n";
/* babel-plugin-inline-import './Chunk/projective_texturing_pars_vertex.glsl' */
const projective_texturing_pars_vertex = "uniform mat4 projectiveTextureMatrix[ORIENTED_IMAGES_COUNT];\nvarying vec4 projectiveTextureCoords[ORIENTED_IMAGES_COUNT];\n";
/* babel-plugin-inline-import './Chunk/projective_texturing_pars_fragment.glsl' */
const projective_texturing_pars_fragment = "uniform sampler2D projectiveTexture[ORIENTED_IMAGES_COUNT];\nuniform sampler2D mask[ORIENTED_IMAGES_COUNT];\nvarying vec4      projectiveTextureCoords[ORIENTED_IMAGES_COUNT];\nuniform float     projectiveTextureAlphaBorder;\nuniform float     opacity;\nuniform bool      boostLight;\n\nstruct Distortion {\n    vec2 size;\n#if USE_DISTORTION\n    vec2 pps;\n    vec4 polynom;\n    vec3 l1l2;\n#endif\n};\n\nuniform Distortion projectiveTextureDistortion[ORIENTED_IMAGES_COUNT];\n\nfloat getAlphaBorder(vec2 p)\n{\n    vec2 d = clamp(projectiveTextureAlphaBorder * min(p, 1. - p), 0., 1.);\n    return min(d.x, d.y);\n}\n\n#if USE_DISTORTION\nvoid distort(inout vec2 p, vec4 polynom, vec2 pps)\n{\n    vec2 v = p - pps;\n    float v2 = dot(v, v);\n    if (v2 > polynom.w) {\n        p = vec2(-1.);\n    }\n    else {\n        p += (v2 * (polynom.x + v2 * (polynom.y + v2 * polynom.z) ) ) * v;\n    }\n}\n\nvoid distort(inout vec2 p, vec4 polynom, vec3 l1l2, vec2 pps)\n{\n    if ((l1l2.x == 0.) && (l1l2.y == 0.)) {\n        distort(p, polynom, pps);\n    } else {\n        vec2 AB = (p - pps) / l1l2.z;\n        float R = length(AB);\n        float lambda = atan(R) / R;\n        vec2 ab = lambda * AB;\n        float rho2 = dot(ab, ab);\n        float r357 = 1. + rho2* (polynom.x + rho2* (polynom.y + rho2 * polynom.z));\n        p = pps + l1l2.z * (r357 * ab + vec2(dot(l1l2.xy, ab), l1l2.y * ab.x));\n    }\n}\n#endif\n\nvec4 mixBaseColor(vec4 aColor, vec4 baseColor) {\n    #ifdef USE_BASE_MATERIAL\n        baseColor.rgb = aColor.a == 1.0 ? aColor.rgb : mix(baseColor, aColor, aColor.a).rgb;\n        baseColor.a = min(1.0, aColor.a + baseColor.a);\n    #else\n        baseColor.rgb += aColor.rgb * aColor.a;\n        baseColor.a += aColor.a;\n    #endif\n    return baseColor;\n}\n\nvec4 projectiveTextureColor(vec4 coords, Distortion distortion, sampler2D tex, sampler2D mask, vec4 baseColor) {\n    vec3 p = coords.xyz / coords.w;\n    if(p.z * p.z < 1.) {\n#if USE_DISTORTION\n        p.xy *= distortion.size;\n        distort(p.xy, distortion.polynom, distortion.l1l2, distortion.pps);\n        p.xy /= distortion.size;\n#endif\n\n        float d = getAlphaBorder(p.xy) * texture2D(mask, p.xy).r;\n\n        if(d > 0.) {\n\n#if DEBUG_ALPHA_BORDER\n        vec3 r = texture2D(tex, p.xy).rgb;\n        return mixBaseColor(vec4( r.r * d, r.g, r.b, 1.0), baseColor);\n#else\n        vec4 color = texture2D(tex, p.xy);\n        color.a *= d;\n        if (boostLight) {\n            return mixBaseColor(vec4(sqrt(color.rgb), color.a), baseColor);\n        } else {\n            return mixBaseColor(color, baseColor);\n        }\n#endif\n\n        }\n    }\n    return mixBaseColor(vec4(0.), baseColor);\n}\n";
const custom_header_colorLayer = '// no custom header';
const custom_body_colorLayer = '// no custom body';
const itownsShaderChunk = {
  color_layers_pars_fragment,
  custom_body_colorLayer,
  custom_header_colorLayer,
  elevation_pars_vertex,
  elevation_vertex,
  geoid_vertex,
  fog_fragment,
  fog_pars_fragment,
  lighting_fragment,
  lighting_pars_fragment,
  mode_depth_fragment,
  mode_id_fragment,
  mode_pars_fragment,
  overlay_fragment,
  overlay_pars_fragment,
  pitUV,
  precision_qualifier,
  projective_texturing_vertex,
  projective_texturing_pars_vertex,
  projective_texturing_pars_fragment
};

/**
 * The ShaderChunkManager manages the itowns chunks shader.
 * It adds chunks to THREE.ShaderChunk to compile shaders
 *
 * In itowns, if you want access to `ShaderChunkManager` instance :
 *
 * ```js
 * import ShaderChunk from 'Renderer/Shader/ShaderChunk';
 * ```
 * or
 * ```js
 * const ShaderChunk = itowns.ShaderChunk';
 * ```
 *
 * @property {Object} target - The target to install the chunks into.
 * @property {string} [path] - A path to add before a chunk name as a prefix.
 *
 */
class ShaderChunkManager {
  /**
   * Constructs a new instance ShaderChunkManager.
   *
   * @constructor
   *
   * @param {Object} target - The target to install the chunks into.
   * @param {string} [path] - A path to add before a chunk name as a prefix.
   *
   */
  constructor(target, path) {
    this.path = path;
    this.target = target;
    this.install();
  }
  /**
   * Set the header ColorLayer shader.
   *
   * @param  {string}  header  The glsl header
   */
  customHeaderColorLayer(header) {
    itownsShaderChunk.custom_header_colorLayer = header;
    this.target[`${this.path}custom_header_colorLayer`] = header;
  }

  /**
   * Set the body ColorLayer shader.
   * You could define you color terrain shader, with a header and a body.
   * the header defines yours fonctions and the body defines the process on ColorLayer.
   * @example <caption>Custom shader chunk</caption>
   *  itowns.ShaderChunk.customHeaderColorLayer(`
   *  // define yours methods
   *  vec4 myColor(vec4 color, float a) {
   *      return color * a;
   *  }
   * `);
   * itowns.ShaderChunk.customBodyColorLayer(`
   *  // the body set final color layer.
   *  // layer.amount_effect is variable, it could be change in Layer instance.
   *  color = myColor(color, layer.amount_effect)
   * `);
   *
   *  var colorLayer = new itowns.ColorLayer('OPENSM', {
   *    source,
   *    type_effect: itowns.colorLayerEffects.customEffect,
   *    amount_effect: 0.5,
   *  });
   *
   * @param  {string}  body  The glsl body
   */
  customBodyColorLayer(body) {
    itownsShaderChunk.custom_body_colorLayer = body;
    this.target[`${this.path}custom_body_colorLayer`] = body;
  }
  /**
   * Install chunks in a target, for example THREE.ShaderChunk, with adding an
   * optional path.
   *
   * @param {Object} target - The target to install the chunks into.
   * @param {Object} chunks - The chunks to install. The key of each chunk will be
   * the name of installation of the chunk in the target (plus an optional path).
   * @param {string} [path] - A path to add before a chunk name as a prefix.
   *
   * @return {Object} The target with installed chunks.
   */
  install() {
    let target = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : this.target;
    let chunks = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : itownsShaderChunk;
    let path = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : this.path;
    Object.keys(chunks).forEach(key => {
      Object.defineProperty(this, key, {
        get: () => chunks[key]
      });
      target[path + key] = chunks[key];
    });
    return target;
  }
}
const ShaderChunk = new ShaderChunkManager(THREE.ShaderChunk, 'itowns/');
export default ShaderChunk;