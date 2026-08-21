# Run State

## Active Run

- Status: blocked
- Run ID: RUN-20260821-START20
- Requested target: 20
- Successful submissions this run: 0
- Evaluated jobs this run: 13
- Skipped or ineligible: 0
- Blocked before submission: 12
- Failed: 1
- Fill-only dry runs: 0
- Assessments reached: 0
- Retry attempts: 0
- Current company: none
- Current role: none
- Current job URL: none
- Current application URL: none
- Current job ID: none
- Current ATS: none
- Last checkpoint: 13 suitable listings evaluated with no verified submission; execution paths are blocked or failed, and the preserved Octillion CAPTCHA tab remains open for human completion
- Lifecycle state: blocked

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
- retry count and next action

CAPTCHA checkpoints use lifecycle `blocked_captcha`, preserve only non-secret job identity, ATS, application URL, selected resume filename, workflow step, and blocker reference, and leave the successful-submission counter unchanged. A later `--resume-captcha` execution reconciles the same application after human verification; it must not create a duplicate submission.

It must never contain passwords, OTPs, MFA codes, CAPTCHA values, cookies,
browser state, authentication tokens, or copied candidate answer values.

Update this checkpoint after each meaningful application transition. On restart,
reconcile it against `application-history.md`; confirmed history wins over an
ambiguous checkpoint. Clear the active section after the run reaches a terminal
stop condition.
