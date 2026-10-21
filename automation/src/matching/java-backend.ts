import { loadMatchingConfig, resolveResumeSelection, selectResumeProfileForJob, type CandidateMatchingConfig, type ResumeProfileId, type SearchProfileId } from "../search-profiles.js";

export type JavaMatchClassification = "APPLY" | "APPLY_STRETCH" | "REVIEW" | "SKIP";
export type JavaExperienceScope = "general" | "professional" | "production" | "commercial" | "preferred" | "unknown" | "none";

export interface ExperienceRequirement {
  minimum: number;
  maximum?: number;
  strict?: boolean;
  text?: string;
}

export interface JavaRequirement {
  level: "core" | "required" | "preferred" | "optional" | "none";
  scope?: JavaExperienceScope;
  minimumYears?: number;
  strict?: boolean;
  text?: string;
}

export interface JavaJobAssessmentInput {
  company?: string;
  role: string;
  description?: string;
  location?: string;
  requiredYoe?: ExperienceRequirement | string;
  javaRequirement?: JavaRequirement | string;
  authorizationEligible?: boolean;
  searchProfile?: SearchProfileId;
  workspaceRoot?: string;
  candidateMatching?: CandidateMatchingConfig;
}

export interface JavaCategoryScores {
  backendRelevance: number;
  experienceAlignment: number;
  javaAlignment: number;
  backendTechnologyMatch: number;
  engineeringQuality: number;
  locationPracticalFit: number;
}

export interface JavaJobAssessment {
  score: number;
  classification: JavaMatchClassification;
  hardBlockers: string[];
  reasonCodes: string[];
  whyCandidateMatches: string[];
  gaps: string[];
  resumeProfile: ResumeProfileId;
  selectedResume: string;
  requiredYoe: string;
  javaRequirement: string;
  javaExperienceScope: JavaExperienceScope;
  categoryScores: JavaCategoryScores;
}

function parseExperience(value: ExperienceRequirement | string | undefined, text: string): ExperienceRequirement | undefined {
  if (value && typeof value !== "string") return value;
  const source = typeof value === "string" ? value : text;
  const flexible = /\b(preferred|nice to have|desirable|flexible)\b/i.test(source);
  const range = source.match(/\b(\d+)\s*(?:-|to)\s*(\d+)\s*(?:years?|yoe)\b/i);
  if (range) return { minimum: Number(range[1]), maximum: Number(range[2]), strict: /\b(required|minimum|must|at least)\b/i.test(source), text: range[0] };
  const plus = source.match(/\b(\d+)\s*\+\s*(?:years?|yoe)\b/i);
  if (plus) return { minimum: Number(plus[1]), strict: !flexible, text: plus[0] };
  const exact = source.match(/\b(\d+)\s*(?:years?|yoe)\b/i);
  if (exact) return { minimum: Number(exact[1]), maximum: Number(exact[1]), strict: /\b(required|minimum|must|at least)\b/i.test(source), text: exact[0] };
  return undefined;
}

function javaScope(text: string): JavaExperienceScope {
  if (/\bprofessional\b.{0,35}\bjava\b|\bjava\b.{0,35}\bprofessional\b/i.test(text)) return "professional";
  if (/\bproduction\b.{0,35}\bjava\b|\bjava\b.{0,35}\bproduction\b/i.test(text)) return "production";
  if (/\bcommercial\b.{0,35}\bjava\b|\bjava\b.{0,35}\bcommercial\b/i.test(text)) return "commercial";
  if (/\bjava\b.{0,35}\b(preferred|nice to have|desirable)\b|\b(preferred|nice to have|desirable)\b.{0,35}\bjava\b/i.test(text)) return "preferred";
  if (/\bjava\b/i.test(text)) return "general";
  return "none";
}

function parseJavaRequirement(value: JavaRequirement | string | undefined, role: string, description: string): JavaRequirement {
  if (value && typeof value !== "string") return { ...value, scope: value.scope ?? "general" };
  const source = typeof value === "string" ? value : `${role}\n${description}`;
  const scope = javaScope(source);
  const years = source.match(/\b(\d+)\s*\+?\s*(?:years?).{0,35}\bjava\b|\bjava\b.{0,35}\b(\d+)\s*\+?\s*(?:years?)/i);
  const minimumYears = years ? Number(years[1] ?? years[2]) : undefined;
  const preferred = scope === "preferred" || /\b(preferred|nice to have|desirable|one of)\b/i.test(source);
  const required = /\b(required|must|minimum|at least)\b/i.test(source);
  const hasJava = /\bjava\b/i.test(source);
  const hasSpring = /\bspring(?: boot| data| security)?\b/i.test(source);
  const level: JavaRequirement["level"] = !hasJava && !hasSpring ? "none" : preferred ? "preferred" : required ? "required" : hasJava && hasSpring ? "core" : "optional";
  return { level, scope, minimumYears, strict: required || /\d+\s*\+/.test(source), text: typeof value === "string" ? value : undefined };
}

