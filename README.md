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
