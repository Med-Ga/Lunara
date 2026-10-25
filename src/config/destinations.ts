// Single source of truth for the playable destination (ARCHITECTURE §3.3 manifest).
// Values come from inspecting the actual asset (see docs/assets.md).
export const MARS = {
  id: "mars" as const,
  title: "Mars — Simulated Terrain",
  disclosure:
    "Simulated landscape rendered in your browser. It represents Mars and is derived from a terrestrial-style 3D model; it is not live Martian imagery or a real robot.",
  assetUrl: "/models/mars-terrain.glb?v=1",
  // Source model spans ~1 x 0.1 x 1 units; scale to a ~400 m wide area.
  scale: 400,
  eyeHeight: 1.7,
  speed: 4, // m/s
  turnRate: Math.PI / 3, // 60°/s
  pitchLimit: (80 * Math.PI) / 180,
  mouseSensitivity: 0.0022,
  maxSlope: 1.0, // rise/run allowed per step
  boundsMargin: 0.12, // keep away from the outer 12% of the map edges
  heightmapResolution: 256,
  spawn: { x: 0, z: 30, yaw: 0 },
  tint: "#e7a47f",
} as const;
