# Reusable Application Answers

Store only confirmed, reusable answers here. For each answer, record its source and scope. Technology years belong in `technology-experience.md`; unknown material facts belong in `human-input-queue.md` until confirmed.

## Confirmed

- Full name: <value>
- Professional application email: <value>
- Phone: <value>
- Current location: <value>
- Highest degree: <value>
- Current employer: <value or none>
- Current title: <value>
- Total professional experience: <value>
- Notice period: <value>
- Willing to relocate: <yes/no/unknown>
- Work arrangement preference: <remote/hybrid/onsite/all/unknown>
- Travel willingness: <value or unknown>
- Offers in hand: <yes/no/unknown>
- Voluntary demographic questions: <preference or leave unanswered>

## Normalized Reusable Concepts

```yaml
- normalized_key: <stable_key>
  value: <confirmed_value>
  scope: <where this answer applies>
  source: user-confirmed
  confidence: confirmed
  equivalent_questions: [<question wording>, <equivalent wording>]
```

## Awaiting Confirmation

- <genuine unknown that may be required by a form>

## Form Handling Rules

- User enters passwords and other secrets personally. Never store or transmit them through the agent.
- Leave unknown or legally material questions for the user unless the exact answer is confirmed here.
- Final submission still requires the mandatory browser confirmation.
