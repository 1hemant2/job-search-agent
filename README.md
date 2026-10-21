# Generic Job Search Agent

This repository contains the reusable discovery, matching, queueing, and browser-application workflow for a truthful job-search agent.

## First-time setup

1. Copy the starter candidate folder into the private `candidate/` folder:

   ```sh
   cp -R candidate-template/. candidate/
   ```

2. Replace the placeholder values in `candidate/*.md` with the candidate's confirmed information. Do not guess unknown legal, identity, employment, education, compensation, or work-authorization facts. Fill `candidate/matching-config.json` when using the optional Java/backend matcher.
3. Put the candidate's resume PDFs in `candidate/resumes/` and update `candidate/resume-profiles.json`. The configured paths must point to those PDFs.
4. Keep `candidate/`, `candidate/resumes/`, `state/`, `tmp/`, and `application-history.md` private. They are ignored by default so personal data is not accidentally committed.
5. Install and test the browser executor:

   ```sh
   cd automation
   npm install
   npm run build
   npm test
   ```

## Onboard another user from a resume

For a new candidate, a PDF resume can bootstrap the private candidate folder:

```sh
cd automation
npm run workspace -- onboard --resume /absolute/path/to/resume.pdf
```

This copies the resume into `candidate/resumes/`, updates the configured
resume profile, extracts conservative suggestions, and generates
`candidate/onboarding-questions.md`. The agent should ask those questions in
chat and write only confirmed answers into the candidate source-of-truth
files before searching. The parser never guesses missing legal,
work-authorization, compensation, demographic, or employment facts.

If that candidate folder already contains confirmed data, onboarding stops
instead of overwriting it. Use `--force` only when intentionally replacing the
same candidate's onboarding state.

PDF parsing uses Poppler's `pdftotext` command. On macOS, install it with
`brew install poppler` if it is not already available. DOC/DOCX intake is not
yet supported by this command; convert it to PDF first.

The agent reads candidate truth from `candidate/`, selects resumes using `candidate/resume-profiles.json`, and persists queues and run state under `state/`. Search profiles, locations, and query variants can be customized in the same JSON configuration without changing the workflow code.

## Commands

Run commands from `automation/`:

```sh
npm run workspace -- search 25
npm run workspace -- search java 25
npm run workspace -- show external
npm run workspace -- apply native
```

Use `start <count>` only after reviewing the workflow and browser-confirmation rules in `AGENTS.md`. Never store passwords, OTPs, MFA codes, CAPTCHA values, cookies, tokens, or recovery codes in this repository.

## Sharing checklist

Before publishing or sending a copy, verify that `git status --short` shows no private candidate files, PDFs, queue records, run logs, outreach batches, browser configuration, or temporary payloads. The committed starter files use placeholders and generic examples only.
