---
title: AI가 짠 파이썬에서 한글이 깨질 때, 환경 변수 한 줄로 고치기
date: 2026-10-18
level: 초급
topic: windows
tools: Windows 11, Python 3, PowerShell
summary: 파이썬 결과의 한글이 「ȫ���� 3��」처럼 깨지거나, UnicodeDecodeError·UnicodeEncodeError 'cp949' codec 오류로 멈춘다.
start: 3
hook: AI가 짜 준 파이썬을 돌렸더니 한글이 「ȫ���� 3��」처럼 나오거나 `'cp949' codec can't decode` 오류로 멈췄다면 이 글입니다.
for: AI에게 파이썬 스크립트를 받아 윈도우에서 돌리는 분
answer: PowerShell에 아래 한 줄을 넣고 터미널과 편집기를 새로 엽니다. 그다음부터 이 PC의 파이썬은 한글을 UTF-8로 읽고 씁니다.
answer_code: [Environment]::SetEnvironmentVariable('PYTHONUTF8', '1', 'User')
why: 한국어 윈도우의 파이썬은 따로 말하지 않으면 옛 한국어 글자표(cp949)로 파일을 읽고 쓰는데, 요즘 파일과 도구는 거의 다 UTF-8 글자표를 씁니다. 같은 글자를 서로 다른 표로 읽으니 깨집니다.
prevent: 새 PC에서 위 한 줄을 먼저 넣어 둡니다. AI에게 파이썬을 부탁할 때는 「파일을 열 때 encoding='utf-8'을 꼭 넣어 줘」라고 같이 말합니다.
takeaway: 글자가 깨져 보인다고 파일이 망가진 것은 아닙니다. 대개 쓰는 쪽과 읽는 쪽이 다른 글자표를 쓴 것뿐이니, 지우거나 옮기기 전에 읽는 방법부터 바꿔 봅니다.
---

## 증상

AI가 짜 준 파이썬을 돌리면 한글이 이렇게 망가진다. 아래는 내 PC(Python 3.14.8)에서 그대로 재현한 것이다.

Git Bash에서 결과를 다른 명령으로 넘기면 글자가 깨진다.

```text
$ python -c "print('홍보물 3개')" | cat
ȫ���� 3��
```

UTF-8로 저장된 글 파일을 읽으면 오류로 멈춘다.

```text
UnicodeDecodeError: 'cp949' codec can't decode byte 0xec in position 0: illegal multibyte sequence
```

결과에 ✅ 같은 기호가 섞이면 출력하다가 멈춘다.

```text
UnicodeEncodeError: 'cp949' codec can't encode character '✅' in position 3: illegal multibyte sequence
```

나는 깨진 글자 때문에 크게 헷갈린 적이 있다. 오류 메시지에 폴더 이름이 `ȫ����`로 찍혀서 「폴더 이름이 깨진 채로 옮겨졌다」고 생각했다. 실제 폴더 이름은 멀쩡했다. 다른 작업이 파일을 지운 것을 깨진 글자 탓으로 잘못 짚은 것이다.

## 원인·원리

컴퓨터는 글자를 숫자로 저장한다. 어떤 글자를 어떤 숫자로 바꿀지 정한 표를 **인코딩**이라고 한다. 같은 「한글」 두 글자도 표마다 숫자가 다르다(내 PC에서 직접 잰 바이트다).

| 글자표 | 「한글」의 바이트 |
|---|---|
| cp949(옛 한국어 윈도우 표) | `c7 d1 b1 db` |
| UTF-8(요즘 거의 모든 파일·웹) | `ed 95 9c ea b8 80` |

윈도우의 파이썬은 따로 말하지 않으면 파일을 열 때, 그리고 결과를 다른 프로그램이나 파일로 넘길 때 윈도우의 옛 글자표(한국어 윈도우는 cp949)를 쓴다. UTF-8로 저장된 파일을 cp949로 읽으면 오류가 나고, cp949로 내보낸 글자를 UTF-8로 읽으면 「ȫ����」처럼 보인다. cp949 표에 없는 ✅ 같은 기호는 아예 내보내지 못한다.

헷갈리는 점은 「어떤 때는 멀쩡하다」는 것이다. 파이썬이 PowerShell 창에 바로 찍을 때는 따로 처리해서 한글이 잘 보인다. 결과를 파일이나 다른 명령으로 넘길 때, 파일을 읽고 쓸 때만 깨진다.

`PYTHONUTF8=1`은 파이썬의 **UTF-8 모드**를 켠다. 그러면 파일 열기·쓰기와 입출력이 모두 UTF-8이 된다.

## 고침

이 PC에서 계속 쓰려면 사용자 환경 변수로 한 번 넣는다. 넣은 뒤에는 터미널과 VS Code 같은 편집기를 껐다가 다시 연다.

```powershell
[Environment]::SetEnvironmentVariable('PYTHONUTF8', '1', 'User')
```

이번 한 번만 돌릴 때는 옵션을 붙인다.

```powershell
python -X utf8 스크립트.py
```

AI가 짠 코드 쪽에서 막으려면, 파일을 여는 줄마다 글자표를 적게 한다.

```python
with open('결과.txt', 'w', encoding='utf-8') as f:
    f.write('홍보물 3개')
```

## 다시 확인

새 터미널에서 아래를 돌린다.

```powershell
python -c "import sys; print(sys.flags.utf8_mode)"
```

`1`이 나오면 UTF-8 모드가 켜진 것이다(켜지기 전에는 `0`). 내 PC에서는 켜고 나서 위 세 가지 증상이 모두 사라졌고, 파일에 쓴 「한글」도 `ed 95 9c ea b8 80`으로 바뀌었다.

## 함정

- 한국어 엑셀에서 「CSV(쉼표로 분리)」로 저장한 파일은 cp949로 저장된다. UTF-8 모드에서는 이 파일이 거꾸로 안 열리니, 그 파일만 `encoding='cp949'`로 연다. 엑셀에서 「CSV UTF-8」로 저장하면 이 문제가 없다.
- `python -I`(격리 모드)는 `PYTHON`으로 시작하는 환경 변수를 모두 무시한다. 그때는 `python -I -X utf8`로 돌린다.
- `PYTHONIOENCODING=utf-8`은 화면 입출력만 바꾸고 파일 열기는 그대로다. 둘 다 고치려면 `PYTHONUTF8=1`을 쓴다.
- 환경 변수는 새로 연 창부터 적용된다. 이미 열려 있던 터미널·편집기에서는 그대로 깨진다.
