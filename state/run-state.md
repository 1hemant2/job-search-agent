# Run State

## Active Run

- Status: searching
- Run ID: RUN-20260821-START2-RUN2
- Requested target: 2
- Successful submissions this run: 0
- Evaluated jobs this run: 18
- Skipped or ineligible: 11
- Blocked before submission: 2
- Failed: 0
- Fill-only dry runs: 0
- Assessments reached: 0
- Retry attempts: 0
- Current company: none
- Current role: none
- Current job URL: none
- Current application URL: none
- Current job ID: none
- Current ATS: none
- Active query: Node.js Backend Engineer
- Source: LinkedIn
- Location: India
- Page number or cursor: 2
- Scroll-completed status: completed
- Visible job IDs: 4454154464,4457059483,4455304907,4456222404,4457058471,4457053007,4455599485,4455442530,4454184367,4452840047,4455411604
- Evaluated job IDs: 4457068318,4453489815,4456208640,4456236144,4457069299,4457062483,4456083923,4457301552,4456218695,4454613064,4454154464,4457059483,4455304907,4456222404,4457058471,4457053007,4455599485,4455442530,4454184367
- New job IDs: 4453489815,4456208640,4456236144,4457069299,4457062483
- Duplicate job IDs: 4457068318,4456083923,4455442530
- Next-page status: pending
- Source/query exhaustion status: sample_exhausted; continue pagination
- Last checkpoint: LinkedIn page 2 continues to reveal cards while scrolling. Axestrack Software Engineer (4454184367) was fully evaluated and skipped with complete-description evidence. Continue with Software Engineer II (4452840047), then Software Engineer | Remote (4455411604), and continue the visible-card queue before changing pages.
- Lifecycle state: searching

## Last Completed Run

- Run ID: RUN-20260821-LINKEDIN-APPLY
- Requested target: 4 user-selected LinkedIn roles
- Successful submissions this run: 0
- Evaluated jobs: 4
- Blocked before submission: 4
- Last checkpoint: Terminal; all four selected applications reached LinkedIn authentication before submission; no submission counted
- Job ID: 4455423014 (final processed role)
- ATS: LinkedIn
- Selected resume: Hemant_Kumar_NodeJS_Resume.pdf

## Checkpoint Contract

This file is operational state, not candidate knowledge. It may contain only:

- run ID and requested target
- successful-submission count for the current run
- current job identity (company, normalized role, URL, job ID, and ATS)
- current application URL when it differs from the discovery/job URL
- lifecycle state and last completed checkpoint
- selected resume filename
- pending non-sensitive field keys or blocker references
- active query, source, location, page number/cursor, and page-transition state
- scroll-completed status and visible/new/duplicate/evaluated job IDs
- next-page status and source/query exhaustion status
- retry count and next action

CAPTCHA checkpoints use lifecycle `blocked_captcha`, preserve only non-secret job identity, ATS, application URL, selected resume filename, workflow step, and blocker reference, and leave the successful-submission counter unchanged. A later `--resume-captcha` execution reconciles the same application after human verification; it must not create a duplicate submission.

It must never contain passwords, OTPs, MFA codes, CAPTCHA values, cookies,
browser state, authentication tokens, or copied candidate answer values.

Update this checkpoint after each meaningful application transition. On restart,
reconcile it against `application-history.md`; confirmed history wins over an
ambiguous checkpoint. Clear the active section after the run reaches a terminal
stop condition.
