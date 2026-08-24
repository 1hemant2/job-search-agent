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
- `show external java` filters the pending external queue to the Java profile.
- `mark external <id> applied|skipped` updates the external queue.
- `outreach prepare <count>` researches relevant recruiting contacts and saves
  an exact, personalized, deduplicated message batch locally without sending.
- `outreach send <batch-id>` opens the saved profiles and sends the prepared
  messages one at a time, with exact pre-send read-back and durable logging.
- `start <count>` runs one authorized batch in two strictly ordered
  stages: first discover, evaluate, and persist approximately `<count>` unique
  opportunities; then stop searching and process every qualifying saved queue
  item one by one in Chrome. The command authorizes the batch workflow, but it
  cannot waive Chrome's mandatory action-time confirmations for transmitting
  candidate data/files or finally submitting job applications. Group those
  confirmations across the frozen batch as specified below instead of asking
  once per job.
  Treat this command as authorization for every qualifying item that is frozen
  into the batch: do not ask whether to apply to an individual job, whether to
  fill an ordinary known field, whether to use its frozen resume, or whether to
  continue to the next queued item. Ask only the grouped browser confirmations
  below, and never repeat them for a job already covered by the same confirmed
  destination, data, resume, and application set.
  Every URL opened from the frozen manifest remains part of this batch; it does
  not become a `DIRECT_LINK_HANDOFF` merely because Stage 2 is processing one
  specific saved link.
- `continue` and `resume` are aliases for resuming the active unfinished
  authorized `start` batch from persisted state. The user does not need to
  repeat the run ID, tab rules, queue rules, resume choice, or authorization.
  These commands continue only the existing frozen batch and do not authorize
  discovering or adding new jobs.

Migration and dry-run commands never submit applications.

## Bootstrap sequence

Before `search`, `apply native`, `start`, `continue`, or `resume`, load and
reconcile, in order:

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

## Continue/resume invariant

In this workspace, a bare `continue` or `resume` means: resume the active
unfinished authorized batch without asking the user to restate its mechanics.
Read the active run ID from `state/run-state.md`, verify the matching immutable
`state/runs/<RUN_ID>/application-batch.json`, and reconcile terminal per-item
outcomes from queue events, executor telemetry, application history, and the
run checkpoint using `runId` plus `opportunityId`. Continue from the first
manifest sequence without a durable terminal outcome.

The original `start` authorization remains valid only for the remaining items
of that same frozen manifest. Automatically apply all Stage 2 Chrome tab,
resume-selection, blocker-continuation, and persistence invariants below. Do
not ask the user to repeat them. If the prior checkpoint incorrectly says
`stage_2_paused` only because one item was blocked, normalize it to
`stage_2_running`, preserve that item's blocker, and advance. Ask for direction
only if no active unfinished batch can be identified unambiguously or a genuine
browser-wide failure prevents continuation.

### Resume a handed-off batch URL

If the user supplies or mentions a job/application URL while an authorized
batch is unfinished, reconcile that URL before selecting a mode. When the URL,
job ID, company/role identity, ATS redirect chain, or persisted blocker matches
an item in the active frozen manifest, enter `BATCH_HANDOFF_RESUME`, not
`DIRECT_LINK_HANDOFF`. This precedence applies even when the URL is an external
ATS page and even when the user manually completed the previously blocked field.

Resume the matching manifest item from its existing live Chrome tab whenever
available. Inspect controlled tabs and user-open tabs, match only by recorded
job identity, and claim the matching tab when necessary; do not open a duplicate
unless no matching tab survives. Preserve the user's completed fields and the
current page state. Before acting, re-mark every other surviving unresolved
batch handoff tab with `markHandoff()` so resuming one item cannot cause prior
handoff tabs to close at turn cleanup. Never close, navigate, or repurpose those
other tabs.

`BATCH_HANDOFF_RESUME` inherits the original workflow authorization for that
manifest item and for the remaining frozen batch. It also inherits any valid
grouped action-time confirmation already given for that exact employer,
resume, and candidate-data set. Do not ask again unless the destination or
transmitted data materially changes. If the item was not covered, include it
in the next precise grouped confirmation under the Stage 2 rules below.
Continue from the current page, then return to manifest order. Material legal
attestations, unknown facts, CAPTCHA/MFA, assessments, and genuine browser
permissions remain blockers.

