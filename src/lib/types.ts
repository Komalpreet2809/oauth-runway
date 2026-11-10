// Shared guide shape — see research/GUIDE_SCHEMA.md for the rationale.
// Library guides (researched ahead of time) and live guides (generated on demand)
// use exactly the same shape so one renderer handles both.

export type EvidenceLevel = "tested" | "sourced" | "uncertain";

export interface SourceRef {
  url: string;
  title?: string;
  quote?: string;
}

export interface Evidence {
  level: EvidenceLevel;
  sources?: SourceRef[];
  note?: string;
}

export type Difficulty = "easy" | "moderate" | "hard" | "very_hard";
export type Owner = "agent" | "you" | "provider";
export type Phase = "setup" | "test" | "review" | "launch";

export interface Clock {
  label: string;
  note?: string;
}

export interface Stage {
  id: string;
  title: string;
  phase: Phase;
  owner: Owner;
  estimate?: string;
  steps: string[];
  agentHelp?: string | null;
  evidence?: Evidence;
}

export interface Requirement {
  item: string;
  neededFor: "setup" | "testing" | "production";
  evidence?: Evidence;
}

export interface Limit {
  limit: string;
  evidence?: Evidence;
}

export interface Blocker {
  title: string;
  symptom?: string;
  whatToDo: string;
  evidence?: Evidence;
}

export interface Nuance {
  text: string;
  evidence?: Evidence;
}

export interface Probe {
  name: string;
  request: string;
  result: string;
  status: "pass" | "fail" | "info";
  checkedAt?: string;
}

export interface Correction {
  claim: string;
  finding: string;
  source?: string;
}

export interface GuideSource {
  url: string;
  title?: string;
  type?: "official" | "secondary" | "probe";
}

export interface Guide {
  schemaVersion: 1;
  slug: string;
  app: {
    name: string;
    provider?: string;
    website?: string;
    developerPortal?: string;
    category?: string;
    composio?: {
      toolkit?: string;
      managedOAuthAvailable?: boolean | null;
      whenYouNeedYourOwnApp?: string;
    };
  };
  meta: {
    generatedAt: string;
    generatedBy: string;
    lastVerifiedAt?: string;
    model?: string;
    durationMs?: number;
    /** Live guides only: results of the deterministic quote check. */
    verification?: { checked: number; matched: number; downgraded: number; unsupported: number };
  };
  summary: {
    verdict: string;
    difficulty: Difficulty;
    difficultyReason?: string;
    timeToFirstConnection: Clock;
    timeToProduction: Clock;
    handsOnEffort?: string;
    approvalWait?: string;
    costs?: string;
    evidence?: Evidence;
  };
  stages: Stage[];
  requirements: Requirement[];
  limitsBeforeApproval: Limit[];
  blockers: Blocker[];
  nuances: Nuance[];
  agentVsYou: { agentCan: string[]; youMust: string[] };
  composioSetup?: { redirectUri?: string; steps?: string[]; notes?: string };
  probes: Probe[];
  corrections: Correction[];
  openQuestions: string[];
  sources: GuideSource[];
}

/** Events streamed from /api/generate to the browser while the agent works. */
export type AgentEvent =
  | { type: "step"; id: string; label: string; status: "running" | "done" | "error" | "skipped"; detail?: string }
  | { type: "source"; url: string; title?: string }
  | { type: "probe"; probe: Probe }
  | { type: "log"; message: string }
  | { type: "done"; slug: string; cached?: boolean }
  | { type: "error"; message: string };
