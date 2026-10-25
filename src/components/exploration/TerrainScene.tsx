"use client";
// Renderer only: emits ready/error/context-loss, obeys `enabled`, writes the pose store.
// It never talks to payment, accounting or observation APIs.
import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { DestinationConfig } from "@/config/destinations";
import { buildHeightmap, sampleHeight, type Heightmap } from "./heightmap";
import type { PoseStore } from "./pose";

export interface TerrainSceneProps {
  destination: DestinationConfig;
  pose: PoseStore;
  savedSites: ReadonlySet<string>;
  enabled: boolean;
  onReady: () => void;
  onError: (message: string) => void;
  onContextLost: () => void;
  onPointerLockChange: (locked: boolean) => void;
}

// Layout-aware keys: Z/S/Q/D (AZERTY, team decision) and W/S/A/D (QWERTY), plus arrows.
const FORWARD = new Set(["z", "w", "arrowup"]);
const BACK = new Set(["s", "arrowdown"]);
const LEFT = new Set(["q", "a", "arrowleft"]);
const RIGHT = new Set(["d", "arrowright"]);

function Terrain({ d, onBuilt }: { d: DestinationConfig; onBuilt: (hm: Heightmap) => void }) {
  const { scene } = useGLTF(d.assetUrl);
  const root = useMemo(() => {
    const r = scene.clone(true);
    const box = new THREE.Box3().setFromObject(r);
    const c = box.getCenter(new THREE.Vector3());
    r.position.set(-c.x * d.scale, -c.y * d.scale, -c.z * d.scale);
    r.scale.setScalar(d.scale);
    r.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && d.tint) {
        const mat = m.material as THREE.MeshStandardMaterial;
        if (mat?.color) mat.color = new THREE.Color(d.tint);
        if (mat) mat.roughness = 1;
      }
    });
    return r;
  }, [scene, d]);

  useEffect(() => {
    onBuilt(buildHeightmap(root, d.heightmapResolution));
  }, [root, d, onBuilt]);

  // Free GPU resources of the clone when the destination changes or the page unmounts.
  useEffect(
    () => () => {
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) m.geometry?.dispose();
      });
    },
    [root],
  );

  return <primitive object={root} />;
}

function SiteMarkers({ d, hm, saved }: { d: DestinationConfig; hm: Heightmap; saved: ReadonlySet<string> }) {
  return (
    <>
      {d.sites.map((s) => {
        const h = sampleHeight(hm, s.x, s.z);
        if (Number.isNaN(h)) return null;
        const done = saved.has(s.id);
        return (
          <mesh key={s.id} position={[s.x, h + 1.2, s.z]}>
            <cylinderGeometry args={[0.18, 0.18, 2.4, 10]} />
            <meshBasicMaterial color={done ? "#7ee2a8" : "#64d8f5"} transparent opacity={0.85} />
          </mesh>
        );
      })}
    </>
  );
}