For Chrome resume uploads, use the documented file-chooser flow with the exact
absolute path for the queued resume and verify the visible attached filename.
If the first chooser interaction fails or no attachment appears, refresh the
page snapshot/locator state and retry the chooser flow once before diagnosing
extension permissions. Request the Chrome/extension file-access change only
after the bounded retry fails with upload evidence. If the user says access is
already enabled, do not repeat the same instruction; retry from fresh browser
state once, then preserve the item as a technical handoff and continue the
batch if it still fails.

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
`state/queues/external-apply.jsonl`; unknown routes go to
`state/queues/unknown-review.jsonl`. External applications never reach the
Playwright submission executor by default, but an authorized `start` batch may
open and fill them interactively in Chrome under the two-stage rules below.

## Two-stage autonomous start invariant

`start <count>` must complete these stages in order. Never interleave searching
with applying.

### Stage 1: discover and freeze the queue

Search, open, fully read, evaluate, deduplicate, and durably record each unique
opportunity until the requested evaluation count is reached or the planned
search space is reasonably exhausted. Save every evaluated job URL and its
decision in the discovery ledger. Route every qualifying opportunity to its
native, external, or unknown queue with the canonical opportunity ID, original
job URL, application URL when available, minimal resume-selection metadata,
score, status, and discovery run ID.

### Resume-selection queue contract

During Stage 1, select the resume before routing the opportunity. Use only
these canonical queue values:

- `hemant_kumar_nodejs_resume` maps to
  `resumes/Hemant_Kumar_NodeJS_Resume.pdf`.
- `hemant_kumar_java_resume` maps to
  `resumes/Hemant_Kumar_Java_Resume.pdf`.

Use the Java profile when Java or Spring is a core required or meaningfully
preferred backend technology. Use the Node.js profile for Node.js, TypeScript,
or JavaScript-specific roles and as the default for general backend roles where
Java is incidental. For a genuinely mixed role, score the job truthfully
against both resume profiles with the same matching model and choose the higher
score; a tie defaults to the Node.js profile. Never broaden the candidate's
Java production experience while scoring.

Queue metadata must stay minimal. Persist only `resumeProfile`,
`selectedResume`, and the existing `matchScore` for the chosen profile; do not
copy skills, projects, experience, or other resume content into the queue item.
All application facts are resolved later from the selected resume and the
candidate source-of-truth files in the workspace.

When an ATS asks for a long-form employment `Role Description`, `Job
Description`, `Responsibilities`, or equivalent field, use the complete
professional Work Experience entry from the queued `selectedResume`, reconciled
with `candidate/experience.md`. This field is not a job-target keyword summary
and not a one-sentence professional summary. Preserve every material truthful
achievement and measurable result from the selected resume when the field limit
allows it, formatted as ATS-readable plain-text bullets. Tailor ordering and
emphasis to the selected profile, but do not introduce technologies absent from
that employment record or convert independent projects into professional work.
If a character limit forces compression, retain the strongest quantified and
profile-relevant achievements and use as much of the available limit as useful.

Before any application is opened, finish discovery, persist the run summary and
search checkpoint, reconcile against application history, and freeze the list
of queue records belonging to this batch as
`state/runs/<RUN_ID>/application-batch.json`. Stage 2 processes only this frozen
manifest; newly encountered jobs belong to a later search run. The manifest is
read-only after freezing. Its `queueStatus` is a freeze-time snapshot: never
write blockers, progress, or later statuses back into `application-batch.json`.
Persist Stage 2 outcomes in the live queue/event record, executor telemetry,
application history, and run checkpoint, joined by `runId` and
`opportunityId`.

### Stage 2: process the frozen queue

