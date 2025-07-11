import * as THREE from 'three';
export function getBufferIndexSize(segments, noSkirt) {
  const triangles = segments * segments * 2 + (noSkirt ? 0 : 4 * segments * 2);
  return triangles * 3;
}
function getUintArrayConstructor(highestValue) {
  let picked = null;
  if (highestValue < 2 ** 8) {
    picked = Uint8Array;
  } else if (highestValue < 2 ** 16) {
    picked = Uint16Array;
  } else if (highestValue < 2 ** 32) {
    picked = Uint32Array;
  } else {
    throw new Error('Value is too high');
  }
  return picked;
}
function allocateIndexBuffer(nVertex, nSeg, params, cache) {
  const indexBufferSize = getBufferIndexSize(nSeg, params.disableSkirt);
  const indexConstructor = getUintArrayConstructor(nVertex);
  const tileLen = indexBufferSize;
  const skirtLen = 4 * nSeg;
  if (cache !== undefined) {
    return {
      index: cache,
      skirt: cache.subarray(tileLen, tileLen + skirtLen)
    };
  }
  const indexBuffer = new ArrayBuffer((
  // Tile
  tileLen
  // Skirt
  + (params.disableSkirt ? 0 : skirtLen)) * indexConstructor.BYTES_PER_ELEMENT);
  const index = new indexConstructor(indexBuffer);
  const skirt = !params.disableSkirt ? index.subarray(tileLen, tileLen + skirtLen) : undefined;
  return {
    index,
    skirt
  };
}
function allocateBuffers(nVertex, nSeg, builder, params, cache) {
  const {
    index,
    skirt
  } = allocateIndexBuffer(nVertex, nSeg, params, cache?.index);
  return {
    index,
    skirt,
    position: new Float32Array(nVertex * 3),
    normal: new Float32Array(nVertex * 3),
    // 2 UV set per tile: wgs84 (uv[0]) and pseudo-mercator (pm, uv[1])
    //    - wgs84: 1 texture per tile because tiles are using wgs84
    //          projection
    //    - pm: use multiple textures per tile.
    //      +-------------------------+
    //      |                         |
    //      |     Texture 0           |
    //      +-------------------------+
    //      |                         |
    //      |     Texture 1           |
    //      +-------------------------+
    //      |                         |
    //      |     Texture 2           |
    //      +-------------------------+
    //        * u = wgs84.u
    //        * v = textureid + v in builder texture
    uvs: [cache?.uv ?? new Float32Array(nVertex * 2), builder.computeExtraOffset !== undefined ? new Float32Array(nVertex) : undefined]
  };
}
function computeUv0(uv, id, u, v) {
  uv[id * 2 + 0] = u;
  uv[id * 2 + 1] = v;
}
function initComputeUv1(value) {
  return (uv, id) => {
    uv[id] = value;
  };
}
/** Compute buffers describing a tile according to a builder and its params. */
// TODO: Split this even further into subfunctions
export function computeBuffers(builder, params, cache) {
  //     n seg, n+1 vert    + <- skirt, n verts per side
  //    <---------------> / |
  //    +---+---+---+---+   |
  //    | / | / | / | / |   |  Vertices:
  //    +---+---+---+---+ - +     tile = (n + 1)^2
  //    | / | / | / | / |   |    skirt = 4n
  //    +---+---+---+---+ - +
  //    | / | / | / | / |   |  Segments:
  //    +---+---+---+---+ - +     tile = 2 * n * (n + 1) + n^2
  //    | / | / | / | / |   |    skirt = 2n * 4
  //    +---+---+---+---+   |
  const nSeg = Math.max(2, params.segments);
  const nVertex = nSeg + 1;
  const nTileVertex = nVertex ** 2;
  const nSkirtVertex = params.disableSkirt ? 0 : 4 * nSeg;
  const nTotalVertex = nTileVertex + nSkirtVertex;

  // Computer should combust before this happens
  if (nTotalVertex > 2 ** 32) {
    throw new Error('Tile segments count is too big');
  }
  const outBuffers = allocateBuffers(nTotalVertex, nSeg, builder, params, cache);
  const computeUvs = [cache === undefined ? computeUv0 : () => {}];
  params = builder.prepare(params);
  for (let y = 0; y <= nSeg; y++) {
    const v = y / nSeg;
    params.coordinates.y = builder.vProject(v, params.extent);
    if (builder.computeExtraOffset !== undefined) {
      computeUvs[1] = initComputeUv1(builder.computeExtraOffset(params));
    }
    for (let x = 0; x <= nSeg; x++) {
      const u = x / nSeg;
      const id_m3 = (y * nVertex + x) * 3;
      params.coordinates.x = builder.uProject(u, params.extent);
      const vertex = builder.vertexPosition(params.coordinates);
      const normal = builder.vertexNormal();

      // move geometry to center world
      vertex.sub(params.center);

      // align normal to z axis
      // HACK: this check style is not great
      if ('quatNormalToZ' in params) {
        const quat = params.quatNormalToZ;
        vertex.applyQuaternion(quat);
        normal.applyQuaternion(quat);
      }
      vertex.toArray(outBuffers.position, id_m3);
      normal.toArray(outBuffers.normal, id_m3);
      for (const [index, computeUv] of computeUvs.entries()) {
        if (computeUv !== undefined) {
          computeUv(outBuffers.uvs[index], y * nVertex + x, u, v);
        }
      }
    }
  }

  // Fill skirt index buffer
  if (cache === undefined && !params.disableSkirt) {
    for (let x = 0; x < nVertex; x++) {
      //   -------->
      //   0---1---2
      //   | / | / |   [0-9] = assign order
      //   +---+---+
      //   | / | / |
      //   +---+---+
      outBuffers.skirt[x] = x;
      //   +---+---+
      //   | / | / |   [0-9] = assign order
      //   +---+---x   x = skipped for now
      //   | / | / |
      //   0---1---2
      //   <--------
      outBuffers.skirt[2 * nVertex - 2 + x] = nVertex ** 2 - (x + 1);
    }
    for (let y = 1; y < nVertex - 1; y++) {
      //   +---+---s |
      //   | / | / | | o = stored vertices
      //   +---+---o | s = already stored
      //   | / | / | |
      //   +---+---s v
      outBuffers.skirt[nVertex - 1 + y] = y * nVertex + (nVertex - 1);
      // ^ s---+---+
      // | | / | / |   o = stored vertices
      // | o---+---+   s = already stored
      // | | / | / |
      // | s---+---+
      outBuffers.skirt[3 * nVertex - 3 + y] = nVertex * (nVertex - 1 - y);
    }
  }

  /** Copy passed indices at the desired index of the output index buffer. */
  function bufferizeTri(id, va, vb, vc) {
    outBuffers.index[id + 0] = va;
    outBuffers.index[id + 1] = vb;
    outBuffers.index[id + 2] = vc;
  }
  if (cache === undefined) {
    for (let y = 0; y < nSeg; y++) {
      for (let x = 0; x < nSeg; x++) {
        const v1 = y * nVertex + (x + 1);
        const v2 = y * nVertex + x;
        const v3 = (y + 1) * nVertex + x;
        const v4 = (y + 1) * nVertex + (x + 1);
        const id = (y * nSeg + x) * 6;
        bufferizeTri(id, /**/v4, v2, v1);
        bufferizeTri(id + 3, v4, v3, v2);
      }
    }
  }

  // PERF: Beware skirt's size influences performance
  // INFO: The size of the skirt is now a ratio of the size of the tile.
  // To be perfect it should depend on the real elevation delta but too heavy
  // to compute
  if (!params.disableSkirt) {
    // We compute the actual size of tile segment to use later for
    // the skirt.
    const segmentSize = new THREE.Vector3().fromArray(outBuffers.position).distanceTo(new THREE.Vector3().fromArray(outBuffers.position, 3));
    const buildSkirt = cache === undefined ? {
      index: (id, v1, v2, v3, v4) => {
        bufferizeTri(id, v1, v2, v3);
        bufferizeTri(id + 3, v1, v3, v4);
        return id + 6;
      },
      uv: (buf, idTo, idFrom) => {
        buf[idTo * 2 + 0] = buf[idFrom * 2 + 0];
        buf[idTo * 2 + 1] = buf[idFrom * 2 + 1];
      }
    } : {
      index: () => {},
      uv: () => {}
    };

    // Alias for readability
    const start = nTileVertex;
    for (let i = 0; i < outBuffers.skirt.length; i++) {
      const id = outBuffers.skirt[i];
      const id_m3 = (start + i) * 3;
      const id2_m3 = id * 3;
      outBuffers.position[id_m3 + 0] = outBuffers.position[id2_m3 + 0] - outBuffers.normal[id2_m3 + 0] * segmentSize;
      outBuffers.position[id_m3 + 1] = outBuffers.position[id2_m3 + 1] - outBuffers.normal[id2_m3 + 1] * segmentSize;
      outBuffers.position[id_m3 + 2] = outBuffers.position[id2_m3 + 2] - outBuffers.normal[id2_m3 + 2] * segmentSize;
      outBuffers.normal[id_m3 + 0] = outBuffers.normal[id2_m3 + 0];
      outBuffers.normal[id_m3 + 1] = outBuffers.normal[id2_m3 + 1];
      outBuffers.normal[id_m3 + 2] = outBuffers.normal[id2_m3 + 2];
      buildSkirt.uv(outBuffers.uvs[0], start + i, id);
      if (outBuffers.uvs[1] !== undefined) {
        outBuffers.uvs[1][start + i] = outBuffers.uvs[1][id];
      }
      const idf = (i + 1) % outBuffers.skirt.length;
      const v2 = start + i;
      const v3 = idf === 0 ? start : start + i + 1;
      const v4 = outBuffers.skirt[idf];
      buildSkirt.index(6 * nSeg ** 2 + i * 6, id, v2, v3, v4);
    }
  }

  // Dropping skirt view
  return {
    index: outBuffers.index,
    position: outBuffers.position,
    uvs: outBuffers.uvs,
    normal: outBuffers.normal
  };
}