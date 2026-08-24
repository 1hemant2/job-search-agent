---
name: job-application
description: Persistent truthful job discovery, matching, deduplication, queue freezing, resume-aware routing, supported native automation, and browser-assisted external application processing.
---

# Discovery-first job workflow

This skill owns discovery, matching, deduplication, application-channel
classification, queue routing and freezing, supported native automation, and
browser-assisted external processing. Candidate facts remain in `candidate/`; resume selection
remains in `resumes/`; `application-history.md` remains the human-readable
audit trail; `state/run-state.md` remains operational checkpoint state.

## Specific-link handoff override

If the user provides a specific job or application URL and explicitly hands off
that task, first reconcile it against any active unfinished authorized batch.
Match using canonical/original/application URL, job ID, company/role identity,
ATS redirect evidence, and persisted blockers. A matching item enters
`BATCH_HANDOFF_RESUME`, even for an external ATS URL or after the user manually
completed a blocked field. Only an unmatched URL enters
`DIRECT_LINK_HANDOFF` mode.

For `BATCH_HANDOFF_RESUME`, inspect existing controlled and user-open Chrome
tabs and reuse/claim the matching live tab; open a duplicate only when the
matching tab no longer exists. Preserve all user-entered progress. Before
acting, call `markHandoff()` again on every other surviving unresolved batch
handoff tab so turn cleanup cannot close them. Never close, navigate, or reuse
another handoff tab. The original `start` authorization remains valid for the
matched item and remaining frozen records. Reuse any valid batch-wide
action-time confirmation already given for that exact employer, resume, and
candidate-data set. Do not ask again unless the data or destination changes.
If it was not covered, include the item in the next grouped confirmation under
the root `AGENTS.md` Stage 2 rules. After the item reaches a durable outcome,
return to manifest order and continue.

If resume upload is needed after confirmation, use the Chrome file-chooser flow
with the queued resume's absolute path and verify the visible attached filename.
On the first failure or missing attachment, refresh the snapshot/locator state
and retry once. Ask the user to change Chrome/extension file-access permissions
only after that retry produces real upload-failure evidence. If the user says
access is already enabled, retry once from fresh browser state rather than
repeating the permission instruction. A remaining failure is an item-level
blocker: mark the tab as a handoff and continue other batch items.

For an unmatched `DIRECT_LINK_HANDOFF`, the URL is the authoritative target.
Continue from that URL and follow only redirects, login gates, or apply controls
that clearly belong to the same job opening. Do not fall back to `search`,
discovery, query expansion, queue processing, alternate job URLs, alternate
listings, or another job if the handed-off workflow fails.

On any failure or blocker, persist the real non-secret outcome, report that the
specific application was not completed, and stop. The normal batch rule to
continue after a blocked or failed application does not apply in this mode.
Reaching an authorized external/manual handoff point is not a completed
application; report it as pending/not completed and stop for the user.

When the user has already uploaded a resume before handoff, treat the visible
attachment as the selected resume for that opening. Inspect the current page
before acting, preserve the attachment and existing progress, and backfill the
remaining form with confirmed workspace facts. Correct inaccurate resume-parser
output using candidate source-of-truth, but do not replace, delete, re-upload,
or reparse the attached resume unless it is visibly absent, rejected/lost by
the site, or the user requests a replacement.

The migration policy is:

```text
SEARCH -> DISCOVER -> NORMALIZE -> READ COMPLETE DESCRIPTION
-> SCORE -> DEDUPE -> CLASSIFY CHANNEL -> ROUTE
```

The default workflow does not automatically submit external ATS or company
portal applications. An authorized two-stage `start <count>` batch is the
exception: external applications are opened and filled interactively in Chrome
when every required answer is confirmed and no human-only or prohibited step
is present, then submitted only after the mandatory grouped final-submission
confirmation. Existing ATS adapters are reusable legacy components but remain
default-disabled for external submission.

## Modes and commands

`search` runs discovery using the configured query variants, locations, and
sources. `search 100` means approximately 100 unique opportunities evaluated,
not 100 result cards or one page. The controller continues across queries,
pages, and sources until the target is reached or the planned search space is
actually exhausted.

