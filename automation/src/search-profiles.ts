import fs from "node:fs";
import path from "node:path";

/** Profile IDs are configuration values, not identities. */
export type SearchProfileId = string;
export type ResumeProfileId = string;

export interface ResumeProfileConfig {
  id: ResumeProfileId;
  label?: string;
  path: string;
  keywords?: string[];
  queryVariants?: Array<[query: string, queryVariant: string]>;
  locations?: string[];
}

export interface SearchProfileConfig {
  id: SearchProfileId;
  aliases: string[];
  resumeProfile: ResumeProfileId;
  resume: string;
  queryVariants: Array<[query: string, queryVariant: string]>;
  locations: string[];
}

export interface CandidateResumeConfig {
  defaultProfile: ResumeProfileId;
  profiles: ResumeProfileConfig[];
  searchProfiles?: Array<{
    id: SearchProfileId;
    aliases?: string[];
    resumeProfile: ResumeProfileId;
    queryVariants?: Array<[query: string, queryVariant: string]>;
    locations?: string[];
  }>;
}

const CONFIG_PATH = "candidate/resume-profiles.json";
const MATCHING_CONFIG_PATH = "candidate/matching-config.json";

export interface CandidateMatchingConfig {
  professionalExperienceYears?: number;
  technologyExperience?: Record<string, {
    generalYears?: number;
    professionalYears?: number;
    productionYears?: number;
    commercialYears?: number;
  }>;
}

const DEFAULT_RESUME_CONFIG: CandidateResumeConfig = {
  defaultProfile: "primary",
  profiles: [
    {
      id: "primary",
      label: "Primary resume",
      path: "candidate/resumes/primary.pdf",
      keywords: ["software engineer", "backend", "api", "platform"],
      queryVariants: [
        ["Software Engineer", "software-engineer"],
        ["Backend Engineer", "backend-engineer"],
        ["API Engineer", "api-engineer"],
      ],
      locations: ["Remote"],
    },
    {
      id: "specialized",
      label: "Specialized resume",
      path: "candidate/resumes/specialized.pdf",
      keywords: ["java", "spring", "kotlin", "jvm"],
      queryVariants: [["Specialized Software Engineer", "specialized-software-engineer"]],
      locations: ["Remote"],
    },
  ],
};

/** Generic aliases retained for the optional Java matching profile and tests. */
export const PRIMARY_RESUME = "candidate/resumes/primary.pdf";
export const SPECIALIZED_RESUME = "candidate/resumes/specialized.pdf";
export const PRIMARY_RESUME_PROFILE: ResumeProfileId = "primary";
export const SPECIALIZED_RESUME_PROFILE: ResumeProfileId = "specialized";

export const RESUME_PATH_BY_PROFILE: Record<ResumeProfileId, string> = Object.fromEntries(
  DEFAULT_RESUME_CONFIG.profiles.map((profile) => [profile.id, profile.path]),
);

const DEFAULT_SEARCH_PROFILES: Record<SearchProfileId, SearchProfileConfig> = {
  node_backend: {
    id: "node_backend",
    aliases: ["node", "nodejs", "node-backend", "default", "general"],
    resumeProfile: PRIMARY_RESUME_PROFILE,
    resume: PRIMARY_RESUME,
    queryVariants: [
      ["Software Engineer", "software-engineer"],
      ["Backend Engineer", "backend-engineer"],
      ["API Engineer", "api-engineer"],
      ["Platform Engineer", "platform-engineer"],
    ],
    locations: ["Remote"],
  },
  java_backend: {
    id: "java_backend",
    aliases: ["java", "java-backend", "spring", "spring-boot", "specialized"],
    resumeProfile: SPECIALIZED_RESUME_PROFILE,
    resume: SPECIALIZED_RESUME,
    queryVariants: [
      ["Java Backend Engineer", "java-backend-engineer"],
      ["Java Software Engineer", "java-software-engineer"],
      ["Backend Engineer Spring", "backend-engineer-spring"],
    ],
    locations: ["Remote"],
  },
};

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/");
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

function cloneDefaultConfig(): CandidateResumeConfig {
  return JSON.parse(JSON.stringify(DEFAULT_RESUME_CONFIG)) as CandidateResumeConfig;
}

