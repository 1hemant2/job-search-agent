# Workday

## Detection and routing

- URL clues commonly include `*.myworkdayjobs.com` or a Workday tenant path.
- Confirm with visible Workday automation IDs and page structure; tenants vary.
- Keep the tenant/company in the application identity for deduplication and
  resumability.

## Normal flow

1. Open the job and use the visible Apply action.
2. Sign in or create the legitimate tenant account through the supported flow.
3. Handle normal verification only through the current browser session.
4. Fill profile sections, resume attachment, screening questions, and
   save/continue steps one page at a time.
5. Check every review section, then submit and verify the tenant confirmation.

Workday commonly has the longest multi-step flow. Save a checkpoint after
account/profile completion, each page transition, upload, and review.

## Recovery

Retry one transient navigation or upload failure. Reopen the tenant if the
page expires. Queue CAPTCHA, unsupported MFA, unknown material legal answers,
and assessments; continue with another job. Never store Workday credentials,
cookies, session exports, or verification codes.
