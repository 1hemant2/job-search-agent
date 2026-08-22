# Recruiter Outreach

## Prepare-then-send batch workflow

Use this workflow for connection notes and personalized messages to recruiters,
talent-acquisition staff, HR partners, hiring managers, or other people directly
relevant to a confirmed opening. A requested batch size such as 10, 50, or 100
is a maximum, not a quota: include only relevant, deduplicated contacts.

`outreach prepare <count>` performs research and drafting only. `outreach send
<batch-id>` sends an already prepared batch. If the user explicitly requests
both discovery and sending in one instruction, the two phases may run
consecutively without another confirmation or message-review checkpoint.
Preparing a batch by itself never authorizes sending it.

### Phase 1: research and prepare locally

1. Start from a confirmed company and opening. Find contacts whose current
   role makes them relevant to that opening, prioritizing the responsible
   recruiter or talent partner, then recruiting leadership, HR, and an
   appropriate engineering hiring manager.
2. Open and inspect each candidate profile before drafting. Record the name,
   profile URL, current title, company, relationship to the opening, and the
   specific evidence that makes the person relevant. Do not add unrelated
   people merely to reach the requested count.
3. Deduplicate by normalized profile URL and identity against prior outreach
   batches and visible pending or accepted invitations. Never send a second
   initial request to the same person.
4. Write every exact final message before beginning browser sending. Persist the
   batch under `state/outreach/batches/<BATCH_ID>/` with:

   - `drafts.md`: a human-readable numbered list containing each target, the
     relevance evidence, character count, and the exact message to send;
   - `targets.jsonl`: one durable record per target with `target_id`, name,
     profile URL, title, company, opening, message type, exact message,
     character count, and `prepared` status;
   - `events.jsonl`: append-only preparation, verification, send, block, and
     skip events with timestamps.

5. Show the saved draft file path in chat and summarize the prepared batch.
   When the user asks to see all notes, present the exact locally saved text,
   not reconstructed wording from memory or a truncated website view.

Saving the drafts is an audit and reliability step, not an approval gate. When
the current user instruction already authorizes sending, do not ask the user to
review or approve individual messages or the whole batch, and do not print all
drafts into chat unless requested. Continue directly to Phase 2 after the batch
files are complete. Pause only for a genuine blocker, missing material fact, or
an action outside the user's authorization.

### Phase 2: send the saved batch one profile at a time

For each `prepared` record, open its saved profile URL fresh and complete the
following sequence before moving to the next record:

1. Confirm that the visible profile name, title, and company match the saved
   target. If they do not, mark the record `blocked_identity_mismatch` and do
   not send.
2. Open Connect/Invite or the authorized message composer, choose Add a note
   when applicable, and clear the text field completely.
3. Insert the saved message in one operation. Never compose, repair, or append
   fragments inside the live field. Do not use repeated typing as a fallback
   after a fill that may already have partially succeeded.
4. Read the complete field value back and compare it character-for-character
   with the locally saved message. Also verify the site's character counter and
   limit. If any value differs, clear the field and retry once from the saved
   source. If exact read-back is unavailable or the second comparison fails,
   close without sending and record `blocked_message_mismatch`.
5. Send only after exact read-back succeeds. Immediately verify the site's
   success confirmation or Pending state, then append the result to
   `events.jsonl` and update the target status before opening the next profile.
6. When LinkedIn's Sent Invitations view exposes the note, compare it with the
   local source. Treat this as a post-send audit because LinkedIn may truncate
   displayed notes; the pre-send full-value comparison remains mandatory.

Process the batch strictly one target at a time. A CAPTCHA, account challenge,
rate limit, invitation limit, missing Connect option, or uncertain page state
blocks only that record unless the site indicates an account-wide restriction.
Never bypass a security control, repeatedly retry a send, or claim success
without a visible confirmation. Report prepared, sent, skipped, blocked, and
remaining counts at the end.

## Default Style

- Keep messages short, specific, and truthful.
- Mention the actual company and role.
- Lead with the most relevant confirmed backend experience.
- Do not send bulk or unrelated outreach.
- Send at most one initial message and one follow-up.
- Personalize from verified job, company, and profile facts only; do not invent
  shared interests, referrals, relationships, or familiarity.
- Keep connection notes within the current platform limit, leaving a small
  safety margin when practical.

## Node.js Backend Template

Hi {first_name},

I just applied for the {role} opening at {company}. I currently build Node.js and PostgreSQL backend systems, including multi-tenant analytics and asynchronous processing with Redis and BullMQ, so the role looked closely aligned with my experience.

Wanted to reach out and introduce myself.

Best,
Hemant

## Connection Note Template

Hi {first_name}, I applied for the {role} role at {company}. I build Node.js/PostgreSQL backend systems with Redis and asynchronous processing, and the opening looked closely aligned. I would be glad to connect.

## Java-Heavy Role Rules

- State that Java and Spring Boot experience comes from two years of hands-on independent backend project development.
- Do not describe the Java experience as professional, commercial, or production employment.
- Pair the Java project experience with transferable professional backend experience in PostgreSQL, Redis, queues, asynchronous processing, Docker, Kubernetes, and distributed systems.
- Mention AlertOps when the role values Spring Boot, RabbitMQ, concurrency, workflow engines, caching, or multi-tenancy.
- Prefer the concise template for initial recruiter outreach. Use the detailed template only when the role is an especially strong match.

## Java Recruiter Message - Concise

Hi {first_name},

I just applied for the {role} position at {company}. I have two years of hands-on Java and Spring Boot experience building independent backend projects, alongside professional experience building scalable backend systems with PostgreSQL, Redis, queues, Docker, and Kubernetes.

The role looked closely aligned, so I wanted to introduce myself.

Best,
Hemant

## Java Recruiter Message - AlertOps Focus

Hi {first_name},

I applied for the {role} opening at {company}. Over the past two years, I have built independent backend systems with Java and Spring Boot, including a multi-tenant alerting platform using PostgreSQL, RabbitMQ, Redis, JPA, optimistic locking, delayed escalation, and idempotent consumers.

I also bring professional backend experience with high-volume data processing, PostgreSQL optimization, asynchronous workers, Docker, and Kubernetes. The role looked like a strong match for that combination, and I would be glad to connect.

Best,
Hemant

## Java Recruiter Message - Transferable Backend Focus

Hi {first_name},

I recently applied for the {role} role at {company}. My professional work focuses on scalable backend systems, asynchronous processing, PostgreSQL, Redis, and Kubernetes. In parallel, I have two years of hands-on Java and Spring Boot experience building independent backend projects involving RabbitMQ, JPA, concurrency control, caching, and multi-tenant architecture.

I would welcome the opportunity to discuss how this backend experience could transfer to your Java engineering team.

Best,
Hemant

## Java Connection Note

Hi {first_name}, I applied for the {role} role at {company}. I have two years of hands-on Java/Spring Boot project experience plus professional backend experience with PostgreSQL, Redis, queues, Docker, and Kubernetes. I would be glad to connect.

## Java Connection Note - Short

Hi {first_name}, I applied for the {role} role at {company}. I bring hands-on Java/Spring Boot project experience and professional experience building scalable backend systems. I would be glad to connect.
