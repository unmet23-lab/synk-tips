---
title: 바탕화면에 저장했다는 파일이 안 보일 때 — OneDrive가 바탕화면을 옮겨 갔다
date: 2026-10-18
level: 초급
topic: windows
tools: Windows 11, OneDrive, PowerShell
summary: 「바탕화면에 저장했다」는데 바탕화면에 없다. OneDrive 백업이 바탕화면 폴더를 OneDrive 안으로 옮겨서, 프로그램마다 다른 「바탕화면」을 보고 있다.
start: 2
hook: AI나 프로그램이 「바탕화면에 저장했어요」라고 했는데 화면 바탕화면에 없다면, 또는 바탕화면 파일이 다른 기기에서 안 열린다면 이 글입니다.
for: 윈도우 11을 처음 설정 그대로 쓰는 분, AI에게 파일 만들기를 맡기는 분
answer: PowerShell에서 아래 한 줄로 이 PC의 진짜 바탕화면 위치를 확인하고, 파일은 그 경로와 `C:\Users\이름\Desktop` 두 곳에서 찾습니다.
answer_code: [Environment]::GetFolderPath('Desktop')
why: OneDrive의 「백업」이 켜져 있으면 바탕화면 폴더가 `C:\Users\이름\Desktop`에서 OneDrive 폴더 안으로 옮겨집니다. 옛 경로에 그대로 저장하는 프로그램이 있으면, 파일이 화면에 안 보이는 옛 폴더에 쌓입니다.
prevent: 바탕화면 경로는 손으로 쓰지 말고 위 한 줄로 받게 합니다. OneDrive 무료 용량(5GB)이 차면 다른 기기로 올라가지도 않으니, 바탕화면 백업을 계속 쓸지 OneDrive 설정에서 정해 둡니다.
takeaway: 「저장했어요」보다 경로가 중요합니다. AI에게 파일을 만들게 하면 저장한 전체 경로를 같이 알려 달라고 하세요.
---

## 증상

AI가 결과물을 바탕화면에 저장해 두었다고 했다. 그런데 화면의 바탕화면에는 아무것도 없었다. 나는 「왜 안 보이지」 하고 한참 찾았다.

비슷한 모양이 몇 가지 더 있다.

- 바탕화면에 둔 파일이 휴대폰이나 다른 PC의 OneDrive에서 안 보인다.
- OneDrive 백업을 켰다 껐더니 바탕화면 폴더가 텅 비어 보인다.
- 「바탕화면」이라는 같은 이름의 폴더가 탐색기에 두 군데 있다.

Microsoft 공식 질문 게시판에도 「OneDrive 백업 후 바탕화면 폴더들이 모두 사라짐」 같은 질문이 계속 올라온다.

## 원인·원리

윈도우의 바탕화면·문서·사진은 **알려진 폴더**다. 이 폴더들의 실제 위치는 윈도우 설정 한 곳에 적혀 있고, 탐색기와 제대로 만든 프로그램은 저장하기 전에 윈도우에게 「바탕화면이 어디야?」라고 묻는다.

OneDrive의 「폴더 백업」을 켜면 그 설정이 바뀐다. 바탕화면의 실제 위치가 `C:\Users\이름\Desktop`에서 `C:\Users\이름\OneDrive\Desktop`으로 옮겨진다(탐색기에는 「바탕 화면」으로 보인다). 화면에 보이는 바탕화면도 OneDrive 쪽이다.

그런데 경로를 직접 적어 저장하는 프로그램과 스크립트도 많다. AI가 짠 스크립트가 `C:\Users\이름\Desktop`에 저장하면, 파일은 아직 남아 있는 옛 폴더에 들어간다. 그 폴더는 화면 바탕화면이 아니라서 안 보인다.

```text
윈도우 설정상 바탕화면  →  C:\Users\이름\OneDrive\Desktop      ← 화면에 보이는 곳
옛 경로를 직접 쓴 저장   →  C:\Users\이름\Desktop             ← 파일이 쌓이는 곳
```

용량 문제도 겹친다. Microsoft 계정의 무료 OneDrive는 5GB다. 그게 차면 동기화가 멈추고, 바탕화면 파일은 이 PC에만 있고 다른 기기로 올라가지 않는다. 내 옛 노트북이 그랬다. 무료 용량이 찬 뒤로 바탕화면 파일이 한 군데에만 있었다.

PC마다 다르다는 점도 알아 둔다. 새로 바꾼 내 노트북은 바탕화면이 원래 자리(`C:\Users\이름\Desktop`) 그대로였다. 그래서 「내 PC는 어떤가」를 직접 확인하는 것이 먼저다.

## 고침

먼저 이 PC의 진짜 바탕화면 위치를 본다.

```powershell
[Environment]::GetFolderPath('Desktop')
```

`OneDrive`가 들어간 경로가 나오면 백업이 켜진 것이다. 그 폴더와 옛 폴더를 둘 다 열어 파일을 찾는다.

```powershell
explorer ([Environment]::GetFolderPath('Desktop'))
explorer "$env:USERPROFILE\Desktop"
```

찾은 파일은 보이는 바탕화면으로 옮겨 둔다.

그다음 바탕화면 백업을 계속 쓸지 정한다. 작업 표시줄의 OneDrive 구름 아이콘 › 설정 › 동기화 및 백업 › 백업 관리에서 바탕화면 스위치를 켜고 끈다.

## 다시 확인

```powershell
[Environment]::GetFolderPath('Desktop')
Test-Path "$env:USERPROFILE\Desktop"
```

첫 줄이 화면 바탕화면과 같은 곳이고, 파일 탐색기 OneDrive 아이콘이 「최신 상태」면 정리된 것이다.

## 함정

- 백업을 끌 때는 파일이 어디에 남는지 본다. 「OneDrive에만 보관」과 「내 PC에만 유지」 중 고르라는 창이 나오면 원하는 쪽을 고른다. 묻지 않고 꺼졌다면 Microsoft 안내대로 이미 백업된 파일은 OneDrive 폴더에 남아 있으니, 바탕화면의 「내 파일 위치」 바로 가기로 열어 손으로 옮겨 온다.
- OneDrive 폴더에서 지운 파일은 다른 기기와 웹에서도 지워진다. 정리할 때는 옮기기부터 하고, 지우기는 마지막에 한다.
- OneDrive 휴지통도 용량에 포함된다. 지웠는데도 용량이 그대로면 휴지통을 본다.
- AI에게 「바탕화면에 저장해 줘」라고만 하면 AI는 옛 경로를 쓰기 쉽다. 「`[Environment]::GetFolderPath('Desktop')`로 받은 경로에 저장해 줘」라고 같이 말한다.
