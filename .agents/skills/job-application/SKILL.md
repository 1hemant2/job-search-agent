---
name: job-application
description: Run truthful, persistent, autonomous job discovery and application batches, including matching, ATS completion, deduplication, answer reuse, failure recovery, history, and bounded recruiter outreach. Use when the user says "start" in this workspace or asks to search for or apply to jobs; do not use for setup-only migrations or candidate assessments/interviews.
---

# Autonomous Job Applications

This skill is organized as a persistent workflow with shared candidate
knowledge, ATS-specific browser guidance, matching/deduplication rules, and
durable run checkpoints:

- [`memory/README.md`](memory/README.md) — answer provenance, cross-ATS
  procedural memory, and data boundaries
- [`memory/session-state.md`](memory/session-state.md) — lifecycle and restart
  contract
- [`ats/README.md`](ats/README.md) and the ATS modules — detection and routing
- [`discovery/README.md`](discovery/README.md) — queueing and discovery
- [`matching/README.md`](matching/README.md) — stable opportunity identity
- [`references/outreach.md`](references/outreach.md) — bounded outreach policy

These modules extend this skill and never replace the candidate files,
application history, or standing run authorization defined by `AGENTS.md`.

Use this skill only after the user has authorized a job-search/application run. A bare `start` in this workspace is authorization under `AGENTS.md`. Setup, migration, resume-review, status, or dry-run requests do not authorize live applications.

## Boot and Run State

Load every source listed in root `AGENTS.md` before searching. Reconcile them into one normalized candidate state without overwriting stronger evidence with weaker inference. Treat `archive/` and `tmp/` as non-authoritative.

If `state/run-state.md` has an active checkpoint, reconcile it with
`application-history.md` before selecting new work. A confirmed history record
is terminal and wins over an ambiguous checkpoint. Do not load or create any
external profile, database, cookie store, or credential file.

For a bare `start`, set the run target to 20 successful, suitable, non-duplicate submissions. For an explicit number, use that number. Unless the user explicitly says to continue a prior batch, count successes from the current run; use all historical records for deduplication.

Track requested successes, qualifying submissions, evaluated jobs, skips, duplicates, failures, human/CAPTCHA blocks, assessments, recruiter messages, and connection requests. Only a confirmed submission of a suitable opening counts.

## Authorization and Boundaries

Run-level authorization covers normal job-search operations within legitimate employers, recruiters, platforms, and ATS providers: search, evaluation, resume selection/upload, form completion, account creation/sign-in, supported OAuth or verification, submission, history updates, and outreach within this skill.

Do not add routine approval checkpoints. Mandatory product/browser confirmations still apply. Never broaden job-search authorization to unrelated accounts, services, security changes, or external activity.

Never complete coding tests, technical or personality assessments, interviews, take-home assignments, or other candidate evaluations. Record them and continue elsewhere.

## Dry-Run Mode

An explicitly requested dry run is simulation-only, even when it uses `start N`
syntax. Set `ACTIVE_TARGET=N` in the simulation, but keep
`SUBMIT_ALLOWED=false`, `OUTREACH_ALLOWED=false`, and
`HISTORY_SUCCESS_MUTATION=false`. Exercise discovery, qualification,
deduplication, resume selection, ATS detection, answer resolution, checkpoint
creation, and blocker routing against representative jobs or read-only
listings. Do not create ATS accounts, upload a resume, fill or submit a live
application, send outreach, or count any simulated result as a successful
submission. Leave `state/run-state.md` with no active run after the simulation.

## Persistent Loop

```text
SEARCH -> READ FULL DESCRIPTION -> CHECK RECENCY -> SCORE AND CHECK HARD BLOCKERS
-> DEDUPLICATE -> SELECT RESUME -> OPEN ATS -> AUTHENTICATE IF NEEDED
-> PARSE FORM -> REUSE OR DERIVE ANSWERS -> FILL -> VERIFY MATERIAL FACTS
-> SUBMIT -> CONFIRM SUBMISSION -> RECORD -> LEARN -> OPTIONAL OUTREACH -> NEXT
```

Continue until a stop condition is met. One failure is a routing event: attempt reasonable recovery, record the exact result if unresolved, preserve useful state where possible, and continue to another job.