function validateConfig(config: CandidateResumeConfig): CandidateResumeConfig {
  if (!Array.isArray(config.profiles) || config.profiles.length === 0) {
    throw new Error(`${CONFIG_PATH} must contain at least one resume profile`);
  }
  const ids = new Set<string>();
  for (const profile of config.profiles) {
    if (!profile?.id || ids.has(profile.id)) throw new Error(`${CONFIG_PATH} contains an invalid or duplicate resume profile id`);
    if (!profile.path || path.isAbsolute(profile.path)) throw new Error(`${CONFIG_PATH} must use workspace-relative resume paths`);
    const normalized = normalizePath(profile.path);
    if (!normalized.startsWith("candidate/resumes/")) throw new Error(`Resume profile ${profile.id} must point inside candidate/resumes/`);
    ids.add(profile.id);
  }
  if (!ids.has(config.defaultProfile)) throw new Error(`${CONFIG_PATH} defaultProfile does not name a configured profile`);
  for (const searchProfile of config.searchProfiles ?? []) {
    if (!searchProfile.id || !ids.has(searchProfile.resumeProfile)) {
      throw new Error(`${CONFIG_PATH} searchProfiles must reference configured resume profiles`);
    }
  }
  return config;
}

export function loadResumeConfig(workspaceRoot?: string): CandidateResumeConfig {
  if (!workspaceRoot) return cloneDefaultConfig();
  const configPath = path.join(workspaceRoot, CONFIG_PATH);
  if (!fs.existsSync(configPath)) return cloneDefaultConfig();
  return validateConfig(JSON.parse(fs.readFileSync(configPath, "utf8")) as CandidateResumeConfig);
}

export function loadMatchingConfig(workspaceRoot?: string): CandidateMatchingConfig {
  if (!workspaceRoot) return {};
  const configPath = path.join(workspaceRoot, MATCHING_CONFIG_PATH);
  if (!fs.existsSync(configPath)) return {};
  return JSON.parse(fs.readFileSync(configPath, "utf8")) as CandidateMatchingConfig;
}

export function resumeProfiles(workspaceRoot?: string): Record<ResumeProfileId, ResumeProfileConfig> {
  return Object.fromEntries(loadResumeConfig(workspaceRoot).profiles.map((profile) => [profile.id, profile]));
}

export function resumePaths(workspaceRoot?: string): Record<ResumeProfileId, string> {
  return Object.fromEntries(loadResumeConfig(workspaceRoot).profiles.map((profile) => [profile.id, normalizePath(profile.path)]));
}

export function searchProfiles(workspaceRoot?: string): Record<SearchProfileId, SearchProfileConfig> {
  const config = loadResumeConfig(workspaceRoot);
  const paths = resumePaths(workspaceRoot);
  if (config.searchProfiles?.length) {
    return Object.fromEntries(config.searchProfiles.map((profile) => [profile.id, {
      id: profile.id,
      aliases: profile.aliases ?? [profile.id],
      resumeProfile: profile.resumeProfile,
      resume: paths[profile.resumeProfile],
      queryVariants: profile.queryVariants?.length ? profile.queryVariants : [[profile.id, profile.id]],
      locations: profile.locations?.length ? profile.locations : ["Remote"],
    }] as const));
  }
  return Object.fromEntries(Object.values(DEFAULT_SEARCH_PROFILES).map((profile) => [profile.id, {
    ...profile,
    resume: paths[profile.resumeProfile] ?? profile.resume,
  }] as const));
}

export const SEARCH_PROFILES = DEFAULT_SEARCH_PROFILES;

export function searchProfileFromToken(token: string | undefined, workspaceRoot?: string): SearchProfileId | undefined {
  if (!token) return undefined;
  const normalized = normalizeToken(token);
  return Object.values(searchProfiles(workspaceRoot)).find((profile) =>
    profile.id === normalized || profile.aliases.some((alias) => normalizeToken(alias) === normalized))?.id;
}

export interface ResumeSelection {
  resumeProfile: ResumeProfileId;
  selectedResume: string;
}

function normalizedResumePath(value: string): string {
  return normalizePath(value).toLowerCase();
}

export function resumeProfileForPath(value: string | undefined, workspaceRoot?: string): ResumeProfileId | undefined {
  if (!value) return undefined;
  const normalized = normalizedResumePath(value);
  return Object.entries(resumePaths(workspaceRoot))
    .find(([, resumePath]) => normalizedResumePath(resumePath) === normalized)?.[0];
}

