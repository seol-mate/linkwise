# linkwise

링크를 저장하면 본문을 수집해 **자동으로 요약하고 태그를 붙여주는** 북마크 서비스.

## 스택

Next.js (App Router) · TypeScript · Tailwind CSS · shadcn/ui · PostgreSQL (Neon) · Drizzle ORM · Vitest

## 시작하기

```bash
npm install
cp .env.example .env.local   # DATABASE_URL 등 값 채우기
npm run db:migrate
npm run dev
```

## 배포 (Vercel)

Vercel Hobby 플랜 기준. 코드 쪽 설정은 끝나 있다.

- `src/app/bookmarks/page.tsx`의 `maxDuration = 300`: 이 페이지의 서버 액션이 응답 뒤(`after()`) 본문 수집과 AI 요약을 실행한다. 최악 약 190초(fetch 10초 + AI 60초 × 3회)라서 Hobby 최대값인 300초로 둔다.
- `vercel.json`의 cron: 매일 UTC 18:00(한국 시간 03:00 전후, Hobby는 ±59분 오차)에 `/api/cron/cleanup-guests`를 호출해 7일 지난 게스트를 삭제한다. cron은 production 배포에서만 실행된다.

### 배포 체크리스트

1. Vercel에서 이 GitHub 저장소를 Import한다(프레임워크는 Next.js로 자동 인식).
2. Production 환경 변수를 등록한다: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `ANTHROPIC_API_KEY`, `CRON_SECRET`(`openssl rand -hex 32`), 필요하면 `ANTHROPIC_MODEL`.
   - `CRON_SECRET`이 비어 있으면 cron 요청이 모두 401로 거부된다. 값을 바꾸면 다시 배포해야 반영된다.
3. OAuth 콜백 URL에 배포 도메인을 추가한다.
   - GitHub OAuth App: `https://<도메인>/api/auth/callback/github` (콜백 URL을 하나만 받으므로 로컬용과 배포용 앱을 따로 만드는 편이 쉽다)
   - Google Cloud Console: `https://<도메인>/api/auth/callback/google`
4. 배포용 Neon DB가 로컬과 다르면 그 `DATABASE_URL`로 `npm run db:migrate`를 실행한다.
5. 배포 후 확인한다.
   - [ ] GitHub / Google / 게스트 로그인, 북마크 저장
   - [ ] Vercel 대시보드 Settings → Cron Jobs에 작업이 등록됐는지
   - [ ] 인증 헤더 없이 `/api/cron/cleanup-guests`에 접속하면 401인지

참고: Vercel 문서상 Cron Jobs는 "Schedules"로 옮겨 가는 중인 기능이다(2026-11 기준). 지금 설정도 동작하지만 나중에 전환이 필요할 수 있다.

## 로드맵

- [x] 프로젝트 초기 세팅, DB 스키마
- [x] 인증 (GitHub, 게스트 데모)
- [x] Google 로그인
- [x] 북마크 CRUD
- [x] 메타데이터/본문 수집 (SSRF 방어)
- [ ] AI 요약/태깅 (비동기 처리)
- [x] 검색/필터

## 결제(API 크레딧) 후 확인할 것

AI 요약/태깅은 구현과 단위 테스트(가짜 클라이언트)까지 끝났고, Anthropic 크레딧이 없어 **실제 호출은 아직 검증하지 못했다.** 크레딧 충전 후 확인한다.

- [ ] 북마크 저장 시 실제로 요약과 태그가 생성되는지 (기본 모델 `claude-haiku-5-5`)
- [ ] 안전 분류기가 요청을 거부했을 때 "AI가 이 페이지의 요약을 거부했습니다"가 표시되는지
- [ ] 요약 품질이 부족하면 `.env.local`의 `ANTHROPIC_MODEL`을 `claude-opus-5-5` 등으로 바꿔 비교
- [ ] 확인이 끝나면 위 로드맵의 "AI 요약/태깅"을 체크
