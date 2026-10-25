"use client";
// Lightweight SVG mini-map. Reads the pose store on its own throttled timer (8 Hz),
// so movement never re-renders the 3D scene or the rest of the page.
import { useEffect, useState } from "react";
import { worldToMap, type DestinationConfig } from "@/config/destinations";
import type { PoseStore } from "./pose";

export type SiteMapState = "unscanned" | "pending" | "saved" | "failed";

const SIZE = 168;
const COLORS: Record<SiteMapState, string> = {
  unscanned: "#64d8f5",
  pending: "#f5c76b",
  saved: "#7ee2a8",
  failed: "#ff8a7a",
};

export function MiniMap({
  destination: d,
  pose,
  siteStates,
}: {
  destination: DestinationConfig;
  pose: PoseStore;
  siteStates: Record<string, SiteMapState>;
}) {
  const [p, setP] = useState({ x: d.spawn.x, z: d.spawn.z, yaw: d.spawn.yaw, ready: false });
  useEffect(() => {
    const id = window.setInterval(() => setP({ x: pose.x, z: pose.z, yaw: pose.yaw, ready: pose.ready }), 125);
    return () => window.clearInterval(id);
  }, [pose]);

  const me = worldToMap(d.bounds, SIZE, p.x, p.z);
  // Forward vector at yaw: (-sin, -cos) in world X/Z → same orientation in map space.
  const fx = -Math.sin(p.yaw);
  const fz = -Math.cos(p.yaw);
  const tip = { x: me.px + fx * 11, y: me.py + fz * 11 };
  const left = { x: me.px - fz * 5 - fx * 4, y: me.py + fx * 5 - fz * 4 };
  const right = { x: me.px + fz * 5 - fx * 4, y: me.py - fx * 5 - fz * 4 };

  return (
    <figure className="rounded-lg bg-background/75 p-2 backdrop-blur" aria-label={`${d.name} mini-map`}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="Mini-map: your position and observation sites">
        <rect x="0.5" y="0.5" width={SIZE - 1} height={SIZE - 1} rx="6" fill="#0b1020cc" stroke="#64d8f5" strokeOpacity="0.55" />
        <path d={`M${SIZE / 2} 4 v6`} stroke="#b5c0d6" strokeWidth="1.5" />
        <text x={SIZE / 2} y="20" textAnchor="middle" fontSize="9" fill="#b5c0d6">N</text>
        {d.sites.map((s) => {
          const m = worldToMap(d.bounds, SIZE, s.x, s.z);
          const st = siteStates[s.id] ?? "unscanned";
          return st === "saved" ? (
            <rect key={s.id} x={m.px - 4} y={m.py - 4} width="8" height="8" fill={COLORS.saved} transform={`rotate(45 ${m.px} ${m.py})`}>
              <title>{`${s.name}: saved`}</title>
            </rect>
          ) : (
            <circle key={s.id} cx={m.px} cy={m.py} r="4.5" fill="none" stroke={COLORS[st]} strokeWidth="2">
              <title>{`${s.name}: ${st}`}</title>
            </circle>
          );
        })}
        {p.ready && (
          <polygon
            points={`${tip.x},${tip.y} ${left.x},${left.y} ${right.x},${right.y}`}
            fill="#f3f6fc"
            stroke="#0b1020"
            strokeWidth="1"
          />
        )}
      </svg>
      <figcaption className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="inline-block size-2.5 rounded-full border-2 border-primary" />Site</span>
        <span className="flex items-center gap-1"><span className="inline-block size-2.5 rotate-45 bg-ok" />Saved</span>
        <span className="flex items-center gap-1"><span className="inline-block size-2.5 rounded-full border-2 border-warn" />Saving</span>
        <span className="flex items-center gap-1"><span className="inline-block size-2.5 rounded-full border-2 border-destructive" />Failed</span>
      </figcaption>
    </figure>
  );
}
