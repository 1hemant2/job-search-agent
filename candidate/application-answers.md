# Reusable Application Answers

This is the canonical store for reusable non-technology application answers. Technology years and scope live only in `technology-experience.md`. Unknown material facts must not be inferred.

When a future answer is learned, store its normalized meaning, value, source, confidence, equivalent wording when useful, and derivation basis if derived. User-confirmed corrections override derived entries; mark superseded derivations obsolete instead of silently retaining them.

## Confirmed

- Full name: Hemant Kumar
- Professional application email: meet.hemant.k@gmail.com
- Alternate email: hk443957@gmail.com (valid but not for applications)
- Phone: +91 9534909390
- LinkedIn: https://linkedin.com/in/hemant-kumar-66ba31208
- GitHub: https://github.com/1hemant2
- Highest degree: B.Tech in Computer Science & Engineering
- Graduation date: May 2024
- Current employer: Enterprise Bot
- Current title: Software Developer
- Confirmed professional experience start: September 2024
- Total professional experience: 2 years for application and recruiter-screening purposes
- Experience timing note: Rounded to 2 years because the exact two-year mark is approximately 10 days after 2026-08-20
- Whole-year or numeric experience fields: Enter 2 years
- Current residential location: Bengaluru, Karnataka, India
- Current residential address: Roopena Agrahara, Bengaluru, Karnataka 560068, India
- Residential PIN code: 560068
- Date of birth: 7 March 2003
- Citizenship: India
- Legally authorized to work in India: Yes
- Requires employer sponsorship in India: No
- Requires employer sponsorship outside India: Yes
- Current visa status outside India: No current visa confirmed
- Work arrangement: Remote, hybrid, or onsite are all acceptable
- Willing to relocate: Yes, for suitable opportunities
- Notice period: 60 days, negotiable to 30 days
- Date-field notice rule: When a form requires an exact availability date, calculate 60 calendar days from the application date; use 30 days only when the form explicitly asks for the negotiable or earliest possible date
- At least 18 years old: Yes
- Travel willingness: Yes, up to 25%
- Industry exclusions: None
- Company-size preference: Any, including approximately 10 to 10,000+ employees
- Current compensation: INR 6.93 LPA
- Expected compensation when one annual India figure is required: INR 14 LPA
- Expected annual India range when a range is accepted: INR 13-16 LPA
- Expected monthly in-hand salary: INR 85,000
- Formal government or role-specific security clearance: No formal security clearance
- Voluntary demographic questions: Prefer not to answer when that option is available

## Normalized Reusable Concepts

```yaml
- normalized_key: notice_period
  value: 60 days
  qualifier: negotiable to 30 days
  source: user-confirmed
  confidence: confirmed
  equivalent_questions: [notice period, how soon can you join, availability, earliest start]
- normalized_key: current_location
  value: Bengaluru, Karnataka, India
  source: user-confirmed
  confidence: confirmed
  equivalent_questions: [current city, city of residence, where are you based]
- normalized_key: immediate_joiner
  value: no
  source: derived
  derived_from: confirmed 60-day notice period
  confidence: high
- normalized_key: bachelors_degree
  value: yes
  source: derived
  derived_from: confirmed B.Tech in Computer Science & Engineering
  confidence: high
- normalized_key: onsite_available
  value: yes
  source: derived
  derived_from: confirmed acceptance of remote, hybrid, or onsite work
  confidence: high
- normalized_key: remote_available
  value: yes
  source: derived
  derived_from: confirmed acceptance of remote, hybrid, or onsite work
  confidence: high
```

For Java, Node.js, REST/API, database, messaging, Docker, Kubernetes, and other technology questions, use `technology-experience.md`.

## Awaiting Confirmation

- House/flat number and street, if a form requires more than the confirmed locality and PIN
- Exact employment start day, if a form requires a day rather than month and year
- Agreement to background checks or other legally significant declarations
- Conflicts of interest or restrictive covenants
