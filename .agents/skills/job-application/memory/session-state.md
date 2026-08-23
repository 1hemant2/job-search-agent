# Resumable Session State

## Lifecycle

```text
discovered
→ qualified
→ duplicate_checked
→ resume_selected
→ ats_detected
→ application_opened
→ profile_filled
→ questions_resolved
→ review_ready
→ submitted_confirmed
```

Terminal non-success states are `skipped`, `duplicate`, `failed`,
`blocked_human`, `blocked_captcha`, `assessment`, and `abandoned`.

## Checkpoint rules

Persist a checkpoint in `state/run-state.md` and record material outcomes in
`application-history.md` after each transition. A checkpoint contains job
identity, ATS, lifecycle state, canonical resume profile/path, pending field keys,
blocker reference, retry count, and next action. It does not contain answer
values, credentials, cookies, or browser state.

For a handed-off ATS page, checkpoint whether the resume was already attached.
On resume, preserve that same attachment and continue from the nearest safe
step; do not repeat upload/parsing unless the ATS visibly lost or rejected it.
Candidate source-of-truth remains authoritative for backfilled field values.

At restart:

1. load `state/run-state.md` and the complete candidate bootstrap set;
2. reconcile the checkpoint with `application-history.md` using company,
   normalized role, job URL, ATS URL, and job ID;
3. treat a confirmed submission in history as terminal and never resubmit;
4. reopen a nonterminal application at its last safe checkpoint when the
   browser still has the page, otherwise reopen the job through its official
   ATS URL;
5. retry only the failed transition once when safe. For a normal batch, record
   the failure and continue with another suitable job. For
   `DIRECT_LINK_HANDOFF`, record the failure, report that the specific
   application was not completed, and stop; never substitute another job.

For a two-stage batch, reconstruct the ordered application list from the frozen
`state/runs/<RUN_ID>/application-batch.json` manifest. Never add newly discovered
jobs to that manifest or silently change a queued resume profile during resume.

The direct-link target remains authoritative across restarts. An official ATS
URL reached by a redirect is valid only when it is clearly the same opening;
otherwise the handoff is blocked rather than converted into discovery.

### CAPTCHA resumability

CAPTCHA is application-level state, not run-level state. The executor gives a
normal page verification a short bounded opportunity to clear, then returns
`status=blocked`, `lifecycle=blocked_captcha`, and `blocker.type=captcha` if
human action remains. It records an idempotent non-secret queue/checkpoint and
does not retry that application again during unattended execution.

After the user completes the challenge, reconstruct the same payload from the
candidate source of truth and invoke the executor with `--resume-captcha`.
Reopen the official application URL, detect that the challenge is gone,
revalidate/refill only ordinary prepared fields, and continue from the nearest
safe step. On confirmed submission, resolve the queue entry and record the
normal history result. If CAPTCHA remains, update the existing blocker and
continue with another job in a normal batch. In `DIRECT_LINK_HANDOFF` mode,
update the existing blocker, report not completed, and stop.

The target counter is rebuilt from confirmed successful submissions in the
current run, not from attempted, historical, duplicate, blocked, or uncertain
records.
