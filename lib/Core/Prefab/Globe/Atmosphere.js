import * as THREE from 'three';
import GeometryLayer from "../../../Layer/GeometryLayer.js";
import { Coordinates, ellipsoidSizes, CoordStars } from '@itowns/geographic';
import Sky from "./SkyShader.js";
/* babel-plugin-inline-import './Shaders/skyFS.glsl' */
const skyFS = "uniform vec3 v3LightPos;\nuniform float g;\nuniform float g2;\n\nvarying vec3 v3Direction;\nvarying vec3 c0;\nvarying vec3 c1;\n\n// Calculates the Mie phase function\nfloat getMiePhase(float fCos, float fCos2, float g, float g2) {\n    return 1.5 * ((1.0 - g2) / (2.0 + g2)) * (1.0 + fCos2) / pow(1.0 + g2 - 2.0 * g * fCos, 1.5);\n}\n\n// Calculates the Rayleigh phase function\nfloat getRayleighPhase(float fCos2) {\n    return 0.75 + 0.75 * fCos2;\n}\n\nvoid main (void) {\n    float fCos = dot(v3LightPos, v3Direction) / length(v3Direction);\n    float fCos2 = fCos * fCos;\n\n    vec3 color = getRayleighPhase(fCos2) * c0 + getMiePhase(fCos, fCos2, g, g2) * c1;\n\n    gl_FragColor = vec4(color, 1.0);\n    gl_FragColor.a = gl_FragColor.b;\n}";
/* babel-plugin-inline-import './Shaders/skyVS.glsl' */
const skyVS = "uniform vec3 v3LightPosition;   // The direction vector to the light source\nuniform vec3 v3InvWavelength;   // 1 / pow(wavelength, 4) for the red, green, and blue channels\nuniform float fCameraHeight;    // The camera's current height\nuniform float fCameraHeight2;   // fCameraHeight^2\nuniform float fOuterRadius;     // The outer (atmosphere) radius\nuniform float fOuterRadius2;    // fOuterRadius^2\nuniform float fInnerRadius;     // The inner (planetary) radius\nuniform float fInnerRadius2;    // fInnerRadius^2\nuniform float fKrESun;          // Kr * ESun\nuniform float fKmESun;          // Km * ESun\nuniform float fKr4PI;           // Kr * 4 * PI\nuniform float fKm4PI;           // Km * 4 * PI\nuniform float fScale;           // 1 / (fOuterRadius - fInnerRadius)\nuniform float fScaleDepth;      // The scale depth (i.e. the altitude at which the atmosphere's average density is found)\nuniform float fScaleOverScaleDepth; // fScale / fScaleDepth\n\nconst int nSamples = 3;\nconst float fSamples = 3.0;\n\nvarying vec3 v3Direction;\nvarying vec3 c0;\nvarying vec3 c1;\n\nfloat scale(float fCos) {\n    float x = 1.0 - fCos;\n    return fScaleDepth * exp(-0.00287 + x*(0.459 + x*(3.83 + x*(-6.80 + x*5.25))));\n}\n\nvoid main(void) {\n    float lengthCamera = length(cameraPosition);\n    float cameraHeight2 = lengthCamera * lengthCamera;\n\n    // Get the ray from the camera to the vertex and its length (which is the far point of the ray passing through the atmosphere)\n    vec3 v3Ray = position - cameraPosition;\n    float fFar = length(v3Ray);\n    v3Ray /= fFar;\n\n    // Calculate the closest intersection of the ray with the outer atmosphere (which is the near point of the ray passing through the atmosphere)\n    float B = 2.0 * dot(cameraPosition, v3Ray);\n    float C = cameraHeight2 - fOuterRadius2;\n    float fDet = max(0.0, B*B - 4.0 * C);\n    float fNear = 0.5 * (-B - sqrt(fDet));\n\n    // Calculate the ray's starting position, then calculate its scattering offset\n    vec3 v3Start = cameraPosition + v3Ray * fNear;\n    fFar -= fNear;\n    float fStartAngle = dot(v3Ray, v3Start) / fOuterRadius;\n    float fStartDepth = exp(-1.0 / fScaleDepth);\n    float fStartOffset = fStartDepth * scale(fStartAngle);\n\n    // Initialize the scattering loop variables\n    float fSampleLength = fFar / fSamples;\n    float fScaledLength = fSampleLength * fScale;\n    vec3 v3SampleRay = v3Ray * fSampleLength;\n    vec3 v3SamplePoint = v3Start + v3SampleRay * 0.5;\n\n    // Now loop through the sample rays\n    vec3 v3FrontColor = vec3(0.0, 0.0, 0.0);\n    for(int i=0; i<nSamples; i++)\n    {\n        float fHeight = length(v3SamplePoint);\n        float fDepth = exp(fScaleOverScaleDepth * (fInnerRadius - fHeight));\n        float fLightAngle = dot(v3LightPosition, v3SamplePoint) / fHeight;\n        float fCameraAngle = dot(v3Ray, v3SamplePoint) / fHeight;\n        float fScatter = (fStartOffset + fDepth * (scale(fLightAngle) - scale(fCameraAngle)));\n        vec3 v3Attenuate = exp(-fScatter * (v3InvWavelength * fKr4PI + fKm4PI));\n\n        v3FrontColor += v3Attenuate * (fDepth * fScaledLength);\n        v3SamplePoint += v3SampleRay;\n    }\n\n    // Finally, scale the Mie and Rayleigh colors and set up the varying variables for the pixel shader\n    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n    c0 = v3FrontColor * (v3InvWavelength * fKrESun);\n    c1 = v3FrontColor * fKmESun;\n    v3Direction = cameraPosition - position;\n}";
/* babel-plugin-inline-import './Shaders/groundFS.glsl' */
const groundFS = "varying vec3 c0;\nvarying vec3 c1;\n\nvoid main (void) {\n\tgl_FragColor = vec4(c1, 1.0 - c0/4.);\n}";
/* babel-plugin-inline-import './Shaders/groundVS.glsl' */
const groundVS = "uniform vec3 v3LightPosition;   // The direction vector to the light source\nuniform vec3 v3InvWavelength;   // 1 / pow(wavelength, 4) for the red, green, and blue channels\nuniform float fCameraHeight;    // The camera's current height\nuniform float fCameraHeight2;   // fCameraHeight^2\nuniform float fOuterRadius;     // The outer (atmosphere) radius\nuniform float fOuterRadius2;    // fOuterRadius^2\nuniform float fInnerRadius;     // The inner (planetary) radius\nuniform float fInnerRadius2;    // fInnerRadius^2\nuniform float fKrESun;          // Kr * ESun\nuniform float fKmESun;          // Km * ESun\nuniform float fKr4PI;           // Kr * 4 * PI\nuniform float fKm4PI;           // Km * 4 * PI\nuniform float fScale;           // 1 / (fOuterRadius - fInnerRadius)\nuniform float fScaleDepth;      // The scale depth (i.e. the altitude at which the atmosphere's average density is found)\nuniform float fScaleOverScaleDepth; // fScale / fScaleDepth\n\nvarying vec3 c0;\nvarying vec3 c1;\n\nconst int nSamples = 3;\nconst float fSamples = 3.0;\n\nfloat scale(float fCos)\n{\n    float x = 1.0 - fCos;\n    return fScaleDepth * exp(-0.00287 + x*(0.459 + x*(3.83 + x*(-6.80 + x*5.25))));\n}\n\nvoid main(void) {\n\n     float cameraHeight2 = length(cameraPosition) * length(cameraPosition);\n\n    // Get the ray from the camera to the vertex and its length (which is the far point of the ray passing through the atmosphere)\n    vec3 v3Ray = position - cameraPosition;\n    float fFar = length(v3Ray);\n    v3Ray /= fFar;\n\n    // Calculate the closest intersection of the ray with the outer atmosphere (which is the near point of the ray passing through the atmosphere)\n    float B = 2.0 * dot(cameraPosition, v3Ray);\n    float C = cameraHeight2 - fOuterRadius2;\n    float fDet = max(0.0, B*B - 4.0 * C);\n    float fNear = 0.5 * (-B - sqrt(fDet));\n\n    // Calculate the ray's starting position, then calculate its scattering offset\n    vec3 v3Start = cameraPosition + v3Ray * fNear;\n    fFar -= fNear;\n    float fDepth = exp((fInnerRadius - fOuterRadius) / fScaleDepth);\n    float fCameraAngle = dot(-v3Ray, position) / length(position);\n    float fLightAngle = dot(v3LightPosition, position) / length(position);\n    float fCameraScale = scale(fCameraAngle);\n    float fLightScale = scale(fLightAngle);\n    float fCameraOffset = fDepth*fCameraScale;\n    float fTemp = (fLightScale + fCameraScale);\n\n    // Initialize the scattering loop variables\n    float fSampleLength = fFar / fSamples;\n    float fScaledLength = fSampleLength * fScale;\n    vec3 v3SampleRay = v3Ray * fSampleLength;\n    vec3 v3SamplePoint = v3Start + v3SampleRay * 0.5;\n\n    // Now loop through the sample rays\n    vec3 v3FrontColor = vec3(0.0, 0.0, 0.0);\n    vec3 v3Attenuate = vec3(0.0, 0.0, 0.0);\n    for(int i=0; i<nSamples; i++)\n    {\n        float fHeight = length(v3SamplePoint);\n        float fDepth = exp(fScaleOverScaleDepth * (fInnerRadius - fHeight));\n        float fScatter = fDepth*fTemp - fCameraOffset;\n        v3Attenuate = exp(-fScatter * (v3InvWavelength * fKr4PI + fKm4PI));\n        v3FrontColor += v3Attenuate * (fDepth * fScaledLength);\n        v3SamplePoint += v3SampleRay;\n    }\n\n    // Calculate the attenuation factor for the ground\n    c0 = v3Attenuate;\n    c1 = v3FrontColor * (v3InvWavelength * fKrESun + fKmESun);\n\n    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n}";
/* babel-plugin-inline-import './Shaders/GlowFS.glsl' */
const GlowFS = "#include <logdepthbuf_pars_fragment>\n\nuniform int atmoIN;\nvarying float intensity;\n\nvec4 glowColor = vec4(0.45, 0.74, 1. ,1.0);\n\nvoid main() {\n    #include <logdepthbuf_fragment>\n    gl_FragColor = glowColor * intensity;\n}\n\n";
/* babel-plugin-inline-import './Shaders/GlowVS.glsl' */
const GlowVS = "#include <common>\n#include <logdepthbuf_pars_vertex>\n\nuniform int atmoIN;\nvarying float intensity;\n\nvoid main()\n{\n    vec3 normalES    = normalize( normalMatrix * normal );\n    vec3 normalCAMES = normalize( normalMatrix * cameraPosition );\n\n    if(atmoIN == 0) {\n        intensity = pow(0.666 - dot(normalES, normalCAMES), 4. );\n    } else {\n        intensity = pow( 1.  - dot(normalES, normalCAMES), 0.8 );\n    }\n\n    gl_Position = projectionMatrix * modelViewMatrix * vec4( position,  1.0 );\n\n    #include <logdepthbuf_vertex>\n}\n\n\n";
const LIGHTING_POSITION = new THREE.Vector3(1, 0, 0);
const v = new THREE.Vector3();
const coordCam = new Coordinates('EPSG:4326');
const coordGeoCam = new Coordinates('EPSG:4326');
const skyBaseColor = new THREE.Color(0x93d5f8);
const colorSky = new THREE.Color();
const spaceColor = new THREE.Color(0x030508);
const limitAlti = 600000;
const mfogDistance = ellipsoidSizes.x * 160.0;