`search java 100` selects the reusable policy in
`search-profiles/java-backend.md`, its Java query/location plan, and the Java
resume-selection/scoring rules. The unqualified `search` command retains the
existing Node/general-backend behavior.

`apply native` loads `state/queues/native-apply.jsonl`, removes opportunities
already confirmed in history, verifies that supported native work is still
available, resolves reusable answers, and invokes the local Playwright runner
only for implemented native flows. It never consumes the external queue.
`apply native java` applies the same rules while filtering to records created
by the Java profile.

`show external` presents pending external applications sorted by match
score, recency, and preference alignment. `mark external <id> applied` and
`mark external <id> skipped` append a status event to the external queue.
`show external java` filters this view to pending Java-profile records.

Recruiter and hiring-team outreach uses a separate prepare-then-send workflow.
`outreach prepare <count>` researches and drafts a batch without sending;
`outreach send <batch-id>` sends only the exact notes already saved in that
batch. If a user's single request explicitly asks both to find relevant people
and send the notes, preparation and sending run consecutively without asking
the user to review or approve each message or the completed batch. Every draft
must still be persisted and verified before its profile is opened for sending.
Read [references/outreach.md](references/outreach.md) for the complete batch,
personalization, verification, and logging rules.

`start <count>` is an authorized two-stage batch. Stage 1 completes
discovery, evaluation, classification, persistence, and a frozen qualifying
queue before any application work begins. Stage 2 stops searching and processes
every frozen native and external queue item one at a time in separate Chrome
tabs. The command supplies workflow authorization but cannot waive Chrome's
mandatory action-time confirmations. After the manifest is frozen, inspect all
frozen items and ask once to transmit the listed candidate-data categories and
exact resume files to every currently actionable named destination. After
approval, fill all covered applications to final review while continuing past
item-level blockers. Then ask once to submit every review-ready named
application and submit the approved set. Do not ask per job when frozen jobs
can be grouped, and do not repeat an approved confirmation unless its
destination, data, resume, or application set materially changes. A one-item
batch still requires separate transmission and final-submission confirmations.
A migration, test, or dry run is
simulation-only and must not create accounts, upload resumes, or submit
applications. Follow the complete two-stage and blocked-tab invariants in root
`AGENTS.md`; never interleave Stage 1 search with Stage 2 application work. Each
Stage 2 application must use the resume profile frozen into its queue record.
The frozen list is persisted at
`state/runs/<RUN_ID>/application-batch.json`; Stage 2 reads that manifest rather
than a changing live queue. The frozen manifest is read-only. `queueStatus` in
each item is only the status captured at freeze time; never write blockers or
Stage 2 progress back into the manifest. Record outcomes in queue events,
executor telemetry, history, and the run checkpoint using `runId` plus
`opportunityId`. On resume, walk manifest `sequence` and skip only items with a
durable terminal outcome in those progress records.

All URLs opened from that manifest remain ordinary batch items. Processing a
specific saved URL does not activate `DIRECT_LINK_HANDOFF`; that mode exists
only when the user supplied the URL as the task target outside the batch. Use
the connected Chrome browser-control surface throughout `start` Stage 2. Do
not use the local Playwright executor for this stage because its owned browser
context closes when execution returns and cannot preserve a live handoff tab.

`continue` and `resume` are first-class aliases for resuming the active
unfinished authorized `start` batch. The user does not need to provide a run
ID or repeat the browser, blocker, resume, queue, or authorization rules. Load
the active run from `state/run-state.md`, verify its immutable application
manifest, reconcile per-item outcomes by `runId` plus `opportunityId`, and
continue the first sequence without a durable terminal outcome. The original
authorization carries only across the remaining records in that same frozen
manifest; never discover or append replacement jobs. If an item blocker alone
caused `stage_2_paused`, normalize the batch back to `stage_2_running`, preserve
the blocker, and advance. Ask the user only when the active unfinished batch is
ambiguous or a real browser-wide failure blocks all further processing.

When a specific URL is present, do not invoke `search`, `start`, or any batch
queue command as a substitute. Reconcile it with an active batch first; a match
uses `BATCH_HANDOFF_RESUME`, while only an unmatched direct-link workflow is
single-opening and terminal on failure.

