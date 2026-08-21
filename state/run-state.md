# Run State

## Active Run

- Status: searching
- Run ID: RUN-20260821-START2-RUN2
- Requested target: 2
- Successful submissions this run: 0
- Evaluated jobs this run: 25
- Skipped or ineligible: 18
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
- Source: Naukri
- Location: Bengaluru
- Page number or cursor: 1
- Scroll-completed status: completed
- Visible job IDs: 240726012221,040225508253,110826013926,210826004480,200826006652,110826039852,230726033579,070826036568,040826909585,260725501556,300726022012,280126503602,010626503754,260626500651,260626500632,290726005626,110725500053,100826020213,280726929047,040826909517
- Evaluated job IDs: 4457068318,4453489815,4456208640,4456236144,4457069299,4457062483,4456083923,4457301552,4456218695,4454613064,4454154464,4457059483,4455304907,4456222404,4457058471,4457053007,4455599485,4455442530,4454184367
- New job IDs: 240726012221,040225508253,110826013926,210826004480,200826006652,110826039852,230726033579,070826036568,040826909585,260725501556,300726022012,280126503602,010626503754,260626500651,260626500632,290726005626,110725500053,100826020213,280726929047,040826909517
- Duplicate job IDs: 4457068318,4456083923,4455442530
- Next-page status: pending; do not advance until all 20 Naukri cards are processed
- Source/query exhaustion status: page 1 in progress; continue pagination after complete page review
- Last checkpoint: LinkedIn page 2 remains preserved with its unprocessed cards. Naukri query Node.js Backend Engineer, Bengaluru, page 1 is the active atomic review queue. Alpine Senior React Developer (230726033579) was fully read and skipped; continue with Backend Node.js Engineer (070826036568).
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
