---
title: When the install command your AI gave you stops with "running scripts is disabled on this system"
date: 2026-10-18
level: beginner
topic: windows
tools: Windows 11, Windows PowerShell, Node.js (npm)
summary: npm, claude, codex or a Python venv command stops with "File …\npm.ps1 cannot be loaded because running scripts is disabled on this system."
start: 1
hook: If you typed `npm install` or `claude` the way your AI told you and got red text saying "running scripts is disabled on this system", this post is for you.
for: Anyone installing AI tools (Claude Code, Codex, npm, Python) on Windows for the first time
answer: Paste the line below into PowerShell, answer `Y` if it asks, then open a new window. No administrator rights needed.
answer_code: Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
why: The PowerShell that ships with Windows starts out set to "run no script files at all". Tools like npm install their commands as `.ps1` script files, so they are blocked the moment you type them.
prevent: Put this line in first thing on a new PC. Scripts downloaded from the internet stay blocked under this setting, so the safety net is still there.
takeaway: Red error text does not always mean something is broken. Read what was blocked first (here, a `.ps1` file); often it is a one-line setting.
---

## Symptom

I pasted an install command from my AI into PowerShell and got this:

```text
npm : File C:\Program Files\nodejs\npm.ps1 cannot be loaded because running scripts is disabled on this system.
For more information, see about_Execution_Policies at https:/go.microsoft.com/fwlink/?LinkID=135170.
    + CategoryInfo          : SecurityError: (:) [], PSSecurityException
    + FullyQualifiedErrorId : UnauthorizedAccess
```

Instead of `npm` it may say `claude`, `codex` or `yarn`, or it may happen when you activate a Python virtual environment with `.\venv\Scripts\Activate`. On Korean Windows the same message reads 「이 시스템에서 스크립트를 실행할 수 없으므로」.

I hit it the day I moved to a new laptop. A posting tool that ran fine on the old laptop stopped with this error. I had changed the setting on the old one at some point and forgotten the setting even existed.

## Cause and principle

PowerShell has a safety rule called the **execution policy**. It decides whether script files (`.ps1`) may run. Commands you type one at a time always work; only script files are subject to the rule.

The "Windows PowerShell" that comes with every Windows PC starts out with nothing set, which means **Restricted**: no script files at all.

| Policy | Meaning |
|---|---|
| Restricted | Runs no script files. The default on Windows PCs |
| RemoteSigned | Runs scripts made on your PC. Scripts downloaded from the internet need a signature |
| Unrestricted | Runs anything. Not recommended |

The catch is that npm installs each command as three files. My Node.js folder holds `npm`, `npm.cmd` and `npm.ps1` side by side. When you type `npm` in PowerShell, PowerShell picks the `.ps1` first, and that file hits the execution policy. Tools installed with `npm install -g`, such as `codex` and `gemini`, get a `.ps1` in `%APPDATA%\npm` the same way.

Side by side on my PC (2026-10-18):

```text
Windows PowerShell 5.1 · Restricted   →  npm --version     blocked
Windows PowerShell 5.1 · Restricted   →  npm.cmd --version 12.2.0
PowerShell 7 · RemoteSigned          →  npm --version     12.2.0
```

PowerShell 7, which I installed separately, was already RemoteSigned on my PC. The built-in blue Windows PowerShell and PowerShell 7 keep separate settings.

## Fix

On a PC you keep using, set RemoteSigned for your own account only. No administrator rights needed.

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

If it asks "Do you want to change the execution policy?", answer `Y`, then close PowerShell and open a new window.

If you would rather not keep the setting, loosen it for the current window only. Closing the window puts it back.

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
```

To avoid the setting entirely, call the `.cmd` file directly.

```powershell
npm.cmd install
```

## Check again

```powershell
Get-ExecutionPolicy -List
npm --version
```

If `CurrentUser` shows `RemoteSigned` and `npm --version` prints a number, you are done.

## Pitfalls

- Do not open everything up with `Unrestricted` or `Bypass`. Scripts from the internet would then run without asking.
- A `.ps1` downloaded from the internet is still blocked under RemoteSigned. Read it first, then unblock it with `Unblock-File .\file-name.ps1`.
- On a work PC an administrator may have locked this with group policy (`MachinePolicy`, `UserPolicy`). The command above will not override that; ask your IT team.
- The same error appears when another program runs `powershell.exe -File script.ps1` internally. I added `-ExecutionPolicy Bypass` to the line that program uses, so that one script runs and the PC setting stays as it is.
