import type { Page } from "playwright";
import type { JavaExperienceScope, JavaMatchClassification } from "./matching/java-backend.js";
import type { ResumeProfileId, SearchProfileId } from "./search-profiles.js";

export type AtsName =
  | "linkedin"
  | "workday"
  | "greenhouse"
  | "lever"
  | "ashby"
  | "generic";

export type ApplicationChannel = "native_easy_apply" | "external_application" | "unknown";

export type NativePlatform = "linkedin" | "naukri" | "indeed" | "wellfound" | (string & {});

export type ExternalAts =
  | "workday"
  | "greenhouse"
  | "lever"
  | "ashby"
  | "smartrecruiters"
  | "company"
  | "other";

export type OpportunityStatus =
  | "discovered"
  | "evaluated"
  | "queued_native"
  | "queued_external"
  | "unknown_route"
  | "submitted"
  | "skipped"
  | "blocked"
  | "failed";

/** Canonical opportunity shared by discovery, dedupe, queues, history, and execution. */
export interface JobOpportunity {
  id: string;
  source: string;
  company: string;
  role: string;
  jobUrl: string;
  applicationUrl?: string;
  jobId?: string;
  location?: string;
  workArrangement?: string;
  postingAge?: string | number;
  postingAgeConfidence?: string;
  description?: string;
  descriptionReadComplete: boolean;
  matchScore?: number;
  matchClassification?: JavaMatchClassification;
  searchProfile?: SearchProfileId;
  resumeProfile?: ResumeProfileId;
  selectedResume?: string;
  requiredYoe?: string;
  javaSpringRequirement?: string;
  javaExperienceScope?: JavaExperienceScope;
  whyCandidateMatches?: string[];
  gaps?: string[];
  applicationChannel: ApplicationChannel;
  nativePlatform?: NativePlatform;
  externalAts?: ExternalAts;
  status: OpportunityStatus;
  reasonCodes: string[];
  discoveredAt: string;
}

export type AnswerValue = string | number | boolean | null;

export interface CandidateEducation {
  institution?: string;
  degree?: string;
  field?: string;
  startDate?: string;
  endDate?: string;
}

export interface CandidateEmployment {
  company: string;
  title: string;
  startDate: string;
  endDate?: string;
  current?: boolean;
}

export interface CandidatePayload {
  name: string;
  email: string;
  phone: string;
  location: string;
  linkedin?: string;
  github?: string;
  portfolio?: string;
  education?: CandidateEducation;
  employment?: CandidateEmployment[];
}

export interface ApplicationPayload {
  opportunityId?: string;
  company: string;
  role: string;
  jobUrl: string;
  applicationUrl?: string;
  jobId?: string;
  ats: AtsName;
  resumeProfile?: ResumeProfileId;
  resume: string;
  candidate: CandidatePayload;
  answers: Record<string, AnswerValue>;
  /** Local-runner external execution requires an explicit policy override. */
  applicationChannel?: ApplicationChannel;
  /** Required when a LinkedIn listing redirects to a non-ATS company domain. */
  allowedApplicationDomains?: string[];
}

export type LifecycleState =
  | "discovered"
  | "qualified"
  | "prepared"
  | "executing"
  | "blocked"
  | "blocked_captcha"
  | "submitted"
  | "failed"
  | "assessment";

export type BlockerType =
  | "unknown_required_question"
  | "captcha"
  | "authentication"
  | "identity_mismatch"
  | "unsafe_domain"
  | "duplicate"
  | "resume_upload"
  | "unsupported_form"
  | "submission_not_verified"
  | "browser";

export interface Blocker {
  type: BlockerType;
  company?: string;
  role?: string;
  ats?: AtsName;
  question?: string;
  options?: string[];
  fieldKey?: string;
  url?: string;
  expectedCompany?: string;
  expectedRole?: string;
  expectedJobId?: string;
  observedCompany?: string;
  observedRole?: string;
  observedJobId?: string;
  pageTitle?: string;
  pageTextEvidence?: string;
  message: string;
}

export interface ExecutorTelemetry {
  executor: "local-playwright";
  atsAdapter?: AtsName;
  startingUrl?: string;
  finalUrl?: string;
  pageTitle?: string;
  currentPhase: string;
  visibleEvidence?: string;
}

export type ExecutionStatus =
  | "dry_run"
  | "submitted"
  | "blocked"
  | "failed"
  | "assessment"
  | "duplicate";

export interface ExecutionResult {
  status: ExecutionStatus;
  lifecycle: LifecycleState;
  opportunityId?: string;
  company: string;
  role: string;
  jobUrl: string;
  ats: AtsName;
  submissionEvidence?: string;
  blocker?: Blocker;
  error?: string;
  dryRun?: boolean;
  executorTelemetry?: ExecutorTelemetry;
  durationMs: number;
}

export interface AdapterStepResult {
  ok: boolean;
  details?: string;
  blocker?: Blocker;
}

export interface AtsAdapter {
  readonly name: AtsName;
  matchesUrl(url: string): boolean;
  detect(): Promise<boolean>;
  handleCaptcha(): Promise<AdapterStepResult>;
  openApplication(): Promise<AdapterStepResult>;
  fillKnownFields(): Promise<AdapterStepResult>;
  uploadResume(): Promise<AdapterStepResult>;
  answerQuestions(): Promise<AdapterStepResult>;
  validate(): Promise<AdapterStepResult>;
  detectAssessment(): Promise<boolean>;
  submit(): Promise<AdapterStepResult>;
  verifySubmission(): Promise<AdapterStepResult>;
}

export interface BrowserOptions {
  profileDir?: string;
  headless?: boolean;
  timeoutMs?: number;
}

export interface ExecutionOptions extends BrowserOptions {
  workspaceRoot?: string;
  historyPath?: string;
  dryRun?: boolean;
  allowSubmit?: boolean;
  resumeCaptcha?: boolean;
  runId?: string;
  allowExternalAutomation?: boolean;
}

export interface AdapterContext {
  page: Page;
  payload: ApplicationPayload;
  workspaceRoot: string;
  dryRun: boolean;
  timeoutMs: number;
  captchaSettleMs?: number;
}