function backendRelevance(role: string, text: string): { score: number; blocker?: string } {
  if (/\b(android|mobile|qa|test automation|support engineer|frontend|front-end)\b/i.test(role)) return { score: 0, blocker: "Role is outside backend application engineering" };
  if (/\b(lead|staff|principal)\b/i.test(role)) return { score: 0, blocker: "Seniority is materially above the target level" };
  if (/\b(devops|site reliability|data engineer)\b/i.test(role) && !/\bbackend\b/i.test(role)) return { score: 5, blocker: "Backend application development is secondary" };
  if (/\bfull[ -]?stack\b/i.test(role)) return { score: /\b(backend|java|spring|api|server)\b/i.test(text) ? 15 : 5 };
  if (/\b(backend|back end|server[ -]?side|java developer)\b/i.test(role)) return { score: 25 };
  if (/\bsoftware (development )?engineer|\bsde[ -]?\d\b/i.test(role) && /\b(java|spring|api|microservices?|backend)\b/i.test(text)) return { score: 25 };
  return { score: /\b(java|spring|api|backend)\b/i.test(text) ? 15 : 5 };
}

function experienceScore(requirement: ExperienceRequirement | undefined, candidateYears?: number): number {
  if (!requirement) return 12;
  if (candidateYears !== undefined && requirement.minimum > candidateYears && requirement.strict) return 0;
  if (requirement.minimum <= 1 && (requirement.maximum ?? 2) <= 2) return 20;
  if (requirement.minimum === 2 && requirement.maximum === 2) return 20;
  if (requirement.minimum === 2) return 18;
  if (requirement.minimum === 3 && !requirement.strict) return 12;
  if (requirement.minimum === 3) return 6;
  return 12;
}

function javaScore(requirement: JavaRequirement, text: string): number {
  const hasJava = /\bjava\b/i.test(text);
  const hasSpring = /\bspring(?: boot| data| security)?\b/i.test(text);
  if (hasJava && hasSpring && ["core", "required"].includes(requirement.level)) return 20;
  if (hasJava && ["core", "required"].includes(requirement.level)) return 15;
  if (hasJava && ["preferred", "optional"].includes(requirement.level)) return 10;
  return 0;
}

function technologyScore(text: string): { score: number; matches: string[] } {
  const groups: Array<[string, RegExp]> = [
    ["relational databases and SQL", /\b(postgres(?:ql)?|mysql|sql|database indexing|query optimization)\b/i],
    ["Redis and caching", /\b(redis|caching)\b/i],
    ["queues and messaging", /\b(rabbitmq|kafka|bullmq|message queue|queue-based)\b/i],
    ["REST APIs", /\b(rest(?:ful)? apis?|api development)\b/i],
    ["event-driven systems", /\bevent[ -]?driven\b/i],
    ["microservices", /\bmicroservices?\b/i],
    ["asynchronous processing", /\b(asynchronous|async processing|idempotent consumer|at-least-once)\b/i],
    ["containers and orchestration", /\b(docker|kubernetes)\b/i],
  ];
  const matches = groups.filter(([, pattern]) => pattern.test(text)).map(([label]) => label);
  return { score: Math.min(20, matches.length * 5), matches };
}

function engineeringScore(text: string): { score: number; matches: string[] } {
  const groups: Array<[string, RegExp]> = [
    ["system design and architecture", /\b(system design|architecture|low-level design|lld)\b/i],
    ["performance and scale", /\b(performance|scalability|high-volume|large-scale)\b/i],
    ["distributed systems", /\bdistributed systems?\b/i],
    ["concurrency and reliability", /\b(concurrency|optimistic locking|idempotent|fault tolerance)\b/i],
    ["data-intensive ownership", /\b(data-intensive|ownership|own backend|end-to-end)\b/i],
  ];
  const matches = groups.filter(([, pattern]) => pattern.test(text)).map(([label]) => label);
  return { score: Math.min(10, matches.length * 2), matches };
}

function locationScore(location: string | undefined, authorizationEligible: boolean | undefined): { score: number; blocker?: string } {
  if (!location) return { score: 5 };
  if (/\bremote\b/i.test(location) && authorizationEligible !== false) return { score: 5 };
  if (authorizationEligible === false) return { score: 0, blocker: "Role is not open to candidates located and authorized under the confirmed work-authorization rules" };
  return { score: 2 };
}

function classification(score: number, hardBlockers: string[]): JavaMatchClassification {
  if (hardBlockers.length) return "SKIP";
  if (score >= 75) return "APPLY";
  if (score >= 60) return "APPLY_STRETCH";
  if (score >= 50) return "REVIEW";
  return "SKIP";
}

function experienceLabel(requirement: ExperienceRequirement | undefined): string {
  if (!requirement) return "not stated";
  if (requirement.text) return requirement.text;
  if (requirement.maximum !== undefined && requirement.maximum !== requirement.minimum) return `${requirement.minimum}-${requirement.maximum} years`;
  return `${requirement.minimum}${requirement.maximum === undefined ? "+" : ""} years`;
}

