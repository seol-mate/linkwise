# linkwise — 에이전트 규칙

링크를 저장하면 본문을 수집해 자동으로 요약하고 태그를 붙여주는 북마크 서비스.
스택: TypeScript · Next.js (App Router, `cacheComponents` 활성화) · Tailwind CSS + shadcn/ui · PostgreSQL(Neon) + Drizzle · Zod · Vitest.
명령어와 디렉터리 구조는 `CLAUDE.md`를 따른다. 이 문서는 코드 작성 시 지킬 규칙을 다룬다.

## 코드 스타일

- TypeScript strict 모드 유지, `any` 사용 지양 (외부 입력은 `unknown`으로 받아 Zod로 좁힌다)
- 중첩 삼항 연산자로 조건부 UI나 값을 표현하지 않는다. 분기 의미가 드러나도록 early return이 있는 함수 또는 명시적인 조건문으로 분리한다.
- import는 `@/*` alias(`src/*`)를 사용한다.
- 스타일은 Tailwind CSS(+ shadcn/ui) 기본, 유틸리티로 부족할 때만 CSS Modules (`*.module.css`) 사용

## Next.js

- 기본은 Server Component, 상호작용이 필요할 때만 `"use client"` 사용. 클라이언트 경계는 가능한 한 작게 유지한다.
- 세션(`cookies()`)을 읽는 컴포넌트는 반드시 `<Suspense>` 안에 둔다 (`cacheComponents` 활성화).
- `redirect()`는 에러를 throw하므로 `try/catch` 안에서 호출하지 말고 밖에서 호출한다.
- 서버 전용 코드(DB, 시크릿)는 Client Component에서 import하지 않는다.

## 에러 처리

- 에러 처리를 항상 추가한다: 비동기 호출·DB·외부 API(fetch, AI API) 등 실패할 수 있는 코드는 `try/catch`(또는 `.catch`)로 처리하고, 실패를 삼키지 말고 적절히 처리(사용자용 메시지 반환, 로그 등)한다.
- 에러 로그·응답에 비밀번호/해시/토큰/API 키를 노출하지 않는다. 내부 에러 메시지를 사용자에게 그대로 내려주지 않는다.
- 백그라운드 처리(요약/태깅)가 실패하면 `bookmarks.status`를 `failed`로, 사유를 `errorMessage`에 기록한다. 사유에도 시크릿을 넣지 않는다.

## 보안

- 사용자가 입력한 URL을 서버에서 fetch할 때는 내부 IP/사설 대역(loopback, link-local, 사설망, 클라우드 메타데이터 주소 등)을 차단한다 (SSRF 방어). 리다이렉트 때마다 대상을 다시 검증하고, 타임아웃과 응답 크기 상한을 둔다. `http(s)` 외 스킴은 거부한다.
- 외부 입력(폼, 쿼리, 요청 본문, URL)은 서버에서 Zod로 검증한다. 클라이언트 검증만 믿지 않는다.
- 모든 Server Action과 Route Handler는 시작 시 세션을 확인하고, DB 조회·수정은 반드시 `userId`로 범위를 제한한다 (다른 사용자의 북마크/태그 접근 금지).
- 시크릿은 `.env.local`에만 두고 커밋하지 않는다. 새 환경 변수는 `.env.example`에 값 없이 추가한다. 클라이언트에 노출할 값만 `NEXT_PUBLIC_` 접두사를 쓴다.
- 사용자 콘텐츠(수집한 제목/본문/요약)는 렌더링 시 이스케이프하며 `dangerouslySetInnerHTML`을 쓰지 않는다. 수집한 본문은 AI 프롬프트에 넣을 때 지시문이 아니라 데이터로 취급한다 (프롬프트 인젝션 주의).

## DB

- 스키마는 `src/db/schema.ts`에서만 변경하고 `npm run db:generate`로 마이그레이션을 만든다.
- `drizzle/` 마이그레이션 파일은 수정하지 않고 그대로 커밋한다. 잘못됐으면 새 마이그레이션으로 고친다.
- 쿼리는 Drizzle 쿼리 빌더/`sql` 템플릿으로 작성한다. 문자열 연결로 SQL을 만들지 않는다.
- 다단계 쓰기(북마크 + 태그 연결 등)는 트랜잭션으로 묶는다.

## 테스트

- 순수 로직(URL 정규화, SSRF 차단 판정, 입력 스키마 등)은 `__tests__/`에 Vitest 테스트를 함께 추가한다.
- 버그를 고칠 때는 재현 테스트를 먼저 추가한다.

## 작업 절차

- 커밋 전 `npm run lint`와 `npx tsc --noEmit`을 통과시킨다. 로직을 바꿨다면 `npm run test:run`도 실행한다.
- 코드 작성 전 `node_modules/next/dist/docs/`의 관련 문서를 먼저 확인한다 (아래 블록 참고).
- 요청 범위를 넘는 리팩터링이나 의존성 추가는 하지 않는다. 필요하면 먼저 사용자에게 확인한다.
- 커밋 메시지는 `type: 설명` 형식(`feat:`, `fix:`, `chore:` 등)을 따른다.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
