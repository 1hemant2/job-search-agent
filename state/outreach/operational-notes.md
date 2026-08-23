# Outreach Execution Notes

## LinkedIn connection-note fallback

- The user prompt and authorization are valid; a failed send must not be attributed to the message when the live field cannot accept input.
- For future LinkedIn connection requests, start from the exact user-owned Chrome tab when available and verify the visible profile identity before opening the invitation dialog.
- Use the saved note as one complete paste operation into the focused note field. Immediately verify both the live field value and LinkedIn's character counter against the saved draft.
- If the field is rendered through a shadow/interop surface and supported input leaves the field at `0/300` or otherwise prevents exact read-back, do not click Send. Use one focused fallback through the active user tab, then mark the target blocked and hand it back to the user.
- Do not repeatedly retry the same non-working input path, and do not blame or shorten a message that is already within the platform limit unless the page reports a content or length error.

## Email scheduling

- Verify recipient, subject, body, attachment, timezone, and exact scheduled date/time before opening the final schedule control.
- Record the actual scheduled or blocked outcome in the outreach batch events and target status.