export function resolveResumeSelection(input: {
  resumeProfile?: ResumeProfileId;
  selectedResume?: string;
}, workspaceRoot?: string): ResumeSelection | undefined {
  const paths = resumePaths(workspaceRoot);
  if (input.resumeProfile && !Object.hasOwn(paths, input.resumeProfile)) {
    throw new Error(`Unknown resumeProfile ${String(input.resumeProfile)}; configure it in ${CONFIG_PATH}`);
  }
  const inferredProfile = resumeProfileForPath(input.selectedResume, workspaceRoot);
  const resumeProfile = input.resumeProfile ?? inferredProfile;
  if (!resumeProfile) return undefined;
  const selectedResume = paths[resumeProfile];
  if (!selectedResume) throw new Error(`Resume profile ${resumeProfile} has no configured path`);
  if (input.selectedResume && normalizedResumePath(input.selectedResume) !== normalizedResumePath(selectedResume)) {
    throw new Error(`resumeProfile ${resumeProfile} does not match selectedResume ${input.selectedResume}`);
  }
  return { resumeProfile, selectedResume };
}

function keywordScore(profile: ResumeProfileConfig, role: string, description: string): number {
  const title = role.toLowerCase();
  const body = description.toLowerCase();
  return (profile.keywords ?? []).reduce((score, keyword) => {
    const normalized = keyword.toLowerCase().trim();
    if (!normalized) return score;
    const escaped = normalized.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");
    return score + (new RegExp(`\\b${escaped}\\b`, "i").test(title) ? 2 : 0)
      + (new RegExp(`\\b${escaped}\\b`, "i").test(body) ? 1 : 0);
  }, 0);
}

/** Title evidence wins over description-only mentions; ties use defaultProfile. */
export function selectResumeProfileForJob(input: {
  role: string;
  description?: string;
  searchProfile?: SearchProfileId;
  profileScores?: Partial<Record<ResumeProfileId, number>>;
}, workspaceRoot?: string): ResumeProfileId {
  const config = loadResumeConfig(workspaceRoot);
  const supplied = input.profileScores ?? {};
  const useSupplied = Object.keys(supplied).length > 0;
  if (useSupplied) {
    const scored = config.profiles
      .filter((profile) => supplied[profile.id] !== undefined)
      .map((profile) => ({ id: profile.id, score: supplied[profile.id]! }));
    if (scored.length) {
      const best = scored.reduce((current, candidate) => candidate.score > current.score ? candidate : current, { id: config.defaultProfile, score: -1 });
      return best.score >= 0 ? best.id : config.defaultProfile;
    }
  }
  const specialized = config.profiles.find((profile) => profile.id === "specialized"
    && (profile.keywords ?? []).some((keyword) => /java|spring|kotlin|jvm/i.test(keyword)));
  if (specialized) {
    const role = input.role.toLowerCase();
    const description = (input.description ?? "").toLowerCase();
    const text = `${role}\n${description}`;
    const nodeTitle = /\b(node(?:\.js|js)?|typescript|javascript)\b/.test(role);
    const javaTitle = /\bjava\b|\bspring(?: boot)?\b/.test(role);
    const springSignal = /\bspring(?: boot| data| security)?\b|\bhibernate\b|\bjpa\b/.test(text);
    const meaningfulJava = javaTitle || springSignal
      || /\bjava\b.{0,35}\b(required|preferred|experience|backend|must|core)\b/.test(text)
      || /\b(required|preferred|experience|must|core)\b.{0,35}\bjava\b/.test(text);
    if (meaningfulJava && !nodeTitle) return specialized.id;
  }
  const scores = config.profiles.map((profile) => ({
    id: profile.id,
    score: keywordScore(profile, input.role, input.description ?? ""),
  }));
  const best = scores.reduce((current, candidate) => candidate.score > current.score ? candidate : current, { id: config.defaultProfile, score: -1 });
  return best.score > 0 ? best.id : config.defaultProfile;
}

export function selectResumeForJob(input: {
  role: string;
  description?: string;
  searchProfile?: SearchProfileId;
  profileScores?: Partial<Record<ResumeProfileId, number>>;
}, workspaceRoot?: string): string {
  const profile = selectResumeProfileForJob(input, workspaceRoot);
  const selection = resolveResumeSelection({ resumeProfile: profile }, workspaceRoot);
  if (!selection) throw new Error(`No resume configured for ${profile}`);
  return selection.selectedResume;
}
