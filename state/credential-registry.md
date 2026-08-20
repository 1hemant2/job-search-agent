# Credential Registry

This registry records only whether an authentication method exists. Never store passwords, OTPs, recovery codes, or secrets here.

## Known Accounts and Methods

Existing sessions were rechecked read-only on 2026-08-20. Availability is only a hint: verify through the supported browser-control surface at run time. No passwords, cookies, OTPs, or email contents were inspected.

| Platform / Tenant | Method | Status | Last Verified | Notes |
|---|---|---|---|---|
| LinkedIn | Existing browser session | Previously available | 2026-08-20 | Verify at run time; do not inspect cookies or profile storage |
| Google OAuth | Existing browser Google session | Previously available | 2026-08-20 | Verify at run time; never request or store the Google password |
