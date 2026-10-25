// Mutable camera/telemetry state written by the renderer every frame and read by
// HUD widgets on their own throttled timers (no React re-render per frame).
export interface PoseStore {
  ready: boolean;
  x: number;
  z: number;
  groundY: number;
  floorY: number;
  yaw: number;
  /** Cumulative distance of accepted movement steps on this page (mu). Never includes spawn/teleport. */
  distance: number;
  /** Cumulative ms during which control was enabled on this page. */
  activeMs: number;
}

export function createPose(): PoseStore {
  return { ready: false, x: 0, z: 0, groundY: 0, floorY: 0, yaw: 0, distance: 0, activeMs: 0 };
}
