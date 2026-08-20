# Generic External ATS

Use this module when URL and DOM detection do not identify a supported family,
or when an employer has materially customized a known ATS.

## Conservative procedure

1. Verify the destination is a legitimate employer or ATS domain.
2. Identify the visible form's labels, required state, control type, and
   navigation structure in one pass.
3. Map known candidate fields and normalized reusable answers.
4. Derive only low-risk answers with a recorded basis.
5. Leave optional unknown fields blank and queue required material fields.
6. Checkpoint before navigation and before review.
7. Submit only after the standard pre-submission checklist passes and verify a
   visible success state.

Generic handling is not permission to ask an LLM to invent values or to click
every button matching `Apply`/`Submit`. Record the observed field pattern and
failure lesson under the narrowest employer/ATS scope for later reuse.
