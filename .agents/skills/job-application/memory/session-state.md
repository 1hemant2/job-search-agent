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
identity, ATS, lifecycle state, selected resume filename, pending field keys,
blocker reference, retry count, and next action. It does not contain answer
values, credentials, cookies, or browser state.

At restart:

1. load `state/run-state.md` and the complete candidate bootstrap set;
2. reconcile the checkpoint with `application-history.md` using company,
   normalized role, job URL, ATS URL, and job ID;
3. treat a confirmed submission in history as terminal and never resubmit;
4. reopen a nonterminal application at its last safe checkpoint when the
   browser still has the page, otherwise reopen the job through its official
   ATS URL;
5. retry only the failed transition once when safe, then record the failure and
   continue with another suitable job.

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
continue with another job.

The target counter is rebuilt from confirmed successful submissions in the
current run, not from attempted, historical, duplicate, blocked, or uncertain
records.
