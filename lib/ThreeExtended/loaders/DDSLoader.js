import { CompressedTextureLoader, RGBAFormat, RGBA_S3TC_DXT3_Format, RGBA_S3TC_DXT5_Format, RGB_ETC1_Format, RGB_S3TC_DXT1_Format, RGB_BPTC_SIGNED_Format, RGB_BPTC_UNSIGNED_Format } from 'three';
class DDSLoader extends CompressedTextureLoader {
  constructor(manager) {
    super(manager);
  }
  parse(buffer, loadMipmaps) {
    const dds = {
      mipmaps: [],
      width: 0,
      height: 0,
      format: null,
      mipmapCount: 1
    };

    // Adapted from @toji's DDS utils
    // https://github.com/toji/webgl-texture-utils/blob/master/texture-util/dds.js

    // All values and structures referenced from:
    // http://msdn.microsoft.com/en-us/library/bb943991.aspx/

    // const DDSD_CAPS = 0x1;
    // const DDSD_HEIGHT = 0x2;
    // const DDSD_WIDTH = 0x4;
    // const DDSD_PITCH = 0x8;
    // const DDSD_PIXELFORMAT = 0x1000;

    // const DDSD_LINEARSIZE = 0x80000;
    // const DDSD_DEPTH = 0x800000;

    // const DDSCAPS_COMPLEX = 0x8;
    // const DDSCAPS_MIPMAP = 0x400000;
    // const DDSCAPS_TEXTURE = 0x1000;

    // const DDSCAPS2_VOLUME = 0x200000;

    // const DDPF_ALPHAPIXELS = 0x1;
    // const DDPF_ALPHA = 0x2;
    // const DDPF_FOURCC = 0x4;
    // const DDPF_RGB = 0x40;
    // const DDPF_YUV = 0x200;
    // const DDPF_LUMINANCE = 0x20000;

    function fourCCToInt32(value) {
      return value.charCodeAt(0) + (value.charCodeAt(1) << 8) + (value.charCodeAt(2) << 16) + (value.charCodeAt(3) << 24);
    }
    function int32ToFourCC(value) {
      return String.fromCharCode(value & 0xff, value >> 8 & 0xff, value >> 16 & 0xff, value >> 24 & 0xff);
    }
    function loadARGBMip(buffer, dataOffset, width, height) {
      const dataLength = width * height * 4;
      const srcBuffer = new Uint8Array(buffer, dataOffset, dataLength);
      const byteArray = new Uint8Array(dataLength);
      let dst = 0;
      let src = 0;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const b = srcBuffer[src];
          src++;
          const g = srcBuffer[src];
          src++;
          const r = srcBuffer[src];
          src++;
          const a = srcBuffer[src];
          src++;
          byteArray[dst] = r;
          dst++; //r
          byteArray[dst] = g;
          dst++; //g
          byteArray[dst] = b;
          dst++; //b
          byteArray[dst] = a;
          dst++; //a
        }
      }
      return byteArray;
    }
    const FOURCC_DXT1 = fourCCToInt32('DXT1');
    const FOURCC_DXT3 = fourCCToInt32('DXT3');
    const FOURCC_DXT5 = fourCCToInt32('DXT5');
    const FOURCC_ETC1 = fourCCToInt32('ETC1');
    const FOURCC_DX10 = fourCCToInt32('DX10');
    const headerLengthInt = 31; // The header length in 32 bit ints
    const extendedHeaderLengthInt = 5; // The extended header length in 32 bit ints

    // Offsets into the header array

    // const off_pfFlags = 20;

    // const off_caps = 27;

    // const off_caps3 = 29;
    // const off_caps4 = 30;

    // If fourCC = DX10, the extended header starts after 32

    // Parse header

    const header = new Int32Array(buffer, 0, headerLengthInt);
    if (header[0] !== 0x20534444) {
      console.error('THREE.DDSLoader.parse: Invalid magic number in DDS header.');
      return dds;
    }
    let blockBytes;
    const fourCC = header[21];
    let isRGBAUncompressed = false;
    let dataOffset = header[1] + 4;
    switch (fourCC) {
      case FOURCC_DXT1:
        blockBytes = 8;
        dds.format = RGB_S3TC_DXT1_Format;
        break;
      case FOURCC_DXT3:
        blockBytes = 16;
        dds.format = RGBA_S3TC_DXT3_Format;
        break;
      case FOURCC_DXT5:
        blockBytes = 16;
        dds.format = RGBA_S3TC_DXT5_Format;
        break;
      case FOURCC_ETC1:
        blockBytes = 8;
        dds.format = RGB_ETC1_Format;
        break;
      case FOURCC_DX10:
        dataOffset += extendedHeaderLengthInt * 4;
        const extendedHeader = new Int32Array(buffer, (headerLengthInt + 1) * 4, extendedHeaderLengthInt);
        const dxgiFormat = extendedHeader[0];
        switch (dxgiFormat) {
          case 96:
            {
              blockBytes = 16;
              dds.format = RGB_BPTC_SIGNED_Format;
              break;
            }
          case 95:
            {
              blockBytes = 16;
              dds.format = RGB_BPTC_UNSIGNED_Format;
              break;
            }
          default:
            {
              console.error('THREE.DDSLoader.parse: Unsupported DXGI_FORMAT code ', dxgiFormat);
              return dds;
            }
        }
        break;
      default:
        if (header[22] === 32 && header[23] & 0xff0000 && header[24] & 0xff00 && header[25] & 0xff && header[26] & 0xff000000) {
          isRGBAUncompressed = true;
          blockBytes = 64;
          dds.format = RGBAFormat;
        } else {
          console.error('THREE.DDSLoader.parse: Unsupported FourCC code ', int32ToFourCC(fourCC));
          return dds;
        }
    }
    dds.mipmapCount = 1;
    if (header[2] & 0x20000 && loadMipmaps !== false) {
      dds.mipmapCount = Math.max(1, header[7]);
    }
    const caps2 = header[28];
    dds.isCubemap = caps2 & 0x200 ? true : false;
    if (dds.isCubemap && (!(caps2 & 0x400) || !(caps2 & 0x800) || !(caps2 & 0x1000) || !(caps2 & 0x2000) || !(caps2 & 0x4000) || !(caps2 & 0x8000))) {
      console.error('THREE.DDSLoader.parse: Incomplete cubemap faces');
      return dds;
    }
    dds.width = header[4];
    dds.height = header[3];

    // Extract mipmaps buffers

    const faces = dds.isCubemap ? 6 : 1;
    for (let face = 0; face < faces; face++) {
      let width = dds.width;
      let height = dds.height;
      for (let i = 0; i < dds.mipmapCount; i++) {
        let byteArray, dataLength;
        if (isRGBAUncompressed) {
          byteArray = loadARGBMip(buffer, dataOffset, width, height);
          dataLength = byteArray.length;
        } else {
          dataLength = Math.max(4, width) / 4 * Math.max(4, height) / 4 * blockBytes;
          byteArray = new Uint8Array(buffer, dataOffset, dataLength);
        }
        const mipmap = {
          'data': byteArray,
          'width': width,
          'height': height
        };
        dds.mipmaps.push(mipmap);
        dataOffset += dataLength;
        width = Math.max(width >> 1, 1);
        height = Math.max(height >> 1, 1);
      }
    }
    return dds;
  }
}
export { DDSLoader };