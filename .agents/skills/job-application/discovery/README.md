# Discovery and Queueing

Discovery remains source-agnostic: LinkedIn is primarily a discovery source,
while official company and ATS applications are first-class targets.

For each candidate opening, capture company, normalized role, posting date,
location/work arrangement, compensation when known, source URL, official ATS
URL, job ID, and the complete description before scoring.

Queue only suitable, recent, non-duplicate opportunities. One failed ATS is a
routing event, not a reason to change the rest of the run to Easy Apply-only.
The queue may contain `pending`, `in_progress`, `blocked`, `failed`,
`submitted`, and `skipped` records, but only confirmed suitable submissions
advance the active target.

## Breadth and exhaustion telemetry

Every run must use a planned set of query variants and sources rather than a
single result-page sample. At minimum, vary the configured role family across
Node.js/backend, backend, backend-heavy software engineering, API/platform,
distributed systems, realistic SDE I/II, TypeScript, and Java-backend queries;
the exact variants must remain compatible with `candidate/preferences.md`.
Paginate every query while a next page or cursor is present, then continue to
the next query and source. A zero-qualifying page, a 20-job evaluation count,
one blocked application, or one exhausted query is never run-level exhaustion.

The coordinator writes append-only JSONL under
`state/runs/<RUN_ID>/`: `discovery-ledger.jsonl` for every evaluated opening,
`search-telemetry.jsonl` for every search page, and
`executor-telemetry.jsonl` for every local Playwright result. Each job record
uses standardized reason codes and records recency as within-window, too-old,
or unknown so the impact of the seven-day rule can be measured without
loosening it.

The only run-level search stop state is
`SEARCH_SPACE_REASONABLY_EXHAUSTED`, reached after all planned query
pagination and all planned sources complete. `SEARCH_SAMPLE_EXHAUSTED`,
`QUERY_EXHAUSTED`, and `SOURCE_EXHAUSTED` are continuation states.
