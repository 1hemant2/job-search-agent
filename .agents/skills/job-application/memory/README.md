# Job-Application Memory Contract

This is the operational memory layer for ATS procedure and answer resolution.
It extends the existing `candidate/` source-of-truth files; it does not replace
them.

## Two separate kinds of memory

1. Candidate knowledge remains in `candidate/`:
   identity, employment, education, projects, technology scope, authorization,
   compensation, preferences, reusable answers, and the human-input queue.
2. Procedural memory belongs here:
   ATS detection clues, navigation patterns, field-label mappings, recovery
   strategies, and cross-ATS lessons learned from completed attempts.

Procedural memory may improve routing and browser efficiency, but it can never
create candidate facts or override a source-of-truth file.

When a user hands off a specific job or application URL, procedural memory may
help resume that same opening, but it must not redirect the task to another
listing or start discovery. A failure remains terminal for that
`DIRECT_LINK_HANDOFF` and must be reported as not completed.

## Answer resolution contract

Normalize a form question to a semantic key before resolving it. Preserve
aliases such as `notice_period`, `availability`, and `earliest_start` when they
have the same scope. A reusable answer record should carry:

```yaml
normalized_key: notice_period
value: 60 days
scope: India employment application
source: user-confirmed
confidence: confirmed
equivalent_questions: [notice period, availability, earliest start]
derived_from: []
status: active
```

Allowed confidence/provenance meanings:

- `confirmed`: directly established by the user or a canonical candidate file;
  reuse when the scope matches.
- `high`: low-risk mechanical or semantic derivation from confirmed facts;
  reuse and retain the derivation basis.
- `moderate`: low-risk, plausible mapping that still needs material review;
  never use it to answer a high-consequence question.
- `unknown`: do not guess; leave optional fields blank or queue required
  material fields in `candidate/human-input-queue.md`.

The existing source hierarchy remains authoritative. A later user correction
supersedes a derived answer and marks the old derivation obsolete. Never infer
citizenship, sponsorship, clearance, criminal history, demographic data,
salary history, or legally significant consent.

## Cross-ATS reuse

Reuse knowledge at the narrowest safe scope:

`exact employer/domain` → `ATS family` → `generic external ATS`.

An employer-specific lesson must not be generalized automatically. An ATS-wide
lesson may be reused across employers only when the visible form structure
supports it. Record failed lessons as well as successful ones so the same
recovery path is not repeated indefinitely.

History and checkpoints should reference normalized answer keys and blocker
keys rather than copying answer values. Do not add a second profile store,
database, browser-session store, or credential store.
