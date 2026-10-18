---
title: When Python garbles non-English text on Windows, one environment variable fixes it
date: 2026-10-18
level: beginner
topic: windows
tools: Windows 11, Python 3, PowerShell
summary: Python output turns Korean (or other non-English) text into garbage like "ȫ���� 3��", or stops with UnicodeDecodeError / UnicodeEncodeError from a 'cp949', 'cp1252' or 'charmap' codec.
start: 3
hook: If a Python script your AI wrote prints garbage instead of Korean (or accented) text, or stops with `codec can't decode`, this post is for you.
for: Anyone running AI-written Python scripts on Windows
answer: Paste the line below into PowerShell, then reopen your terminal and editor. From then on, Python on this PC reads and writes text as UTF-8.
answer_code: [Environment]::SetEnvironmentVariable('PYTHONUTF8', '1', 'User')
why: Unless told otherwise, Python on Windows reads and writes files with Windows' legacy character table (cp949 on Korean Windows, cp1252 on many Western ones), while nearly every modern file and tool uses UTF-8. The same letters read through two different tables come out broken.
prevent: Put this line in first thing on a new PC. When you ask an AI for Python, add "always pass encoding='utf-8' when opening files".
takeaway: Garbled text does not mean the file is damaged. Usually the writer and the reader used different character tables, so change how you read it before deleting or moving anything.
---

## Symptom

A Python script from my AI mangles Korean text like this. Everything below is reproduced on my PC (Python 3.14.8, Korean Windows).

Passing the output to another command in Git Bash garbles it:

```text
$ python -c "print('홍보물 3개')" | cat
ȫ���� 3��
```

Reading a text file saved as UTF-8 stops with an error:

```text
UnicodeDecodeError: 'cp949' codec can't decode byte 0xec in position 0: illegal multibyte sequence
```

If the output contains a symbol such as ✅, printing stops:

```text
UnicodeEncodeError: 'cp949' codec can't encode character '✅' in position 3: illegal multibyte sequence
```

Garbled text once sent me down the wrong path. An error message printed a folder name as `ȫ����`, and I concluded the folder had been moved with a broken name. The folder name was fine. Another job had deleted the files, and I blamed it on the garbled letters.

On English Windows the message names `cp1252` or `charmap` instead of `cp949`, and accented letters or symbols are what break. The cause and the fix are the same.

## Cause and principle

Computers store letters as numbers. The table that says which letter becomes which number is an **encoding**. The same two Korean letters 「한글」 become different bytes in different tables (measured on my PC):

| Character table | Bytes for 「한글」 |
|---|---|
| cp949 (legacy Korean Windows table) | `c7 d1 b1 db` |
| UTF-8 (nearly every file and web page today) | `ed 95 9c ea b8 80` |

Unless told otherwise, Python on Windows uses Windows' legacy table (cp949 on Korean Windows) when it opens files and when it hands output to another program or a file. Reading a UTF-8 file as cp949 raises an error; reading cp949 output as UTF-8 shows garbage like 「ȫ����」. Symbols missing from cp949, such as ✅, cannot be written at all.

The confusing part is that it sometimes works. When Python prints straight into a PowerShell window, it handles that case separately and the text looks fine. It breaks only when output goes to a file or another command, or when files are read and written.

`PYTHONUTF8=1` turns on Python's **UTF-8 Mode**, which makes opening and writing files and all input and output use UTF-8.

## Fix

To keep it on this PC, set it once as a user environment variable. Afterwards, close and reopen your terminal and any editor such as VS Code.

```powershell
[Environment]::SetEnvironmentVariable('PYTHONUTF8', '1', 'User')
```

For a one-off run, add the option instead:

```powershell
python -X utf8 script.py
```

To fix it in the AI-written code itself, name the encoding on every line that opens a file:

```python
with open('result.txt', 'w', encoding='utf-8') as f:
    f.write('홍보물 3개')
```

## Check again

In a new terminal, run:

```powershell
python -c "import sys; print(sys.flags.utf8_mode)"
```

`1` means UTF-8 Mode is on (it is `0` before). On my PC all three symptoms above disappeared once it was on, and 「한글」 written to a file became `ed 95 9c ea b8 80`.

## Pitfalls

- A CSV saved from Korean Excel as "CSV (Comma delimited)" is stored in cp949. In UTF-8 Mode that file fails the other way, so open just that file with `encoding='cp949'`. Saving as "CSV UTF-8" in Excel avoids the problem.
- `python -I` (isolated mode) ignores every environment variable starting with `PYTHON`. Use `python -I -X utf8` in that case.
- `PYTHONIOENCODING=utf-8` only changes screen input and output; opening files stays the same. Use `PYTHONUTF8=1` to fix both.
- Environment variables apply to windows opened afterwards. Terminals and editors that were already open keep garbling text.
