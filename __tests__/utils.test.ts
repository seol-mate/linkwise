import { expect, test } from "vitest";
import { cn } from "@/lib/utils";

test("cn은 충돌하는 Tailwind 클래스를 병합한다", () => {
  expect(cn("px-2", "px-4")).toBe("px-4");
});
