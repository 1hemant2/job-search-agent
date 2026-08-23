# Discovery and Queueing

Discovery remains source-agnostic: LinkedIn is primarily a discovery source,
while official company and ATS applications are first-class targets.

## Direct-link handoff

A user-provided job or application URL creates `DIRECT_LINK_HANDOFF` mode and
overrides discovery. Treat that URL as the one authoritative opening. Follow a
redirect or apply control only when it remains part of the same opening. Do not
search for the role, expand queries, inspect alternate listings, process the
normal queues, or switch to another job if the URL fails.

Record the blocker or failure and stop with an explicit not-completed report.
The batch rule that a failed application may be routed while other jobs
continue does not apply to a direct-link handoff.

For each candidate opening, capture company, normalized role, posting date,
location/work arrangement, compensation when known, source URL, official ATS
URL, job ID, and the complete description before scoring.

Queue only suitable, recent, non-duplicate opportunities. One failed ATS is a
routing event, not a reason to change the rest of the run to Easy Apply-only.
The queue may contain `pending`, `in_progress`, `blocked`, `failed`,
`submitted`, and `skipped` records, but only confirmed suitable submissions
advance the active target.

For every qualifying record, persist the discovery run ID and minimal resume
selection: canonical `resumeProfile`, exact `selectedResume` path, and the
chosen-profile `matchScore`. Do not copy resume content or candidate answers
into queue metadata. Existing canonical profile/path mappings live in
`resumes/index.md`.

Discovery and application are separate stages. Complete discovery and write
the run summary before opening any application. Then freeze only that run's
qualifying native and external records into
`state/runs/<RUN_ID>/application-batch.json`; Stage 2 processes the immutable
manifest, not a changing live queue.

## Breadth and exhaustion telemetry

Every run must use a planned set of query variants and sources rather than a
single result-page sample. At minimum, vary the configured role family across
Node.js/backend, backend, backend-heavy software engineering, API/platform,
distributed systems, realistic SDE I/II, TypeScript, and Java-backend queries;
the exact variants and locations must remain compatible with
`candidate/preferences.md`.

For every source/query, process the first page and fully scroll the visible
results before changing pages. Record every visible card with company, role,
URL, job ID, location, posting age, and application route. Deduplicate against
both `application-history.md` and the current-run discovery ledger, read the
complete description for each new potentially suitable job, and record every
decision including skipped, duplicate, stale, unsuitable, blocked, and
qualified jobs.

Only after the page is complete may the coordinator use Next or a verified
cursor. Confirm that the page number, URL cursor, or first/last job IDs
changed. Retry an unchanged page once, then mark it stalled and continue with
the next query or source. Preserve the active query, source, location,
page/cursor, and evaluated IDs; never return to page 1 or repeatedly process a
promoted/recommended listing already seen in the run.

Paginate every query while a next page or cursor is present, then continue to
the next query and source. A zero-qualifying page, a 20-job evaluation count,
one blocked application, or one exhausted query is never run-level exhaustion.

The coordinator writes append-only JSONL under
`state/runs/<RUN_ID>/`: `discovery-ledger.jsonl` for every evaluated opening,
`search-telemetry.jsonl` for every search page, and
`executor-telemetry.jsonl` for every local Playwright result, plus
`application-batch.json` for the frozen Stage 2 list. Each job record
uses standardized reason codes and records recency as within-window, too-old,
or unknown so the impact of the seven-day rule can be measured without
loosening it. Search records also preserve scroll completion, visible job IDs,
new/duplicate/evaluated IDs, next-page status, and page-transition evidence.

The active section of `state/run-state.md` must preserve: active query, source,
location, page number or cursor, scroll-completed status, visible job IDs,
evaluated job IDs, new job IDs, duplicate job IDs, next-page status, and
source/query exhaustion status.

The only run-level search stop state is
`SEARCH_SPACE_REASONABLY_EXHAUSTED`, reached after all planned query
pagination and all planned sources complete. `SEARCH_SAMPLE_EXHAUSTED`,
`QUERY_EXHAUSTED`, and `SOURCE_EXHAUSTED` are continuation states.