/**
 * @extends GeometryLayer
 */
class Atmosphere extends GeometryLayer {
  /**
  * It's layer to simulate Globe atmosphere.
  * There's 2 modes : simple and realistic (atmospheric-scattering).
   *
  * The atmospheric-scattering it is taken from :
  * * [Atmosphere Shader From Space (Atmospheric scattering)](http://stainlessbeer.weebly.com/planets-9-atmospheric-scattering.html)
  * * [Accurate Atmospheric Scattering (NVIDIA GPU Gems 2)](https://developer.nvidia.com/gpugems/gpugems2/part-ii-shading-lighting-and-shadows/chapter-16-accurate-atmospheric-scattering).
  *
  * @param {string} id - The id of the layer Atmosphere.
  * @param {Object} [options] - options layer.
  * @param {number} [options.Kr] - `Kr` is the rayleigh scattering constant.
  * @param {number} [options.Km] - `Km` is the Mie scattering constant.
  * @param {number} [options.ESun] - `ESun` is the brightness of the sun.
  * @param {number} [options.g] - constant `g` that affects the symmetry of the scattering.
  * @param {number} [options.innerRadius] - The inner (planetary) radius
  * @param {number} [options.outerRadius] - The outer (Atmosphere) radius
  * @param {number[]} [options.wavelength] - The constant is the `wavelength` (or color) of light.
  * @param {number} [options.scaleDepth] - The `scale depth` (i.e. the altitude at which the atmosphere's average density is found).
  * @param {number} [options.mieScaleDepth] - not used.
  */
  constructor() {
    let id = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 'atmosphere';
    let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    options.source = false;
    super(id, new THREE.Object3D(), options);
    this.isAtmosphere = true;
    const material = new THREE.ShaderMaterial({
      uniforms: {
        atmoIN: {
          type: 'i',
          value: 0
        },
        screenSize: {
          type: 'v2',
          value: new THREE.Vector2(window.innerWidth, window.innerHeight)
        } // Should be updated on screen resize...
      },
      vertexShader: GlowVS,
      fragmentShader: GlowFS,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
      wireframe: false
    });
    const sphereGeometry = new THREE.SphereGeometry(1, 64, 64);
    const basicAtmosphereOut = new THREE.Mesh(sphereGeometry, material);
    basicAtmosphereOut.scale.copy(ellipsoidSizes).multiplyScalar(1.14);
    this.basicAtmosphere = new THREE.Object3D();
    this.realisticAtmosphere = new THREE.Object3D();
    this.realisticAtmosphere.visible = false;
    this.object3d.add(this.basicAtmosphere);
    this.object3d.add(this.realisticAtmosphere);
    this.basicAtmosphere.add(basicAtmosphereOut);
    const materialAtmoIn = new THREE.ShaderMaterial({
      uniforms: {
        atmoIN: {
          type: 'i',
          value: 1
        },
        screenSize: {
          type: 'v2',
          value: new THREE.Vector2(window.innerWidth, window.innerHeight)
        } // Should be updated on screen resize...
      },
      vertexShader: GlowVS,
      fragmentShader: GlowFS,
      side: THREE.FrontSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false
    });
    const basicAtmosphereIn = new THREE.Mesh(sphereGeometry, materialAtmoIn);
    basicAtmosphereIn.scale.copy(ellipsoidSizes).multiplyScalar(1.002);
    this.basicAtmosphere.add(basicAtmosphereIn);
    this.realisticLightingPosition = {
      x: -0.5,
      y: 0.0,
      z: 1.0
    };
    this.fog = {
      enable: true,
      distance: mfogDistance
    };

    // Atmosphere Shader From Space (Atmospheric scattering)
    // http://stainlessbeer.weebly.com/planets-9-atmospheric-scattering.html
    // https://developer.nvidia.com/gpugems/gpugems2/part-ii-shading-lighting-and-shadows/chapter-16-accurate-atmospheric-scattering
    this.realisticAtmosphereInitParams = options.Kr ? options : {
      Kr: 0.0025,
      Km: 0.0015,
      ESun: 20.0,
      g: -0.950,
      innerRadius: 6400000,
      outerRadius: 6700000,
      wavelength: [0.650, 0.570, 0.475],
      scaleDepth: 0.25
      // mieScaleDepth: 0.1,
    };
    this.object3d.updateMatrixWorld();
  }
  update(context, layer, node) {
    // update uniforms
    node.material.fogDistance = this.fog.distance;
    node.material.lightingEnabled = this.realisticAtmosphere.visible;
    node.material.lightPosition = this.realisticLightingPosition;
  }

