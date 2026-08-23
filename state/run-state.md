# Run State

## Active Run

- Status: terminal - search space reasonably exhausted
- Run ID: RUN-20260823-START20
- Requested target: 20
- Successful submissions this run: 0
- Evaluated jobs this run: 20
- Skipped or ineligible: 16
- Blocked before submission: 0
- Failed: 0
- Fill-only dry runs: 0
- Assessments reached: 0
- Retry attempts: 0
- Current company: none
- Current role: none
- Current job URL: none
- Current application URL: none
- Current job ID: none
- Current ATS: none
- Active query: linkedin:Node.js Backend Engineer:node-backend-bengaluru-past-week
- Source: linkedin
- Location: Bengaluru, Karnataka, India
- Page number or cursor: search-page-scroll
- Scroll-completed status: complete
- Visible job IDs: opp-6c26728eb37a0c0d0894, opp-e482bae2e2e74449980a, opp-dd24b339260f491ed2f5, opp-32168c20e7cb1b8d688e, opp-0569758fcd5b2a6d084f, opp-4945fa1b598ab831853c, opp-3d205fcec9f55ae1b46b, opp-b50f40c55030407b780f, opp-d551fc241e67d728736b, opp-a3c487d723bea68f9c54, opp-1ab1a7477071fb2fae57, opp-29d05d19ea6ad833ec86, opp-c5fd4ae4f84a41156e89, opp-f91f0379e465d20455a8, opp-6085ab746858bc2fa1ab, opp-acb72281e6ab642ee8fc, opp-da8891ee3d15f215a0cd, opp-901a67285c81841857af, opp-021c63d2eeab388c7fab, opp-12c045950bc759081685
- Evaluated job IDs: opp-6c26728eb37a0c0d0894, opp-e482bae2e2e74449980a, opp-dd24b339260f491ed2f5, opp-32168c20e7cb1b8d688e, opp-0569758fcd5b2a6d084f, opp-4945fa1b598ab831853c, opp-3d205fcec9f55ae1b46b, opp-b50f40c55030407b780f, opp-d551fc241e67d728736b, opp-a3c487d723bea68f9c54, opp-1ab1a7477071fb2fae57, opp-29d05d19ea6ad833ec86, opp-c5fd4ae4f84a41156e89, opp-f91f0379e465d20455a8, opp-6085ab746858bc2fa1ab, opp-acb72281e6ab642ee8fc, opp-da8891ee3d15f215a0cd, opp-901a67285c81841857af, opp-021c63d2eeab388c7fab, opp-12c045950bc759081685
- New job IDs: opp-6c26728eb37a0c0d0894, opp-e482bae2e2e74449980a, opp-dd24b339260f491ed2f5, opp-32168c20e7cb1b8d688e, opp-0569758fcd5b2a6d084f, opp-4945fa1b598ab831853c, opp-3d205fcec9f55ae1b46b, opp-b50f40c55030407b780f, opp-d551fc241e67d728736b, opp-a3c487d723bea68f9c54, opp-1ab1a7477071fb2fae57, opp-29d05d19ea6ad833ec86, opp-c5fd4ae4f84a41156e89, opp-f91f0379e465d20455a8, opp-6085ab746858bc2fa1ab, opp-acb72281e6ab642ee8fc, opp-da8891ee3d15f215a0cd, opp-901a67285c81841857af, opp-021c63d2eeab388c7fab, opp-12c045950bc759081685
- Duplicate job IDs: none
- Next-page status: not_attempted
- Source/query exhaustion status: SEARCH_SPACE_REASONABLY_EXHAUSTED
- Last checkpoint: Browser discovery evaluated 20 unique cards for the Bengaluru Node.js/backend search; 1 qualifying native opening and 3 qualifying external openings were routed, with no submission attempted.
- Lifecycle state: stopped
- Discovery state: SEARCH_SPACE_REASONABLY_EXHAUSTED
- Queries completed: 1/1
- Sources completed: 1/1
- Jobs discovered: 20
- Unique jobs evaluated: 20
- Next cursor/page: none
- Discovery ledger: state/runs/RUN-20260823-START20/discovery-ledger.jsonl
- Search telemetry: state/runs/RUN-20260823-START20/search-telemetry.jsonl
- Executor telemetry: state/runs/RUN-20260823-START20/executor-telemetry.jsonl

## Last Completed Run

- Run ID: RUN-20260821-LINKEDIN-APPLY
- Requested target: 4 user-selected LinkedIn roles
- Successful submissions this run: 0
- Evaluated jobs: 4
- Blocked before submission: 4
- Last checkpoint: Terminal; all four selected applications reached LinkedIn authentication before submission; no submission counted
- Job ID: 4455423014 (final processed role)
- ATS: LinkedIn
- Selected resume: Hemant_Kumar_NodeJS_Resume.pdf

## Checkpoint Contract

This file is operational state, not candidate knowledge. It may contain only:

- run ID and requested target
- successful-submission count for the current run
- current job identity (company, normalized role, URL, job ID, and ATS)
- current application URL when it differs from the discovery/job URL
- lifecycle state and last completed checkpoint
- selected resume filename
- pending non-sensitive field keys or blocker references
- active query, source, location, page number/cursor, and page-transition state
- scroll-completed status and visible/new/duplicate/evaluated job IDs
- next-page status and source/query exhaustion status
- retry count and next action

CAPTCHA checkpoints use lifecycle `blocked_captcha`, preserve only non-secret job identity, ATS, application URL, selected resume filename, workflow step, and blocker reference, and leave the successful-submission counter unchanged. A later `--resume-captcha` execution reconciles the same application after human verification; it must not create a duplicate submission.

It must never contain passwords, OTPs, MFA codes, CAPTCHA values, cookies,
browser state, authentication tokens, or copied candidate answer values.

Update this checkpoint after each meaningful application transition. On restart,
reconcile it against `application-history.md`; confirmed history wins over an
ambiguous checkpoint. Clear the active section after the run reaches a terminal
stop condition.