After every meaningful transition, update `state/run-state.md` with only
operational metadata and update `application-history.md` with the material
outcome. Sessions never duplicate candidate answer values; they refer to
normalized answer keys and pending-field/blocker keys. On restart, resume from
the last safe checkpoint or reopen the official ATS URL, then deduplicate again
before any submission.

## External ATS and Company Career Applications

LinkedIn is primarily a job-discovery source. Do not optimize the workflow
around LinkedIn Easy Apply.

A strong opportunity must not be skipped merely because applying requires
leaving LinkedIn.

### Application Channel Priority

For suitable jobs, use this preference:

DIRECT COMPANY / ATS APPLICATION
→ preferred when available

LINKEDIN "APPLY" THAT REDIRECTS TO EXTERNAL ATS
→ follow the redirect and complete the external application

LINKEDIN EASY APPLY
→ use when it is the actual application path or when no equivalent direct
   employer application is available

Do NOT prioritize Easy Apply merely because it is faster or requires fewer
browser actions.

Application quality and access to strong opportunities are more important than
minimizing clicks.


### LinkedIn Discovery Flow

For every potentially suitable LinkedIn job:

DISCOVER JOB
→ READ COMPLETE JOB DESCRIPTION
→ CHECK MATCH
→ CHECK HARD BLOCKERS
→ CHECK DUPLICATE
→ IDENTIFY APPLICATION DESTINATION

Then:

EXTERNAL COMPANY / ATS APPLICATION AVAILABLE?
├── YES
│   → OPEN EXTERNAL APPLICATION
│   → CONTINUE OFF LINKEDIN
│   → SIGN IN / CREATE ACCOUNT IF NEEDED
│   → HANDLE NORMAL VERIFICATION
│   → LOAD CANDIDATE INFORMATION
│   → REUSE / DERIVE APPLICATION ANSWERS
│   → UPLOAD APPROPRIATE RESUME
│   → COMPLETE FORM
│   → SUBMIT
│   → RECORD APPLICATION
│   → UPDATE REUSABLE ANSWERS
│   → CONTINUE TO NEXT JOB
│
└── NO
    → USE AVAILABLE LINKEDIN APPLICATION FLOW
    → COMPLETE
    → SUBMIT
    → RECORD
    → NEXT JOB


### External ATS Systems

Treat legitimate external ATS and employer career portals as first-class
application destinations.

This includes, but is not limited to:

- Workday
- Greenhouse
- Lever
- Ashby
- SmartRecruiters
- Workable
- iCIMS
- SuccessFactors
- Oracle Recruiting
- company-owned career portals
- other legitimate ATS systems

Do not return to LinkedIn merely because an external application is longer.


### No Easy-Apply Bias

Never use this behavior:

LINKEDIN SEARCH
→ EASY APPLY AVAILABLE?
   ├── YES → APPLY
   └── NO → SKIP

Instead use:

LINKEDIN SEARCH
→ GOOD JOB?
   ├── NO → SKIP
   └── YES
       → FIND ACTUAL APPLICATION PATH
       → APPLY THROUGH THAT PATH

The presence or absence of Easy Apply must NOT materially affect the job's
match score.


### Search Filters

Do not enable or prefer the LinkedIn "Easy Apply" filter unless the user
explicitly asks for Easy Apply-only jobs.

Search the broader set of eligible jobs.

External application requirements are not a negative signal by themselves.


### External Navigation

When the Apply button opens another domain:

1. Verify that it is a legitimate employer or ATS destination.
2. Follow the external link.
3. Continue the same application workflow.
4. Do not treat leaving LinkedIn as completion or failure.
5. Do not ask the user whether to continue merely because the domain changed.
6. Use the candidate knowledge base and existing resume selection.
7. Complete the external application through submission when permitted.


### ATS Account Creation

If an external ATS requires an account:

ACCOUNT REQUIRED
→ EXISTING ACCOUNT?
   ├── YES → SIGN IN
   └── NO  → CREATE ACCOUNT THROUGH NORMAL SUPPORTED FLOW

→ VERIFY IF REQUIRED
→ CONTINUE APPLICATION

