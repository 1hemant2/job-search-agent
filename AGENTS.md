# Persistent job-application workspace

Detailed workflow policy lives in `.agents/skills/job-application/SKILL.md`.
This file contains only bootstrapping, command modes, and invariants.

## Commands

- `search` runs discovery with the default evaluation limit.
- `search 100` evaluates approximately 100 unique opportunities across the
  configured query variants and sources; the number is not result-card count.
- `search java 100` uses the Java-backend profile and Java-specific query plan.
- `apply native` processes the persisted supported native-application queue.
- `apply native java` processes only Java-profile native queue records.
- `show external` shows the highest-value pending external applications.
- `show external java` filters the manual external queue to the Java profile.
- `mark external <id> applied|skipped` updates the manual external queue.
- `outreach prepare <count>` researches relevant recruiting contacts and saves
  an exact, personalized, deduplicated message batch locally without sending.
- `outreach send <batch-id>` opens the saved profiles and sends the prepared
  messages one at a time, with exact pre-send read-back and durable logging.
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

## Batch tab continuity

For ordinary batch application runs, when a native application is blocked,
incomplete, or requires human input, persist the non-secret blocker and keep
the current browser tab open for follow-up. Mark the tab as a handoff and
continue with the next queued task in a separate new browser tab, preserving
the blocked opening's identity and state. Do not reuse the blocked tab for a
different job, close it, or overwrite its progress. This rule applies only to
ordinary batch runs; `DIRECT_LINK_HANDOFF` remains terminal on failure and must
stop after recording the blocker.

## User workflow preference

When the user explicitly hands off a website task, fill ordinary application
details using confirmed facts already persisted in the workspace and continue
through the workflow without asking the user to repeat them. For external job applications,
the user authorizes checking a standard terms-and-conditions acknowledgment
needed to reach the final review page, then stop and notify the user before any
final submission. This preference does not authorize guessing unknown material
facts, accepting new material legal attestations (such as background checks,
criminal-history declarations, conflicts, or work-authorization statements),
bypassing CAPTCHA/MFA, completing assessments or interviews, transmitting
secrets, or submitting the final application.

When the user explicitly authorizes both preparation and sending of a recruiter
outreach batch, save the exact personalized notes locally and proceed through
the batch without asking for review of each message or the whole batch. Show
all draft text only when requested. This removes a review checkpoint; it does
not authorize outreach beyond the requested batch or bypass message-verification
and site-safety rules.

If the user has already uploaded a resume before handing over an ATS form such
as Workday, preserve that attached resume and continue from the current page.
Do not upload, delete, replace, or reparse it merely because the automated
workflow normally contains a resume-upload step. Backfill blank fields and
correct inaccurate parser-populated fields with confirmed candidate facts from
the workspace while leaving the same resume attached. Upload again only when
the page clearly shows no attachment, the site rejects or loses the file, or
the user explicitly asks to replace it.

Persisted candidate context also states that Enterprise Bot is the candidate's
only employer and that the candidate is the first person in the family to work
in IT, with no relatives at other companies. Backfill employer-history and
familial-relationship questions from these facts automatically when applicable.

## Specific-link handoff mode

When the user provides a specific job or application URL and hands off the task,
enter `DIRECT_LINK_HANDOFF` mode. The provided URL is the authoritative target:
open it, follow only redirects or apply controls that belong to that same
opening, and continue the requested workflow from there. Do not start search,
query expansion, discovery, queue processing, alternate-source lookup, or a
different job as a fallback.

If the specific-link workflow cannot be completed for any reason, record the
actual blocker or failure, tell the user that the application was not completed,
and stop the task. This stop rule overrides normal batch behavior that would
continue with another queued job. A same-opening external application may be
left at the authorized manual handoff point, but it must still be reported as
not completed until the user confirms submission.
