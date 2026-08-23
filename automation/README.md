# Local Playwright execution adapter

For a user-provided URL, the caller must treat the payload as a
`DIRECT_LINK_HANDOFF`: execute only that opening and same-opening redirects or
apply controls. A failed or blocked result is final for that handoff; do not
replace the payload with a search result, alternate listing, queued item, or
other job. The caller must report that the specific application was not
completed and stop. This does not change ordinary batch queue behavior.

If the user hands off an ATS page after already uploading a resume, the caller
must preserve the visible attachment and current form progress. It should skip
duplicate upload/parsing, backfill blanks, and correct parser errors with
confirmed workspace facts. Re-upload is appropriate only when the attachment
is visibly absent, rejected/lost by the ATS, or the user requests replacement.

This subsystem is a deterministic browser executor for the existing job-agent workspace. It does not discover jobs, score them, derive candidate answers, or write candidate memory/history. Codex prepares one JSON payload, the runner executes routine browser actions, and Codex records the returned result in `application-history.md`, `state/run-state.md`, and—when a reusable answer was learned—`candidate/application-answers.md`.

## Architecture

- `src/types.ts` — payload, lifecycle, blocker, and result contracts.
- `src/application-payload.ts` — validation, resume-path guards, domain allowlisting, and history deduplication.
- `src/application-batch.ts` — freezes one run-scoped Stage 2 manifest after discovery ends.
- `src/browser.ts` — persistent Playwright profile/session and safe navigation.
- `src/ats/` — LinkedIn, Workday, Greenhouse, Lever, Ashby, and conservative generic adapters.
- `src/captcha-state.ts` — idempotent non-secret CAPTCHA queue/checkpoint persistence and resolution.
- `src/discovery-ledger.ts` — append-safe JSONL discovery, search, and executor telemetry records.
- `src/discovery.ts` — planned query/source coordination, page-processing checks, and explicit exhaustion state machine.
- `src/run-state.ts` — discovery pointers, page-processing status, job-ID sets, and counters in `state/run-state.md`.
- `src/runner.ts` — state-machine execution and structured JSON output.
- `test/` — payload, detection, form-filling, unknown-question, CAPTCHA, deduplication, and dry-run integration tests.

The lifecycle is explicit: `prepared → executing → blocked | blocked_captcha | assessment | failed | submitted`. A blocked application returns to Codex as a result and does not stop other jobs in an ordinary batch; a `DIRECT_LINK_HANDOFF` stops after reporting that its specific application was not completed.

## Payload contract

Codex should write a temporary JSON payload outside the candidate source-of-truth files, for example `tmp/application-payload.json`:

```json
{
  "company": "Example Company",
  "role": "Backend Engineer",
  "jobUrl": "https://boards.greenhouse.io/example/jobs/123",
  "ats": "greenhouse",
  "resumeProfile": "hemant_kumar_nodejs_resume",
  "resume": "resumes/Hemant_Kumar_NodeJS_Resume.pdf",
  "candidate": {
    "name": "Hemant Kumar",
    "email": "candidate@example.invalid",
    "phone": "+91 0000000000",
    "location": "Bengaluru, Karnataka, India"
  },
  "answers": {
    "work_authorized": "Yes"
  }
}
```

The resume must resolve inside the workspace `resumes/` directory. Canonical
batch payloads pair `hemant_kumar_nodejs_resume` with
`resumes/Hemant_Kumar_NodeJS_Resume.pdf` or
`hemant_kumar_java_resume` with `resumes/Hemant_Kumar_Java_Resume.pdf`; a
mismatch is rejected. Values are never hard-coded in ATS adapters. For a
LinkedIn listing that redirects to another domain, set `applicationUrl` to the
actual application URL and include its host in `allowedApplicationDomains`.

Required questions are matched only by deterministic field keys/labels. If a required question is not in `answers`, the result is:

```json
{
  "status": "blocked",
  "blocker": {
    "type": "unknown_required_question",
    "question": "exact visible question",
    "options": ["available", "choices"]
  }
}
```

The executor never invents answers, bypasses CAPTCHA, completes assessments, or stores passwords, cookies, OTPs, MFA codes, or tokens.

CAPTCHA is handled with one short passive re-check for natural page verification. If it remains, the runner returns `status: "blocked"`, `lifecycle: "blocked_captcha"`, and `blocker.type: "captcha"`, writes one non-secret queue/checkpoint entry, and exits promptly. A later run must pass `--resume-captcha`; otherwise an active queued CAPTCHA is returned without reopening or retrying that application.

When the payload came from a direct-link handoff, the blocked result ends that
handoff. Resume is allowed only for the same opening after the user completes
the required human action; it must never trigger job search or substitution.

## Browser state

By default, Playwright uses `automation/.profile`, which is ignored by Git and is suitable for reusing a normal local browser session. The runner never reads or prints the profile contents. Set `--profile-dir` to use another local profile directory when appropriate. The adapter prefers an installed local Chrome/Edge executable; `PLAYWRIGHT_EXECUTABLE_PATH` can override it.

Install dependencies and a Playwright browser if needed:

```powershell
cd "D:\Job Apply\automation"
npm install
npx playwright install chromium
```

On this machine, an installed Edge executable is also detected automatically when the Playwright-managed Chromium binary is unavailable.

## Testing and dry run

Build and run all tests:

```powershell
npm run build
npm test
```

