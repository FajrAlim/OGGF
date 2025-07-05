const conf = {
  version: '2.45.1'
};
export const REVISION = conf.version;

// Geographic tools
export { Coordinates, Extent, CRS, Ellipsoid, ellipsoidSizes, OrientationUtils } from '@itowns/geographic';
export { default as GeoidGrid } from "./Core/Geographic/GeoidGrid.js";
export { default as GlobeView, GLOBE_VIEW_EVENTS } from "./Core/Prefab/GlobeView.js";
export { default as PlanarView } from "./Core/Prefab/PlanarView.js";
export { default as Fetcher } from "./Provider/Fetcher.js";
export { MAIN_LOOP_EVENTS } from "./Core/MainLoop.js";
export { default as View } from "./Core/View.js";
export { VIEW_EVENTS } from "./Core/View.js";
export { default as FeatureProcessing } from "./Process/FeatureProcessing.js";
export { default as ObjectRemovalHelper } from "./Process/ObjectRemovalHelper.js";
export { updateLayeredMaterialNodeImagery, updateLayeredMaterialNodeElevation } from "./Process/LayeredMaterialNodeProcessing.js";
export { default as OrientedImageCamera } from "./Renderer/OrientedImageCamera.js";
export { default as PointsMaterial, PNTS_MODE, PNTS_SHAPE, PNTS_SIZE_MODE, ClassificationScheme } from "./Renderer/PointsMaterial.js";
export { default as GlobeControls } from "./Controls/GlobeControls.js";
export { default as FlyControls } from "./Controls/FlyControls.js";
export { default as FirstPersonControls } from "./Controls/FirstPersonControls.js";
export { default as StreetControls } from "./Controls/StreetControls.js";
export { default as PlanarControls } from "./Controls/PlanarControls.js";
export { CONTROL_EVENTS } from "./Controls/GlobeControls.js";
export { PLANAR_CONTROL_EVENT } from "./Controls/PlanarControls.js";
export { default as Feature2Mesh } from "./Converter/Feature2Mesh.js";
export { default as FeaturesUtils } from "./Utils/FeaturesUtils.js";
export { default as DEMUtils } from "./Utils/DEMUtils.js";
export { default as CameraUtils } from "./Utils/CameraUtils.js";
export { default as ShaderChunk } from "./Renderer/Shader/ShaderChunk.js";
export { getMaxColorSamplerUnitsCount, colorLayerEffects } from "./Renderer/LayeredMaterial.js";
export { default as Capabilities } from "./Core/System/Capabilities.js";
export { CAMERA_TYPE } from "./Renderer/Camera.js";
export { default as OBB } from "./Renderer/OBB.js";

// Internal itowns format
export { default as Feature, FeatureCollection, FeatureGeometry, FEATURE_TYPES } from "./Core/Feature.js";
export { default as Style } from "./Core/Style.js";
export { default as Label } from "./Core/Label.js";

// Layers provided by default in iTowns
// A custom layer should at least implements Layer
// See http://www.itowns-project.org/itowns/docs/#api/Layer/Layer
export { default as Layer, ImageryLayers } from "./Layer/Layer.js";
export { default as ColorLayer } from "./Layer/ColorLayer.js";
export { default as ElevationLayer } from "./Layer/ElevationLayer.js";
export { default as GeometryLayer } from "./Layer/GeometryLayer.js";
export { default as FeatureGeometryLayer } from "./Layer/FeatureGeometryLayer.js";
export { default as PointCloudLayer } from "./Layer/PointCloudLayer.js";
export { default as PotreeLayer } from "./Layer/PotreeLayer.js";
export { default as Potree2Layer } from "./Layer/Potree2Layer.js";
export { default as C3DTilesLayer, C3DTILES_LAYER_EVENTS } from "./Layer/C3DTilesLayer.js";
export { default as OGC3DTilesLayer, OGC3DTILES_LAYER_EVENTS, enableDracoLoader, enableKtx2Loader, enableMeshoptDecoder } from "./Layer/OGC3DTilesLayer.js";
export { default as TiledGeometryLayer } from "./Layer/TiledGeometryLayer.js";
export { default as OrientedImageLayer } from "./Layer/OrientedImageLayer.js";
export { STRATEGY_MIN_NETWORK_TRAFFIC, STRATEGY_GROUP, STRATEGY_PROGRESSIVE, STRATEGY_DICHOTOMY } from "./Layer/LayerUpdateStrategy.js";
export { default as ColorLayersOrdering } from "./Renderer/ColorLayersOrdering.js";
export { default as GlobeLayer } from "./Core/Prefab/Globe/GlobeLayer.js";
export { default as PlanarLayer } from "./Core/Prefab/Planar/PlanarLayer.js";
export { default as LabelLayer } from "./Layer/LabelLayer.js";
export { default as EntwinePointTileLayer } from "./Layer/EntwinePointTileLayer.js";
export { default as CopcLayer } from "./Layer/CopcLayer.js";
export { default as GeoidLayer } from "./Layer/GeoidLayer.js";

