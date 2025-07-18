/**
 * @author zz85 / https://github.com/zz85
 *
 * Based on "A Practical Analytic Model for Daylight"
 * aka The Preetham Model, the de facto standard analytic skydome model
 * http://www.cs.utah.edu/~shirley/papers/sunsky/sunsky.pdf
 *
 * First implemented by Simon Wallner
 * http://www.simonwallner.at/projects/atmospheric-scattering
 *
 * Improved by Martin Upitis
 * http://blenderartists.org/forum/showthread.php?245954-preethams-sky-impementation-HDR
 *
 * Three.js integration by zz85 http://twitter.com/blurspline
 */

import * as THREE from 'three';
const skyShader = {
  uniforms: {
    luminance: {
      type: 'f',
      value: 1
    },
    turbidity: {
      type: 'f',
      value: 2
    },
    reileigh: {
      type: 'f',
      value: 1
    },
    mieCoefficient: {
      type: 'f',
      value: 0.005
    },
    mieDirectionalG: {
      type: 'f',
      value: 0.8
    },
    v3LightPosition: {
      type: 'v3',
      value: new THREE.Vector3()
    },
    up: {
      type: 'v3',
      value: new THREE.Vector3(0.0, 1.0, 0.0)
    }
  },
  vertexShader: ['varying vec3 vWorldPosition;', 'void main() {', 'vec4 worldPosition = modelMatrix *  vec4( cameraPosition + position, 1.0 );', 'vWorldPosition = worldPosition.xyz;', 'gl_Position = projectionMatrix * modelViewMatrix * vec4( cameraPosition + position, 1.0 );', '}'].join('\n'),
  fragmentShader: ['uniform sampler2D skySampler;', 'uniform vec3 v3LightPosition;', 'uniform vec3 up;', 'varying vec3 vWorldPosition;',
  // "vec3 cameraPos = cameraPosition; //vec3(0., 0., 0.);",
  '// uniform sampler2D sDiffuse;', '// const float turbidity = 10.0; //', '// const float reileigh = 2.; //', '// const float luminance = 1.0; //', '// const float mieCoefficient = 0.005;', '// const float mieDirectionalG = 0.8;', 'uniform float luminance;', 'uniform float turbidity;', 'uniform float reileigh;', 'uniform float mieCoefficient;', 'uniform float mieDirectionalG;', '// constants for atmospheric scattering', 'const float e = 2.71828182845904523536028747135266249775724709369995957;', 'const float pi = 3.141592653589793238462643383279502884197169;', 'const float n = 1.0003; // refractive index of air', 'const float N = 2.545E25; // number of molecules per unit volume for air at', '// 288.15K and 1013mb (sea level -45 celsius)', 'const float pn = 0.035; // depolatization factor for standard air', '// wavelength of used primaries, according to preetham', 'const vec3 lambda = vec3(680E-9, 550E-9, 450E-9);', '// mie stuff', '// K coefficient for the primaries', 'const vec3 K = vec3(0.686, 0.678, 0.666);', 'const float v = 4.0;', '// optical length at zenith for molecules', 'const float rayleighZenithLength = 8.4E3;', 'const float mieZenithLength = 1.25E3;',
  // "const vec3 up = vec3(0.0, 1.0, 0.0);",

  'const float EE = 1000.0;', 'const float sunAngularDiameterCos = 0.999956676946448443553574619906976478926848692873900859324;', '// 66 arc seconds -> degrees, and the cosine of that', '// earth shadow hack', 'const float cutoffAngle = pi/1.95;', 'const float steepness = 1.5;', 'vec3 totalRayleigh(vec3 lambda)', '{', 'return (8.0 * pow(pi, 3.0) * pow(pow(n, 2.0) - 1.0, 2.0) * (6.0 + 3.0 * pn)) / (3.0 * N * pow(lambda, vec3(4.0)) * (6.0 - 7.0 * pn));', '}',
  // see http://blenderartists.org/forum/showthread.php?321110-Shaders-and-Skybox-madness
  '// A simplied version of the total Reayleigh scattering to works on browsers that use ANGLE', 'vec3 simplifiedRayleigh()', '{', 'return 0.0005 / vec3(94, 40, 18);',
  // return 0.00054532832366 / (3.0 * 2.545E25 * pow(vec3(680E-9, 550E-9, 450E-9), vec3(4.0)) * 6.245);
  '}', 'float rayleighPhase(float cosTheta)', '{ ', 'return (3.0 / (16.0*pi)) * (1.0 + pow(cosTheta, 2.0));', '// return (1.0 / (3.0*pi)) * (1.0 + pow(cosTheta, 2.0));', '// return (3.0 / 4.0) * (1.0 + pow(cosTheta, 2.0));', '}', 'vec3 totalMie(vec3 lambda, vec3 K, float T)', '{', 'float c = (0.2 * T ) * 10E-18;', 'return 0.434 * c * pi * pow((2.0 * pi) / lambda, vec3(v - 2.0)) * K;', '}', 'float hgPhase(float cosTheta, float g)', '{', 'return (1.0 / (4.0*pi)) * ((1.0 - pow(g, 2.0)) / pow(1.0 - 2.0*g*cosTheta + pow(g, 2.0), 1.5));', '}', 'float sunIntensity(float zenithAngleCos)', '{', 'return EE * max(0.0, 1.0 - exp(-((cutoffAngle - acos(zenithAngleCos))/steepness)));', '}', '// float logLuminance(vec3 c)', '// {', '//     return log(c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722);', '// }', '// Filmic ToneMapping http://filmicgames.com/archives/75', 'float A = 0.15;', 'float B = 0.50;', 'float C = 0.10;', 'float D = 0.20;', 'float E = 0.02;', 'float F = 0.30;', 'float W = 1000.0;', 'vec3 Uncharted2Tonemap(vec3 x)', '{', 'return ((x*(A*x+C*B)+D*E)/(x*(A*x+B)+D*F))-E/F;', '}', 'void main() ', '{', 'vec3 up2 = normalize(cameraPosition.xyz);', 'float sunfade = 1.0-clamp(1.0-exp((v3LightPosition.y/450000.0)),0.0,1.0);', 'float reileighCoefficient = reileigh - (1.0* (1.0-sunfade));', 'vec3 sunDirection = normalize(v3LightPosition);', 'float sunE = sunIntensity(dot(sunDirection, up2));', '// extinction (absorbtion + out scattering) ', '// rayleigh coefficients',
  // "vec3 betaR = totalRayleigh(lambda) * reileighCoefficient;",
  'vec3 betaR = simplifiedRayleigh() * reileighCoefficient;', '// mie coefficients', 'vec3 betaM = totalMie(lambda, K, turbidity) * mieCoefficient;', '// optical length', '// cutoff angle at 90 to avoid singularity in next formula.', 'float zenithAngle = acos(max(0.0, dot(up2, normalize(vWorldPosition - cameraPosition))));', 'float sR = rayleighZenithLength / (cos(zenithAngle) + 0.15 * pow(93.885 - ((zenithAngle * 180.0) / pi), -1.253));', 'float sM = mieZenithLength / (cos(zenithAngle) + 0.15 * pow(93.885 - ((zenithAngle * 180.0) / pi), -1.253));', '// combined extinction factor', 'vec3 Fex = exp(-(betaR * sR + betaM * sM));', '// in scattering', 'float cosTheta = dot(normalize(vWorldPosition - cameraPosition), sunDirection);', 'float rPhase = rayleighPhase(cosTheta*0.5+0.5);', 'vec3 betaRTheta = betaR * rPhase;', 'float mPhase = hgPhase(cosTheta, mieDirectionalG);', 'vec3 betaMTheta = betaM * mPhase;', 'vec3 Lin = pow(sunE * ((betaRTheta + betaMTheta) / (betaR + betaM)) * (1.0 - Fex),vec3(1.5));', 'Lin *= mix(vec3(1.0),pow(sunE * ((betaRTheta + betaMTheta) / (betaR + betaM)) * Fex,vec3(1.0/2.0)),clamp(pow(1.0-dot(up2, sunDirection),5.0),0.0,1.0));', '//nightsky', 'vec3 direction = normalize(vWorldPosition - cameraPosition);', 'float theta = acos(direction.y); // elevation --> y-axis, [-pi/2, pi/2]', 'float phi = atan(direction.z, direction.x); // azimuth --> x-axis [-pi/2, pi/2]', 'vec2 uv = vec2(phi, theta) / vec2(2.0*pi, pi) + vec2(0.5, 0.0);', '// vec3 L0 = texture2D(skySampler, uv).rgb+0.1 * Fex;', 'vec3 L0 = vec3(0.1) * Fex;', '// composition + solar disc', '//if (cosTheta > sunAngularDiameterCos)', 'float sundisk = smoothstep(sunAngularDiameterCos,sunAngularDiameterCos+0.00002,cosTheta);', '// if (normalize(vWorldPosition - cameraPosition).y>0.0)', 'L0 += (sunE * 19000.0 * Fex)*sundisk;', 'vec3 whiteScale = 1.0/Uncharted2Tonemap(vec3(W));', 'vec3 texColor = (Lin+L0);   ', 'texColor *= 0.04 ;', 'texColor += vec3(0.0,0.001,0.0025)*0.3;', 'float g_fMaxLuminance = 1.0;', 'float fLumScaled = 0.1 / luminance;     ', 'float fLumCompressed = (fLumScaled * (1.0 + (fLumScaled / (g_fMaxLuminance * g_fMaxLuminance)))) / (1.0 + fLumScaled); ', 'float ExposureBias = fLumCompressed;', 'vec3 curr = Uncharted2Tonemap((log2(2.0/pow(luminance,4.0)))*texColor);', 'vec3 color = curr*whiteScale;', 'vec3 retColor = pow(color,vec3(1.0/(1.2+(1.2*sunfade))));', 'gl_FragColor.rgb = retColor;', 'gl_FragColor.a = 1. - ( (length(cameraPosition) - 6400000.) / 1000.);', '}'].join('\n')
};
class Sky extends THREE.Mesh {
  constructor() {
    const skyUniforms = THREE.UniformsUtils.clone(skyShader.uniforms);
    const skyMat = new THREE.ShaderMaterial({
      fragmentShader: skyShader.fragmentShader,
      vertexShader: skyShader.vertexShader,
      uniforms: skyUniforms,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false
    });
    const skyGeo = new THREE.SphereGeometry(40000, 32, 15);
    super(skyGeo, skyMat);
  }
}
export default Sky;