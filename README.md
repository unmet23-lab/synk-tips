# tips.synk.im

유호가 SYNK를 만들며 모은 개발 꿀팁 · by [yuhobuilds](https://www.youtube.com/@yuhobuilds). 글은 마크다운 파일 하나, push 하면 GitHub Pages 에 자동으로 올라간다.

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
