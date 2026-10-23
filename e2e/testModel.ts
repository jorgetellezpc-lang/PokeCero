// GLB de prueba generado en memoria: una caja de color (NO es un Pokémon).
// Sirve para comprobar en el navegador que la ruta de modelos 3D funciona:
// carga, colocación, luz, animación de reserva y liberación de recursos.

export function boxGlb(w = 1, h = 2, d = 1, color: [number, number, number] = [0.25, 0.6, 1]): Buffer {
  const pos: number[] = [];
  const nor: number[] = [];
  const idx: number[] = [];
  const faces: [number[], number[], number[]][] = [
    [[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 1, 0], [0, 0, -1]],
    [[0, 1, 0], [0, 0, 1], [1, 0, 0]], [[0, -1, 0], [0, 0, -1], [1, 0, 0]],
    [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [-1, 0, 0], [0, 1, 0]],
  ];
  const s = [w / 2, h / 2, d / 2];
  for (const [n, u, v] of faces) {
    const base = pos.length / 3;
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      for (let k = 0; k < 3; k++) pos.push((n[k] + u[k] * a + v[k] * b) * s[k] + (k === 1 ? h / 2 : 0));
      nor.push(...n);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const P = new Float32Array(pos);
  const N = new Float32Array(nor);
  const I = new Uint16Array(idx);
  const bin = Buffer.concat([Buffer.from(P.buffer), Buffer.from(N.buffer), Buffer.from(I.buffer)]);
  const json = Buffer.from(JSON.stringify({
    asset: { version: '2.0' },
    scenes: [{ nodes: [0] }], scene: 0, nodes: [{ mesh: 0, name: 'caja-prueba' }],
    materials: [{ pbrMetallicRoughness: { baseColorFactor: [...color, 1], metallicFactor: 0, roughnessFactor: 0.8 } }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: 0 }] }],
    buffers: [{ byteLength: bin.length }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: P.byteLength },
      { buffer: 0, byteOffset: P.byteLength, byteLength: N.byteLength },
      { buffer: 0, byteOffset: P.byteLength + N.byteLength, byteLength: I.byteLength },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: P.length / 3, type: 'VEC3', min: [-w / 2, 0, -d / 2], max: [w / 2, h, d / 2] },
      { bufferView: 1, componentType: 5126, count: N.length / 3, type: 'VEC3' },
      { bufferView: 2, componentType: 5123, count: I.length, type: 'SCALAR' },
    ],
  }));
  const pad = (b: Buffer, fill: number) => Buffer.concat([b, Buffer.alloc((4 - (b.length % 4)) % 4, fill)]);
  const J = pad(json, 0x20);
  const B = pad(bin, 0);
  const head = Buffer.alloc(12);
  head.writeUInt32LE(0x46546c67, 0);
  head.writeUInt32LE(2, 4);
  head.writeUInt32LE(12 + 8 + J.length + 8 + B.length, 8);
  const ch = (len: number, type: number) => { const c = Buffer.alloc(8); c.writeUInt32LE(len, 0); c.writeUInt32LE(type, 4); return c; };
  return Buffer.concat([head, ch(J.length, 0x4e4f534a), J, ch(B.length, 0x004e4942), B]);
}
