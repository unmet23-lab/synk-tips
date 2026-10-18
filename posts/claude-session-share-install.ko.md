---
title: Claude 세션 공유 도구 설치하기 — 어떤 계정으로 로그인해도 같은 목록
date: 2026-10-17
level: 초급
topic: claude-app
tools: Windows 11, PowerShell, Node.js 20 이상, Claude 데스크톱 앱
summary: 계정을 바꿔도 Code 탭 세션 목록이 그대로 보이게 하는 도구를 깐다. PowerShell 한 줄로 설치하고, Claude를 한 번 껐다 켜면 끝.
---

## 증상

왜 세션이 사라져 보이는지는 [계정을 바꿨더니 Claude 세션이 다 사라졌다](/ko/claude-sessions-vanish-after-account-switch/)에 적었다. 여기는 고치는 도구를 까는 순서만 적는다. 명령은 전부 PowerShell에 그대로 붙여 넣으면 된다.

## 원인·원리

앱이 계정·조직 짝마다 세션 목록 폴더를 따로 두기 때문에, 그 폴더들을 **똑같은 내용으로 유지하는 프로그램**을 하나 띄워 두면 된다. 도구 `claude-session-share`가 그 일을 한다. Node.js 스크립트 하나가 폴더 변화를 지켜보다가(파일 감시 + 1초마다 폴더 시각 확인 + 5분마다 전체 대조) 어느 한 폴더의 추가·수정·삭제를 나머지 전부에 옮긴다. 설치기는 이 스크립트를 `%LOCALAPPDATA%\claude-session-share\`에 두고, 로그인할 때 창 없이 돌도록 시작프로그램에 `.vbs` 하나를 만든다.

## 고침

### 1. PowerShell을 새로 연다

시작 메뉴에서 PowerShell을 연다. **Claude 앱 안의 터미널에서는 하지 않는다**(아래 「함정」).

### 2. Node.js 확인

```powershell
node --version
```

`v20` 이상이면 된다. 없으면 설치하고 PowerShell 창을 새로 연다.

```powershell
winget install OpenJS.NodeJS.LTS
```

### 3. 설치 한 줄

공개 저장소: [unmet23-lab/claude-session-share](https://github.com/unmet23-lab/claude-session-share)

```powershell cover
irm https://raw.githubusercontent.com/unmet23-lab/claude-session-share/main/install.ps1 | iex
```

설치기가 하는 일은 다섯 가지다. Node.js 확인, 스크립트를 `%LOCALAPPDATA%\claude-session-share\`에 두기, 시작프로그램에 `claude-session-share.vbs` 만들기, 모든 계정 폴더를 통째로 백업하고 한 번 맞추기, 지켜보기 시작하고 상태 보여 주기. 같은 한 줄을 다시 실행하면 업데이트된다.

저장소를 zip으로 받았으면 그 폴더에서 이렇게 해도 같다.

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

### 4. Claude를 완전히 껐다 켠다

창만 닫지 말고 트레이 아이콘에서 종료한 뒤 다시 실행한다. 그러면 모든 계정의 세션이 목록에 보인다.

## 다시 확인

```powershell
node "$env:LOCALAPPDATA\claude-session-share\claude-session-share.mjs" --status
```

- 「지켜보기: 실행 중 (pid …)」이면 돌고 있는 거다.
- 계정 폴더 줄마다 세션 기록 수가 나온다. 모든 줄의 수가 같으면 잘 맞춰진 거다.
- 다른 계정으로 로그인해 본다. 처음 쓰는 계정이면 윈도우 알림이 뜨고, 앱을 한 번 껐다 켜면 같은 목록이 보인다.

## 함정

- **Claude·Codex 같은 스토어 앱 안에서 연 터미널에서는 설치하지 말 것.** 그 안에서는 `AppData` 쓰기가 앱 전용 폴더로 돌려져서 같은 폴더가 두 번 보이고, 지켜보기가 둘이 될 수 있다. 설치기는 이걸 알아채면 멈추고 「시작 메뉴에서 PowerShell을 새로 열어 다시 실행하세요」라고 말한다.
- 폴더를 junction·symlink로 잇는 방법은 쓰지 말 것. 앱이 연결 폴더에는 세션을 저장하지 않는다. 자세한 건 [원인 글의 함정](/ko/claude-sessions-vanish-after-account-switch/#함정).
- 앱은 폴더를 감시하지 않는다. 처음 보는 계정 짝은 꼭 한 번 껐다 켠다. 이미 아는 짝은 바로 보인다.
- 끄려면 제거기를 돌린다. 지켜보기를 멈추고 시작프로그램에서 뺀다. 설치 폴더에는 백업이 있어서 지울지 묻고, 기본은 남긴다. 꺼도 지금까지 맞춘 세션은 각 계정 폴더에 그대로 있다.

```powershell
powershell -ExecutionPolicy Bypass -File "$env:LOCALAPPDATA\claude-session-share\uninstall.ps1"
```

- 공유는 Claude 앱끼리만이다.
