# Ashby

## Detection and routing

- URL clues commonly include `jobs.ashbyhq.com` or an Ashby-hosted form.
- Use visible DOM/form clues to distinguish an Ashby page from an employer
  redirect or embedded generic form.

## Normal flow

Ashby is often compact, but custom questions and attachments vary by employer.
Fill confirmed contact/profile fields, upload the selected truthful resume,
resolve custom questions by normalized key and scope, and inspect the final
review state before submission.

## Recovery

Record the exact step when an upload, custom control, or redirect fails. Retry
one transient action; otherwise preserve the checkpoint and route to the next
suitable job. Do not assume a compact form is low risk or that a button click
is proof of submission.
