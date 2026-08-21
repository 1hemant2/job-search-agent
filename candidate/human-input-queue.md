# Human Input Queue

## GGS — Backend Developer (Node.js) - GGS - BLR

- Company: GGS / Getinz People Freshteam
- Role: Backend Developer (Node.js) - GGS - BLR
- URL: https://getinz-people.freshteam.com/jobs/owvrsM53ohRL/backend-developer-node-js-ggs-blr#applicant-form
- ATS: Freshteam (generic runner)
- Blocker: CAPTCHA challenge on the application form
- Reason: The local runner will not solve or bypass CAPTCHA.
- State: Candidate fields and resume preparation completed; no submission made.
- Resume: resumes/Hemant_Kumar_NodeJS_Resume.pdf

## Initial Setup

- Status: Core setup complete
- Added: 2026-08-20
- Last audited: 2026-08-20
- Reason: All core reusable answers are confirmed. Form-specific personal or legal questions remain deferred until required.

### Deferred Until a Form Requires It

1. House/flat number and street name if the confirmed locality-level address is insufficient. Confirmed address: Roopena Agrahara, Bengaluru, Karnataka 560068, India.
2. Exact employment start day if a form requires a day rather than September 2024.
3. Background-check consent, conflicts of interest, criminal-history declarations, and similar legally significant answers must be confirmed when the exact question is known.

### Confirmed Handling Rules

- International numeric compensation: Research the current market and the company's reported range for the specific role, then choose a realistic value aligned with the candidate's skills and experience.

## CAPTCHA Queue Entry Schema

CAPTCHA and equivalent human-verification entries are application-level blockers. They must not reduce the successful-application target or stop unrelated applications. The local executor writes one idempotent entry per normalized application identity:

- `status: blocked_captcha`
- `company`, `role`, `ats`, `url`, and `job_id` when available
- `reason: Human CAPTCHA verification required`
- selected resume filename, `resume_step`, and `application_state`
- completed field keys only, never copied candidate values
- `queued_at` and a resume instruction

After the user completes the CAPTCHA in the existing browser session, reconstruct the same truthful payload and resume with `--resume-captcha`. A cleared challenge is revalidated before normal submission. Repeated unattended attempts are suppressed until explicit resume; duplicate queue entries are not created. CAPTCHA answers, tokens, cookies, passwords, OTPs, MFA codes, and recovery codes are never stored.

## Resolved — Professional Application Email

- Resolved: 2026-08-20
- Use `meet.hemant.k@gmail.com` for all applications and recruiter outreach.
- `hk443957@gmail.com` is valid and reaches the same inbox, but is not to be used for applications.

## Resolved — Crossing Hurdles Email Selection

- Resolved: 2026-08-20
- LinkedIn verified and made `meet.hemant.k@gmail.com` the primary email address.
- The Crossing Hurdles application was submitted using the canonical professional email.

## CAPTCHA — GGS — Backend Developer (Node.js) - GGS - BLR
<!-- captcha-queue-key: ggs backend developer node js ggs blr generic https getinz people freshteam com jobs owvrsm53ohrl backend developer node js ggs blr applicant form -->

- status: blocked_captcha
- company: GGS
- role: Backend Developer (Node.js) - GGS - BLR
- ats: generic
- url: https://getinz-people.freshteam.com/jobs/owvrsM53ohRL/backend-developer-node-js-ggs-blr#applicant-form
- job_id: not provided
- reason: Human CAPTCHA verification required
- resume: Hemant_Kumar_NodeJS_Resume.pdf
- resume_step: application_opened
- application_state: application_opened
- fields_completed: none recorded
- unresolved_questions: none
- queued_at: 2026-08-21T04:37:14.307Z
- resume_action: After manual CAPTCHA completion, rerun the same payload with --resume-captcha.
