# tips.synk.im

유호가 SYNK를 만들며 모은 개발 꿀팁 · by [yuhobuilds](https://www.youtube.com/@yuhobuilds). 글은 마크다운 파일 하나, push 하면 GitHub Pages 에 자동으로 올라간다.

## 무엇을 쓰나 (2026-10-18 정함)

- **새 글은 yuhobuilds 영상과 짝으로만 쓴다.** 영상에서 다룬 일, 유호가 실제로 겪은 일만 쓰고 영상 설명란에서 이 글로 보낸다. 검색에 답이 흔한 일반 오류 글은 더 늘리지 않는다.
- 이미 올린 기본 글(설치 명령 막힘·바탕화면 OneDrive·파이썬 한글 깨짐)은 영상 설명란의 「막히면 여기」로 쓴다.
- 읽히는지는 Cloudflare Web Analytics(쿠키 없음, `site.json`의 `cfBeacon`)로 몇 주 잰다. 소개란·설명란에서 거의 안 오면 글을 늘리지 않는다.
- 후보 목록과 고른 기준은 [docs/글감_후보.md](docs/글감_후보.md).

## 글 하나 올리는 법

1. `posts/<slug>.ko.md` 와 `posts/<slug>.en.md` 두 파일을 쓴다 (아래 앞머리 + 「증상 → 원인·원리 → 고침 → 다시 확인 → 함정」).
2. `npm run check` 로 빌드되는지 본다 (`npm run serve` 로 http://127.0.0.1:4173/ 에서 미리 보기).
3. `git add posts && git commit -m "글: <제목>" && git push` — 1~2분 뒤 사이트에 뜬다.

## 앞머리(front matter)

```markdown
---
title: 계정을 바꿨더니 Claude 세션이 다 사라졌다
date: 2026-10-17
level: 중급                      # 초급 | 중급 | 고급  (영어판은 beginner | intermediate | advanced 도 됨)
topic: claude-app                # topics.json 의 키
tools: Claude 데스크톱 앱(Windows), Node.js, PowerShell 7
summary: 증상 한 줄 — 검색어가 되게 쓴다
start: 3                         # (선택) 「처음이면 여기부터」 순서. 없으면 빠진다
# ↓ (선택) 글 머리 상자. answer 를 쓰면 why · prevent · takeaway 도 같이 쓴다. 모두 한 줄
hook: 「이런 일을 겪었다면 이 글입니다」 한 줄 — 제목 아래에 요약 대신 나온다
for: 이런 분께
answer: 바로 답 한두 문장
answer_code: 복사해 쓰는 명령 한 줄
answer_lang: powershell          # (선택) 명령 칸 이름, 기본 powershell
why: 왜 이런가 한두 문장
prevent: 다음부터 막는 법 한두 문장
takeaway: 다른 일에도 쓰이는 교훈 한 문장
---
```

- 주제를 더하려면 `topics.json` 에 키와 ko·en 이름을 넣는다.
- 그림은 `posts/img/` 에 두고 `![설명](/img/파일.png)` 로 부른다 (빌드가 상대 경로로 바꾼다).
- 영어판이 아직 없으면 그 언어 쪽에는 글이 안 뜨고, 언어 전환은 첫 화면으로 간다.
- `draft: true` 를 앞머리에 넣으면 빌드에서 빠진다.

## 구조

| 경로 | 하는 일 |
|---|---|
| `posts/` | 글 원고. `<slug>.ko.md` + `<slug>.en.md` 한 쌍 |
| `tools/build.mjs` | 마크다운 → `dist/` (첫 화면·주제·글·검색 색인·RSS·sitemap). 의존은 `marked` 하나 |
| `tools/check.mjs` | `dist/` 의 상대 링크가 다 실제 파일인지 확인 |
| `tools/serve.mjs` | 로컬 미리 보기 서버 |
| `site/assets/` | `style.css`(synk.im 공개본 값), `app.js`(복사·검색), 서체(woff2, OFL) |
| `.github/workflows/pages.yml` | push 마다 빌드해 GitHub Pages 에 올림 |

주소: 한국어 `/ko/…`, 영어 `/en/…`. 뿌리 `/` 는 `/ko/` 로 보낸다. 안쪽 링크는 전부 상대 경로라 사용자 지정 도메인과 `*.github.io/synk-tips/` 어느 쪽에서도 열린다.
