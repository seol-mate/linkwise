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

## 로드맵

- [x] 프로젝트 초기 세팅, DB 스키마
- [x] 인증 (GitHub, 게스트 데모)
- [ ] Google 로그인
- [x] 북마크 CRUD
- [x] 메타데이터/본문 수집 (SSRF 방어)
- [ ] AI 요약/태깅 (비동기 처리)
- [ ] 검색/필터

## 결제(API 크레딧) 후 확인할 것

AI 요약/태깅은 구현과 단위 테스트(가짜 클라이언트)까지 끝났고, Anthropic 크레딧이 없어 **실제 호출은 아직 검증하지 못했다.** 크레딧 충전 후 확인한다.

- [ ] 북마크 저장 시 실제로 요약과 태그가 생성되는지 (기본 모델 `claude-haiku-5-5`)
- [ ] 안전 분류기가 요청을 거부했을 때 "AI가 이 페이지의 요약을 거부했습니다"가 표시되는지
- [ ] 요약 품질이 부족하면 `.env.local`의 `ANTHROPIC_MODEL`을 `claude-opus-5-5` 등으로 바꿔 비교
- [ ] 확인이 끝나면 위 로드맵의 "AI 요약/태깅"을 체크
