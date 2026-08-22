# Workday

## Detection and routing

- URL clues commonly include `*.myworkdayjobs.com` or a Workday tenant path.
- Confirm with visible Workday automation IDs and page structure; tenants vary.
- Keep the tenant/company in the application identity for deduplication and
  resumability.

## Normal flow

1. Inspect the current Workday page and preserve all completed progress.
2. Open the job and use the visible Apply action only when the handoff has not
   already advanced beyond it.
3. Sign in or create the legitimate tenant account through the supported flow.
4. Handle normal verification only through the current browser session.
5. If a resume is already attached, keep that same file and skip upload and
   parsing. Otherwise upload the selected resume through the normal flow.
6. Backfill blank profile sections and correct inaccurate parser-populated
   fields using confirmed candidate source-of-truth, then complete screening
   questions and save/continue steps one page at a time.
7. Check every review section, then submit and verify the tenant confirmation.

An existing attachment is authoritative for resume selection on that Workday
opening. Do not delete, replace, re-upload, or reparse it unless Workday shows
that it is missing/rejected or the user asks to use another resume. Resume text
does not override confirmed candidate facts when parsed employment, education,
dates, contact details, or experience values are wrong.

Workday commonly has the longest multi-step flow. Save a checkpoint after
account/profile completion, each page transition, upload, and review.

## Recovery

Retry one transient navigation or upload failure. Reopen the tenant if the
page expires. Queue CAPTCHA, unsupported MFA, unknown material legal answers,
and assessments; continue with another job only in a normal batch. In
`DIRECT_LINK_HANDOFF`, report not completed and stop without searching or
switching jobs. Never store Workday credentials, cookies, session exports, or
verification codes.
