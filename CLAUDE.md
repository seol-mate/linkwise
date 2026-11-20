# linkwise

링크를 저장하면 본문을 수집해 자동으로 요약하고 태그를 붙여주는 북마크 서비스. TypeScript + Next.js (App Router) + PostgreSQL(Neon) + Drizzle.
참고 레포: `../portfolio` (설정/규칙 기준).

## 명령어

- `npm run dev` — 개발 서버 (http://localhost:3000)
- `npm run build` / `npm run start` — 프로덕션 빌드 / 실행
- `npm run lint` — ESLint
- `npx tsc --noEmit` — 타입 체크
- `npm run test:run` — Vitest
- `npm run format` — Prettier
- `npm run db:generate` — 스키마 변경으로 마이그레이션 생성
- `npm run db:migrate` — 마이그레이션 적용 (`.env.local`의 `DATABASE_URL` 필요)

## 구조

- `src/app/` — App Router (라우트, 레이아웃, 페이지)
- `src/components/ui/` — shadcn/ui 컴포넌트
- `src/db/` — Drizzle 스키마(`schema.ts`)와 DB 클라이언트(`index.ts`)
- `src/lib/` — 유틸
- `drizzle/` — 생성된 마이그레이션 (수정하지 않고 커밋)
- `__tests__/` — Vitest 테스트
- import alias: `@/*` → `src/*`

## 규칙

- TypeScript strict 모드 유지, `any` 사용 지양
- 중첩 삼항 연산자로 조건부 UI나 값을 표현하지 않는다. early return 또는 명시적 조건문으로 분리한다.
- 기본은 Server Component, 상호작용이 필요할 때만 `"use client"` 사용
- 스타일은 Tailwind CSS(+ shadcn/ui) 기본, 유틸리티로 부족할 때만 CSS Modules 사용
- 에러 처리를 항상 추가한다: 실패할 수 있는 비동기/외부 호출(fetch, DB, AI API)은 `try/catch`로 처리하고 실패를 삼키지 않는다.
- 사용자가 입력한 URL을 서버에서 fetch할 때는 내부 IP/사설 대역을 차단한다 (SSRF 방어)하고 타임아웃을 둔다.
- 스키마는 `src/db/schema.ts`에서만 변경하고 `db:generate`로 마이그레이션을 만든다.
- 커밋 전 `npm run lint`와 `npx tsc --noEmit` 통과 확인
- 이 Next.js 버전은 기존 지식과 다를 수 있음 — 코드 작성 전 `node_modules/next/dist/docs/`의 관련 문서를 먼저 확인 (`AGENTS.md` 참고)
