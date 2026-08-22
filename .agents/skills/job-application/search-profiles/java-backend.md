# Java Backend Search Profile

This profile adds Java/Spring Boot discovery and matching without changing the
shared candidate facts, canonical opportunity identity, deduplication, recency,
application-channel classification, queues, history, or native executor.

## Sources of truth

Load the candidate files required by root `AGENTS.md`. In particular:

- `candidate/technology-experience.md` owns general versus professional,
  production, and commercial Java experience values.
- `candidate/experience.md` owns professional backend achievements.
- `candidate/projects.md` owns independent Java/Spring Boot evidence.
- `candidate/preferences.md` and `candidate/work-authorization.md` own
  location and eligibility facts.
- `resumes/index.md` owns resume selection.

Do not copy candidate facts into this profile or infer that the professional
production stack was Java. Generic Java-experience questions use the canonical
general hands-on value. Questions explicitly restricted to professional,
production, commercial, or employment Java use the separately stored scoped
value. Never silently narrow a generic question or broaden a scoped one.

## Objective and search breadth

Find roles where the candidate has a realistic chance of passing recruiter
screening and performing well in the technical interview. Search by compatible
responsibilities and technologies, not literal titles only. Use sensible Java
and backend combinations for Backend Engineer, Backend Developer, Software
Engineer, Software Development Engineer, SDE-1, SDE-2, Java Backend Engineer,
Java Software Engineer, and Backend Software Engineer.

Continue across configured query variants, pages, and sources until the unique
evaluation target is reached or the shared discovery state machine reaches
`SEARCH_SPACE_REASONABLY_EXHAUSTED`.

Location priority is Bengaluru, Remote India, Hyderabad, Pune, Gurgaon/NCR,
then other compatible Indian locations. International remote roles qualify
only when candidates located in India are eligible. Prefer product companies,
engineering-focused startups, mid-sized technology companies, and backend-heavy
fintech, SaaS, or infrastructure companies; company fame is not required.

## Target and blockers

Prioritize 1-3 years total software/backend experience, especially 1-2 years,
2+ years, and roles valuing Java/Spring Boot knowledge plus backend fundamentals.
Consider a three-year role when wording is flexible and technical fit is strong.

A statement such as "2 years Java experience" is not automatically a blocker.
Classify whether it is general/flexible or a strict professional/production
requirement. Apply the canonical Java scope only when wording explicitly limits
the experience type.

Normally skip hard 4+ total-experience requirements, strict 3+ professional or
production Java/Spring Boot requirements, substantial senior ownership, Lead,
Staff, Principal, Android Java, frontend-heavy, QA/test automation, support,
DevOps-only, and data-engineering roles where backend applications are secondary.

Do not reject adjacent backend technologies by name alone. Kafka can transfer
from RabbitMQ/BullMQ experience; MySQL from PostgreSQL/SQL/query optimization;
and AWS from OCI unless deep production AWS expertise is a strict core need.

## Scoring (100 points)

- Backend relevance (25): 25 backend core, 15 backend-heavy mixed/full-stack,
  5 backend secondary.
- Experience alignment (20): 20 for 1-2 years, 18 for 2-3 years, 12 for a
  flexible three-year role. A strict 4+ total requirement is rejected. A strict
  professional/production Java requirement is evaluated against its canonical
  scoped value and can hard-block.
- Java alignment (20): 20 Java plus Spring Boot core, 15 Java backend with
  another Java framework, 10 JVM/backend where Java is one accepted option.
- Backend technology match (20): meaningful overlap across SQL/PostgreSQL,
  Redis, RabbitMQ/Kafka, REST APIs, event-driven systems, microservices,
  asynchronous processing, Docker, and Kubernetes. Do not require every item.
- Engineering quality (10): system design, performance/scale, distributed
  systems, concurrency/reliability, data-intensive systems, and backend feature
  ownership.
- Location/practical fit (5): full credit when location and work authorization
  are compatible.

Strong positive signals include Java, Spring Boot, SQL/PostgreSQL, Redis,
RabbitMQ/Kafka, REST APIs, microservices, distributed/event-driven systems,
asynchronous processing, concurrency, database optimization, Docker,
Kubernetes, system design, DSA, LLD, and high-volume backend systems.

Classify 75-100 as `APPLY`, 60-74 as `APPLY_STRETCH`, 50-59 as `REVIEW`, and
below 50 as `SKIP`. Hard blockers override the numeric classification. Missing
learnable backend tools must not automatically force `SKIP`.

## Resume and persistence

Select `resumes/Hemant_Kumar_Java_Resume.pdf` only when Java/Spring is
meaningful to the backend role. An incidental Java mention is insufficient. A
clearly Node.js/TypeScript-specific role keeps the Node.js resume even if Java
is merely nice to have.

Every Java evaluation persists the shared canonical opportunity ID plus company,
role, location, source and application URLs, source/platform, required YOE,
Java/Spring requirement, Java experience scope, score, classification, match
reasons, gaps, selected resume, channel, status, and posting age. Qualifying
native records route to the native queue, qualifying external records remain
manual-first, and unknown routes go to review. Profile filtering never changes
the shared dedupe identity.

## Commands

- `search java 100` evaluates approximately 100 unique Java/backend jobs.
- `apply native java` processes only eligible Java-profile native records.
- `show external java` shows pending manual Java-profile external records.

Migration and dry-run use never uploads a resume or submits an application.