## Bootstrap and candidate truth

Before searching or applying, load the full source set listed in root
`AGENTS.md`, reconcile it into one candidate state, and never ask for facts
already present there. Source priority is current user correction, candidate
source-of-truth, confirmed reusable answers, resume, derivations with
provenance, records, preferences, and only then current form context.

An already-attached resume is authoritative for attachment selection in that
specific handoff, but not for candidate facts: confirmed candidate files still
control field values when ATS parsing is blank, malformed, or inconsistent.

Never invent identity, employment, dates, education, achievements, skills,
production experience, authorization, sponsorship, clearance, demographics,
compensation history, or legally material answers. Preserve the separate
meaning of general hands-on technology experience and professional/production
experience. The canonical Java scope is in
`candidate/technology-experience.md` and must not be broadened.

Resolve answers in this order: known fact, semantic equivalent, mechanical
calculation, truthful dropdown mapping, high-confidence low-risk derivation,
then human queue for a required material unknown. Save reusable answers and
derivations immediately with provenance. Never persist passwords, OTPs, MFA
codes, CAPTCHA values, cookies, tokens, recovery codes, or temporary links.

## Canonical opportunity contract

`automation/src/types.ts` defines the shared `JobOpportunity` model. The
canonical identity is `opportunity.id`; the same ID is used in discovery
records, queues, history reconciliation, and executor payloads. A normalized
opportunity contains:

- source, company, role, job URL, optional application URL and job ID;
- location, work arrangement, posting age and confidence;
- complete-description evidence, chosen-profile match score, canonical resume
  profile, and selected truthful resume path;
- application channel, native platform, external ATS, lifecycle status;
- reason codes and discovery timestamp.

`automation/src/opportunity.ts` normalizes company/role text and URLs, removes
tracking parameters, detects ATS families, and creates stable IDs. The
cross-source key uses normalized company/role plus a shared official
application URL when available; otherwise job ID and canonical host provide
source-specific separation. Job URL, job ID, source, and company/role aliases
remain auditable. Thus a LinkedIn listing and its Greenhouse listing merge when
they expose the same official opening, while two same-titled openings remain
separate when their IDs differ.

## Human-style discovery gate

Build a plan with multiple compatible role variants, locations, and sources.
For each source/query, process the complete visible page before pagination or
source changes:

1. capture every visible card, including company, role, URL, job ID, location,
   posting age, and application route;
2. open each card and load the complete description;
3. expand “Show more”/equivalent controls and scroll the description itself;
4. record responsibilities, required/preferred skills, seniority, location,
   authorization, compensation, age, route, and matched candidate evidence;
5. deduplicate against canonical opportunity IDs, current-run aliases, and
   confirmed application history;
6. record exactly one decision before opening the next card.

A description is not complete from a card preview. If loading fails, perform
the bounded sequence: open the selected card, wait, scroll the detail panel,
expand it, open the standalone detail page, inspect an official employer/ATS
listing when exposed, and retry once. Only then record
`BLOCKED_DESCRIPTION_UNAVAILABLE`; it has no score and is not a silent skip.

Each evaluated record should include complete-description status, required and
preferred skills, experience/seniority, location, age, route, candidate
evidence, unsupported requirements, score, and reason.

## Matching and recency

Use the existing score model: technical match 35%, experience 20%, role
alignment 15%, company quality 10%, compensation 10%, location/authorization
10%. A score of 70+ may qualify when the description is complete, age is
reliably under seven calendar days, and no hard blocker exists. Scores 60–69
are review candidates; below 60 are skipped. Do not let application length or
Easy Apply availability change match quality.

Preserve the current seven-day recency rule. Treat seven days or older and
unknown/unreliable age as ineligible for automatic native application. Record
recency impact in every run summary rather than loosening the rule.

Hard blockers include incompatible authorization/citizenship/clearance,
unavailable sponsorship, location conflict, unrelated work, unsupported
required skills, and clear seniority mismatch.

## Resume selection and minimal queue metadata

Select the resume during discovery before queue routing. The only canonical
profile IDs and paths are:

