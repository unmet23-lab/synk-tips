---
title: Installing the session-share tool — the same list whichever account you log in with
date: 2026-10-17
level: beginner
topic: claude-app
tools: Windows 11, Node.js 20+, PowerShell 7, Claude desktop app
summary: Install the mirror script that keeps the Code tab's session list identical across accounts. Download one file, run it once, register it in the Startup folder. Done.
start: 2
---

## Symptom

Why the sessions seem to disappear is explained in [I switched accounts and all my Claude sessions vanished](/en/claude-sessions-vanish-after-account-switch/). This post is only the install order. Every command can be pasted into PowerShell as is.

## Cause and principle

The app keeps one session-list folder per account-and-organization pair, so all you need is a **program that keeps those folders identical**. The script `claude-session-share.mjs` does exactly that. It watches the folders (file watch + a one-second folder-time check + a full comparison every five minutes) and copies any addition, change or deletion from one folder to all the others. It only needs Node.js; there is no installer.

## Fix

### 1. Check Node.js

```powershell
node --version
```

`v20` or newer is fine (I verified with v24). If it is missing, install the LTS from [nodejs.org](https://nodejs.org/).

### 2. Get the script

Public repository: **(coming soon — the link will be filled in here once it is decided)**

Put the downloaded `claude-session-share.mjs` in `%USERPROFILE%\.ai-accounts\`. Create the folder if it does not exist.

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.ai-accounts" | Out-Null
# move the downloaded file into that folder (when it landed in Downloads)
Move-Item "$env:USERPROFILE\Downloads\claude-session-share.mjs" "$env:USERPROFILE\.ai-accounts\"
```

### 3. Run it once to sync

```powershell
node "$env:USERPROFILE\.ai-accounts\claude-session-share.mjs" --once --backup
```

`--backup` copies the state before syncing into `claude-session-backups\…-before-mirror`. When it finishes it prints the status. If every pair folder shows the same "N session records", you are good.

### 4. Register it in the Startup folder

Create a `.vbs` file in the Startup folder so it runs without a window whenever Windows starts, and launch it right now.

```powershell
$startup = [Environment]::GetFolderPath('Startup')
@'
Set sh = CreateObject("WScript.Shell")
home = sh.ExpandEnvironmentStrings("%USERPROFILE%")
sh.Run """C:\Program Files\nodejs\node.exe"" """ & home & "\.ai-accounts\claude-session-share.mjs""", 0, False
'@ | Set-Content -Path "$startup\claude-session-share.vbs"
Start-Process wscript.exe "$startup\claude-session-share.vbs"
```

If `node.exe` lives somewhere else, check with `(Get-Command node).Source` and change the path.

## Check again

```powershell
node "$env:USERPROFILE\.ai-accounts\claude-session-share.mjs" --status
```

- "watching: running (pid …)" means it is alive.
- Every pair-folder line should show the same "N session records" and no "(not synced yet)".
- Now log in with another account. For an account you have never used, a Windows notification appears; restart the app once and the same list shows up.

## Pitfalls

- **Do not join the folders with a junction or symlink.** The app will not save sessions into a linked folder. Details are in [the pitfalls of the cause post](/en/claude-sessions-vanish-after-account-switch/#pitfalls).
- The app does not watch the folder. For a pair it has never seen, restart it once. Pairs it already knows show up immediately.
- If you edit the script, stop the running process and launch the `.vbs` again.

```powershell
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*claude-session-share.mjs*' } | ForEach-Object { Stop-Process -Id $_.ProcessId }
Start-Process wscript.exe "$([Environment]::GetFolderPath('Startup'))\claude-session-share.vbs"
```

- To turn it off, delete the `.vbs` file and run the first line above to stop the process.
- Sharing is only between Claude app logins.