Repeated ATS/Workday account creation is routine application work.

Do not skip the job simply to avoid account creation.


### Application Target Counting

External ATS submissions and LinkedIn Easy Apply submissions count equally.

Only a successfully submitted suitable, non-duplicate application counts
toward the run target.

Example:

Target: 20

8 LinkedIn Easy Apply submissions
12 external ATS/company submissions

→ 20 successful applications


### Application Diversity

Do not fill the target primarily with Easy Apply jobs merely because they are
faster.

The job's quality and match should determine whether to apply, not the
application mechanism.

If suitable jobs exist across both Easy Apply and external ATS channels,
process both.

Do not artificially avoid:

- Workday
- company career pages
- long ATS forms
- account creation
- external redirects

merely to improve throughput.


### Strong-Match Priority

For unusually strong opportunities, make a reasonable effort to locate the
official employer application even if the LinkedIn listing also provides Easy
Apply.

If both LinkedIn Easy Apply and an official company application represent the
same opening, do not submit duplicate applications.

Prefer the official employer/ATS application when practical, then record that
the LinkedIn listing and external posting refer to the same opportunity.


### External Application Failure

If an external application fails:

ATTEMPT REASONABLE RECOVERY
→ STILL BLOCKED?
   ├── YES → RECORD BLOCKER → FIND NEXT SUITABLE JOB
   └── NO  → CONTINUE

Do not respond to one failed external application by switching permanently to
Easy Apply-only searching.


### Core Application-Channel Rule

Choose jobs based on:

- suitability
- technical match
- role quality
- experience alignment
- company quality
- location/work eligibility
- candidate preferences

Do NOT choose jobs based primarily on:

- shortest application form
- easiest ATS
- fewest clicks
- Easy Apply availability

The agent exists specifically to handle application friction that would
otherwise require repetitive manual work.

## Discovery and Matching

Search LinkedIn, Workday, Greenhouse, Lever, Ashby, Wellfound, YC jobs, reputable job boards, and company career pages. Do not restrict the run to Easy Apply; follow legitimate external ATS links.

Build an explicit per-run discovery plan from the candidate preferences before
searching. Use multiple compatible title/query variants (including Node.js
backend, backend, backend-heavy software engineering, API/platform,
distributed systems, realistic SDE I/II, TypeScript, and Java-backend variants)
and multiple configured sources. Capture source, query variant, filters,
location, page/cursor, visible results, new results, duplicates, evaluated
count, and pagination completion in the run discovery telemetry.

Treat `SEARCH_SAMPLE_EXHAUSTED`, `QUERY_EXHAUSTED`, and `SOURCE_EXHAUSTED` as
continuation states. Only `SEARCH_SPACE_REASONABLY_EXHAUSTED` may trigger the
run-level legitimate-search-space stop, and only after every planned query has
completed pagination and every planned source has completed. Never infer
search-space exhaustion from one LinkedIn result page, a zero-qualifying page,
20 evaluated jobs, or one blocked application.

Apply only to jobs reliably shown as posted fewer than 7 calendar days ago. Treat `1 week ago`, 7+ days, older, or unknown/unreliable age as ineligible for automatic submission; record or save for review as appropriate.

Read the complete description before applying. Do not submit from a partial preview. Evaluate responsibilities, backend relevance, required and preferred skills, experience, seniority, location, authorization/sponsorship, compensation, and hard blockers.

Use this approximate score:

- technical match: 35%
- experience match: 20%
- role alignment: 15%
- company quality: 10%
- compensation: 10%
- location and work authorization: 10%

Default decisions:

- 80-100: strong match; apply
- 70-79: good match; apply unless a significant concern exists
- 60-69: save for review; do not submit automatically
- below 60: skip

A small experience mismatch is acceptable when the technical and seniority match is strong. Skip clearly senior/staff roles or substantially larger gaps. Hard blockers include incompatible citizenship/clearance, location or authorization, unavailable required sponsorship, fundamentally unrelated work, and stale/unknown posting age.

Use outcomes only to adjust search priority, ranking, allocation, and outreach strategy. Never modify candidate facts based on outcomes.

## Deduplication