- `hemant_kumar_nodejs_resume` ->
  `resumes/Hemant_Kumar_NodeJS_Resume.pdf`
- `hemant_kumar_java_resume` ->
  `resumes/Hemant_Kumar_Java_Resume.pdf`

Choose `hemant_kumar_java_resume` when Java or Spring is core required or a
meaningful preferred backend technology. Choose
`hemant_kumar_nodejs_resume` for Node.js, TypeScript, or JavaScript-specific
roles and by default for general backend roles where Java is incidental. For a
genuinely mixed role, apply the same truthful matching model to both profiles,
choose the higher score, and use the Node.js profile on a tie. Preserve the
confirmed distinction between hands-on Java experience and professional Java
production experience.

Persist only `resumeProfile`, `selectedResume`, and `matchScore` as
resume-selection metadata. `matchScore` is the score for the chosen profile.
Do not duplicate resume skills, projects, experience, or candidate answers in
the queue. During application, load those facts from the selected resume and
candidate source files. Stage 2 must select or upload the exact queued resume
and must not rescore or silently change it. An already attached user-provided
resume remains governed by the preservation rule above.

Long-form ATS employment fields such as `Role Description`, `Job Description`,
or `Responsibilities` must be populated from the complete professional Work
Experience entry in the queued `selectedResume`, reconciled with
`candidate/experience.md`. Do not replace that entry with a generated one-line
stack summary or copy the target job description. Preserve all material
truthful achievements and metrics when the field permits, using plain-text
bullets. The selected profile controls phrasing and emphasis: the Node.js
profile may retain its confirmed Node.js/BullMQ/Redis/PostgreSQL employment
details, while the Java profile must not imply professional Java employment.
Independent project technologies never become employment responsibilities.
Only compress for a real field limit, retaining quantified impact and the most
profile-relevant supported achievements.

## Channel classification and routing

Every qualifying opportunity must be classified before routing:

- `native_easy_apply`: predictable application inside the originating
  platform, such as LinkedIn Easy Apply. Detection is explicit; a platform
  source alone is not enough.
- `external_application`: Apply leaves the platform for Workday, Greenhouse,
  Lever, Ashby, SmartRecruiters, or a company portal.
- `unknown`: route cannot be classified reliably; persist for review.

`automation/src/queues.ts` writes durable JSONL queues:

- `state/queues/native-apply.jsonl` stores opportunity ID, company, role,
  platform, URLs, discovery run ID, chosen `resumeProfile`, `selectedResume`,
  chosen-profile score, age, timestamp, status, retry count, and last error;
- `state/queues/external-apply.jsonl` stores opportunity ID, company, role,
  discovery source, original URL, external URL, ATS, discovery run ID, chosen
  `resumeProfile`, `selectedResume`, chosen-profile score, age, match reasons,
  timestamps, and status;
- `state/queues/unknown-review.jsonl` stores unresolved route opportunities and
  the same minimal resume-selection metadata when a resume was selected.

Native statuses include `pending`, `in_progress`, `blocked`, `failed`,
`submitted`, `native_unsupported`, and `skipped`. External statuses are
`pending`, `in_progress`, `blocked`, `failed`, `opened`, `submitted`, `applied`,
`skipped`, and `expired`; legacy `pending_manual` records remain readable.

Only supported native flows may enter local runner execution. LinkedIn native
execution is currently enabled. Naukri, Indeed, and Wellfound native detection
is modeled, but local native execution remains `native_unsupported` until
separately tested; an authorized batch may still use their visible Chrome flow
when it can be completed safely. External applications never enter the local
runner. An authorized `start` batch instead opens them interactively in Chrome,
fills confirmed ordinary fields after grouped transmission approval, stages
safe applications at final review, submits the review-ready set after grouped
final-submission approval, preserves blocked tabs, and continues the frozen
queue. The local runner refuses a payload marked
`external_application` unless an explicit future policy override is passed.

When an external ATS is detected, read its matching guidance under `ats/`
before filling tenant-specific pages. In particular, read `ats/workday.md`
before processing Workday's `My Experience` page; generic visible-input filling
is insufficient because Workday hides record forms behind section-scoped Add
controls.

