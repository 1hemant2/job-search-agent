# Candidate profile starter

Copy this folder into the private workspace folder with:

```sh
cp -R candidate-template/. candidate/
```

Replace all `<placeholder>` values with confirmed facts. Delete sections that do not apply, but do not replace unknown facts with guesses. Add resume PDFs under `candidate/resumes/` and configure their paths in `resume-profiles.json`.

Alternatively, bootstrap a new candidate from a PDF resume with:

```sh
cd automation
npm run workspace -- onboard --resume /absolute/path/to/resume.pdf
```

Then ask the questions in `candidate/onboarding-questions.md`. Parsed values
are suggestions only; confirm them with the candidate before copying them into
the source-of-truth files.

For the optional Java/backend matcher, also fill `matching-config.json` with
confirmed numeric experience scopes. If a scope is left `null`, jobs requiring
that scope remain human-review blockers.