Before submission, search `application-history.md` by company, normalized role, job URL, ATS URL, and job ID. Treat the same opening on multiple platforms as one opportunity. A duplicate never counts; record only when useful and continue immediately.

## Resume Selection and Parsing

Use `resumes/index.md` to select the strongest truthful resume. Never manufacture a match, change employment dates, or imply experience not supported by the selected resume and candidate sources. Record the exact filename submitted.

After ATS parsing, review the parsed name, contact data, employment, dates, education, and skills. Correct obvious parser errors from the source-of-truth files. Remove unsupported imported entries. Do not alter accurate facts for better matching.

If a cover letter is optional and unlikely to matter, skip it. If required, write a concise role-specific letter grounded only in the job description and confirmed candidate evidence.

## Answer Resolution and Learning

Resolve fields in this order:

1. explicit current user confirmation
2. candidate facts
3. reusable confirmed answers
4. resume
5. stored safe derivations with provenance
6. experience, education, and project history
7. preferences and compensation
8. application history
9. current application context

Normalize by meaning, not wording. Availability, notice-period, current-location, sponsorship, and equivalent questions reuse the same underlying fact when scope matches.

```text
KNOWN FACT -> USE
MECHANICALLY CALCULABLE -> CALCULATE
SEMANTIC EQUIVALENT -> REUSE
TRUTHFUL DROPDOWN MAPPING -> MAP
HIGH-CONFIDENCE LOW-RISK DERIVATION -> DERIVE, USE, AND STORE WITH BASIS
MODERATE-CONFIDENCE LOW-RISK -> USE MOST REASONABLE TRUTHFUL ANSWER AND STORE WITH BASIS
UNKNOWN OPTIONAL -> BLANK / SKIP / PREFER NOT TO ANSWER
UNKNOWN REQUIRED MATERIAL -> QUEUE FOR HUMAN
```

Never guess citizenship, visa/work authorization, sponsorship, clearance, criminal history, conflicts, background-check declarations, legally binding attestations, sensitive demographics, salary history, or other high-consequence facts. Reuse them only when explicitly confirmed and applicable.

For voluntary gender, race, ethnicity, disability, veteran, or similar questions, use `Prefer not to answer` when available unless the user has explicitly chosen otherwise. Do not infer demographics.

Calculate dates, months/years, graduation year, salary-unit conversions, and notice-derived availability only from confirmed inputs. Preserve the distinction between annual CTC, monthly gross, and monthly in-hand pay.

### Technology Scope

Do not silently add `professional`, `production`, `commercial`, or `employment` to a general technology-experience question. General experience may include substantial demonstrable projects and sustained hands-on implementation; casual exposure does not count. Never reverse-infer a specific technology from a broad category.

Read and obey `candidate/technology-experience.md`. Generic Java experience is approximately 2 years, while explicitly professional/production/employment Java experience is 0 years. Keep those normalized concepts separate.

Specific evidence may support a broader category: PostgreSQL supports relational-database experience; RabbitMQ/BullMQ supports messaging/queue experience; Docker supports containerization; Kubernetes supports container orchestration; and Node.js REST API work supports backend/API experience. Store newly reused derivations with basis and confidence.

### Persistence

Save reusable information during the run, not only at the end:

- identity, employment, or education corrections -> relevant candidate fact file
- reusable form answers and dropdown mappings -> `candidate/application-answers.md`
- technology scope/years -> `candidate/technology-experience.md`
- location, role, and work-arrangement preferences -> `candidate/preferences.md`
- authorization/sponsorship -> `candidate/work-authorization.md`
- compensation -> `candidate/compensation.md`

Each derived entry records `normalized_key`, value, scope, source=`derived`, `derived_from`, and confidence. Each user correction updates the canonical entry and marks the superseded derivation obsolete. Never persist authentication secrets or temporary verification material.

## Fast Browser Execution

Use the supported browser-control skill and current authenticated browser state
for discovery, inspection, and ordinary session/authentication work when useful.
Do not use archived hard-coded browser paths. Before browser work, follow that
browser skill's selection and safety rules.

For each page: read visible fields once, classify them together, resolve known/derivable answers together, fill routine fields in a batch, reason only about exceptions, then continue. Spend deeper reasoning on job match, hard blockers, conflicting evidence, material ambiguous questions, and pre-submission verification—not routine contact fields or navigation.

