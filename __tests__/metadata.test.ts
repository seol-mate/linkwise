import { describe, expect, it } from "vitest";

import { MAX_TITLE_LENGTH } from "@/lib/bookmark-schemas";
import { MAX_CONTENT_LENGTH, MAX_DESCRIPTION_LENGTH, extractMetadata } from "@/lib/metadata";

describe("extractMetadata - 제목", () => {
  it("og:title을 가장 우선한다", () => {
    const html = `<head><title>문서 제목</title><meta property="og:title" content="OG 제목"><meta name="twitter:title" content="트위터 제목"></head>`;
    expect(extractMetadata(html).title).toBe("OG 제목");
  });

  it("og:title이 없으면 twitter:title, 그다음 <title>을 쓴다", () => {
    expect(extractMetadata(`<head><title>문서 제목</title><meta name="twitter:title" content="트위터 제목"></head>`).title).toBe("트위터 제목");
    expect(extractMetadata(`<head><title>문서 제목</title></head>`).title).toBe("문서 제목");
  });

  it("공백과 줄바꿈을 정리한다", () => {
    expect(extractMetadata(`<title>  여러 줄\n  제목  </title>`).title).toBe("여러 줄 제목");
  });

  it("제목이 없거나 비어 있으면 null이다", () => {
    expect(extractMetadata(`<body>본문</body>`).title).toBeNull();
    expect(extractMetadata(`<title>   </title>`).title).toBeNull();
    expect(extractMetadata(`<meta property="og:title" content="">`).title).toBeNull();
  });

  it("제목은 최대 길이로 자른다", () => {
    const title = extractMetadata(`<title>${"가".repeat(MAX_TITLE_LENGTH + 50)}</title>`).title;
    expect(title?.length).toBe(MAX_TITLE_LENGTH);
  });

  it("태그가 섞인 제목도 텍스트로만 다룬다", () => {
    const title = extractMetadata(`<title>&lt;script&gt;alert(1)&lt;/script&gt;</title>`).title;
    expect(title).toBe("<script>alert(1)</script>"); // 이스케이프는 렌더링 단계 책임
  });
});

describe("extractMetadata - 설명", () => {
  it("og:description을 우선하고, 없으면 meta description을 쓴다", () => {
    expect(extractMetadata(`<meta name="description" content="일반"><meta property="og:description" content="OG">`).description).toBe("OG");
    expect(extractMetadata(`<meta name="description" content="일반">`).description).toBe("일반");
  });

  it("설명은 최대 길이로 자르고, 없으면 null이다", () => {
    expect(extractMetadata(`<meta name="description" content="${"a".repeat(MAX_DESCRIPTION_LENGTH + 10)}">`).description?.length).toBe(MAX_DESCRIPTION_LENGTH);
    expect(extractMetadata(`<body>본문</body>`).description).toBeNull();
  });
});

describe("extractMetadata - 본문", () => {
  it("script, style, nav 등을 제외한 텍스트만 뽑는다", () => {
    const html = `<body><nav>메뉴</nav><script>var secret = 1;</script><style>.a{}</style><p>첫 문단</p><p>둘째   문단</p><footer>푸터</footer></body>`;
    expect(extractMetadata(html).content).toBe("첫 문단 둘째 문단");
  });

  it("article이 있으면 article을, 없으면 main을 우선한다", () => {
    expect(extractMetadata(`<body><p>바깥</p><article>기사 본문</article></body>`).content).toBe("기사 본문");
    expect(extractMetadata(`<body><p>바깥</p><main>메인 본문</main></body>`).content).toBe("메인 본문");
  });

  it("본문은 최대 길이로 자른다", () => {
    const content = extractMetadata(`<body>${"가".repeat(MAX_CONTENT_LENGTH + 100)}</body>`).content;
    expect(content.length).toBe(MAX_CONTENT_LENGTH);
  });

  it("빈 문서와 깨진 HTML도 오류 없이 처리한다", () => {
    expect(extractMetadata("")).toEqual({ title: null, description: null, content: "" });
    expect(() => extractMetadata("<div><p>닫히지 않은 <b>태그")).not.toThrow();
    expect(extractMetadata("<div><p>닫히지 않은 <b>태그").content).toBe("닫히지 않은 태그");
  });
});
