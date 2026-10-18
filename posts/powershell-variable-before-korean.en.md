---
title: In PowerShell, "$count개" silently drops the number
date: 2026-10-17
level: beginner
topic: windows
tools: PowerShell 7
summary: Inside a double-quoted string, a Korean (or any Unicode) letter right after a variable swallows the whole variable into an empty value. No error. Wrap it in $() or ${}.
---

## Symptom

I wanted to print how many files I had moved, so I wrote:

```powershell
$made = 3
"링크 $made개"     # "links: 3 (count)" — in Korean the unit 개 sticks to the number
```

I expected "링크 3개" and got "링크 ". The number was gone, and there was not a single error line. It bit me twice in the script I used to move to a new laptop. I stared at the output and wondered whether nothing had been moved at all.

## Cause and principle

PowerShell replaces `$name` inside a double-quoted string with the variable's value. **Where the name ends** is decided by "keep going as long as the characters are legal in a name". Legal characters are not just letters, digits and underscores from ASCII — **Unicode letters such as Korean count too.** So `$made개` is not "`$made` followed by `개`"; it is **one variable named `made개`**. No such variable exists, so an empty string is inserted, and reading an undefined variable is not an error with the default settings.

In English you rarely hit this because a space follows the variable, as in `"$count items"`. Korean counters (개, 명, 번, 원) attach directly to the number, which is exactly where it breaks. The same thing happens with any language whose letters sit right after a variable.

## Fix

Make the end of the variable name explicit. Both forms work.

```powershell
$made = 3
"링크 $($made)개"   # subexpression — inserts the evaluated value
"링크 ${made}개"    # braces — pins the name boundary
```

Scan the scripts you already have. This regex finds "a variable name followed immediately by a Korean letter".

```powershell
Select-String -Path .\*.ps1 -Pattern '\$[A-Za-z_][A-Za-z0-9_]*[가-힣]'
```

## Check again

```powershell
$made = 3
"링크 $made개"      # 링크        ← reproduces as is
"링크 $($made)개"   # 링크 3개
```

If you want an error the moment an undefined variable is read, turn on strict mode at the top of the script file. Then it stops right there with "The variable '$made개' cannot be retrieved because it has not been set."

```powershell
Set-StrictMode -Version Latest
```

## Pitfalls

- Variable names are case-insensitive. `$h` and `$H` are the same variable, so whichever is assigned later overwrites the other. Keep your home folder in `$H` and use `$h` further down, and you get the wrong value.
- `Set-StrictMode` turned on in an interactive terminal can make other commands and tools you run afterwards stop with "variable … has not been set". Keep it at the top of script files only.
