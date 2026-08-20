# Job Search Workspace

This directory contains the reusable candidate profile and application state derived from the resume and the job-search instructions.

## Setup Status

- Resume parsed: Complete
- Resume visual QA: Complete
- Candidate profile: Complete from available evidence
- Target categories and hard constraints: Established
- Application history: Initialized
- Resume store: Initialized with the Node.js resume as the default
- Credential registry: LinkedIn and Google/Gmail Chrome sessions verified available on 2026-08-20
- Required candidate answers: Core legal, location, availability, and India compensation answers are confirmed
- Core setup status: Complete
- Deferred form-specific information: Only exact house/street details, exact employment start day, and legally significant declarations remain; see `human-input-queue.md`
- Autonomous application submission: Ready for suitable roles; any application requiring a deferred field should be queued without stopping the overall run

## Operating Rule

The resume remains the primary source of truth. Files in this directory capture reusable information but must never override or embellish the resume without explicit candidate confirmation.
