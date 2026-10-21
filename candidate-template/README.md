# Candidate profile starter

This folder contains the private candidate templates used by the agent.
Candidates do not need to edit or copy these files manually.

Place exactly one PDF resume in `candidate/inbox/` and tell the agent:
“My resume is ready.” The agent initializes the profile, asks questions in
chat, and saves each confirmed answer before continuing. Parsed values are
suggestions only and must be confirmed by the candidate.

For the optional Java/backend matcher, also fill `matching-config.json` with
confirmed numeric experience scopes. If a scope is left `null`, jobs requiring
that scope remain human-review blockers.