  // eslint-disable-next-line no-unused-vars
  preUpdate(context) {
    const cameraPosition = context.view.camera3D.position;
    if (this.fog.enable) {
      v.setFromMatrixPosition(context.view.tileLayer.object3d.matrixWorld);
      const len = v.distanceTo(cameraPosition);
      // Compute fog distance, this function makes it possible to have a shorter distance
      // when the camera approaches the ground
      this.fog.distance = mfogDistance * ((len - ellipsoidSizes.x * 0.99) * 0.25 / ellipsoidSizes.x) ** 1.5;
    } else {
      this.fog.distance = 10e10;
    }
    const renderer = context.view.mainLoop.gfxEngine.renderer;
    // get altitude camera
    coordCam.crs = context.view.referenceCrs;
    coordCam.setFromVector3(cameraPosition).as('EPSG:4326', coordGeoCam);
    const altitude = coordGeoCam.altitude;

    // If the camera altitude is below limitAlti,
    // we interpolate between the sky color and the space color
    if (altitude < limitAlti) {
      colorSky.copy(spaceColor).lerp(skyBaseColor, (limitAlti - altitude) / limitAlti);
      renderer.setClearColor(colorSky, renderer.getClearAlpha());
    } else {
      renderer.setClearColor(spaceColor, renderer.getClearAlpha());
    }
  }

