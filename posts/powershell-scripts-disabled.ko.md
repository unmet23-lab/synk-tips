---
title: AI가 알려 준 설치 명령이 「스크립트를 실행할 수 없으므로」로 막힐 때
date: 2026-10-18
level: 초급
topic: windows
tools: Windows 11, Windows PowerShell, Node.js(npm)
summary: npm, claude, codex, 파이썬 가상환경 명령이 「이 시스템에서 스크립트를 실행할 수 없으므로 … .ps1 파일을 로드할 수 없습니다」로 멈춘다.
short: 스크립트를 실행할 수 없으므로
start: 1
hook: AI가 알려 준 대로 `npm install`이나 `claude`를 쳤는데 빨간 글씨로 「이 시스템에서 스크립트를 실행할 수 없으므로」가 떴다면 이 글입니다.
for: 윈도우에서 AI 도구(Claude Code·Codex·npm·파이썬)를 처음 까는 분
answer: PowerShell 창에 아래 한 줄을 붙여 넣고, 묻는 말이 나오면 `Y`를 누른 뒤 창을 새로 엽니다. 관리자 권한은 필요 없습니다.
answer_code: Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
why: 윈도우에 기본으로 깔린 PowerShell은 처음에 「스크립트 파일은 하나도 실행하지 않음」으로 맞춰져 있습니다. 그런데 npm 같은 도구는 명령을 `.ps1` 스크립트 파일로 깔아 두어서, 치는 순간 막힙니다.
prevent: 새 PC를 받으면 이 한 줄을 먼저 넣어 둡니다. 인터넷에서 받은 스크립트는 이 설정에서도 막히니 안전장치는 그대로 남습니다.
takeaway: 빨간 오류가 늘 고장을 뜻하지는 않습니다. 「무엇을 막았나」(여기서는 `.ps1` 파일)를 먼저 읽으면 한 줄짜리 설정 문제인 경우가 많습니다.
---

## 증상

AI가 알려 준 설치 명령을 PowerShell에 붙여 넣었더니 이런 빨간 글씨가 나왔다.

```text
npm : 이 시스템에서 스크립트를 실행할 수 없으므로 C:\Program Files\nodejs\npm.ps1 파일을 로드할 수 없습니다.
자세한 내용은 about_Execution_Policies(https://go.microsoft.com/fwlink/?LinkID=135170)를 참조하십시오.
    + CategoryInfo          : 보안 오류: (:) [], PSSecurityException
    + FullyQualifiedErrorId : UnauthorizedAccess
```

`npm` 자리에는 `claude`, `codex`, `yarn`이 오기도 하고, 파이썬 가상환경을 켜는 `.\venv\Scripts\Activate`에서 나기도 한다. 영어 윈도우에서는 「cannot be loaded because running scripts is disabled on this system」으로 나온다.

나는 노트북을 새로 바꾼 날 겪었다. 옛 노트북에서 잘 돌던 SNS 올리기 도구가 이 오류로 멈췄다. 옛 노트북은 언젠가 설정을 바꿔 두어서, 이런 설정이 있다는 것 자체를 몰랐다.

## 원인·원리

PowerShell에는 **실행 정책**이라는 안전장치가 있다. 스크립트 파일(`.ps1`)을 실행해도 되는지 정하는 규칙이다. 한 줄씩 직접 치는 명령은 늘 되고, 파일로 된 스크립트만 이 규칙의 적용을 받는다.

윈도우 PC에 기본으로 깔린 「Windows PowerShell」은 아무것도 정하지 않은 상태가 **Restricted**(스크립트 파일 전부 막음)다.

| 정책 | 뜻 |
|---|---|
| Restricted | 스크립트 파일은 하나도 실행하지 않는다. 윈도우 PC의 기본값 |
| RemoteSigned | 내 PC에서 만든 스크립트는 실행한다. 인터넷에서 받은 스크립트는 서명이 있어야 한다 |
| Unrestricted | 무엇이든 실행한다. 권하지 않는다 |

문제는 npm이 명령을 세 가지 파일로 깔아 둔다는 점이다. 내 PC의 Node.js 폴더에는 `npm`, `npm.cmd`, `npm.ps1`이 나란히 있다. PowerShell에서 `npm`이라고 치면 PowerShell은 `.ps1`을 먼저 고르고, 그 파일이 실행 정책에 걸린다. `npm install -g`로 깐 `codex`·`gemini` 같은 도구도 `%APPDATA%\npm` 폴더에 똑같이 `.ps1`이 생긴다.

직접 견줘 보면 차이가 분명하다(내 PC, 2026-10-18).

```text
Windows PowerShell 5.1 · Restricted   →  npm --version     막힘
Windows PowerShell 5.1 · Restricted   →  npm.cmd --version 12.2.0
PowerShell 7 · RemoteSigned          →  npm --version     12.2.0
```

따로 설치한 PowerShell 7은 내 PC에서 설치할 때부터 RemoteSigned였다. 기본으로 깔린 파란 아이콘의 Windows PowerShell과 PowerShell 7은 설정을 따로 갖는다.

## 고침

계속 쓰는 내 PC라면, 내 계정에만 RemoteSigned를 건다. 관리자 권한이 필요 없다.

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

「실행 정책을 변경하시겠습니까?」가 나오면 `Y`를 누르고, PowerShell 창을 닫았다가 새로 연다.

설정을 남기기 싫으면 지금 연 창에서만 풀 수 있다. 창을 닫으면 원래대로 돌아간다.

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
```

설정을 아예 건드리지 않고 피하려면 `.cmd` 파일을 직접 부른다.

```powershell
npm.cmd install
```

## 다시 확인

```powershell
Get-ExecutionPolicy -List
npm --version
```

목록에서 `CurrentUser`가 `RemoteSigned`이고, `npm --version`이 숫자를 찍으면 된 것이다.

## 함정

- `Unrestricted`나 `Bypass`로 통째로 풀지 않는다. 인터넷에서 받은 스크립트까지 묻지 않고 돌아간다.
- 인터넷에서 받은 `.ps1`은 RemoteSigned에서도 막힌다. 내용을 확인한 뒤에만 `Unblock-File .\파일이름.ps1`로 풀어 준다.
- 회사 PC는 관리자가 그룹 정책(`MachinePolicy`·`UserPolicy`)으로 막아 두었을 수 있다. 그러면 위 명령으로도 안 풀리니 IT 담당자에게 물어본다.
- 다른 프로그램이 안에서 `powershell.exe -File 스크립트.ps1`로 부를 때도 같은 오류가 난다. 나는 그 프로그램이 부르는 줄에 `-ExecutionPolicy Bypass`를 넣어, PC 설정은 그대로 두고 그 스크립트만 돌게 했다.
