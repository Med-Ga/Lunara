"use client";
// Mission-control readout. Pose-derived values are sampled at 4 Hz with a monotonic clock.
import { useEffect, useRef, useState } from "react";
import { headingDegrees, simulatedTemperatureC, type DestinationConfig } from "@/config/destinations";
import { formatMMSS } from "@/server/sessions/accounting";
import type { PoseStore } from "./pose";

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

export function TelemetryPanel({
  destination: d,
  pose,
  remainingMs,
  discoveries,
  distance,
}: {
  destination: DestinationConfig;
  pose: PoseStore;
  remainingMs: number;
  discoveries: number;
  distance: () => number;
}) {
  const [v, setV] = useState({ x: 0, z: 0, heading: 0, speed: 0, dist: 0, temp: d.environment.baseTempC });
  const last = useRef<{ t: number; dist: number } | null>(null);

  useEffect(() => {
    last.current = null; // reset sampling anchor on mount / destination change
    const id = window.setInterval(() => {
      const now = performance.now();
      const prev = last.current;
      const speed = prev ? Math.max(0, (pose.distance - prev.dist) / ((now - prev.t) / 1000)) : 0;
      last.current = { t: now, dist: pose.distance };
      setV({
        x: pose.x,
        z: pose.z,
        heading: headingDegrees(pose.yaw),
        speed,
        dist: distance(),
        temp: simulatedTemperatureC(d, pose.x, pose.z, Math.max(0, pose.groundY - pose.floorY)),
      });
    }, 250);
    return () => window.clearInterval(id);
  }, [pose, d, distance]);

  const rows: [string, string][] = [
    ["Destination", `${d.name} (simulated)`],
    ["Time left", formatMMSS(remainingMs)],
    ["Speed", `${v.speed.toFixed(1)} mu/s`],
    ["Distance", `${v.dist.toFixed(0)} mu`],
    ["Position", `X ${v.x.toFixed(0)} · Z ${v.z.toFixed(0)}`],
    ["Heading", `${v.heading}° ${COMPASS[Math.round(v.heading / 45) % 8]}`],
    ["Temperature", `${v.temp.toFixed(0)} °C (sim.)`],
    ["Discoveries", `${discoveries} saved`],
  ];
  return (
    <section aria-label="Exploration telemetry" className="w-60 rounded-lg bg-background/75 p-3 text-xs backdrop-blur">
      <h2 className="mb-2 font-heading text-sm font-bold">Telemetry</h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        {rows.map(([k, val]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="tabular text-right">{val}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-[10px] leading-tight text-muted-foreground">mu = map units (not calibrated to metres).</p>
    </section>
  );
}
