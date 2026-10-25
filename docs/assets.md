# Terrain asset record (LUN-15)

| Field | Value (inspected 25 Oct 2026) |
|---|---|
| Source file supplied by team | `maps/rocky_desert_-_terrain.glb` (kept locally, git-ignored) |
| Original size / SHA-256 | 39.3 MB / `df9963987f02cd46892adfd2dc92ce0197771474373cf32142162e607f72f0a2` |
| Generator | Sketchfab-12.66.0 (glTF 2.0, no required extensions) |
| Geometry | 3 meshes, ~190k vertices, one material, one 4096² PNG base-colour texture |
| Bounding box (source units) | x −0.5…0.5, y −0.052…0.052, z −0.424…0.576 |
| Shipped file | `public/models/mars-terrain.glb` → URL `/models/mars-terrain.glb` |
| Shipped size / SHA-256 | 6.97 MB / `efcb8496f380c6bde87e912b7facf48b8d994d4d29b0effaf3962e0c0f619296` |
| Optimisation (same asset) | `gltf-transform resize 2048` → `webp` (q85) → `quantize` (KHR_mesh_quantization, EXT_texture_webp) |
| World transform | centred, uniform scale ×400 → ~400 m × 400 m, relief ≈ ±21 m |
| Camera | eye height 1.7 m, 4 m/s, 60°/s turn, pitch ±80° |
| Ground | 256×256 height grid built from vertices at load; moves rejected outside inner 76% of map, on missing ground, or on slopes > 1:1 |
| Spawn | (0, 30) or nearest valid ground cell |
| Mars appearance | Material tinted `#e7a47f`; sky/fog `#d9a07a`. Terrain is a terrestrial-style rocky desert standing in for Mars. |

## License — ACTION REQUIRED before public demo

The license and author of the Sketchfab model were **not supplied with the file and have not been verified**.
Before presenting or deploying publicly, the team must open the original Sketchfab page, confirm the license
permits redistribution in a web app and modification (e.g. CC BY 4.0), and add the required credit line here and
in the site footer. A license that forbids redistribution is a release blocker (ARCHITECTURE §3.7).
