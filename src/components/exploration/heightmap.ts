import * as THREE from "three";

/** Grid of average ground heights built once from the terrain vertices (cheap per-frame lookup). */
export interface Heightmap {
  minX: number;
  minZ: number;
  sizeX: number;
  sizeZ: number;
  res: number;
  heights: Float32Array; // NaN = no ground
}

export function buildHeightmap(root: THREE.Object3D, res: number): Heightmap {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const sums = new Float64Array(res * res);
  const counts = new Uint32Array(res * res);
  const v = new THREE.Vector3();
  const sizeX = box.max.x - box.min.x;
  const sizeZ = box.max.z - box.min.z;

  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const pos = mesh.geometry.getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      const cx = Math.min(res - 1, Math.floor(((v.x - box.min.x) / sizeX) * res));
      const cz = Math.min(res - 1, Math.floor(((v.z - box.min.z) / sizeZ) * res));
      const k = cz * res + cx;
      sums[k] += v.y;
      counts[k]++;
    }
  });

  const heights = new Float32Array(res * res);
  for (let k = 0; k < heights.length; k++) heights[k] = counts[k] ? sums[k] / counts[k] : NaN;
  // Fill isolated empty cells from neighbours so sparse areas are walkable; large holes stay NaN.
  for (let pass = 0; pass < 2; pass++) {
    for (let z = 0; z < res; z++)
      for (let x = 0; x < res; x++) {
        const k = z * res + x;
        if (!Number.isNaN(heights[k])) continue;
        let s = 0,
          n = 0;
        for (let dz = -1; dz <= 1; dz++)
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx,
              zz = z + dz;
            if (xx < 0 || zz < 0 || xx >= res || zz >= res) continue;
            const h = heights[zz * res + xx];
            if (!Number.isNaN(h)) {
              s += h;
              n++;
            }
          }
        if (n >= 4) heights[k] = s / n;
      }
  }
  return { minX: box.min.x, minZ: box.min.z, sizeX, sizeZ, res, heights };
}

/** Bilinear ground height at world (x, z); NaN if outside or no ground. */
export function sampleHeight(hm: Heightmap, x: number, z: number): number {
  const fx = ((x - hm.minX) / hm.sizeX) * hm.res - 0.5;
  const fz = ((z - hm.minZ) / hm.sizeZ) * hm.res - 0.5;
  const x0 = Math.floor(fx),
    z0 = Math.floor(fz);
  if (x0 < 0 || z0 < 0 || x0 + 1 >= hm.res || z0 + 1 >= hm.res) return NaN;
  const tx = fx - x0,
    tz = fz - z0;
  const h = (xx: number, zz: number) => hm.heights[zz * hm.res + xx];
  const a = h(x0, z0),
    b = h(x0 + 1, z0),
    c = h(x0, z0 + 1),
    d = h(x0 + 1, z0 + 1);
  return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
}