// Sources provided by default in iTowns
// A custom source should at least implements Source
// See http://www.itowns-project.org/itowns/docs/#api/Source/Source
export { default as Source } from "./Source/Source.js";
export { default as FileSource } from "./Source/FileSource.js";
export { default as TMSSource } from "./Source/TMSSource.js";
export { default as WFSSource } from "./Source/WFSSource.js";
export { default as WMSSource } from "./Source/WMSSource.js";
export { default as WMTSSource } from "./Source/WMTSSource.js";
export { default as VectorTilesSource } from "./Source/VectorTilesSource.js";
export { default as OrientedImageSource } from "./Source/OrientedImageSource.js";
export { default as PotreeSource } from "./Source/PotreeSource.js";
export { default as Potree2Source } from "./Source/Potree2Source.js";
export { default as C3DTilesSource } from "./Source/C3DTilesSource.js";
export { default as C3DTilesIonSource } from "./Source/C3DTilesIonSource.js";
export { default as C3DTilesGoogleSource } from "./Source/C3DTilesGoogleSource.js";
export { default as OGC3DTilesSource } from "./Source/OGC3DTilesSource.js";
export { default as OGC3DTilesIonSource } from "./Source/OGC3DTilesIonSource.js";
export { default as OGC3DTilesGoogleSource } from "./Source/OGC3DTilesGoogleSource.js";
export { default as EntwinePointTileSource } from "./Source/EntwinePointTileSource.js";
export { default as CopcSource } from "./Source/CopcSource.js";

// Parsers provided by default in iTowns
// Custom parser can be implemented as wanted, as long as the main function
// takes the data as the first argument and options as the second.
export { default as GpxParser } from "./Parser/GpxParser.js";
export { default as GeoJsonParser } from "./Parser/GeoJsonParser.js";
export { default as KMLParser } from "./Parser/KMLParser.js";
export { default as CameraCalibrationParser } from "./Parser/CameraCalibrationParser.js";
export { default as ShapefileParser } from "./Parser/ShapefileParser.js";
export { default as LASParser } from "./Parser/LASParser.js";
export { default as ISGParser } from "./Parser/ISGParser.js";
export { default as GDFParser } from "./Parser/GDFParser.js";
export { default as GTXParser } from "./Parser/GTXParser.js";
export { default as B3dmParser } from "./Parser/B3dmParser.js";
export { default as iGLTFLoader } from "./Parser/iGLTFLoader.js";

// 3D Tiles classes and extensions
// Exported to allow one to implement its own 3D Tiles extension which needs to
// know the classes it extends
export { default as C3DTFeature } from "./Core/3DTiles/C3DTFeature.js";
export { default as C3DTileset } from "./Core/3DTiles/C3DTileset.js";
export { default as C3DTBoundingVolume } from "./Core/3DTiles/C3DTBoundingVolume.js";
export { default as C3DTBatchTable } from "./Core/3DTiles/C3DTBatchTable.js";
export { default as C3DTExtensions } from "./Core/3DTiles/C3DTExtensions.js";
export { C3DTilesTypes, C3DTilesBoundingVolumeTypes } from "./Core/3DTiles/C3DTilesEnums.js";
export { default as C3DTBatchTableHierarchyExtension } from "./Core/3DTiles/C3DTBatchTableHierarchyExtension.js";
export { process3dTilesNode, $3dTilesCulling, $3dTilesSubdivisionControl } from "./Process/3dTilesProcessing.js";