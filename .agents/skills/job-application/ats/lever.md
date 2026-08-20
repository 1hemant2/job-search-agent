# Lever

## Detection and routing

- URL clues commonly include `jobs.lever.co` or a Lever-hosted posting.
- Confirm the visible application form; employer customizations are common.

## Normal flow

Lever is frequently a single-page form with contact details, links, resume or
cover-letter attachments, and custom questions. Resolve fields in one visible
pass, fill routine known fields in a batch, then inspect all required custom
questions before review.

Do not treat a successful file upload or button click as submission. Require a
visible confirmation state and record the exact resume filename used.

## Recovery

Retry one safe upload or transient page action. For an unknown required
question, preserve the current state and queue it. If the page uses a custom
embedded flow, use `generic.md` while retaining Lever as the ATS family.
