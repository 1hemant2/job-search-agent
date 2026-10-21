import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { loadResumeConfig, type CandidateResumeConfig, type ResumeProfileConfig } from "./search-profiles.js";

export type OnboardingStatus = "questions_pending" | "ready_for_search";

export interface ResumeSections {
  [section: string]: string;
}

export interface ParsedResume {
  text: string;
  name?: string;
  email?: string;
  phone?: string;
  urls: string[];
  sections: ResumeSections;
  keywords: string[];
}

export interface OnboardingQuestion {
  id: string;
  category: string;
  question: string;
  oftenAskedByPortals: boolean;
  answer: null;
  status: "pending";
}

export interface OnboardingState {
  schemaVersion: 1;
  status: OnboardingStatus;
  createdAt: string;
  updatedAt: string;
  resume: {
    sourceFileName: string;
    selectedResume: string;
    resumeProfile: string;
    parsedTextFile: string;
  };
  extracted: {
    name?: string;
    email?: string;
    phone?: string;
    urls: string[];
    keywords: string[];
  };
  sections: ResumeSections;
  questions: OnboardingQuestion[];
}

export interface OnboardingResult {
  statePath: string;
  questionsPath: string;
  selectedResume: string;
  resumeProfile: string;
  questionCount: number;
  detectedFields: string[];
}

const CANDIDATE_DIRECTORY = "candidate";
const RESUME_DIRECTORY = "candidate/resumes";
const ONBOARDING_STATE = "candidate/onboarding.json";
const ONBOARDING_QUESTIONS = "candidate/onboarding-questions.md";
const PARSED_RESUME = "candidate/parsed-resume.txt";

const SECTION_ALIASES: Record<string, string> = {
  summary: "summary",
  profile: "summary",
  objective: "summary",
  "professional summary": "summary",
  experience: "experience",
  "work experience": "experience",
  employment: "experience",
  "employment history": "experience",
  "professional experience": "experience",
  education: "education",
  skills: "skills",
  "technical skills": "skills",
  "core skills": "skills",
  "core competencies": "skills",
  technologies: "skills",
  projects: "projects",
  certifications: "certifications",
  certificates: "certifications",
  awards: "awards",
  publications: "publications",
  "volunteer experience": "volunteer",
};

const COMMON_TECHNOLOGIES = [
  "JavaScript", "TypeScript", "Node.js", "Python", "Java", "Spring", "Kotlin", "Go", "C#", ".NET",
  "Ruby", "PHP", "React", "Angular", "Vue", "Next.js", "Express", "GraphQL", "REST", "SQL",
  "PostgreSQL", "MySQL", "MongoDB", "Redis", "AWS", "Azure", "GCP", "Docker", "Kubernetes",
  "Terraform", "Jenkins", "GitHub Actions", "Kafka", "RabbitMQ", "Selenium", "Playwright",
];

function normalizeLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function canonicalHeader(value: string): string | undefined {
  const normalized = normalizeLine(value)
    .replace(/[|:]+$/, "")
    .toLowerCase();
  return SECTION_ALIASES[normalized];
}

function looksLikeSectionHeader(value: string): boolean {
  const line = normalizeLine(value);
  if (!line || line.length > 64 || line.startsWith("-") || line.startsWith("•")) return false;
  if (canonicalHeader(line)) return true;
  return /^[A-Z][A-Z0-9 &/+-]{2,63}$/.test(line);
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => normalizeLine(value)).filter(Boolean))];
}