export function evaluateJavaBackendJob(input: JavaJobAssessmentInput): JavaJobAssessment {
  const description = input.description ?? "";
  const text = `${input.role}\n${description}`;
  const experience = parseExperience(input.requiredYoe, text);
  const matching = input.candidateMatching ?? loadMatchingConfig(input.workspaceRoot);
  const candidateYears = matching.professionalExperienceYears;
  const candidateJava = matching.technologyExperience?.java;
  const javaRequirement = parseJavaRequirement(input.javaRequirement, input.role, description);
  const backend = backendRelevance(input.role, text);
  const technology = technologyScore(text);
  const engineering = engineeringScore(text);
  const location = locationScore(input.location, input.authorizationEligible);
  const hardBlockers: string[] = [];
  const reasonCodes: string[] = [];

  if (backend.blocker) {
    hardBlockers.push(backend.blocker);
    reasonCodes.push("ROLE_MISMATCH");
  }
  if (experience && experience.strict && candidateYears !== undefined && experience.minimum > candidateYears) {
    hardBlockers.push(`Strict ${experience.minimum}+ years total experience requirement exceeds the configured candidate experience`);
    reasonCodes.push("EXPERIENCE_HARD_BLOCKER");
  }
  if (["professional", "production", "commercial"].includes(javaRequirement.scope ?? "")
      && javaRequirement.strict) {
    const configuredYears = javaRequirement.scope === "professional"
      ? candidateJava?.professionalYears
      : javaRequirement.scope === "production"
        ? candidateJava?.productionYears
        : candidateJava?.commercialYears;
    if (configuredYears === undefined) {
      hardBlockers.push(`Candidate ${javaRequirement.scope} Java experience is not configured`);
      reasonCodes.push("CANDIDATE_SCOPE_UNKNOWN");
    } else if (configuredYears < (javaRequirement.minimumYears ?? 1)) {
      hardBlockers.push(`Explicit ${javaRequirement.scope} Java experience requirement exceeds the configured candidate scope`);
      reasonCodes.push("PROFESSIONAL_JAVA_REQUIRED");
    }
  }
  if (location.blocker) {
    hardBlockers.push(location.blocker);
    reasonCodes.push("WORK_AUTHORIZATION_MISMATCH");
  }

  const categoryScores: JavaCategoryScores = {
    backendRelevance: backend.score,
    experienceAlignment: experienceScore(experience, candidateYears),
    javaAlignment: javaScore(javaRequirement, text),
    backendTechnologyMatch: technology.score,
    engineeringQuality: engineering.score,
    locationPracticalFit: location.score,
  };
  const score = Object.values(categoryScores).reduce((sum, value) => sum + value, 0);
  const whyCandidateMatches = [
    backend.score >= 15 ? "Role is meaningfully backend-focused" : undefined,
    categoryScores.experienceAlignment >= 18 ? "Experience requirement aligns with the configured candidate experience" : undefined,
    categoryScores.javaAlignment >= 15 && (candidateJava?.generalYears ?? 0) > 0
      ? "Java is central and the candidate has configured hands-on Java experience"
      : categoryScores.javaAlignment >= 15 ? "Java is central to the role" : categoryScores.javaAlignment === 10 ? "Java is an accepted or preferred backend option" : undefined,
    technology.matches.length ? `Transferable backend overlap: ${technology.matches.join(", ")}` : undefined,
    engineering.matches.length ? `Engineering depth signals: ${engineering.matches.join(", ")}` : undefined,
  ].filter((value): value is string => Boolean(value));
  const gaps: string[] = [];
  if (javaRequirement.scope && ["professional", "production", "commercial"].includes(javaRequirement.scope)
      && candidateJava?.[`${javaRequirement.scope}Years` as "professionalYears" | "productionYears" | "commercialYears"] === undefined) {
    gaps.push("Confirm the candidate's Java experience scope before applying; general hands-on work must not be substituted for professional or production experience");
  }

  const resultClassification = classification(score, hardBlockers);
  if (!hardBlockers.length && resultClassification === "SKIP") reasonCodes.push("INSUFFICIENT_MATCH_SCORE");
  const resumeProfile = selectResumeProfileForJob({ role: input.role, description, searchProfile: input.searchProfile ?? "java_backend" }, input.workspaceRoot);
  const selection = resolveResumeSelection({ resumeProfile }, input.workspaceRoot);
  if (!selection) throw new Error(`No resume configured for ${resumeProfile}`);
  return {
    score,
    classification: resultClassification,
    hardBlockers,
    reasonCodes,
    whyCandidateMatches,
    gaps,
    resumeProfile,
    selectedResume: selection.selectedResume,
    requiredYoe: experienceLabel(experience),
    javaRequirement: javaRequirement.text ?? javaRequirement.level,
    javaExperienceScope: javaRequirement.scope ?? "unknown",
    categoryScores,
  };
}
