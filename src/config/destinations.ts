// Typed destination configuration (display, terrain, navigation, mini-map, sites, environment).
// Shared by client and server. It is NOT payment authority: prices live in the server catalog.
export type DestinationId = "mars" | "moon";
export const DESTINATION_IDS: readonly DestinationId[] = ["mars", "moon"];

export interface SiteAttribute {
  label: string;
  value: number;
  unit: string;
}

export interface GeoSite {
  id: string;
  destinationId: DestinationId;
  name: string;
  category: string;
  x: number;
  z: number;
  radius: number;
  description: string;
  /** Predefined synthetic values. Composition entries sum to 100 % within a site. */
  attributes: SiteAttribute[];
  interpretation: string;
}

export interface Bounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface DestinationConfig {
  id: DestinationId;
  name: string;
  kind: "planet" | "moon";
  tagline: string;
  description: string;
  disclosure: string;
  previewClass: string;
  assetUrl: string;
  /** Uniform scale from source model units to in-app map units (mu); not calibrated to metres. */
  scale: number;
  eyeHeight: number;
  speed: number; // mu/s, also the server's plausibility ceiling
  turnRate: number;
  pitchLimit: number;
  mouseSensitivity: number;
  maxSlope: number;
  heightmapResolution: number;
  /** Validated traversable rectangle in world (in-app) coordinates. */
  bounds: Bounds;
  spawn: { x: number; z: number; yaw: number };
  tint: string | null;
  sky: string;
  fog: [number, number];
  hemisphere: [string, string, number];
  sun: { position: [number, number, number]; intensity: number; color: string };
  environment: { label: string; baseTempC: number; spatialAmplitudeC: number; heightLapseCPerMu: number };
  datasetVersion: string;
  sites: GeoSite[];
}

const DEG = Math.PI / 180;
const common = { eyeHeight: 1.7, turnRate: 60 * DEG, pitchLimit: 80 * DEG, mouseSensitivity: 0.0022 };