  // default to non-realistic lightning
  _initRealisticLighning() {
    const atmosphere = this.realisticAtmosphereInitParams;
    const uniformsAtmosphere = {
      v3LightPosition: {
        value: LIGHTING_POSITION.clone().normalize()
      },
      v3InvWavelength: {
        value: new THREE.Vector3(1 / atmosphere.wavelength[0] ** 4, 1 / atmosphere.wavelength[1] ** 4, 1 / atmosphere.wavelength[2] ** 4)
      },
      fCameraHeight: {
        value: 0.0
      },
      fCameraHeight2: {
        value: 0.0
      },
      fInnerRadius: {
        value: atmosphere.innerRadius
      },
      fInnerRadius2: {
        value: atmosphere.innerRadius * atmosphere.innerRadius
      },
      fOuterRadius: {
        value: atmosphere.outerRadius
      },
      fOuterRadius2: {
        value: atmosphere.outerRadius * atmosphere.outerRadius
      },
      fKrESun: {
        value: atmosphere.Kr * atmosphere.ESun
      },
      fKmESun: {
        value: atmosphere.Km * atmosphere.ESun
      },
      fKr4PI: {
        value: atmosphere.Kr * 4.0 * Math.PI
      },
      fKm4PI: {
        value: atmosphere.Km * 4.0 * Math.PI
      },
      fScale: {
        value: 1 / (atmosphere.outerRadius - atmosphere.innerRadius)
      },
      fScaleDepth: {
        value: atmosphere.scaleDepth
      },
      fScaleOverScaleDepth: {
        value: 1 / (atmosphere.outerRadius - atmosphere.innerRadius) / atmosphere.scaleDepth
      },
      g: {
        value: atmosphere.g
      },
      g2: {
        value: atmosphere.g * atmosphere.g
      },
      nSamples: {
        value: 3
      },
      fSamples: {
        value: 3.0
      },
      tDisplacement: {
        value: new THREE.Texture()
      },
      tSkyboxDiffuse: {
        value: new THREE.Texture()
      },
      fNightScale: {
        value: 1.0
      }
    };
    const geometryAtmosphereIn = new THREE.SphereGeometry(atmosphere.innerRadius, 50, 50);
    const materialAtmosphereIn = new THREE.ShaderMaterial({
      uniforms: uniformsAtmosphere,
      vertexShader: groundVS,
      fragmentShader: groundFS,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthTest: false,
      depthWrite: false
    });
    const ground = new THREE.Mesh(geometryAtmosphereIn, materialAtmosphereIn);
    const geometryAtmosphereOut = new THREE.SphereGeometry(atmosphere.outerRadius, 196, 196);
    const materialAtmosphereOut = new THREE.ShaderMaterial({
      uniforms: uniformsAtmosphere,
      vertexShader: skyVS,
      fragmentShader: skyFS,
      transparent: true,
      side: THREE.BackSide
    });
    const sky = new THREE.Mesh(geometryAtmosphereOut, materialAtmosphereOut);
    const skyDome = new Sky();
    skyDome.frustumCulled = false;
    this.realisticAtmosphere.add(ground);
    this.realisticAtmosphere.add(sky);
    this.realisticAtmosphere.add(skyDome);
    const effectController = {
      turbidity: 10,
      reileigh: 2,
      mieCoefficient: 0.005,
      mieDirectionalG: 0.8,
      luminance: 1,
      inclination: 0.49,
      // elevation / inclination
      azimuth: 0.25,
      // Facing front,
      sun: !true
    };
    skyDome.material.uniforms.turbidity.value = effectController.turbidity;
    skyDome.material.uniforms.reileigh.value = effectController.reileigh;
    skyDome.material.uniforms.luminance.value = effectController.luminance;
    skyDome.material.uniforms.mieCoefficient.value = effectController.mieCoefficient;
    skyDome.material.uniforms.mieDirectionalG.value = effectController.mieDirectionalG;
    skyDome.material.uniforms.up.value = new THREE.Vector3(); // no more necessary, estimate normal from cam..
  }
  setRealisticOn(bool) {
    if (bool) {
      if (!this.realisticAtmosphere.children.length) {
        this._initRealisticLighning();
      }
      this.realisticLightingPosition = CoordStars.getSunPositionInScene(new Date().getTime(), 48.85, 2.35).normalize();
      this.realisticAtmosphere.children.forEach(obj => obj.material.uniforms.v3LightPosition.value.copy(this.realisticLightingPosition));
    }
    this.basicAtmosphere.visible = !bool;
    this.realisticAtmosphere.visible = bool;
  }
}
export default Atmosphere;