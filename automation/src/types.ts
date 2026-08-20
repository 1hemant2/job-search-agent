import type { Page } from "playwright";

export type AtsName =
  | "linkedin"
  | "workday"
  | "greenhouse"
  | "lever"
  | "ashby"
  | "generic";

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
  company: string;
  role: string;
  jobUrl: string;
  applicationUrl?: string;
  jobId?: string;
  ats: AtsName;
  resume: string;
  candidate: CandidatePayload;
  answers: Record<string, AnswerValue>;
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
  message: string;
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
  company: string;
  role: string;
  jobUrl: string;
  ats: AtsName;
  submissionEvidence?: string;
  blocker?: Blocker;
  error?: string;
  dryRun?: boolean;
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
}

export interface AdapterContext {
  page: Page;
  payload: ApplicationPayload;
  workspaceRoot: string;
  dryRun: boolean;
  timeoutMs: number;
  captchaSettleMs?: number;
}