## Sources and capability honesty

`automation/src/sources/index.ts` is the capability registry. It explicitly
separates discovery, native detection, and native execution. The current code
does not bundle a local collector for LinkedIn, Naukri, Indeed, Wellfound,
company careers, Greenhouse, Lever, Ashby, or Workday. Existing browser/session
discovery can feed normalized records into `DiscoveryCoordinator`; an ATS
adapter is not treated as a discovery collector. The registry must be updated
when a real source collector is added and tested.

LinkedIn records must distinguish Easy Apply from external Apply. Naukri,
Indeed, and Wellfound records use the same native/external/unknown contract;
native support cannot be inferred from source name.

## Persistence and exhaustion

Every run writes under `state/runs/<RUN_ID>/`:

- `discovery-ledger.jsonl` for every evaluated opening;
- `search-telemetry.jsonl` for every visible page and page transition;
- `executor-telemetry.jsonl` for local execution outcomes;
- `application-batch.json` for the frozen ordered Stage 2 list;
- `run-summary.json` with evaluated, qualifying, recency-too-old,
  recency-unknown, score-too-low, hard-blocker, native, external, and
  unknown-route metrics.

The coordinator preserves active query, source, location, page/cursor,
scroll-completion, visible/new/duplicate/evaluated IDs, next-page status, and
query/source exhaustion in `state/run-state.md`.

`SEARCH_SAMPLE_EXHAUSTED`, `QUERY_EXHAUSTED`, and `SOURCE_EXHAUSTED` are
continuation states. Only `SEARCH_SPACE_REASONABLY_EXHAUSTED` is a run-level
search stop, after all planned pagination and sources are complete. Twenty
cards, one page, one blocked application, or one empty qualifying page is not
search exhaustion.

## Application blockers and human handoff

If a native or external application encounters visible CAPTCHA, MFA,
authentication, unknown required material questions, an assessment, or a
broken form, mark
that queue item with the closest supported durable status, record the exact
non-secret blocker, call `await currentTab.markHandoff()` on the actual Chrome
tab, leave it open, and continue with the next frozen item in a separate new
tab. Merely writing "handoff" in status or telemetry does not preserve an
agent-created tab. Never bypass security controls or complete
assessments/interviews. Genuine human-only blockers remain in
`candidate/human-input-queue.md`; that file is not the job queue.

An item-level `blocked`, `failed`, `assessment`, `unsupported`, or human-input
outcome must return control to the manifest loop, not terminate the batch or
produce the run's final response. Do not call `tab.close()`, close the browser
binding/context, or reuse a handoff tab. Open the next manifest record in a new
tab, advance the manifest pointer, and keep the run `stage_2_running`. An item
blocker must not set `stage_2_paused`; that state is only for an explicit user
pause or a browser-wide failure that makes the next item unreachable. Before
any final response, interruption, or turn end, call
`markHandoff()` again on every still-controlled blocked/incomplete tab that
must survive because Chrome marks are turn-scoped. Finalize the batch only
after every frozen item has a durable outcome or a genuine batch-level browser
failure makes continuation impossible.

The preceding continue-with-the-next-item rule applies only to ordinary batch
runs. In `DIRECT_LINK_HANDOFF` mode, the blocker is recorded for the handed-off
opening, the user is told the application was not completed, and the run stops.
Opening a manifest URL during `start` never converts the run into this mode.

External browser processing may continue through standard navigation and an
authorized standard terms acknowledgment. In an authorized `start` batch it
may be included in the grouped final-submission checkpoint when all required
answers are confirmed and no human-only or prohibited step is present, and may
be submitted only after that approval. Otherwise the external tab remains open
at its furthest safe point while the ordinary batch continues.

## History and migration boundary

Keep `application-history.md` as the readable audit trail, but do not make
Markdown parsing the only dedupe mechanism. Reconcile confirmed submitted
history with canonical opportunity IDs before native execution. Queue routing
does not count as submission.

Do not delete ATS adapters, executor code, persistent browser profile,
telemetry, answer learning, or run state during migration. Deprioritize or
disable external automation by policy, retain it as legacy reusable code, and
make any future re-enablement an explicit policy change.
