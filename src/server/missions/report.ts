// Deterministic mission report built ONLY from persisted mission records, accepted telemetry
// and saved observations. Pure function: same inputs → same report. No AI, no invented findings.
import { DESTINATIONS, simulatedTemperatureC, type DestinationId } from "@/config/destinations";

export const INTEGRITY_STATEMENT =
  "This report contains simulated observations generated within LUNARA’s planetary exploration environment. It does not represent measurements collected by real extraterrestrial instruments.";

export interface MissionData {
  session: {
    id: string;
    destinationId: DestinationId;
    status: string;
    startedAt: number;
    endedAt: number | null;
    endReason: string | null;
    consumedMs: number;
  };
  telemetry: { distanceMu: number; sampledMs: number; acceptedCount: number; rejectedCount: number } | null;
  observations: {
    site_id: string;
    dataset_version: string;
    x: number;
    z: number;
    scanned_at: string;
    snapshot: {
      name: string;
      category: string;
      attributes: { label: string; value: number; unit: string }[];
      interpretation: string;
      source: string;
    };
  }[];
}

export interface MissionReport {
  version: "report-v1";
  mission: {
    id: string;
    explorer: string;
    destinationId: DestinationId;
    destination: string;
    startedAt: string;
    endedAt: string | null;
    endReason: string;
    timeConsumedMs: number;
  };
  statistics: {
    distanceMu: number | null;
    averageSpeedMuPerS: number | null;
    speedDefinition: string;
    observationCount: number;
    sitesScanned: string[];
    telemetryCoveragePct: number | null;
    telemetryNotes: string[];
    environment: { label: string; value: number; unit: string }[];
  };
  observations: {
    siteId: string;
    name: string;
    category: string;
    coordinates: { x: number; z: number; unit: "mu" };
    scannedAt: string;
    attributes: { label: string; value: number; unit: string }[];
    datasetVersion: string;
    interpretation: string;
    source: "Simulated / predefined dataset";
  }[];
  summary: string;
  hypotheticalQuestions: string[];
  integrityStatement: string;
}

const END_REASONS: Record<string, string> = {
  USER_EXIT: "User exit",
  OWNER_ENDED: "User exit (ended from dashboard)",
  BALANCE_EXHAUSTED: "Time exhaustion",
  LEASE_EXPIRED: "Interruption (connection lost; closed at lease cutoff)",
};

const QUESTIONS: Record<string, string> = {
  Regolith: "How would grain size vary with depth below this simulated surface layer?",
  "Basaltic formation": "Would neighbouring outcrops show the same iron and magnesium proportions?",
  "Sedimentary formation": "What process could produce the regular layer spacing recorded here?",
  "Iron-oxide-rich material": "Does the iron-oxide fraction change with slope direction?",
  "Anorthositic highland material": "Where does highland material give way to mare material along the basin wall?",
  "Impact ejecta": "Which nearby crater could have supplied this mixed debris?",
  "Ilmenite-bearing basalt": "How far does the low-albedo patch extend beyond the scanned point?",
};

export function maskEmail(email: string | null): string {
  if (!email) return "LUNARA explorer";
  const [user, domain] = email.split("@");
  if (!domain) return "LUNARA explorer";
  return `${user.slice(0, 1)}${"•".repeat(Math.max(1, Math.min(6, user.length - 1)))}@${domain}`;
}

const round = (v: number, p = 1) => Math.round(v * 10 ** p) / 10 ** p;

export function buildReport(data: MissionData, explorer: string): MissionReport {
  const s = data.session;
  if (s.status === "ACTIVE") throw new Error("Cannot build a report for an active mission");
  const d = DESTINATIONS[s.destinationId];
  const t = data.telemetry;
  const obs = [...data.observations].sort((a, b) => a.scanned_at.localeCompare(b.scanned_at));

  const notes: string[] = [];
  let coverage: number | null = null;
  let distance: number | null = null;
  let speed: number | null = null;
  if (!t) {
    notes.push("No telemetry was recorded for this mission (it predates telemetry or none was received).");
  } else {
    distance = round(t.distanceMu, 1);
    coverage = s.consumedMs > 0 ? Math.min(100, round((t.sampledMs / s.consumedMs) * 100, 0)) : 0;
    speed = t.sampledMs > 0 ? round(t.distanceMu / (t.sampledMs / 1000), 2) : null;
    if (t.acceptedCount === 0) notes.push("No telemetry checkpoints were accepted; distance and speed are unavailable.");
    if (coverage < 90) notes.push(`Telemetry covers ${coverage}% of billed time; distance may be under-reported.`);
    if (t.rejectedCount > 0)
      notes.push(`${t.rejectedCount} checkpoint(s) were excluded as stale or implausible and not counted.`);
  }
  if (t && t.acceptedCount === 0) {
    distance = null;
    speed = null;
  }

  const environment = obs.length
    ? obs.map((o) => ({
        label: `Surface temperature at ${o.snapshot.name} (simulated)`,
        value: simulatedTemperatureC(d, o.x, o.z, 0),
        unit: "°C",
      }))
    : [{ label: `${d.environment.label}, mission baseline`, value: d.environment.baseTempC, unit: "°C" }];

  const categories = new Map<string, number>();
  for (const o of obs) categories.set(o.snapshot.category, (categories.get(o.snapshot.category) ?? 0) + 1);
  const catText = [...categories.entries()].map(([c, n]) => `${c} (${n})`).join(", ");

  const summary =
    obs.length === 0
      ? `No observations were saved during this ${d.name} mission. The report records time and navigation data only.`
      : `${obs.length} observation${obs.length === 1 ? " was" : "s were"} saved during this ${d.name} mission, covering: ${catText}. All values come from LUNARA's predefined simulated dataset.`;

  return {
    version: "report-v1",
    mission: {
      id: s.id,
      explorer,
      destinationId: s.destinationId,
      destination: `${d.name} (simulated)`,
      startedAt: new Date(s.startedAt).toISOString(),
      endedAt: s.endedAt == null ? null : new Date(s.endedAt).toISOString(),
      endReason: END_REASONS[s.endReason ?? ""] ?? (s.endReason ?? "Unknown"),
      timeConsumedMs: s.consumedMs,
    },
    statistics: {
      distanceMu: distance,
      averageSpeedMuPerS: speed,
      speedDefinition: "Recorded distance ÷ telemetry-sampled active time (map units per second).",
      observationCount: obs.length,
      sitesScanned: obs.map((o) => o.site_id),
      telemetryCoveragePct: coverage,
      telemetryNotes: notes,
      environment,
    },
    observations: obs.map((o) => ({
      siteId: o.site_id,
      name: o.snapshot.name,
      category: o.snapshot.category,
      coordinates: { x: round(o.x, 1), z: round(o.z, 1), unit: "mu" as const },
      scannedAt: new Date(o.scanned_at).toISOString(),
      attributes: o.snapshot.attributes,
      datasetVersion: o.dataset_version,
      interpretation: o.snapshot.interpretation,
      source: "Simulated / predefined dataset" as const,
    })),
    summary,
    hypotheticalQuestions: [...categories.keys()].map((c) => QUESTIONS[c]).filter(Boolean),
    integrityStatement: INTEGRITY_STATEMENT,
  };
}
