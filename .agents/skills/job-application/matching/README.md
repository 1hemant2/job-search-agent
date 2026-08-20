# Matching and Deduplication

Use the existing score and hard-blocker rules in `SKILL.md`. ATS type,
application length, and number of clicks are not match criteria.

Before opening an application and again before submission, compute a stable
deduplication identity from:

```text
normalized company + normalized role + job ID + job URL + official ATS URL
```

Normalize tracking parameters and platform redirects, and treat LinkedIn and
the official ATS posting for the same opening as one opportunity. Record a
duplicate only when useful; it never counts toward the active target.
