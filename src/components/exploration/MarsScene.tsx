"use client";
// Renderer only: emits ready/error/context-loss and obeys `enabled`.
// It never talks to payment or accounting APIs.
import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { MARS } from "@/config/destinations";
import { buildHeightmap, sampleHeight, type Heightmap } from "./heightmap";

export interface MarsSceneProps {
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

function Terrain({ onBuilt }: { onBuilt: (root: THREE.Object3D, hm: Heightmap) => void }) {
  const { scene } = useGLTF(MARS.assetUrl);
  const root = useMemo(() => {
    const r = scene.clone(true);
    // Centre horizontally and scale to world metres.
    const box = new THREE.Box3().setFromObject(r);
    const c = box.getCenter(new THREE.Vector3());
    r.position.set(-c.x * MARS.scale, -c.y * MARS.scale, -c.z * MARS.scale);
    r.scale.setScalar(MARS.scale);
    r.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        const mat = m.material as THREE.MeshStandardMaterial;
        if (mat?.color) mat.color = new THREE.Color(MARS.tint);
        if (mat) mat.roughness = 1;
      }
    });
    return r;
  }, [scene]);

  useEffect(() => {
    onBuilt(root, buildHeightmap(root, MARS.heightmapResolution));
  }, [root, onBuilt]);

  return <primitive object={root} />;
}

function Rover({
  heightmap,
  enabled,
  onPointerLockChange,
  onFirstFrame,
}: {
  heightmap: Heightmap | null;
  enabled: boolean;
  onPointerLockChange: (l: boolean) => void;
  onFirstFrame: () => void;
}) {
  const { camera, gl } = useThree();
  const keys = useRef(new Set<string>());
  const yaw = useRef<number>(MARS.spawn.yaw);
  const pitch = useRef(-0.05);
  const pos = useRef(new THREE.Vector3(MARS.spawn.x, 0, MARS.spawn.z));
  const enabledRef = useRef(enabled);
  const firstFrameSent = useRef(false);
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  // Place at a validated spawn (search outward if the spawn has no ground).
  useEffect(() => {
    if (!heightmap) return;
    for (let r = 0; r < 120; r += 2) {
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
        const x = MARS.spawn.x + Math.cos(a) * r;
        const z = MARS.spawn.z + Math.sin(a) * r;
        const h = sampleHeight(heightmap, x, z);
        if (!Number.isNaN(h)) {
          pos.current.set(x, h + MARS.eyeHeight, z);
          return;
        }
      }
    }
  }, [heightmap]);

  // Clear held keys whenever control is revoked.
  useEffect(() => {
    if (!enabled) keys.current.clear();
  }, [enabled]);

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
      yaw.current -= e.movementX * MARS.mouseSensitivity;
      pitch.current = THREE.MathUtils.clamp(
        pitch.current - e.movementY * MARS.mouseSensitivity,
        -MARS.pitchLimit,
        MARS.pitchLimit,
      );
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
  }, [gl, onPointerLockChange]);

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.1); // clamp after stalls
    if (heightmap && enabledRef.current) {
      const k = keys.current;
      let turn = 0,
        fwd = 0;
      for (const key of k) {
        if (FORWARD.has(key)) fwd += 1;
        if (BACK.has(key)) fwd -= 1;
        if (LEFT.has(key)) turn += 1;
        if (RIGHT.has(key)) turn -= 1;
      }
      yaw.current += Math.sign(turn) * MARS.turnRate * dt;
      if (fwd !== 0) {
        const step = Math.sign(fwd) * MARS.speed * dt;
        const nx = pos.current.x - Math.sin(yaw.current) * step;
        const nz = pos.current.z - Math.cos(yaw.current) * step;
        const half = (heightmap.sizeX / 2) * (1 - MARS.boundsMargin * 2);
        const halfZ = (heightmap.sizeZ / 2) * (1 - MARS.boundsMargin * 2);
        const cx = heightmap.minX + heightmap.sizeX / 2;
        const cz = heightmap.minZ + heightmap.sizeZ / 2;
        const inBounds = Math.abs(nx - cx) <= half && Math.abs(nz - cz) <= halfZ;
        const h = sampleHeight(heightmap, nx, nz);
        const prevGround = pos.current.y - MARS.eyeHeight;
        const slopeOk = Math.abs(h - prevGround) <= Math.abs(step) * MARS.maxSlope + 0.05;
        if (inBounds && !Number.isNaN(h) && slopeOk) pos.current.set(nx, h + MARS.eyeHeight, nz);
        // otherwise keep the last valid pose
      }
    }
    camera.position.copy(pos.current);
    camera.rotation.set(pitch.current, yaw.current, 0, "YXZ");
    if (heightmap && !firstFrameSent.current) {
      firstFrameSent.current = true;
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

export default function MarsScene({ enabled, onReady, onError, onContextLost, onPointerLockChange }: MarsSceneProps) {
  const [heightmap, setHeightmap] = useState<Heightmap | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const readySent = useRef(false);

  const onBuilt = useMemo(
    () => (_root: THREE.Object3D, hm: Heightmap) => {
      const valid = Array.from(hm.heights).filter((h) => !Number.isNaN(h)).length;
      if (valid < hm.res * hm.res * 0.25) {
        onError("Terrain loaded but no usable ground was found.");
        return;
      }
      setHeightmap(hm);
    },
    [onError],
  );

  return (
    <SceneErrorBoundary onError={onError}>
      <Canvas
        ref={canvasRef}
        dpr={[1, 1.5]}
        camera={{ fov: 70, near: 0.1, far: 2000, position: [0, 20, 40] }}
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
        aria-label="Simulated Mars terrain, first-person view"
        role="img"
      >
        <color attach="background" args={["#d9a07a"]} />
        <fog attach="fog" args={["#d9a07a", 60, 320]} />
        <hemisphereLight args={["#ffe2c8", "#5a2a18", 0.9]} />
        <directionalLight position={[80, 120, 40]} intensity={1.6} color="#fff1e0" />
        <Suspense fallback={null}>
          <Terrain onBuilt={onBuilt} />
        </Suspense>
        <Rover
          heightmap={heightmap}
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

useGLTF.preload(MARS.assetUrl);
