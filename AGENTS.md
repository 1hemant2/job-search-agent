# Persistent job-application workspace

Detailed workflow policy lives in `.agents/skills/job-application/SKILL.md`.
This file contains only bootstrapping, command modes, and invariants.

## Commands

- `search` runs discovery with the default evaluation limit.
- `search 100` evaluates approximately 100 unique opportunities across the
  configured query variants and sources; the number is not result-card count.
- `apply native` processes the persisted supported native-application queue.
- `show external` shows the highest-value pending external applications.
- `mark external <id> applied|skipped` updates the manual external queue.
- `start` is retained as a compatibility alias for an authorized run, but it
  now means discovery, evaluation, classification, and queue routing. It does
  not authorize automatic external ATS submission.

Migration and dry-run commands never submit applications.

## Bootstrap sequence

Before `search`, `apply native`, or `start`, load and reconcile, in order:

1. `.agents/skills/job-application/SKILL.md`
2. `candidate/profile.md`
3. `candidate/application-answers.md`
4. `candidate/technology-experience.md`
5. `candidate/experience.md`
6. `candidate/education.md`
7. `candidate/projects.md`
8. `candidate/preferences.md`
9. `candidate/work-authorization.md`
10. `candidate/compensation.md`
11. `resumes/index.md` and resume files
12. `application-history.md`
13. `candidate/human-input-queue.md`
14. `state/credential-registry.md` only for authentication-method presence
15. `state/run-state.md` when present

Candidate files are the source of truth. Never invent identity, employment,
education, dates, skills, authorization, compensation, or demographic facts.
Preserve the distinction between general hands-on technology experience and
professional/production experience, especially the Java interpretation in
`candidate/technology-experience.md`.

## Discovery-first invariant

Every visible result card is opened, fully read, matched, deduplicated, given
an explicit decision, and durably recorded before pagination or source changes.
Description failure is a bounded blocked-description outcome, not a silent
skip. Search stops only at `SEARCH_SPACE_REASONABLY_EXHAUSTED` or the requested
unique-evaluation limit after the planned search space has been processed.

Every evaluated job becomes one canonical `JobOpportunity` identity shared by
the discovery ledger, queues, history reconciliation, and executor payloads.

Qualifying opportunities are classified as `native_easy_apply`,
`external_application`, or `unknown`. Native opportunities go to
`state/queues/native-apply.jsonl`; external opportunities go to
`state/queues/external-apply.jsonl` for manual handling; unknown routes go to
`state/queues/unknown-review.jsonl`. External applications never reach the
Playwright submission executor by default.

## Safety and persistence

Do not modify candidate facts during migration. Preserve resumes, answer
learning, browser profile, telemetry, ATS adapters, and existing history.
Persist each discovery run under `state/runs/<RUN_ID>/`, including the
discovery ledger, search telemetry, executor telemetry, and run summary.
Keep `candidate/human-input-queue.md` for genuine human-required blockers; it
is not the primary job queue.

Never store passwords, OTPs, MFA codes, CAPTCHA values, cookies, tokens, or
recovery codes. Never complete assessments or interviews. A visible CAPTCHA,
MFA, or required human action blocks only that native application and the queue
continues. External applications are already manual-first.
