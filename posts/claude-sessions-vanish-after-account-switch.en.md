---
title: I switched accounts and all my Claude sessions vanished
date: 2026-10-17
level: intermediate
topic: claude-app
tools: Claude desktop app (Windows), Node.js, PowerShell 7
summary: Logging in with another account left the Code tab's session list empty. The conversations were not gone. Only the list lives in a different folder per account.
start: 3
---

## Symptom

I work in the Code tab of the Claude desktop app all day. When I hit the usage limit I log in with another account and keep going. The moment I switched, the session list in the left sidebar was empty. Every session I had open looked like it was gone.

Switch back to the original account and they are all there again. So nothing was deleted. The app shows a different list per account. What I wanted was simple: "whichever account I log in with, the sessions I was working on should still be there."

## Cause and principle

The app stores the session list **separately for every account-and-organization pair**. For the Microsoft Store (MSIX) build the location is:

```text
%LOCALAPPDATA%\Packages\Claude_<package id>\LocalCache\Roaming\Claude\
└─ claude-code-sessions\
   └─ <account id>\
      └─ <organization id>\
         ├─ local_*.json          ← one record file per session
         ├─ deleted_<session id>  ← marker for a deleted session
         ├─ archived-sessions.idx ← index of archived sessions
         ├─ scheduled-tasks.json  ← scheduled tasks
         └─ backlog\
```

(A non-Store install keeps the same layout under `%APPDATA%\Claude\claude-code-sessions\`.)

The folder is picked by the logged-in account id and organization id, so another account reads another folder. If that folder is empty, the list is empty. That is all there is to it.

One common misunderstanding: **the conversations themselves never disappear.** The transcripts live under `~\.claude\projects\`, and that folder is shared regardless of account. What vanished was the "list of which conversations exist", not the conversations. So if the list files are identical in every pair folder, every account shows the same sidebar.

## Fix

My first attempt joined the folders with a junction (a linked folder). That failed (see "Pitfalls" below). What works is a **mirror script that keeps the folders identical**. It does four things:

1. Keeps every pair folder (account × organization) as a **real folder**.
2. When a session record is added, changed or deleted in any one folder, it copies that change to all the others within one or two seconds. If the same file differs between folders, the most recently modified one wins. Deleted sessions (a `deleted_*` marker) are never resurrected.
3. When the app logs in with a pair it has never seen and reads zero sessions, the script fills that folder and shows a Windows notification saying "restart the app". That one restart is the only one you need.
4. Backs up the folder with the most records every hour.

The install steps are written out in [Installing the session-share tool](/en/claude-session-share-install/). It is one Node.js script plus a Startup-folder entry.

## Check again

Look at the script's status.

```powershell
node "$env:USERPROFILE\.ai-accounts\claude-session-share.mjs" --status
```

Every pair folder should show the same "N session records" count and no "(not synced yet)" marks.

Then log in with another account and look at the sidebar. If it is an account you have never used, a notification appears; restart the app once. Same list — done.

## Pitfalls

- **Do not join the folders with a junction or symlink.** The app checks the session folder with `lstat` and `realpath`, and refuses to write if it is a reparse point. `main.log` (in the app data folder's `logs\`) filled up with over a thousand lines of "Failed to save session … Refusing non-directory at private dir path (symlink/file plant)". Reads look fine for a while and then suddenly return zero. Twenty-one sessions I created over two hours this way were never saved, and I had to rebuild their records from the transcripts.
- The app does not watch the folder. Even after the files are in place, the list only changes after you restart the app.
- If the list looks empty, search `main.log` for "Refusing" and "Loaded 0 persisted sessions". The first means a linked-folder problem; the second means a pair the app has not seen before.
- Sharing is only between Claude app logins. If another AI tool is showing your Claude conversations, that is that tool's own "import" setting, not this script.
