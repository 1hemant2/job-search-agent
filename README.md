# Generic Job Search Agent

This repository contains the reusable discovery, matching, queueing, and browser-application workflow for a truthful job-search agent.

## How a candidate starts

The candidate only needs to do three things:

1. Place exactly one PDF resume in `candidate/inbox/`.
2. Tell the agent in chat: “My resume is ready.”
3. Answer the questions the agent asks.

The agent handles the rest: resume parsing, profile setup, resume selection,
and saving every confirmed answer before asking the next question. If the chat
is interrupted, the agent continues from the first unanswered question.

The agent will not guess missing identity, employment, education,
work-authorization, compensation, demographic, or legal information. A
candidate can answer “not applicable” or “prefer not to say” when appropriate.

After onboarding is complete, the agent can search for suitable jobs and guide
the candidate through applications. The candidate does not need to edit
templates or run setup commands.

Only PDF resumes are supported for automatic parsing at this time.

## Privacy

Candidate resumes, answers, application history, browser state, and run data
stay in private local folders and are excluded from future commits. Do not
place passwords, OTPs, MFA codes, CAPTCHA values, cookies, tokens, or recovery
codes in the workspace.