export const DESTINATIONS: Record<DestinationId, DestinationConfig> = {
  mars: {
    id: "mars",
    name: "Mars",
    kind: "planet",
    tagline: "Rocky basin",
    description: "A simulated rocky basin about 400 mu across. Rust-coloured slopes, ridges and a wide valley floor.",
    disclosure:
      "Simulated landscape rendered in your browser. It represents Mars and is derived from a terrestrial-style 3D model; it is not live Martian imagery or a real robot.",
    previewClass: "preview-mars",
    assetUrl: "/models/mars-terrain.glb?v=1",
    scale: 400,
    ...common,
    speed: 4,
    maxSlope: 1.0,
    heightmapResolution: 256,
    bounds: { minX: -152, maxX: 152, minZ: -152, maxZ: 152 },
    spawn: { x: 0, z: 30, yaw: 0 },
    tint: "#e7a47f",
    sky: "#d9a07a",
    fog: [60, 320],
    hemisphere: ["#ffe2c8", "#5a2a18", 0.9],
    sun: { position: [80, 120, 40], intensity: 1.6, color: "#fff1e0" },
    environment: { label: "Surface air (simulated)", baseTempC: -63, spatialAmplitudeC: 6, heightLapseCPerMu: -0.25 },
    datasetVersion: "mars-sites-v1",
    sites: [
      {
        "id": "mars-ridge-regolith",
        "destinationId": "mars",
        "name": "Spawn Ridge Regolith",
        "category": "Regolith",
        "x": -21.1,
        "z": 16.4,
        "radius": 6,
        "description": "Loose, fine-grained surface material on the ridge near the landing area.",
        "attributes": [
          {
            "label": "SiO2",
            "value": 45,
            "unit": "% (illustrative)"
          },
          {
            "label": "FeO",
            "value": 18,
            "unit": "% (illustrative)"
          },
          {
            "label": "Al2O3",
            "value": 10,
            "unit": "% (illustrative)"
          },
          {
            "label": "Other",
            "value": 27,
            "unit": "% (illustrative)"
          },
          {
            "label": "Median grain size",
            "value": 0.3,
            "unit": "mm (simulated)"
          }
        ],
        "interpretation": "Fine, iron-bearing loose material consistent with a weathered surface layer in this simulation."
      },
      {
        "id": "mars-east-basalt",
        "destinationId": "mars",
        "name": "Eastern Basaltic Outcrop",
        "category": "Basaltic formation",
        "x": 55.5,
        "z": -19.5,
        "radius": 6,
        "description": "Dark, blocky rock exposed on the eastern slope.",
        "attributes": [
          {
            "label": "SiO2",
            "value": 48,
            "unit": "% (illustrative)"
          },
          {
            "label": "FeO",
            "value": 19,
            "unit": "% (illustrative)"
          },
          {
            "label": "MgO",
            "value": 9,
            "unit": "% (illustrative)"
          },
          {
            "label": "Other",
            "value": 24,
            "unit": "% (illustrative)"
          },
          {
            "label": "Surface roughness",
            "value": 4.2,
            "unit": "cm RMS (simulated)"
          }
        ],
        "interpretation": "Dark, iron- and magnesium-bearing rock: a basaltic signature in the predefined dataset."
      },
      {
        "id": "mars-north-sediment",
        "destinationId": "mars",
        "name": "Northern Layered Bank",
        "category": "Sedimentary formation",
        "x": -3.9,
        "z": -44.5,
        "radius": 6,
        "description": "A bank showing thin, layered bands along the valley edge.",
        "attributes": [
          {
            "label": "SiO2",
            "value": 52,
            "unit": "% (illustrative)"
          },
          {
            "label": "Al2O3",
            "value": 13,
            "unit": "% (illustrative)"
          },
          {
            "label": "CaO",
            "value": 8,
            "unit": "% (illustrative)"
          },
          {
            "label": "Other",
            "value": 27,
            "unit": "% (illustrative)"
          },
          {
            "label": "Layer spacing",
            "value": 12,
            "unit": "cm (simulated)"
          }
        ],
        "interpretation": "Regular banding with higher silica and alumina: illustrative of layered sedimentary material."
      },
      {
        "id": "mars-west-iron",
        "destinationId": "mars",
        "name": "Western Rust Flats",
        "category": "Iron-oxide-rich material",
        "x": -66.4,
        "z": 64.8,
        "radius": 6,
        "description": "Strongly reddened soil on the western flats.",
        "attributes": [
          {
            "label": "Fe2O3",
            "value": 24,
            "unit": "% (illustrative)"
          },
          {
            "label": "SiO2",
            "value": 42,
            "unit": "% (illustrative)"
          },
          {
            "label": "Al2O3",
            "value": 9,
            "unit": "% (illustrative)"
          },
          {
            "label": "Other",
            "value": 25,
            "unit": "% (illustrative)"
          },
          {
            "label": "Albedo",
            "value": 0.21,
            "unit": "(simulated)"
          }
        ],
        "interpretation": "Elevated iron-oxide fraction explains the reddish tone in this simulated reading."
      },
      {
        "id": "mars-south-dune",
        "destinationId": "mars",
        "name": "Southern Dust Apron",
        "category": "Regolith",
        "x": 66.4,
        "z": 64.8,
        "radius": 6,
        "description": "A smooth apron of wind-sorted fine dust.",
        "attributes": [
          {
            "label": "SiO2",
            "value": 44,
            "unit": "% (illustrative)"
          },
          {
            "label": "FeO",
            "value": 17,
            "unit": "% (illustrative)"
          },
          {
            "label": "Al2O3",
            "value": 10,
            "unit": "% (illustrative)"
          },
          {
            "label": "Other",
            "value": 29,
            "unit": "% (illustrative)"
          },
          {
            "label": "Median grain size",
            "value": 0.1,
            "unit": "mm (simulated)"
          }
        ],
        "interpretation": "Very fine, well-sorted grains suggest wind-deposited dust in this simulation."
      }
    ],
  },
  moon: {
    id: "moon",
    name: "Moon",
    kind: "moon",
    tagline: "Mare Moscoviense basin",
    description:
      "A simulated crater basin modelled on Mare Moscoviense on the lunar far side: a dark, smooth floor ringed by highland walls.",
    disclosure:
      "Simulated landscape rendered in your browser from a 3D terrain model. It is not live lunar imagery, and no robot or instrument is connected.",
    previewClass: "preview-moon",
    assetUrl: "/models/moon-terrain.glb?v=1",
    scale: 0.055,
    ...common,
    speed: 5,
    maxSlope: 1.0,
    heightmapResolution: 128,
    bounds: { minX: -260, maxX: 260, minZ: -260, maxZ: 260 },
    spawn: { x: 0, z: 0, yaw: 0 },
    tint: null,
    sky: "#05060a",
    fog: [180, 900],
    hemisphere: ["#dfe5f2", "#3a3c44", 1.5],
    sun: { position: [-200, 160, 120], intensity: 3.4, color: "#ffffff" },
    environment: { label: "Regolith surface, sunlit (simulated)", baseTempC: 96, spatialAmplitudeC: 9, heightLapseCPerMu: -0.15 },
    datasetVersion: "moon-sites-v1",
    sites: [
      {
        "id": "moon-central-regolith",
        "destinationId": "moon",
        "name": "Central Mare Regolith",
        "category": "Regolith",
        "x": -2.3,
        "z": -25.8,
        "radius": 6,
        "description": "Grey, powdery surface layer covering the basin floor.",
        "attributes": [
          {
            "label": "SiO2",
            "value": 43,
            "unit": "% (illustrative)"
          },
          {
            "label": "FeO",
            "value": 16,
            "unit": "% (illustrative)"
          },
          {
            "label": "Al2O3",
            "value": 13,
            "unit": "% (illustrative)"
          },
          {
            "label": "Other",
            "value": 28,
            "unit": "% (illustrative)"
          },
          {
            "label": "Median grain size",
            "value": 0.07,
            "unit": "mm (simulated)"
          }
        ],
        "interpretation": "Fine, iron-bearing powder typical of a mare surface layer in the predefined dataset."
      },
      {
        "id": "moon-east-basalt",
        "destinationId": "moon",
        "name": "Eastern Mare Basalt",
        "category": "Basaltic formation",
        "x": 91.4,
        "z": 11.7,
        "radius": 6,
        "description": "Dark, smooth plain of solidified lava.",
        "attributes": [
          {
            "label": "SiO2",
            "value": 41,
            "unit": "% (illustrative)"
          },
          {
            "label": "FeO",
            "value": 20,
            "unit": "% (illustrative)"
          },
          {
            "label": "TiO2",
            "value": 6,
            "unit": "% (illustrative)"
          },
          {
            "label": "Other",
            "value": 33,
            "unit": "% (illustrative)"
          },
          {
            "label": "Surface roughness",
            "value": 1.8,
            "unit": "cm RMS (simulated)"
          }
        ],
        "interpretation": "High iron with moderate titanium: an illustrative mare basalt composition."
      },
      {
        "id": "moon-west-highland",
        "destinationId": "moon",
        "name": "Western Highland Margin",
        "category": "Anorthositic highland material",
        "x": -77.3,
        "z": 53.9,
        "radius": 6,
        "description": "Brighter material near the basin wall.",
        "attributes": [
          {
            "label": "SiO2",
            "value": 45,
            "unit": "% (illustrative)"
          },
          {
            "label": "Al2O3",
            "value": 27,
            "unit": "% (illustrative)"
          },
          {
            "label": "CaO",
            "value": 16,
            "unit": "% (illustrative)"
          },
          {
            "label": "Other",
            "value": 12,
            "unit": "% (illustrative)"
          },
          {
            "label": "Albedo",
            "value": 0.18,
            "unit": "(simulated)"
          }
        ],
        "interpretation": "High alumina and calcium with brighter albedo: an illustrative highland signature."
      },
      {
        "id": "moon-se-ejecta",
        "destinationId": "moon",
        "name": "Southeast Ejecta Field",
        "category": "Impact ejecta",
        "x": 68,
        "z": -63.3,
        "radius": 6,
        "description": "Scattered blocks thrown out by a small impact.",
        "attributes": [
          {
            "label": "SiO2",
            "value": 44,
            "unit": "% (illustrative)"
          },
          {
            "label": "FeO",
            "value": 14,
            "unit": "% (illustrative)"
          },
          {
            "label": "Al2O3",
            "value": 17,
            "unit": "% (illustrative)"
          },
          {
            "label": "Other",
            "value": 25,
            "unit": "% (illustrative)"
          },
          {
            "label": "Block density",
            "value": 3,
            "unit": "blocks / 10 m² (simulated)"
          }
        ],
        "interpretation": "Mixed composition between mare and highland values, as expected for mixed impact debris in this simulation."
      },
      {
        "id": "moon-sw-ilmenite",
        "destinationId": "moon",
        "name": "Southwest Dark Patch",
        "category": "Ilmenite-bearing basalt",
        "x": -86.7,
        "z": -35.2,
        "radius": 6,
        "description": "An unusually dark patch on the mare floor.",
        "attributes": [
          {
            "label": "SiO2",
            "value": 39,
            "unit": "% (illustrative)"
          },
          {
            "label": "FeO",
            "value": 19,
            "unit": "% (illustrative)"
          },
          {
            "label": "TiO2",
            "value": 11,
            "unit": "% (illustrative)"
          },
          {
            "label": "Other",
            "value": 31,
            "unit": "% (illustrative)"
          },
          {
            "label": "Albedo",
            "value": 0.07,
            "unit": "(simulated)"
          }
        ],
        "interpretation": "Elevated titanium oxide with very low albedo: an illustrative ilmenite-rich basalt reading."
      }
    ],
  },
};

