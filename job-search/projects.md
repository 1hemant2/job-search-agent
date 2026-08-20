# Projects

## Chatty - Real-Time Messaging System

- Technologies: Node.js, JavaScript, Socket.IO, Redis, MongoDB
- Architected and developed a real-time messaging backend supporting one-to-one conversations, presence, delivery status, and seen-status tracking.
- Integrated the Redis Socket.IO adapter for horizontal scaling and synchronization across backend instances.
- Implemented offline synchronization and reconnect handling to deliver missed messages after reconnection.
- Repository URL: https://github.com/1hemant2/Chaty
- Public repository: Verified 2026-08-20

## AlertOps - Queue-Based Alerting and Escalation System

- Technologies: Java, Spring Boot, PostgreSQL, RabbitMQ, Redis, JPA
- Built a multi-tenant alerting platform with JWT-based access control, configurable alert flows, time-based escalations, and Redis-backed caching.
- Implemented an alert-flow engine using optimistic locking for concurrent workflow modifications.
- Engineered delayed escalation with RabbitMQ delayed queues and retry-safe processing using at-least-once delivery and idempotent consumers.
- Repository URL: https://github.com/1hemant2/alert_ops
- Public repository: Verified 2026-08-20
