---
title: Installing the session-share tool — the same list whichever account you log in with
date: 2026-10-17
level: beginner
topic: claude-app
tools: Windows 11, PowerShell, Node.js 20+, Claude desktop app
summary: Install the tool that keeps the Code tab's session list identical across accounts. One PowerShell line to install, one full restart of Claude. Done.
---

## Symptom

Why the sessions seem to disappear is explained in [I switched accounts and all my Claude sessions vanished](/en/claude-sessions-vanish-after-account-switch/). This post is only the install order. Every command can be pasted into PowerShell as is.

## Cause and principle

The app keeps one session-list folder per account-and-organization pair, so all you need is a **program that keeps those folders identical**. The tool `claude-session-share` does exactly that. A single Node.js script watches the folders (file watch + a one-second folder-time check + a full comparison every five minutes) and copies any addition, change or deletion from one folder to all the others. The installer puts the script in `%LOCALAPPDATA%\claude-session-share\` and adds one `.vbs` to the Startup folder so it runs without a window whenever you log in.

## Fix

### 1. Open a fresh PowerShell

Open PowerShell from the Start menu. **Not from a terminal inside the Claude app** (see "Pitfalls" below).

### 2. Check Node.js

```powershell
node --version
```

`v20` or newer is fine. If it is missing, install it and open a new PowerShell window.

```powershell
winget install OpenJS.NodeJS.LTS
```

### 3. The one-line install

Public repository: [unmet23-lab/claude-session-share](https://github.com/unmet23-lab/claude-session-share)

```powershell
irm https://raw.githubusercontent.com/unmet23-lab/claude-session-share/main/install.ps1 | iex
```

The installer does five things: checks Node.js, puts the script in `%LOCALAPPDATA%\claude-session-share\`, creates `claude-session-share.vbs` in the Startup folder, backs up every account folder in full and syncs them once, then starts the watcher and prints the status. Running the same line again updates the tool.

If you downloaded the repository as a zip, this does the same from that folder.

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

### 4. Quit Claude completely and start it again

Do not just close the window. Quit from the tray icon, then launch it again. Every account's sessions now show up in the list.

## Check again

```powershell
node "$env:LOCALAPPDATA\claude-session-share\claude-session-share.mjs" --status
```

- "watching: running (pid …)" means it is alive.
- Each account-folder line shows a session-record count. If every line has the same number, the folders are in sync.
- Log in with another account. For an account you have never used, a Windows notification appears; restart the app once and the same list shows up.

## Pitfalls

- **Do not install from a terminal opened inside a Store app such as Claude or Codex.** In there, writes to `AppData` are redirected into the app's private folder, so the same folder appears twice and you can end up with two watchers. The installer detects this, stops, and tells you to open a new PowerShell from the Start menu.
- Do not join the folders with a junction or symlink. The app will not save sessions into a linked folder. Details are in [the pitfalls of the cause post](/en/claude-sessions-vanish-after-account-switch/#pitfalls).
- The app does not watch the folder. For a pair it has never seen, restart it once. Pairs it already knows show up immediately.
- To turn it off, run the uninstaller. It stops the watcher and removes the Startup entry. The install folder holds the backups, so it asks before deleting it and keeps it by default. Sessions already synced stay in each account folder.

```powershell
powershell -ExecutionPolicy Bypass -File "$env:LOCALAPPDATA\claude-session-share\uninstall.ps1"
```

- Sharing is only between Claude app logins.
