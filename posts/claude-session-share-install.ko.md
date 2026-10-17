---
title: Claude 세션 공유 도구 설치하기 — 어떤 계정으로 로그인해도 같은 목록
date: 2026-10-17
level: 초급
topic: claude-app
tools: Windows 11, Node.js 20 이상, PowerShell 7, Claude 데스크톱 앱
summary: 계정을 바꿔도 Code 탭 세션 목록이 그대로 보이게 하는 미러 스크립트를 깐다. 파일 하나 내려받고, 한 번 돌리고, 시작프로그램에 등록하면 끝.
start: 2
---

## 증상

왜 세션이 사라져 보이는지는 [계정을 바꿨더니 Claude 세션이 다 사라졌다](/ko/claude-sessions-vanish-after-account-switch/)에 적었다. 여기는 고치는 도구를 까는 순서만 적는다. 명령은 전부 PowerShell에 그대로 붙여 넣으면 된다.

## 원인·원리

앱이 계정·조직 짝마다 세션 목록 폴더를 따로 두기 때문에, 그 폴더들을 **똑같은 내용으로 유지하는 프로그램**을 하나 띄워 두면 된다. 스크립트 `claude-session-share.mjs`가 그 일을 한다. 폴더 변화를 지켜보다가(파일 감시 + 1초마다 폴더 시각 확인 + 5분마다 전체 대조) 어느 한 폴더의 추가·수정·삭제를 나머지 전부에 옮긴다. Node.js만 있으면 돌아가고 설치 프로그램은 없다.

## 고침

### 1. Node.js 확인

```powershell
node --version
```

`v20` 이상이면 된다(나는 v24로 확인했다). 없으면 [nodejs.org](https://nodejs.org/)에서 LTS를 설치한다.

### 2. 스크립트 받기

공개 저장소: **(준비 중 — 주소가 정해지면 여기에 채웁니다)**

받은 `claude-session-share.mjs`를 `%USERPROFILE%\.ai-accounts\` 폴더에 둔다. 폴더가 없으면 만든다.

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.ai-accounts" | Out-Null
# 받은 파일을 이 폴더로 옮긴다 (다운로드 폴더에 받았을 때)
Move-Item "$env:USERPROFILE\Downloads\claude-session-share.mjs" "$env:USERPROFILE\.ai-accounts\"
```

### 3. 한 번 돌려서 맞추기

```powershell
node "$env:USERPROFILE\.ai-accounts\claude-session-share.mjs" --once --backup
```

`--backup`은 맞추기 전 상태를 `claude-session-backups\…-before-mirror`에 복사해 둔다. 끝나면 상태가 찍힌다. 짝 폴더마다 「N개 세션 기록」이 같은 수면 된 거다.

### 4. 시작프로그램에 등록

윈도우가 켜질 때 창 없이 돌게 `.vbs` 파일을 시작프로그램 폴더에 만들고, 지금 바로 한 번 띄운다.

```powershell
$startup = [Environment]::GetFolderPath('Startup')
@'
Set sh = CreateObject("WScript.Shell")
home = sh.ExpandEnvironmentStrings("%USERPROFILE%")
sh.Run """C:\Program Files\nodejs\node.exe"" """ & home & "\.ai-accounts\claude-session-share.mjs""", 0, False
'@ | Set-Content -Path "$startup\claude-session-share.vbs"
Start-Process wscript.exe "$startup\claude-session-share.vbs"
```

`node.exe` 위치가 다르면 `(Get-Command node).Source`로 확인해서 바꾼다.

## 다시 확인

```powershell
node "$env:USERPROFILE\.ai-accounts\claude-session-share.mjs" --status
```

- 「지켜보기: 실행 중 (pid …)」이면 돌고 있는 거다.
- 짝 폴더 줄마다 「N개 세션 기록」이 같고 「(아직 안 맞춤)」이 없어야 한다.
- 이제 다른 계정으로 로그인해 본다. 처음 쓰는 계정이면 윈도우 알림이 뜨고, 앱을 한 번 껐다 켜면 같은 목록이 보인다.

## 함정

- **폴더를 junction·symlink로 잇는 방법은 쓰지 말 것.** 앱이 연결 폴더에는 세션을 저장하지 않는다. 자세한 건 [원인 글의 함정](/ko/claude-sessions-vanish-after-account-switch/#함정).
- 앱은 폴더를 감시하지 않는다. 처음 보는 계정 짝은 꼭 한 번 껐다 켠다. 이미 아는 짝은 바로 보인다.
- 스크립트를 고쳤으면 돌고 있는 프로세스를 끝내고 `.vbs`를 다시 띄운다.

```powershell
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*claude-session-share.mjs*' } | ForEach-Object { Stop-Process -Id $_.ProcessId }
Start-Process wscript.exe "$([Environment]::GetFolderPath('Startup'))\claude-session-share.vbs"
```

- 끄려면 `.vbs` 파일을 지우고 위 첫 줄로 프로세스를 끝낸다.
- 공유는 Claude 앱끼리만이다.
