# Discovery and Queueing

Discovery remains source-agnostic: LinkedIn is primarily a discovery source,
while official company and ATS applications are first-class targets.

For each candidate opening, capture company, normalized role, posting date,
location/work arrangement, compensation when known, source URL, official ATS
URL, job ID, and the complete description before scoring.

Queue only suitable, recent, non-duplicate opportunities. One failed ATS is a
routing event, not a reason to change the rest of the run to Easy Apply-only.
The queue may contain `pending`, `in_progress`, `blocked`, `failed`,
`submitted`, and `skipped` records, but only confirmed suitable submissions
advance the active target.
