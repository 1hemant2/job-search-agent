# ATS Routing and Adapter Contract

ATS handling is a set of browser-guidance modules, not a second automation
program. Use the supported visible browser and read the current page before
acting.

## Detection order

1. Normalize the URL host and inspect known patterns.
2. Inspect visible DOM clues, page title, form controls, and automation IDs.
3. Compare the result with procedural memory for the employer/domain.
4. If signals conflict, prefer the visible page and use `generic.md`.

Detection is routing metadata only. It never changes candidate truth rules or
deduplication.

## Direct-link handoff boundary

When the task began with a user-provided URL, the adapter may navigate through
same-opening redirects, authentication gates, and apply controls exposed by
that opening. It must not replace the target with a search result, alternate
listing, or another queued opportunity. If the target cannot be completed,
return the observed blocker or failure so the agent can report not completed and
stop the direct-link run.

Before running any upload step, inspect the current form state. If the user
already attached a resume, preserve that file and its parsed progress, treat it
as the selected resume for this opening, and continue with unanswered sections.
Use confirmed candidate files to backfill blanks and correct parser mistakes.
Do not remove, replace, re-upload, or reparse the attachment unless it is
visibly missing, rejected/lost by the ATS, or the user explicitly requests a
different resume.

## Adapter interface

Each ATS module should describe only the current page's observed flow:

- open/apply entry point
- standard profile fields
- resume upload behavior
- custom-question grouping and safe answer mapping
- navigation controls and save/continue behavior
- review and submission confirmation signals
- recoverable failures and human-only blockers

After each meaningful step, checkpoint the session and record reusable
procedural knowledge. Never assume a selector, question, tenant, or page layout
is permanent.

## Shared safety boundary

No CAPTCHA bypass, stealth, fingerprint manipulation, anti-detection, forged
tokens, password literals, OTP persistence, or generic guessing. Unknown
material questions go to the human-input queue. A visible success confirmation
is required before an application counts.

See the dedicated modules for Workday, Greenhouse, Lever, Ashby, and generic
external ATS pages.

## CAPTCHA routing

CAPTCHA, reCAPTCHA, hCaptcha, Turnstile, and equivalent human verification are
application-level blockers across all ATS adapters. Allow a brief bounded
period for normal page verification to finish, then return the blocker if it
remains. Do not click challenge controls, inspect or inject tokens, retry the
same challenge in a loop, or use solver/stealth/anti-detection mechanisms.

Preserve the official URL, company, role, ATS, job ID, selected resume
filename, workflow step, and completed field keys only. Queue one
`blocked_captcha` entry in `candidate/human-input-queue.md`, leave the target
counter unchanged, and continue with another suitable application in a normal
batch. For `DIRECT_LINK_HANDOFF`, preserve the same checkpoint, report the
application as not completed, and stop. Resume only after an explicit human
completion using the same browser profile and a reconciled payload.