The dry-run command performs navigation, deterministic filling, resume upload, and validation but never clicks final Submit. It is also the safe default whenever `--allow-submit` is absent:

```powershell
$env:DRY_RUN = "true"
npm run dry-run -- --payload ..\tmp\application-payload.json --headful
```

The test suite includes a local HTTP application form and verifies that no submission request is made. No real application was submitted while building this adapter.

## Production execution

Production execution requires both `--allow-submit` and `DRY_RUN=false`/no dry-run flag. The exact command is:

```powershell
$env:DRY_RUN = "false"
npm run execute -- --payload ..\tmp\application-payload.json --allow-submit --headful
```

The runner checks the target domain, ATS, company/role identity, selected resume, prepared answers, and application history before the adapter-owned final submit control is allowed to run. It recognizes a confirmation page before returning `submitted`; unrecognized post-submit state returns `failed` with `submission_not_verified`.

The runner prints only structured result JSON. It does not mutate `application-history.md` or candidate answer/source-of-truth files; the job-agent remains responsible for application-history reconciliation, target counting, candidate-answer learning, and final run reconciliation. For CAPTCHA only, the runner writes the normalized non-secret `blocked_captcha` queue/checkpoint metadata needed for resumability in `candidate/human-input-queue.md` and `state/run-state.md`.

## Discovery telemetry and exhaustion

Each run should construct a `DiscoveryCoordinator` with an explicit plan of source/query variants. It writes append-safe JSONL files under:

```text
state/runs/<RUN_ID>/discovery-ledger.jsonl
state/runs/<RUN_ID>/search-telemetry.jsonl
state/runs/<RUN_ID>/executor-telemetry.jsonl
```

Job records contain the run identity, source, query variant, company, role,
source/application URLs, job ID, card location and location filter,
application route, description-read status, page/cursor, result position, posting-age confidence, recency class,
score, canonical resume profile/path, decision, standardized reason codes, and
executor outcome.
Search records contain every visible job ID, scroll completion, new/duplicate/
evaluated IDs, pagination state, page-transition evidence, and query-level stop
reason. Executor records contain the adapter, starting/final URL, page title,
phase, status, blocker, visible classification evidence, and the raw
structured executor result.

The discovery state machine is:

```text
SEARCH_SAMPLE_EXHAUSTED
  -> continue the current query's pagination
QUERY_EXHAUSTED
  -> continue the next planned query
SOURCE_EXHAUSTED
  -> continue the next configured source
SEARCH_SPACE_REASONABLY_EXHAUSTED
  -> the only state allowed to trigger run-level search exhaustion
```

A run must not stop because 20 jobs were evaluated or because one visible page had no qualifying job. The final state is reached only after every planned query has completed pagination, every planned source has completed its query variants, and no open cursor or planned query remains.

To persist executor telemetry during a dry run, supply the run id:

```powershell
$env:DRY_RUN = "true"
npm run dry-run -- --payload ..\tmp\application-payload.json --run-id RUN-20260821-DRYRUN --headful
```
## Discovery-first routing

Workspace commands are:

```text
npm run search -- 100
npm run search -- java 100
npm run workspace -- start 20 --fixture automation/test/fixtures/discovery-first-dry-run.json
npm run workspace -- freeze <run-id>
npm run apply-native
npm run workspace -- apply native java
npm run show-external
npm run workspace -- show external java
npm run workspace -- mark external <opportunity-id> applied
```

`start <count>` is the two-stage command. It completes discovery and queue
routing first, then writes the immutable Stage 2 list to
`state/runs/<RUN_ID>/application-batch.json`. Browser/session discovery without
a local collector can call `freeze <run-id>` after all run-scoped queue records
have been persisted. Every frozen item contains the job identity, application
route, selected resume profile/path, chosen-profile score, and queue status;
candidate facts are not duplicated in the manifest.
Freezing is idempotent: once the manifest exists, later queue changes do not
alter that run's Stage 2 list.

The Java mode loads
`.agents/skills/job-application/search-profiles/java-backend.md`, uses the
Java-specific title/location plan and 100-point scorer, and persists
`searchProfile: "java_backend"` plus the Java requirement scope,
classification, match reasons, gaps, canonical `resumeProfile`, and selected
resume path in normalized records and queues. Unqualified commands retain the
existing Node/general behavior. Existing JSONL records without `resumeProfile`
are upgraded in memory when their canonical `selectedResume` path is read.

Qualifying native records go to `state/queues/native-apply.jsonl`; qualifying
external records go to `state/queues/external-apply.jsonl`; unresolved routes
go to `state/queues/unknown-review.jsonl`. New external records use `pending`
and may be processed interactively in an authorized `start` batch. The local
runner still blocks `applicationChannel: "external_application"` unless its
explicit `--allow-external` safety flag is supplied.

The capability registry currently reports no bundled local collectors for
LinkedIn, Naukri, Indeed, Wellfound, or external job boards. It reports native
classification support and enables only LinkedIn native execution. Naukri,
Indeed, and Wellfound native items are queued as `native_unsupported` until
their flows are separately implemented and tested.

Safe representative discovery simulation:

```powershell
npm run workspace -- search 100 --fixture automation/test/fixtures/discovery-first-dry-run.json --run-id RUN-DRYRUN
```

Fixture queues are isolated under the run directory and do not enter the live
application queues.