function Rover({
  d,
  hm,
  pose,
  enabled,
  onPointerLockChange,
  onFirstFrame,
}: {
  d: DestinationConfig;
  hm: Heightmap | null;
  pose: PoseStore;
  enabled: boolean;
  onPointerLockChange: (l: boolean) => void;
  onFirstFrame: () => void;
}) {
  const { camera, gl } = useThree();
  const keys = useRef(new Set<string>());
  const yaw = useRef<number>(d.spawn.yaw);
  const pitch = useRef(-0.05);
  const pos = useRef(new THREE.Vector3(d.spawn.x, 0, d.spawn.z));
  const enabledRef = useRef(enabled);
  const firstFrameSent = useRef(false);
  const poseRef = useRef(pose); // mutable telemetry store, written outside render

  useEffect(() => {
    poseRef.current = pose;
  }, [pose]);

  useEffect(() => {
    enabledRef.current = enabled;
    if (!enabled) keys.current.clear();
  }, [enabled]);

  // Validated spawn: nearest ground cell inside bounds (spawn placement is never counted as distance).
  useEffect(() => {
    if (!hm) return;
    let floor = Infinity;
    for (const h of hm.heights) if (!Number.isNaN(h) && h < floor) floor = h;
    poseRef.current.floorY = floor;
    for (let r = 0; r < 120; r += 2) {
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
        const x = d.spawn.x + Math.cos(a) * r;
        const z = d.spawn.z + Math.sin(a) * r;
        const h = sampleHeight(hm, x, z);
        if (!Number.isNaN(h) && x >= d.bounds.minX && x <= d.bounds.maxX && z >= d.bounds.minZ && z <= d.bounds.maxZ) {
          pos.current.set(x, h + d.eyeHeight, z);
          yaw.current = d.spawn.yaw;
          return;
        }
      }
    }
  }, [hm, d]);

  useEffect(() => {
    const el = gl.domElement;
    const isEditing = () => {
      const a = document.activeElement as HTMLElement | null;
      return !!a && (a.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(a.tagName));
    };
    const down = (e: KeyboardEvent) => {
      if (!enabledRef.current || isEditing()) return;
      const k = e.key.toLowerCase();
      if (FORWARD.has(k) || BACK.has(k) || LEFT.has(k) || RIGHT.has(k)) {
        keys.current.add(k);
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    const clear = () => keys.current.clear();
    const move = (e: MouseEvent) => {
      if (!enabledRef.current || document.pointerLockElement !== el) return;
      yaw.current -= e.movementX * d.mouseSensitivity;
      pitch.current = THREE.MathUtils.clamp(pitch.current - e.movementY * d.mouseSensitivity, -d.pitchLimit, d.pitchLimit);
    };
    const lockChange = () => {
      const locked = document.pointerLockElement === el;
      if (!locked) clear();
      onPointerLockChange(locked);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", clear);
    document.addEventListener("mousemove", move);
    document.addEventListener("pointerlockchange", lockChange);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", clear);
      document.removeEventListener("mousemove", move);
      document.removeEventListener("pointerlockchange", lockChange);
      if (document.pointerLockElement === el) document.exitPointerLock();
    };
  }, [gl, d, onPointerLockChange]);

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.1); // clamp after stalls
    if (hm && enabledRef.current) {
      poseRef.current.activeMs += dt * 1000;
      let turn = 0,
        fwd = 0;
      for (const key of keys.current) {
        if (FORWARD.has(key)) fwd += 1;
        if (BACK.has(key)) fwd -= 1;
        if (LEFT.has(key)) turn += 1;
        if (RIGHT.has(key)) turn -= 1;
      }
      yaw.current += Math.sign(turn) * d.turnRate * dt;
      if (fwd !== 0) {
        const step = Math.sign(fwd) * d.speed * dt;
        const nx = pos.current.x - Math.sin(yaw.current) * step;
        const nz = pos.current.z - Math.cos(yaw.current) * step;
        const b = d.bounds;
        const inBounds = nx >= b.minX && nx <= b.maxX && nz >= b.minZ && nz <= b.maxZ;
        const h = sampleHeight(hm, nx, nz);
        const prevGround = pos.current.y - d.eyeHeight;
        const slopeOk = Math.abs(h - prevGround) <= Math.abs(step) * d.maxSlope + 0.05;
        if (inBounds && !Number.isNaN(h) && slopeOk) {
          poseRef.current.distance += Math.hypot(nx - pos.current.x, nz - pos.current.z);
          pos.current.set(nx, h + d.eyeHeight, nz);
        }
      }
    }
    camera.position.copy(pos.current);
    camera.rotation.set(pitch.current, yaw.current, 0, "YXZ");
    poseRef.current.x = pos.current.x;
    poseRef.current.z = pos.current.z;
    poseRef.current.groundY = pos.current.y - d.eyeHeight;
    poseRef.current.yaw = yaw.current;
    if (hm && !firstFrameSent.current) {
      firstFrameSent.current = true;
      poseRef.current.ready = true;
      onFirstFrame();
    }
  });

  return null;
}

class SceneErrorBoundary extends Component<{ onError: (m: string) => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    this.props.onError(error.message || "The 3D terrain could not be loaded.");
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function supportsWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export default function TerrainScene({
  destination: d,
  pose,
  savedSites,
  enabled,
  onReady,
  onError,
  onContextLost,
  onPointerLockChange,
}: TerrainSceneProps) {
  const [hm, setHm] = useState<Heightmap | null>(null);
  const readySent = useRef(false);
  // Parent callbacks change identity on every render (the countdown re-renders ~5×/s).
  // Keep the latest ones in a ref so they never re-trigger terrain building or spawn placement.
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const onBuilt = useMemo(
    () => (h: Heightmap) => {
      const valid = Array.from(h.heights).filter((x) => !Number.isNaN(x)).length;
      if (valid < h.res * h.res * 0.25) {
        onErrorRef.current("Terrain loaded but no usable ground was found.");
        return;
      }
      setHm(h);
    },
    [],
  );

  return (
    <SceneErrorBoundary onError={(m) => onErrorRef.current(m)}>
      <Canvas
        dpr={[1, 1.5]}
        camera={{ fov: 70, near: 0.1, far: 3000, position: [0, 20, 40] }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener("webglcontextlost", (e) => {
            e.preventDefault();
            onContextLost();
          });
        }}
        onClick={(e) => {
          if (enabled) (e.target as HTMLCanvasElement).requestPointerLock?.();
        }}
        aria-label={`Simulated ${d.name} terrain, first-person view`}
        role="img"
      >
        <color attach="background" args={[d.sky]} />
        <fog attach="fog" args={[d.sky, d.fog[0], d.fog[1]]} />
        <hemisphereLight args={d.hemisphere} />
        <directionalLight position={d.sun.position} intensity={d.sun.intensity} color={d.sun.color} />
        <Suspense fallback={null}>
          <Terrain d={d} onBuilt={onBuilt} />
        </Suspense>
        {hm && <SiteMarkers d={d} hm={hm} saved={savedSites} />}
        <Rover
          d={d}
          hm={hm}
          pose={pose}
          enabled={enabled}
          onPointerLockChange={onPointerLockChange}
          onFirstFrame={() => {
            if (!readySent.current) {
              readySent.current = true;
              onReady();
            }
          }}
        />
      </Canvas>
    </SceneErrorBoundary>
  );
}
