# Browser Configuration - Always Use Google Chrome

This file is read by the autonomous job-search agent (AGENTS.md) to ensure Chrome usage is consistent.

## Rule: Always Use Real Google Chrome (Not Chrome for Testing)

**DO NOT use Chrome for Testing** (`~/.agent-browser/browsers/chrome-*/Google Chrome for Testing`).  
**ALWAYS use the installed Google Chrome** at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`.

## Hemant Profile

- **Profile:** `Profile 3` - `Hemant kumar` - `meet.hemant.k@gmail.com` (canonical professional email)
- **User Data Dir:** `/Users/hemant/Library/Application Support/Google/Chrome`
- **Full Profile Path:** `/Users/hemant/Library/Application Support/Google/Chrome/Profile 3`
- **Chrome App:** `/Applications/Google Chrome.app`

This is the profile verified in `Local State` as `gaia_name: Hemant kumar`, `user_name: meet.hemant.k@gmail.com`.

Do NOT use Chrome Beta profiles:
- `Chrome Beta/Profile 1` (empty)
- `Chrome Beta/Profile 3` (`hemant@enterprisebot.org` - work, managed)

## How to Open Chrome

### Option 1: Direct (visible window, for manual login)
```bash
./scripts/open-google-chrome.sh "https://www.linkedin.com/feed/"
```

### Option 2: With Remote Debugging (for agent-browser --auto-connect)
```bash
./scripts/open-google-chrome.sh --with-debugging "https://www.linkedin.com/jobs/"
# Then agent can connect:
npx agent-browser --auto-connect get url
npx agent-browser --auto-connect snapshot -i
npx agent-browser --auto-connect click @eN
```

### Option 3: Direct agent-browser with real Chrome (recommended for automation)
```bash
export AGENT_BROWSER_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
export AGENT_BROWSER_PROFILE="/Users/hemant/Library/Application Support/Google/Chrome/Profile 3"

npx agent-browser --executable-path "$AGENT_BROWSER_EXECUTABLE_PATH" --profile "$AGENT_BROWSER_PROFILE" --headed open "https://www.linkedin.com/jobs/"
npx agent-browser --executable-path "$AGENT_BROWSER_EXECUTABLE_PATH" --profile "$AGENT_BROWSER_PROFILE" snapshot -i
```

## AGENTS.md Integration

Per AGENTS.md #6 and #7:
- The agent is authorized to use Google OAuth via the existing authenticated Google session in this profile
- Prefer this profile's Google session (`meet.hemant.k@gmail.com`) when LinkedIn shows "Continue with Google"
- Never request or store Google password - use the existing session

## Launcher Script

`scripts/open-google-chrome.sh` always opens Google Chrome (stable) with Hemant profile.  
The agent MUST use this script or the equivalent agent-browser flags above.

## Verification

After launching, verify:
```bash
npx agent-browser --executable-path "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --profile "/Users/hemant/Library/Application Support/Google/Chrome/Profile 3" get url
# Should show https://www.linkedin.com/...
```