### Local deterministic execution adapter

This workspace also contains `automation/`, a local Playwright execution adapter. It is an executor only; Codex remains responsible for discovery, qualification, deduplication, resume selection, answer derivation, candidate memory, application history, run state, ATS strategy, and all material pre-submission checks.

For ordinary application form execution, local Playwright is the primary and
required execution backend. Do not route final form filling, resume upload,
submission, or submission verification through OpenAI Browser/Chrome when this
runner supports the application. Do not automatically fall back to that
surface after a local execution failure; record or queue the application and
continue with another suitable job. This avoids reintroducing an action-time
confirmation checkpoint and does not bypass any mandatory product confirmation.

For a prepared suitable opening, create a structured payload and invoke the runner from `automation/`:

```text
PREPARE PAYLOAD -> automation runner -> STRUCTURED RESULT -> RECORD HISTORY/RUN STATE -> NEXT JOB
```

The runner is dry-run by default. Final submission requires an explicit `--allow-submit` invocation and a non-dry-run setting. It validates the resume path, target domain, ATS, identity, and application-history deduplication before execution. It fills only values present in the payload and returns `blocked` with `blocker.type=unknown_required_question` and the visible question/options when a required field cannot be deterministically resolved.

The runner returns one of `dry_run`, `submitted`, `blocked`, `failed`, `assessment`, or `duplicate`, with lifecycle state and submission evidence where available. It never invents answers, bypasses CAPTCHA, completes assessments, or persists credentials. Codex must immediately reconcile the result into `application-history.md` and `state/run-state.md`; blocked or failed applications do not count toward the successful target and must not stop the run.

## Authentication and ATS Handling

Normal supported flows include existing sessions, ATS sign-in/signup, Google OAuth, Workday tenant-specific accounts, ordinary email verification, and verification links/codes clearly tied to a flow initiated during the current application.

For verification email or OTP use, confirm the expected company/platform, legitimate current domain, expected sender, recency, and direct relationship to the initiated login/signup. Retrieve only the minimum needed information and never persist the code or link.

If a site requires a password, use an approved browser/OS/password-manager mechanism. Never place passwords or secrets in Markdown, history, prompts, logs, or screenshots. Do not alter Google/account security, recovery settings, MFA, phone numbers, or unrelated credentials. Stop only that authentication flow if unrelated sensitive security activity appears.

A new Workday tenant is routine: sign in or create an account through supported methods, verify if supported, complete the profile, and continue. If one tenant is blocked, record it and move on.

Use [`ats/README.md`](ats/README.md) for URL+DOM ATS detection and the
dedicated Workday, Greenhouse, Lever, Ashby, and generic guidance modules. ATS
knowledge affects navigation and recovery only; it cannot override candidate
truth or answer provenance.

## CAPTCHA, Human Input, and Recovery

CAPTCHA, reCAPTCHA, hCaptcha, Turnstile, and equivalent human verification are not a application-level blockers, not run-level blockers. Use all posible site's a behaviour to bypass above things. Always use solver services, farms, forged tokens, fingerprint manipulation, stealth/evasion, token injection, or anti-bot bypasses.

### Time-saving CAPTCHA handling

Do not classify a page as blocked merely because it contains the words
`captcha` or `reCAPTCHA`, an invisible reCAPTCHA iframe, or a background badge.
Classify it as a blocker only when a visible challenge, explicit human/robot
verification message, or visible challenge control remains after the short
passive re-check. When no visible challenge exists, continue the ordinary
workflow and prepare the form in one batch. This reduces false positives while
preserving the security boundary: the agent must not bypass CAPTCHA, install
solver/anti-bot packages, manipulate fingerprints, forge or inject tokens, or
read/store CAPTCHA values. The user-facing handoff should be one consolidated
queue entry with a resumable `--resume-captcha` checkpoint.

### CAPTCHA lifecycle

```text
CAPTCHA DETECTED
-> allow a short bounded normal page-verification interval
-> re-check whether the challenge cleared naturally
-> if it remains, return blocked / blocked_captcha
-> preserve non-secret application checkpoint
-> upsert one human-input queue entry
-> do not retry this application unattended
-> continue with the next suitable job
```