After Stage 1 has stopped, process every qualifying native and external record
from the frozen application manifest, one job at a time. Open each saved job
link in a new Chrome tab, verify that it is the same canonical opening, and follow only apply
controls or redirects belonging to that opening. Read `resumeProfile` and
`selectedResume` from that manifest record and use exactly that resume throughout
the application; do not rescore or silently switch variants during Stage 2.
Use the connected Chrome browser-control surface for `start` Stage 2. Do not
invoke the local Playwright executor for this stage: it owns and closes its
browser context and therefore cannot preserve a blocked live tab while the
batch continues.

### Mandatory grouped browser confirmations

Chrome requires action-time confirmation immediately before sensitive
candidate data or a resume is transmitted to an employer and again immediately
before a job application is finally submitted. The initial `start <count>`
command is workflow authorization; it does not satisfy either browser safety
confirmation.

Minimize interruptions by using exactly two batch checkpoints whenever the
frozen jobs can be grouped:

1. After Stage 1 freezes the manifest, inspect every frozen record far enough
   to identify its exact employer/application destination, selected resume,
   and candidate-data categories that will be transmitted. Then ask once for
   confirmation covering all currently actionable frozen jobs. Name every
   company and role, its destination, its exact resume filename, and the
   specific data categories. Do not ask for SolarWinds alone when another
   frozen job can be included in the same imminent batch transmission.
2. After that confirmation, fill every covered application to its furthest safe
   point, leaving each successful flow at final review/submit. Continue past
   item-level blockers under the tab-continuity rules. Once all frozen items
   are either review-ready or durably blocked, ask once for final-submission
   confirmation listing every review-ready company and role. Submit all listed
   applications after approval without asking again unless the destination,
   transmitted data, or set of applications materially changes.

Between these two checkpoints, do not ask the user to confirm ordinary fields,
resume selection, navigation, or continuation. Resolve those mechanically from
the candidate source-of-truth and frozen queue metadata. A bare `continue` or
`resume` carries the original batch authorization and does not create a new
approval prompt.

If an additional destination or data category becomes known only after the
first checkpoint, ask one supplemental grouped confirmation covering only the
new transmissions. A one-item batch still requires the transmission and final
submission confirmations because they authorize different actions.

For supported native flows such as LinkedIn Easy Apply, after the grouped
transmission confirmation fill the application autonomously when every required
answer is known from confirmed workspace facts. Select or upload the resume
named by the queue metadata, stop at final review/submit, and include the job in
the grouped final-submission checkpoint. For platform-specific native
flows that are not supported by the local executor, use the visible Chrome
workflow when it can be completed safely; otherwise preserve the tab as a
handoff and continue.

For external applications, after the grouped transmission confirmation open the
external ATS in Chrome and fill ordinary fields autonomously with confirmed
workspace facts, preserving any existing user-provided resume attachment when
the preservation rule below applies; otherwise upload the exact
`selectedResume` from the queue when needed. Continue through standard
navigation and the authorized standard terms acknowledgment. Stop at final
review/submit and include the job in the grouped final-submission checkpoint
when every required answer is confirmed and the application contains no
CAPTCHA, MFA, assessment, unknown material fact, or new material legal
attestation. Otherwise leave the application at its furthest safe point,
preserve the tab as a handoff, and continue the batch.

If any native or external application is blocked, ambiguous, unsupported,
expired, or requires human action, persist its exact non-secret status and
blocker, add genuine unknowns to the human-input queue, mark the tab as a
handoff, and leave it open without losing progress. For an agent-created
Chrome tab, "mark as a handoff" requires an actual successful
`await currentTab.markHandoff()` call; prose, telemetry, or a queue status is
not a substitute. Immediately continue with the next frozen queue record in
another new tab. Do not reuse a blocked tab for another job and do not stop or
return a final response merely because one application is blocked. A blocker
is terminal for that manifest item only, not for the batch controller.
After persisting that item, advance the manifest pointer and keep the run in
`stage_2_running`. Do not set `stage_2_paused` for an item-level blocker;
reserve a paused state for an explicit user pause or a genuine browser-wide
failure that prevents opening the next item.

