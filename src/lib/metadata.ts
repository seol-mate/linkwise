import * as cheerio from "cheerio";

import { MAX_TITLE_LENGTH } from "@/lib/bookmark-schemas";

export const MAX_DESCRIPTION_LENGTH = 500;
export const MAX_CONTENT_LENGTH = 20_000;

export type PageMetadata = {
  title: string | null;
  description: string | null;
  // 요약/태깅 단계에서 사용할 본문 텍스트 (태그·스크립트 제거, 공백 정리, 길이 제한)
  content: string;
};

const BLOCK_SELECTOR =
  "p, div, li, br, h1, h2, h3, h4, h5, h6, section, article, blockquote, pre, tr, td, th, dt, dd, figcaption";

function clean(value: string | undefined, maxLength: number): string | null {
  if (!value) {
    return null;
  }
  const collapsed = value.replace(/\s+/g, " ").trim();
  if (collapsed === "") {
    return null;
  }
  return collapsed.slice(0, maxLength);
}

// 수집한 값은 신뢰하지 않는 외부 데이터다. 여기서는 텍스트만 뽑고, 화면에서는 항상 이스케이프해서 보여준다.
export function extractMetadata(html: string): PageMetadata {
  const $ = cheerio.load(html);

  const meta = (selector: string): string | undefined => $(selector).first().attr("content");

  const title =
    clean(meta('meta[property="og:title"]'), MAX_TITLE_LENGTH) ??
    clean(meta('meta[name="twitter:title"]'), MAX_TITLE_LENGTH) ??
    clean($("title").first().text(), MAX_TITLE_LENGTH);

  const description =
    clean(meta('meta[property="og:description"]'), MAX_DESCRIPTION_LENGTH) ??
    clean(meta('meta[name="description"]'), MAX_DESCRIPTION_LENGTH) ??
    clean(meta('meta[name="twitter:description"]'), MAX_DESCRIPTION_LENGTH);

  $("script, style, noscript, template, nav, header, footer, aside, form, svg, iframe, canvas").remove();

  // text()는 인접한 블록 요소를 구분 없이 이어 붙이므로, 블록 뒤에 공백을 넣어 단어가 붙지 않게 한다.
  $(BLOCK_SELECTOR).after(" ");

  const article = $("article").first();
  const main = $("main").first();
  let root = $("body");
  if (article.length > 0) {
    root = article;
  } else if (main.length > 0) {
    root = main;
  }

  const content = clean(root.text(), MAX_CONTENT_LENGTH) ?? "";

  return { title, description, content };
}
