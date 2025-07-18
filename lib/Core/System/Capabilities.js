/* babel-plugin-inline-import '../../Renderer/Shader/SampleTestFS.glsl' */
const SampleTestFS = "uniform sampler2D uni[SAMPLE];\nvoid main() {\n    gl_FragColor += texture2D(uni[SAMPLE-1], vec2(0));\n}";
/* babel-plugin-inline-import '../../Renderer/Shader/SampleTestVS.glsl' */
const SampleTestVS = "void main() {\n    gl_Position = vec4( 0.0, 0.0, 0.0, 1.0 );\n}"; // default values
let logDepthBufferSupported = false;
let maxTexturesUnits = 8;
let maxTextureSize = 4096;
function _WebGLShader(renderer, type, string) {
  const gl = renderer.getContext();
  const shader = gl.createShader(type);
  gl.shaderSource(shader, string);
  gl.compileShader(shader);
  return shader;
}
function isFirefox() {
  return navigator && navigator.userAgent && navigator.userAgent.toLowerCase().includes('firefox');
}
export default {
  isLogDepthBufferSupported() {
    return logDepthBufferSupported;
  },
  isFirefox,
  getMaxTextureUnitsCount() {
    return maxTexturesUnits;
  },
  getMaxTextureSize() {
    return maxTextureSize;
  },
  updateCapabilities(renderer) {
    const gl = renderer.getContext();
    maxTexturesUnits = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
    maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    const program = gl.createProgram();
    const glVertexShader = _WebGLShader(renderer, gl.VERTEX_SHADER, SampleTestVS);
    let fragmentShader = `#define SAMPLE ${maxTexturesUnits}\n`;
    fragmentShader += SampleTestFS;
    const glFragmentShader = _WebGLShader(renderer, gl.FRAGMENT_SHADER, fragmentShader);
    gl.attachShader(program, glVertexShader);
    gl.attachShader(program, glFragmentShader);
    gl.linkProgram(program);
    if (gl.getProgramParameter(program, gl.LINK_STATUS) === false) {
      if (maxTexturesUnits > 16) {
        const info = gl.getProgramInfoLog(program);
        // eslint-disable-next-line no-console
        console.warn(`${info}: using a maximum of 16 texture units instead of the reported value (${maxTexturesUnits})`);
        if (isFirefox()) {
          // eslint-disable-next-line no-console
          console.warn(`It can come from a Mesa/Firefox bug;
                        the shader compiles to an error when using more than 16 sampler uniforms,
                        see https://bugzilla.mozilla.org/show_bug.cgi?id=777028`);
        }
        maxTexturesUnits = 16;
      } else {
        throw new Error(`The GPU capabilities could not be determined accurately.
                    Impossible to link a shader with the Maximum texture units ${maxTexturesUnits}`);
      }
    }
    gl.deleteProgram(program);
    gl.deleteShader(glVertexShader);
    gl.deleteShader(glFragmentShader);
    logDepthBufferSupported = renderer.capabilities.logarithmicDepthBuffer;
  }
};