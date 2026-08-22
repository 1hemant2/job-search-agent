# Greenhouse

## Detection and routing

- URL clues commonly include `boards.greenhouse.io`,
  `job-boards.greenhouse.io`, or a Greenhouse-hosted application form.
- Confirm the visible form before selecting the Greenhouse guidance.

## Normal flow

Greenhouse often presents a single-page form with contact fields, location,
resume upload, links, optional cover letter/referral/source fields, and custom
questions. Read every custom question as a group, map only known or safely
derivable answers, and preserve the exact job/company identity.

If a resume is already attached at handoff, preserve it and skip upload. Use
confirmed candidate facts to backfill blanks and correct parser/autofill errors
without replacing the attachment.

Sponsorship, prior-affiliate, authorization, background-check, and other
material questions use the candidate source hierarchy and blocker queue; never
answer from a generic form guess.

## Recovery

Correct parser or autofill errors from `candidate/`; retry an upload once only
when the attachment is visibly absent, rejected, or lost, then checkpoint
before review. Record the visible confirmation only after the page indicates
success. If the form structure differs materially, route to `generic.md` for
the same opening and record the observed pattern for future review.
