import { describe, expect, it } from "vitest";
import { DESTINATIONS, DESTINATION_IDS, findSite, headingDegrees, simulatedTemperatureC, worldToMap } from "../../src/config/destinations";
import { buildReport, INTEGRITY_STATEMENT, maskEmail, type MissionData } from "../../src/server/missions/report";

const baseSession = {
  id: "00000000-0000-4000-8000-000000000001",
  destinationId: "moon" as const,
  status: "ENDED",
  startedAt: Date.UTC(2026, 9, 25, 10, 0, 0),
  endedAt: Date.UTC(2026, 9, 25, 10, 1, 0),
  endReason: "USER_EXIT",
  consumedMs: 60000,
};

function obs(siteId: string, at: string) {
  const s = findSite(siteId)!;
  return {
    site_id: s.id,
    dataset_version: DESTINATIONS[s.destinationId].datasetVersion,
    x: s.x,
    z: s.z,
    scanned_at: at,
    snapshot: { name: s.name, category: s.category, attributes: s.attributes, interpretation: s.interpretation, source: "simulated-predefined-dataset" },
  };
}

describe("site dataset", () => {
  it("has unique ids, consistent destinations, compositions that total 100 %, and sites inside bounds", () => {
    const ids = new Set<string>();
    for (const id of DESTINATION_IDS) {
      const d = DESTINATIONS[id];
      expect(d.sites.length).toBeGreaterThanOrEqual(4);
      for (const s of d.sites) {
        expect(ids.has(s.id)).toBe(false);
        ids.add(s.id);
        expect(s.destinationId).toBe(id);
        const comp = s.attributes.filter((a) => a.unit.startsWith("%"));
        expect(comp.reduce((t, a) => t + a.value, 0)).toBe(100);
        expect(s.x).toBeGreaterThan(d.bounds.minX);
        expect(s.x).toBeLessThan(d.bounds.maxX);
        expect(s.z).toBeGreaterThan(d.bounds.minZ);
        expect(s.z).toBeLessThan(d.bounds.maxZ);
        expect(s.description + s.interpretation).not.toMatch(/water ice|confirmed/i);
      }
    }
  });
});

describe("mini-map transform", () => {
  it("maps bounds corners and centre exactly, with north (−Z) up", () => {
    for (const id of DESTINATION_IDS) {
      const b = DESTINATIONS[id].bounds;
      expect(worldToMap(b, 168, b.minX, b.minZ)).toEqual({ px: 0, py: 0 });
      expect(worldToMap(b, 168, b.maxX, b.maxZ)).toEqual({ px: 168, py: 168 });
      const c = worldToMap(b, 168, (b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2);
      expect(c.px).toBeCloseTo(84);
      expect(c.py).toBeCloseTo(84);
      // moving north (−Z) moves the marker up
      expect(worldToMap(b, 168, 0, -10).py).toBeLessThan(worldToMap(b, 168, 0, 10).py);
    }
  });

  it("places a known site at the expected pixel", () => {
    const d = DESTINATIONS.mars;
    const s = d.sites[0];
    const m = worldToMap(d.bounds, 168, s.x, s.z);
    expect(m.px).toBeCloseTo(((s.x - d.bounds.minX) / (d.bounds.maxX - d.bounds.minX)) * 168);
    expect(m.py).toBeCloseTo(((s.z - d.bounds.minZ) / (d.bounds.maxZ - d.bounds.minZ)) * 168);
  });
});

describe("heading and temperature", () => {
  it("converts camera yaw to compass degrees (0 = north, 90 = east)", () => {
    expect(headingDegrees(0)).toBe(0);
    expect(headingDegrees(-Math.PI / 2)).toBe(90); // turning right faces +X (east)
    expect(headingDegrees(Math.PI / 2)).toBe(270);
    expect(headingDegrees(Math.PI)).toBe(180);
  });
  it("simulated temperature is deterministic", () => {
    expect(simulatedTemperatureC(DESTINATIONS.moon, 10, 20, 3)).toBe(simulatedTemperatureC(DESTINATIONS.moon, 10, 20, 3));
  });
});

describe("mission report", () => {
  const telemetry = { distanceMu: 123.456, sampledMs: 50000, acceptedCount: 10, rejectedCount: 0 };

  it("three saved observations produce exactly those three entries, in scan order", () => {
    const data: MissionData = {
      session: baseSession,
      telemetry,
      observations: [
        obs("moon-east-basalt", "2026-10-25T10:00:40Z"),
        obs("moon-central-regolith", "2026-10-25T10:00:10Z"),
        obs("moon-se-ejecta", "2026-10-25T10:00:55Z"),
      ],
    };
    const r = buildReport(data, "m•••@x.com");
    expect(r.observations.map((o) => o.siteId)).toEqual(["moon-central-regolith", "moon-east-basalt", "moon-se-ejecta"]);
    expect(r.statistics.observationCount).toBe(3);
    expect(r.statistics.distanceMu).toBe(123.5);
    expect(r.statistics.averageSpeedMuPerS).toBe(2.47);
    expect(r.statistics.telemetryCoveragePct).toBe(83);
    expect(r.statistics.telemetryNotes.join(" ")).toMatch(/83%/);
    expect(r.observations.every((o) => o.source === "Simulated / predefined dataset")).toBe(true);
    expect(r.integrityStatement).toBe(INTEGRITY_STATEMENT);
    expect(r.mission.endReason).toBe("User exit");
    expect(buildReport(data, "m•••@x.com")).toEqual(r); // deterministic
  });

  it("zero observations produce a truthful zero-observation report", () => {
    const r = buildReport({ session: { ...baseSession, endReason: "BALANCE_EXHAUSTED" }, telemetry, observations: [] }, "x");
    expect(r.observations).toHaveLength(0);
    expect(r.statistics.observationCount).toBe(0);
    expect(r.summary).toMatch(/No observations were saved/);
    expect(r.mission.endReason).toBe("Time exhaustion");
    expect(r.hypotheticalQuestions).toEqual([]);
  });

  it("missing telemetry is reported as unavailable, never invented", () => {
    const r = buildReport({ session: { ...baseSession, endReason: "LEASE_EXPIRED" }, telemetry: null, observations: [] }, "x");
    expect(r.statistics.distanceMu).toBeNull();
    expect(r.statistics.averageSpeedMuPerS).toBeNull();
    expect(r.statistics.telemetryCoveragePct).toBeNull();
    expect(r.statistics.telemetryNotes[0]).toMatch(/No telemetry/);
    expect(r.mission.endReason).toMatch(/Interruption/);
  });

  it("refuses to build a report for an active mission", () => {
    expect(() => buildReport({ session: { ...baseSession, status: "ACTIVE" }, telemetry, observations: [] }, "x")).toThrow();
  });

  it("masks the explorer email", () => {
    expect(maskEmail("mohamed@gmail.com")).toBe("m••••••@gmail.com");
    expect(maskEmail(null)).toBe("LUNARA explorer");
  });
});