function extractName(lines: string[]): string | undefined {
  const candidates = lines.slice(0, 30).map(normalizeLine).filter((line) => {
    if (!line || line.length < 2 || line.length > 80) return false;
    if (line.includes("@") || /^https?:\/\//i.test(line)) return false;
    if (/\+?\d[\d ()-]{6,}/.test(line)) return false;
    if (canonicalHeader(line)) return false;
    if (/^(resume|curriculum vitae|cv)$/i.test(line)) return false;
    return true;
  });
  return candidates[0];
}

function extractPhone(text: string): string | undefined {
  const match = text.match(/(?:\+?\d[\d .()\-]{7,}\d)/);
  return match ? normalizeLine(match[0]) : undefined;
}

function extractSections(lines: string[]): ResumeSections {
  const sections: ResumeSections = {};
  let current = "intro";
  const content: Record<string, string[]> = { [current]: [] };

  for (const rawLine of lines) {
    const line = normalizeLine(rawLine);
    if (!line) continue;
    const known = canonicalHeader(line);
    if (known) {
      current = known;
      content[current] ??= [];
      continue;
    }
    if (looksLikeSectionHeader(line) && current !== "intro") {
      current = line.toLowerCase().replace(/\s+/g, "_");
      content[current] ??= [];
      continue;
    }
    content[current].push(line);
  }

  for (const [name, values] of Object.entries(content)) {
    const value = values.join("\n").trim();
    if (value) sections[name] = value;
  }
  return sections;
}

function extractKeywords(text: string): string[] {
  const lower = text.toLowerCase();
  return COMMON_TECHNOLOGIES.filter((technology) => {
    const escaped = technology.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}\\b`, "i").test(lower);
  });
}

export function parseResumeText(text: string): ParsedResume {
  const normalizedText = text.replace(/\r/g, "").trim();
  const lines = normalizedText.split("\n");
  const urls = unique([...normalizedText.matchAll(/https?:\/\/[^\s)]+/gi)].map((match) => match[0].replace(/[.,;]+$/, "")));
  const sections = extractSections(lines);
  return {
    text: normalizedText,
    name: extractName(lines),
    email: normalizedText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0],
    phone: extractPhone(normalizedText),
    urls,
    sections,
    keywords: extractKeywords(normalizedText),
  };
}

export function extractResumeText(pdfPath: string): string {
  try {
    return execFileSync("pdftotext", ["-layout", pdfPath, "-"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      throw new Error("Resume parsing needs Poppler's pdftotext command. Install Poppler, then run onboarding again.");
    }
    throw new Error(`Could not extract text from resume PDF: ${detail}`);
  }
}

function safeFileName(fileName: string): string {
  const baseName = path.basename(fileName).replace(/[^A-Za-z0-9._-]+/g, "_");
  const withExtension = /\.pdf$/i.test(baseName) ? baseName : `${baseName}.pdf`;
  return withExtension || "resume.pdf";
}

function copyResume(workspaceRoot: string, sourcePath: string): string {
  const resumeDirectory = path.join(workspaceRoot, RESUME_DIRECTORY);
  fs.mkdirSync(resumeDirectory, { recursive: true });
  const originalName = safeFileName(sourcePath);
  let targetName = originalName;
  let counter = 2;
  while (fs.existsSync(path.join(resumeDirectory, targetName))) {
    const sourceReal = fs.realpathSync(sourcePath);
    const targetReal = fs.realpathSync(path.join(resumeDirectory, targetName));
    if (sourceReal === targetReal) break;
    const stem = originalName.replace(/\.pdf$/i, "");
    targetName = `${stem}-${counter}.pdf`;
    counter += 1;
  }
  const targetPath = path.join(resumeDirectory, targetName);
  if (!fs.existsSync(targetPath) || fs.realpathSync(sourcePath) !== fs.realpathSync(targetPath)) {
    fs.copyFileSync(sourcePath, targetPath);
  }
  return `${RESUME_DIRECTORY}/${targetName}`;
}

function templateFiles(templateRoot: string): string[] {
  if (!fs.existsSync(templateRoot)) return [];
  const result: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(fullPath);
      else result.push(fullPath);
    }
  };
  visit(templateRoot);
  return result;
}

function seedCandidateTemplates(workspaceRoot: string): void {
  const candidateRoot = path.join(workspaceRoot, CANDIDATE_DIRECTORY);
  const templateRoot = path.join(workspaceRoot, "candidate-template");
  fs.mkdirSync(candidateRoot, { recursive: true });
  for (const source of templateFiles(templateRoot)) {
    const relative = path.relative(templateRoot, source);
    const target = path.join(candidateRoot, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (!fs.existsSync(target)) fs.copyFileSync(source, target);
  }
}

function nonTemplateCandidateFiles(workspaceRoot: string): string[] {
  const candidateRoot = path.join(workspaceRoot, CANDIDATE_DIRECTORY);
  const templateRoot = path.join(workspaceRoot, "candidate-template");
  if (!fs.existsSync(candidateRoot)) return [];
  const files: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(fullPath);
      else {
        const relative = path.relative(candidateRoot, fullPath);
        if (relative === "README.md" || relative === ".gitkeep") continue;
        const templatePath = path.join(templateRoot, relative);
        if (!fs.existsSync(templatePath) || fs.readFileSync(fullPath, "utf8") !== fs.readFileSync(templatePath, "utf8")) {
          files.push(relative);
        }
      }
    }
  };
  visit(candidateRoot);
  return files;
}

function updateResumeConfig(workspaceRoot: string, profileId: string, selectedResume: string, keywords: string[]): void {
  const configPath = path.join(workspaceRoot, "candidate/resume-profiles.json");
  const existing = fs.existsSync(configPath)
    ? JSON.parse(fs.readFileSync(configPath, "utf8")) as CandidateResumeConfig
    : loadResumeConfig(workspaceRoot);
  const profile: ResumeProfileConfig = {
    id: profileId,
    label: "Uploaded resume",
    path: selectedResume,
    keywords,
    queryVariants: [["Software Engineer", "software-engineer"]],
    locations: ["Remote"],
  };
  const index = existing.profiles.findIndex((candidate) => candidate.id === profileId);
  if (index >= 0) existing.profiles[index] = { ...existing.profiles[index], ...profile };
  else existing.profiles.push(profile);
  existing.defaultProfile = profileId;
  existing.searchProfiles = (existing.searchProfiles ?? []).filter((searchProfile) => searchProfile.resumeProfile !== profileId);
  existing.searchProfiles.push({
    id: "default",
    aliases: ["default", profileId],
    resumeProfile: profileId,
    queryVariants: [["Software Engineer", "software-engineer"]],
    locations: ["Remote"],
  });
  fs.writeFileSync(configPath, `${JSON.stringify(existing, null, 2)}\n`, "utf8");
}

function question(id: string, category: string, text: string, oftenAskedByPortals = true): OnboardingQuestion {
  return { id, category, question: text, oftenAskedByPortals, answer: null, status: "pending" };
}

export function buildOnboardingQuestions(parsed: ParsedResume): OnboardingQuestion[] {
  const questions: OnboardingQuestion[] = [
    question("identity_name", "Identity", "What full name should job applications use? Confirm or correct the name detected from the resume."),
    question("contact_email", "Contact", "What email address should applications use? Confirm or correct the detected address."),
    question("contact_phone", "Contact", "What phone number should applications use? Include country code if relevant."),
    question("mailing_address", "Contact", "What mailing address, if any, may be stored and used when a portal requires one? Do not store it if you prefer to enter it manually per application."),
    question("current_location", "Location", "What city, region, and country are you currently based in?"),
    question("target_roles", "Preferences", "Which job titles, seniority levels, and technologies should the agent target?"),
    question("work_arrangement", "Preferences", "Which work arrangements are acceptable: remote, hybrid, onsite, or some combination?"),
    question("target_locations", "Preferences", "Which locations are acceptable, and are you willing to relocate?"),
    question("travel", "Preferences", "Are you willing to travel for work, and if so, what level of travel is acceptable?"),
    question("work_authorization", "Work authorization", "In which countries are you authorized to work, and will you need current or future sponsorship?"),
    question("authorization_expiry", "Work authorization", "If your work authorization is time-limited, what expiry or renewal detail should be used? Say not applicable if none."),
    question("employment_status", "Employment", "What is your current employment status, current employer, title, and start date? Confirm any employment history the resume parser may have missed."),
    question("availability", "Employment", "What is your notice period or earliest available start date?"),
    question("employment_gaps", "Employment", "Are there employment gaps, overlapping dates, or other timeline details that need truthful explanation?"),
    question("professional_experience", "Experience", "How many years of professional experience should the agent use, and which technologies were used professionally versus only in projects or learning?"),
    question("education", "Education", "What is your highest completed education, institution, field of study, and graduation year?"),
    question("certifications", "Education", "Which active certifications, licenses, or clearances should be included?"),
    question("compensation", "Compensation", "What compensation range and currency should be used when a portal asks for expectations? Do not provide current compensation unless you explicitly want it stored."),
    question("references", "Application facts", "Do you want to keep references ready for portals that request them? Store contact details only with the reference's permission."),
    question("cover_letter", "Application materials", "Should the agent prepare a tailored cover letter when a portal requests one, and what facts or constraints should it follow?", false),
    question("relatives_or_conflicts", "Application facts", "Are there any relatives at the employer, conflicts of interest, prior employment, or prior applications that a portal may ask about?"),
    question("background_check", "Application facts", "Are you willing to answer standard background-check or employment-verification questions when an application requires them? Material legal questions remain human decisions."),
    question("voluntary_demographics", "Privacy", "Should voluntary demographic questions be skipped where possible, or do you want confirmed answers stored?"),
    question("resume_profile", "Resume", "Should this uploaded resume be the default profile, or should the agent create additional profile variants for different role families?", false),
  ];

  if (!parsed.name) questions.find((item) => item.id === "identity_name")!.question = "What full name should job applications use? It was not reliably detected in the resume.";
  if (!parsed.email) questions.find((item) => item.id === "contact_email")!.question = "What email address should applications use? It was not detected in the resume.";
  if (!parsed.phone) questions.find((item) => item.id === "contact_phone")!.question = "What phone number should applications use? It was not detected in the resume.";
  return questions;
}

function renderQuestions(state: OnboardingState): string {
  const detected = [
    ["Name", state.extracted.name],
    ["Email", state.extracted.email],
    ["Phone", state.extracted.phone],
    ["Links", state.extracted.urls.length ? state.extracted.urls.join(", ") : undefined],
    ["Resume keywords", state.extracted.keywords.length ? state.extracted.keywords.join(", ") : undefined],
  ].filter(([, value]) => value);

  const lines = [
    "# Resume onboarding",
    "",
    "Status: questions pending",
    "",
    "The parser extracted suggestions from the uploaded resume. Treat them as unconfirmed until the candidate confirms or corrects them. Do not use this file as authorization to guess missing legal, employment, compensation, demographic, or work-authorization facts.",
    "",
    "## Detected suggestions",
    "",
    ...(detected.length ? detected.map(([label, value]) => `- ${label}: ${value}`) : ["- No reliable contact fields were detected."]),
    "",
    "## Questions to ask the candidate",
    "",
    ...state.questions.map((item, index) => `${index + 1}. **${item.category} - ${item.id}:** ${item.question}`),
    "",
    "## Portal coverage",
    "",
    "These questions cover common Workday, Greenhouse, Lever, SmartRecruiters, company-career, and native job-platform fields. A specific employer may still ask a new material question; stop and ask the candidate rather than guessing.",
    "",
    "After the candidate answers, persist only confirmed answers in the candidate source-of-truth files, update this onboarding state to ready_for_search, and keep sensitive credentials out of the workspace.",
    "",
  ];
  return lines.join("\n");
}

export function onboardResume(workspaceRoot: string, sourceResume: string, profileId = "primary", force = false): OnboardingResult {
  const sourcePath = path.resolve(sourceResume);
  if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) throw new Error(`Resume file not found: ${sourceResume}`);
  if (!/\.pdf$/i.test(sourcePath)) throw new Error("Onboarding currently accepts PDF resumes. Convert a DOC/DOCX resume to PDF first.");
  const existingCandidateFiles = nonTemplateCandidateFiles(workspaceRoot);
  if (existingCandidateFiles.length && !force) {
    throw new Error(`Candidate data already exists (${existingCandidateFiles.join(", ")}). Use --force only when replacing this onboarding state intentionally.`);
  }

  const parsed = parseResumeText(extractResumeText(sourcePath));
  const selectedResume = copyResume(workspaceRoot, sourcePath);
  seedCandidateTemplates(workspaceRoot);
  updateResumeConfig(workspaceRoot, profileId, selectedResume, parsed.keywords);

  fs.writeFileSync(path.join(workspaceRoot, PARSED_RESUME), parsed.text.endsWith("\n") ? parsed.text : `${parsed.text}\n`, "utf8");
  const now = new Date().toISOString();
  const state: OnboardingState = {
    schemaVersion: 1,
    status: "questions_pending",
    createdAt: now,
    updatedAt: now,
    resume: {
      sourceFileName: path.basename(sourcePath),
      selectedResume,
      resumeProfile: profileId,
      parsedTextFile: PARSED_RESUME,
    },
    extracted: {
      name: parsed.name,
      email: parsed.email,
      phone: parsed.phone,
      urls: parsed.urls,
      keywords: parsed.keywords,
    },
    sections: parsed.sections,
    questions: buildOnboardingQuestions(parsed),
  };
  fs.writeFileSync(path.join(workspaceRoot, ONBOARDING_STATE), `${JSON.stringify(state, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(workspaceRoot, ONBOARDING_QUESTIONS), renderQuestions(state), "utf8");

  const detectedFields = ["name", "email", "phone", "sections", "keywords"].filter((field) => {
    if (field === "sections") return Object.keys(parsed.sections).length > 0;
    if (field === "keywords") return parsed.keywords.length > 0;
    return Boolean(parsed[field as "name" | "email" | "phone"]);
  });
  return {
    statePath: ONBOARDING_STATE,
    questionsPath: ONBOARDING_QUESTIONS,
    selectedResume,
    resumeProfile: profileId,
    questionCount: state.questions.length,
    detectedFields,
  };
}
