# Human Input Queue

## Chrome Application Handoff — Genesys Workday

- Status: blocked_authentication
- Platform: LinkedIn → Genesys Workday
- Role: Software Engineer
- Job ID: JR112053-1
- URL: https://genesys.wd1.myworkdayjobs.com/en-US/Genesys/job/Virtual-Office-(Tamil-Nadu)/Software-Engineer_JR112053-1/apply/autofillWithResume?source=Linkedin1
- Reason: Workday requires a Genesys external account before the resume-upload step. The visible form asks for email address, password, and password confirmation.
- State: The user-visible Chrome tab is on step 1 of 7 (Create Account/Sign In); no resume has been uploaded and no application submitted.
- Resume: resumes/Hemant_Kumar_NodeJS_Resume.pdf

## Chrome Application Handoff — Hire Feed

- Status: blocked_unsupported_form
- Platform: LinkedIn → Micro1
- Role: Node.js Developer (Remote)
- Job ID: 4457059483
- URL: https://jobs.micro1.ai/post/bd545591-e88e-48f9-b3a9-cd3716144c8f
- Reason: The local runner prepared the application but stopped before submission because Micro1 uses a multi-step “Next” flow and exposes no adapter-owned final submit control.
- State: Official application tab remains open in Chrome; no final submission was made or verified.
- Resume: resumes/Hemant_Kumar_NodeJS_Resume.pdf

## Chrome Application Handoff — Alignerr

- Status: blocked_unsupported_form
- Platform: LinkedIn → Alignerr
- Role: Back End Developer (AI Infrastructure)
- Job ID: 4457053007
- URL: https://www.alignerr.com/jobs/d1805065-3991-404b-bc83-f3d3baca378b
- Reason: The local runner completed deterministic preparation but stopped before submission because no adapter-owned final submit control was available.
- State: Official application tab remains open in Chrome; no final submission was made or verified.
- Resume: resumes/Hemant_Kumar_NodeJS_Resume.pdf

## Chrome Application Follow-up — Baazi Games

- Status: awaiting_user_confirmation
- Platform: LinkedIn → Google Forms
- Role: Software Engineer (SDE 2 Backend)
- URL: https://in.linkedin.com/jobs/view/software-engineer-at-baazi-games-4453880019
- Reason: External form requires an in-person hiring-drive time slot (10:00 AM or 11:15 AM) and resume upload. Browser confirmation is required immediately before transmitting profile data and submitting.
- State: Form open; no fields entered and no submission made.
- Resume: resumes/Hemant_Kumar_NodeJS_Resume.pdf

## CAPTCHA — GoKwik

- Status: blocked_captcha
- Platform: LinkedIn → GoKwik Keka
- Role: Software Development Engineer II
- URL: https://in.linkedin.com/jobs/view/software-development-engineer-ii-at-gokwik-4453575373
- Reason: Visible CAPTCHA on the official Keka application form; automation will not solve or bypass it. Chrome also rejected resume upload permission.
- State: Form prepared with truthful fields; resume and CAPTCHA remain incomplete; no submission made.
- Resume: resumes/Hemant_Kumar_NodeJS_Resume.pdf

## Chrome Application Follow-up — Cladbe

- Status: resolved_submitted
- Platform: LinkedIn Easy Apply
- Role: Back End Developer
- URL: https://www.linkedin.com/jobs/view/4455423014/apply/?openSDUIApplyFlow=true
- Reason: Authenticated Easy Apply form was completed after user authorization.
- State: Submitted; LinkedIn displayed “Application submitted.”
- Resume: resumes/Hemant_Kumar_NodeJS_Resume.pdf

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

## CAPTCHA — Octillion Media LLC — Senior Software Engineer - MERN Stack
<!-- captcha-queue-key: octillion media llc senior software engineer mern stack generic https jobs smartrecruiters com oneclick ui company octillionmediallc publication 4828a3fc 444e 4562 b108 b0a10139f2a3 dcr ci octillionmediallc 743999762741699 -->

- status: blocked_captcha
- company: Octillion Media LLC
- role: Senior Software Engineer - MERN Stack
- ats: generic
- url: https://jobs.smartrecruiters.com/oneclick-ui/company/OctillionMediaLLC/publication/4828a3fc-444e-4562-b108-b0a10139f2a3?dcr_ci=OctillionMediaLLC
- job_id: 743999762741699
- reason: Human CAPTCHA verification required
- resume: Hemant_Kumar_NodeJS_Resume.pdf
- resume_step: application_opened
- application_state: application_opened
- fields_completed: none recorded
- unresolved_questions: none
- queued_at: 2026-08-21T11:15:47.772Z
- resume_action: After manual CAPTCHA completion, rerun the same payload with --resume-captcha.
## RBS Workday - Software Engineer - Background-check acknowledgment

- Status: resolved_user_instruction
- Platform: RBS Workday
- Job ID: R-00283835
- URL: https://rbs.wd3.myworkdayjobs.com/en-US/RBS/job/Bengaluru/Software-Engineer_R-00283835/apply/autofillWithResume
- Reason: User confirmed that the affirmative acknowledgment option should always be selected for this standard background-check question.
- State: Resolved; browser application preserved on Application Questions for continuation, with no final submission.
- Other deterministic questions available from confirmed facts: Indian nationality = Yes; prior NatWest redundancy = No; prior NatWest misconduct termination = No. Optional reasonable-adjustments question left unanswered.

## RBS Workday - Software Engineer - Voluntary-disclosure consent

- Status: resolved_user_instruction
- Platform: RBS Workday
- Job ID: R-00283835
- URL: https://rbs.wd3.myworkdayjobs.com/en-US/RBS/job/Bengaluru/Software-Engineer_R-00283835/apply/autofillWithResume
- Reason: User confirmed use of workspace facts, Sex = Male, and affirmative special-category consent.
- State: Resolved; browser preserved on Voluntary Disclosures for continuation, with no final submission.

## JCPenney iCIMS - Engineer 1 - Account and required preference blockers

- Status: resolved_submitted
- Platform: JCPenney iCIMS
- Job ID: 2026-8885
- URL: https://careers-jcpenney.icims.com/jobs/8885/engineer-1/candidate
- Reason: JCPenney iCIMS displayed successful submission after the Work Opportunity questionnaire Opt-Out path.
- State: Submitted; success page preserved. Resume: `Hemant_Kumar_NodeJS_Resume.pdf`.

## LinkedIn Easy Apply — Codeyoung — Full Stack Engineer

- Status: blocked_unknown_required_question
- Platform: LinkedIn Easy Apply
- Job ID: 4457301425
- URL: https://www.linkedin.com/jobs/view/4457301425/
- Reason: Required question `What is your expected CTC ?` is rendered as a Yes/No dropdown; LinkedIn rejects the unanswered field with `Please enter a valid answer`.
- State: Contact step, existing Node.js resume, and deterministic questions were prepared; no final review or submission was completed.
- Resume: `resumes/Hemant_Kumar_NodeJS_Resume.pdf`
- Unresolved question: What is your expected CTC ?
- Available options: Yes; No
