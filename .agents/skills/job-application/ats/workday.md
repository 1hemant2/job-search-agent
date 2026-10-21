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
6. On `My Experience`, inventory every summary section before continuing.
   `No Response` means no record was added; it is not a completed answer and
   does not imply that no controls exist. Workday often hides all record fields
   until the section-scoped Add control is clicked.
7. Backfill blank profile sections and correct inaccurate parser-populated
   fields using confirmed candidate source-of-truth, then complete screening
   questions and save/continue steps one page at a time.
8. Check every review section, then submit and verify the tenant confirmation.

An existing attachment is authoritative for resume selection on that Workday
opening. Do not delete, replace, re-upload, or reparse it unless Workday shows
that it is missing/rejected or the user asks to use another resume. Resume text
does not override confirmed candidate facts when parsed employment, education,
dates, contact details, or experience values are wrong.

Workday commonly has the longest multi-step flow. Save a checkpoint after
account/profile completion, each page transition, upload, and review.

## My Experience record sections

For each section, locate its heading/container first, scroll it into view, and
inspect buttons within that section. Controls may be named `Add`, `Add Work
Experience`, `Add Education`, or similar. Click the section-scoped control and
then inspect the newly exposed fields; do not search only for already-visible
empty inputs.

- **Work Experience:** `candidate/experience.md` is the source of truth for
  the candidate's employment records. If the summary says `No Response` or a
  record is absent, click Add and enter only the confirmed employer, title,
  location, dates, current-employment state, and supported description details.
  Preserve an accurate parser-created record instead of duplicating it.
- **Education:** `candidate/education.md` is the source of truth for education
  records. If a confirmed record is absent, click Add and enter its institution,
  field, dates, and grade only where the form supports it.
- **Certifications:** add the confirmed RHCSA certification when the section
  supports it. Do not invent an issue date, expiration date, credential ID, or
  URL; a required unknown field blocks only this item.
- **Languages:** this means human/spoken languages, not programming languages.
  No spoken-language fact is currently confirmed. Leave the optional section
  as `No Response`; if Workday requires it, create a human-input blocker.
- **Skills:** add job-relevant skills that are confirmed by the queued resume
  and candidate sources. When Workday uses suggestions, select the matching
  suggestion so a visible chip/record is created; typed but uncommitted text is
  not a saved skill.

After each Add flow, use its visible Save/Done control and verify that the
section summary no longer says `No Response` and shows the expected record.
Do not click the page-level Save and Continue until Work Experience, Education,
confirmed Certifications, and Skills have been populated or have a documented
required-field blocker.

### Workday Role Description

The Work Experience `Role Description` field is a long-form employment record.
Populate it with the complete employment section from the queued
`selectedResume`, cross-checked against `candidate/experience.md`. Do not
write a short stack sentence such as "Build scalable backend systems using..."
and do not derive the text from the target job description.

A non-empty value is not automatically acceptable. On resume or review, replace
an existing one-line keyword/stack summary with the full selected-resume
experience entry before saving, while preserving any accurate user edits.

Use newline-separated plain-text bullets and retain all material achievements
when Workday's character limit permits. Preserve every material achievement,
responsibility, and metric from that employment record.

Follow the selected resume's wording and technology emphasis. Never add a
technology to an employment record merely because it appears in a project,
another resume variant, or the target job description.
If Workday enforces a smaller character limit, compress the bullets only as much
as required, prioritize quantified impact plus profile-relevant evidence, and
never collapse the entry to a one-line keyword list while more space remains.

After filling, read back the complete textarea value and verify that multiple
achievement bullets and the major metrics survived before saving the record.

## Chrome resume-upload recovery

After the required action-time confirmation, start the file-chooser wait before
clicking Workday's upload control, set the exact queued resume using its absolute
path, and verify the filename/attachment status on the page. If the first
attempt fails or the attachment does not appear, refresh the browser snapshot
and locator, then retry once. Only after the retry fails should the agent show
the Chrome `Allow access to file URLs` troubleshooting instruction. If the user
says it is already enabled, do not repeat that instruction; retry once from a
fresh chooser state, then preserve the tab as a technical handoff if necessary.

## Recovery

Retry one transient navigation or upload failure from fresh page/locator state. Reopen the tenant if the
page expires. Queue CAPTCHA, unsupported MFA, unknown material legal answers,
and assessments; continue with another job only in a normal batch. In
`DIRECT_LINK_HANDOFF`, report not completed and stop without searching or
switching jobs. Never store Workday credentials, cookies, session exports, or
verification codes.