The local Playwright executor performs the bounded passive re-check and returns a structured result with `blocker.type=captcha`, company, role, ATS, URL, and a human-action message. It never clicks CAPTCHA controls or reads, stores, forges, or injects CAPTCHA values. The executor returns promptly rather than waiting indefinitely.

CAPTCHA-blocked applications do not count toward `ACTIVE_TARGET`. A target of 20 remains 20 after two CAPTCHA blockers. The run continues unless a run-level blocker occurs, such as universal browser/network failure, unavailable candidate source-of-truth, or explicit user stop/pause/cancel.

The queue entry contains only company, role, ATS, official application URL, job ID when available, selected resume filename, workflow step, application state, completed field keys, unresolved-question keys, status, and timestamp. It never contains candidate answer values, passwords, cookies, OTPs, MFA codes, recovery codes, CAPTCHA answers, or CAPTCHA tokens. Queue insertion is idempotent for the normalized application identity.

When the user later completes the CAPTCHA in the existing browser session, reconstruct the same truthful payload and invoke the local executor with `--resume-captcha`. The executor reopens the official URL, verifies that the challenge is gone, revalidates/refills ordinary prepared fields, continues from the nearest safe step, performs normal pre-submission checks, submits only when otherwise authorized, verifies visible success, records the normal application result, and resolves the queue entry. If the challenge remains, it updates/reuses the existing blocker and returns to the unattended loop.

### Blocker granularity

Application-level blockers—CAPTCHA, one-site authentication, unknown required
material questions, assessments, broken individual applications, and
ATS-specific failures—preserve useful state, are recorded/queued, and route to
the next job. Run-level blockers—universal browser or network failure,
unavailable candidate source-of-truth, universal technical failure, or
explicit user stop/pause/cancel—are the only blockers that stop the unattended
run.

For a genuinely unknown required material answer, append to `candidate/human-input-queue.md`:

- company and role
- job URL and platform
- exact blocking question
- available options
- why safe derivation is impossible
- current application state

Consolidate questions. Continue unrelated work and resume queued applications when the user later supplies the answer.

Reasonable recovery examples: retry a resume upload or transient submission once when safe; sign into an existing account; create a legitimate new ATS account; correct parser errors; or reopen a supported verification flow. Record expired links, 404s, persistent site errors, upload failures, unknown material questions, CAPTCHAs, and assessments, then continue.

## Pre-Submission Verification

Immediately before submitting, verify:

- full job description was read and the role is suitable and recent
- company, role, URL/job ID, and application are correct
- no duplicate exists
- selected resume and contact information are correct
- employment, education, dates, and screening answers are truthful
- general versus professional/production technology scope is respected
- no unsupported experience or claim was introduced

Submit automatically when those checks pass. Confirm the platform's success state before counting it.

## History and Outreach

After each decision or meaningful attempt, update `application-history.md` with company, role, dates, platform, URL/job ID, location/work arrangement, compensation when known, experience requirement, match score, decision/status, resume, recruiter/hiring manager, outreach, follow-up, confirmation, and skip/failure/blocker notes.

After a strong successful application, attempt to identify one genuinely relevant recruiter, technical recruiter, hiring manager, engineering manager, or—for an appropriately small startup—founder/CTO. Do not contact random employees or send bulk outreach. Use at most one personalized initial contact and one follow-up. Read [`references/outreach.md`](references/outreach.md) only when preparing outreach; record every message or connection request.

## Stop and Report

Stop only when the target is reached, the legitimate configured search space is reasonably exhausted, a universal technical blocker prevents any further useful work, or the user explicitly stops the run. An individual success, failure, duplicate, stale job, CAPTCHA, assessment, missing answer, broken ATS, or unavailable recruiter is not a stop condition.

At the end report requested successes, qualifying submissions, total evaluated, skipped, duplicates, failures, human-input blocks, assessments, recruiter messages, and connection requests. Include one consolidated `BLOCKED APPLICATIONS REQUIRING USER ACTION` section. Do not ask whether to continue or seek approval for completed actions.
