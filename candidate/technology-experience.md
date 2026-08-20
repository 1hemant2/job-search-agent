# Technology Experience

This file is the canonical source for technology-experience scope. General hands-on experience and professional/production/commercial employment experience are separate concepts.

## Java

```yaml
normalized_key: java_general_experience
value: approximately 2 years
scope: substantial hands-on Java development, DSA/LLD work, and independent backend projects including Spring Boot AlertOps
source: user-confirmed
confidence: confirmed
interpretation: use for generic Java experience, hands-on Java experience, or "worked with Java" unless the surrounding question explicitly restricts scope to professional, employment, production, or commercial experience
```

```yaml
normalized_key: java_professional_experience
value: 0 years
scope: paid employment using Java
source: user-confirmed
confidence: confirmed
interpretation: use only when the question explicitly says professional or employment Java experience
```

```yaml
normalized_key: java_production_experience
value: 0 years
scope: Java used in a professional production system
source: user-confirmed
confidence: confirmed
interpretation: use only when the question explicitly says production Java experience
```

```yaml
normalized_key: java_commercial_experience
value: 0 years
scope: commercial employment using Java
source: derived
derived_from:
  - confirmed 0 years professional Java employment
  - resume contains Java only in independent projects
confidence: high
interpretation: use only when commercial clearly means paid employment; otherwise preserve the literal scope or queue a required material ambiguity
```

Never answer 0 to a generic Java-experience question merely because the experience was not professional. Never present the approximately 2 years of general Java experience as employment.

## Confirmed Professional Backend Experience

```yaml
normalized_key: typescript_experience
value: 0 years confirmed
scope: general or professional TypeScript experience
source: candidate profile and resume audit
confidence: confirmed
interpretation: do not claim TypeScript experience unless the candidate later confirms and documents it
```

```yaml
normalized_key: nodejs_experience
value: approximately 2 years
scope: professional Node.js backend development
source: candidate profile and resume
confidence: confirmed
```

```yaml
normalized_key: backend_api_experience
value: approximately 2 years
scope: professional backend and REST API development
source: derived
derived_from:
  - Enterprise Bot Node.js backend work since September 2024
  - confirmed REST API skill
confidence: high
```

## Broader Skill Derivations

```yaml
- normalized_key: relational_database_experience
  value: yes
  source: derived
  derived_from: confirmed PostgreSQL and SQL experience
  confidence: high
- normalized_key: messaging_queue_experience
  value: yes
  source: derived
  derived_from: confirmed BullMQ and RabbitMQ experience
  confidence: high
- normalized_key: containerization_experience
  value: yes
  source: derived
  derived_from: confirmed Docker experience
  confidence: high
- normalized_key: container_orchestration_experience
  value: yes
  source: derived
  derived_from: confirmed Kubernetes experience
  confidence: high
```

Do not use a broad category to infer an unsupported specific product or professional scope. For example, database experience does not prove professional Oracle experience.
