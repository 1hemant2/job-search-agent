---
name: job-application
description: Persistent truthful job discovery, matching, deduplication, application-channel classification, queue routing, supported native application automation, and manual external-application handoff.
---

# Discovery-first job workflow

This skill owns discovery, matching, deduplication, application-channel
classification, queue routing, supported native automation, and manual
external handoff. Candidate facts remain in `candidate/`; resume selection
remains in `resumes/`; `application-history.md` remains the human-readable
audit trail; `state/run-state.md` remains operational checkpoint state.

The migration policy is:

```text
SEARCH -> DISCOVER -> NORMALIZE -> READ COMPLETE DESCRIPTION
-> SCORE -> DEDUPE -> CLASSIFY CHANNEL -> ROUTE
```

The default workflow does not automatically submit external ATS or company
portal applications. Existing ATS adapters are reusable legacy components but
are default-disabled for external submission.

## Modes and commands

`search` runs discovery using the configured query variants, locations, and
sources. `search 100` means approximately 100 unique opportunities evaluated,
not 100 result cards or one page. The controller continues across queries,
pages, and sources until the target is reached or the planned search space is
actually exhausted.

`apply native` loads `state/queues/native-apply.jsonl`, removes opportunities
already confirmed in history, verifies that supported native work is still
available, resolves reusable answers, and invokes the local Playwright runner
only for implemented native flows. It never consumes the external queue.

`show external` presents pending manual external applications sorted by match
score, recency, and preference alignment. `mark external <id> applied` and
`mark external <id> skipped` append a status event to the external queue.

`start` is a compatibility alias for an authorized continuous discovery run.
It no longer means “submit every qualifying ATS job.” A migration, test, or
dry run is simulation-only and must not create accounts, upload resumes, or
submit applications.

## Bootstrap and candidate truth

Before searching or applying, load the full source set listed in root
`AGENTS.md`, reconcile it into one candidate state, and never ask for facts
already present there. Source priority is current user correction, candidate
source-of-truth, confirmed reusable answers, resume, derivations with
provenance, records, preferences, and only then current form context.

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
- complete-description evidence, match score, selected truthful resume;
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
  platform, URLs, score, age, resume, timestamp, status, retry count, and
  last error;
- `state/queues/external-apply.jsonl` stores opportunity ID, company, role,
  discovery source, original URL, external URL, ATS, score, resume, age,
  match reasons, timestamps, and manual status;
- `state/queues/unknown-review.jsonl` stores unresolved route opportunities.

Native statuses include `pending`, `in_progress`, `blocked`, `failed`,
`submitted`, `native_unsupported`, and `skipped`. External statuses are
`pending_manual`, `opened`, `applied`, `skipped`, and `expired`.

Only supported native flows may enter execution. LinkedIn native execution is
currently enabled. Naukri, Indeed, and Wellfound native detection is modeled,
but native execution remains `native_unsupported` until separately tested.
External applications are manual-first. The local runner refuses a payload
marked `external_application` unless an explicit future policy override is
passed; normal queue processing never supplies that override.

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

## Native blockers and human handoff

If a native application encounters visible CAPTCHA, MFA, authentication,
unknown required material questions, an assessment, or a broken form, mark
that queue item blocked, preserve only non-secret operational state, and
continue with the next native item. Never bypass security controls or complete
assessments/interviews. Genuine human-only blockers remain in
`candidate/human-input-queue.md`; that file is not the job queue.

External applications are already handed to the user through the external
queue, so no external CAPTCHA-resume or automatic ATS-confirmation workflow is
part of the default policy.

## History and migration boundary

Keep `application-history.md` as the readable audit trail, but do not make
Markdown parsing the only dedupe mechanism. Reconcile confirmed submitted
history with canonical opportunity IDs before native execution. Queue routing
does not count as submission.

Do not delete ATS adapters, executor code, persistent browser profile,
telemetry, answer learning, or run state during migration. Deprioritize or
disable external automation by policy, retain it as legacy reusable code, and
make any future re-enablement an explicit policy change.
