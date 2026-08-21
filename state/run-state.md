# Run State

## Active Run

- Status: terminal - recent qualifying search space exhausted; no executable submission path remained
- Run ID: RUN-20260821-START2
- Requested target: 2
- Successful submissions this run: 0
- Evaluated jobs this run: 2
- Skipped or ineligible: 0
- Blocked before submission: 1
- Failed: 1
- Assessments reached: 0
- Retry attempts: CloudSEK 1 user-authorized retry after an earlier unverified submit click
- Last checkpoint: Invisible reCAPTCHA handling was corrected; CloudSEK form was filled and a second submit click completed, but confirmation was again not verifiable, so it was not counted; GGS remains CAPTCHA-blocked
- Lifecycle state: stopped

## Last Completed Run

- Run ID: RUN-20260821-START1
- Requested target: 1
- Successful submissions this run: 1
- Last checkpoint: Synthires / Software Engineer submitted successfully; LinkedIn showed Application submitted
- Job ID: 4452236568
- ATS: LinkedIn Easy Apply
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