The autonomous batch ends only after every frozen queue record has a durable
outcome such as submitted, completed to the furthest authorized safe point,
blocked, failed, expired, skipped with reason, or unknown-route review. Update
executor telemetry, queue status, application history, and the run summary
after each record so the run can resume safely after interruption.
On resume, walk the immutable manifest in `sequence` order and process each
item that lacks a durable terminal per-item outcome in those progress records;
do not infer completion by mutating or rereading the manifest snapshot status.

## Safety and persistence

Do not modify candidate facts during migration. Preserve resumes, answer
learning, browser profile, telemetry, ATS adapters, and existing history.
Persist each discovery run under `state/runs/<RUN_ID>/`, including the
discovery ledger, search telemetry, executor telemetry, run summary, and frozen
application-batch manifest when Stage 2 is authorized.
Keep `candidate/human-input-queue.md` for genuine human-required blockers; it
is not the primary job queue.

Never store passwords, OTPs, MFA codes, CAPTCHA values, cookies, tokens, or
recovery codes. Never complete assessments or interviews. A visible CAPTCHA,
MFA, or required human action blocks only that application and the queue
continues in another tab.

## Batch tab continuity

For ordinary batch application runs, when any native or external application
is blocked, incomplete, or requires human input, persist the non-secret blocker
and keep the current browser tab open for follow-up. Mark the tab as a handoff and
continue with the next queued task in a separate new browser tab, preserving
the blocked opening's identity and state. Do not reuse the blocked tab for a
different job, close it, or overwrite its progress. This rule applies only to
ordinary batch runs; `DIRECT_LINK_HANDOFF` remains terminal on failure and must
stop after recording the blocker.

Agent-created Chrome tabs are ephemeral and otherwise close automatically when
the turn ends. Therefore call `await currentTab.markHandoff()` immediately when
the blocker is detected. Before any final response, interruption, or end of the
turn, call `markHandoff()` again on every still-controlled blocked/incomplete
tab that must survive; marks are turn-scoped. Never call `tab.close()`, close
the browser/context, or navigate a marked handoff tab to another job. Continue
the manifest loop in a fresh tab after the mark succeeds. If marking fails,
record a batch-infrastructure error for tab retention, preserve the
URL/checkpoint, and continue other records when Chrome remains usable.

Do not emit the batch's final response until every frozen manifest record has
a durable per-item outcome or a genuine batch-level infrastructure failure
makes further records unreachable. At normal completion, re-mark all surviving
handoff tabs, leave them open for the user, and report their opportunity IDs and
blockers separately from submitted jobs.

## User workflow preference

When the user explicitly hands off a website task, fill ordinary application
details using confirmed facts already persisted in the workspace and continue
through the workflow without asking the user to repeat them. Outside an
authorized `start <count>` batch, an external job handoff authorizes checking a
standard terms-and-conditions acknowledgment needed to reach the final review
page, then stopping before final submission. Inside an authorized `start`
batch, the two-stage workflow and grouped action-time confirmation rules above
apply. Neither mode
authorizes guessing unknown material facts, accepting new material legal
attestations (such as background checks,
criminal-history declarations, conflicts, or work-authorization statements),
bypassing CAPTCHA/MFA, completing assessments or interviews, transmitting
secrets, or misrepresenting candidate facts.

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
first apply the active-batch reconciliation rule above. Enter
`DIRECT_LINK_HANDOFF` only when the URL cannot be matched to an unfinished
authorized batch item. In that mode, the provided URL is the authoritative
target: open it, follow only redirects or apply controls that belong to that
same opening, and continue the requested workflow from there. Do not start
search, query expansion, discovery, queue processing, alternate-source lookup,
or a different job as a fallback.

This mode is activated only by a URL supplied by the user as the task target
outside an already-authorized batch. A URL read from
`state/runs/<RUN_ID>/application-batch.json`, a redirect reached while
processing that record, or a link clicked from a saved result never changes
`start` Stage 2 into `DIRECT_LINK_HANDOFF`; ordinary batch continuation rules
remain in force.

If the specific-link workflow cannot be completed for any reason, record the
actual blocker or failure, tell the user that the application was not completed,
and stop the task. This stop rule overrides normal batch behavior that would
continue with another queued job. A same-opening external application may be
left at the authorized manual handoff point, but it must still be reported as
not completed until the user confirms submission.