export function isDestinationId(v: unknown): v is DestinationId {
  return v === "mars" || v === "moon";
}

export function getDestination(id: DestinationId): DestinationConfig {
  return DESTINATIONS[id];
}

export function findSite(siteId: string): GeoSite | undefined {
  for (const d of DESTINATION_IDS) {
    const s = DESTINATIONS[d].sites.find((x) => x.id === siteId);
    if (s) return s;
  }
  return undefined;
}

/** Deterministic simulated temperature for a position (no randomness). */
export function simulatedTemperatureC(d: DestinationConfig, x: number, z: number, heightAboveFloor: number): number {
  const e = d.environment;
  const spatial = Math.sin(x / 47) * Math.cos(z / 61) * e.spatialAmplitudeC;
  return Math.round((e.baseTempC + spatial + heightAboveFloor * e.heightLapseCPerMu) * 10) / 10;
}

/** World X/Z → mini-map pixels. North (−Z, the forward direction at yaw 0) is up. */
export function worldToMap(b: Bounds, size: number, x: number, z: number): { px: number; py: number } {
  return {
    px: ((x - b.minX) / (b.maxX - b.minX)) * size,
    py: ((z - b.minZ) / (b.maxZ - b.minZ)) * size,
  };
}

/** Compass heading in degrees (0 = north/−Z, 90 = east/+X) from camera yaw. */
export function headingDegrees(yaw: number): number {
  const deg = ((-yaw * 180) / Math.PI) % 360;
  return Math.round((deg + 360) % 360);
}
