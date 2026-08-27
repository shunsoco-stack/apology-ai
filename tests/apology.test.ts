import { describe, expect, it } from "vitest";
import { generateApology, type ApologyMode } from "../src/lib/apology";

describe("generateApology", () => {
  it.each<[ApologyMode, string]>([
    ["normal", "すみませんでした"],
    ["polite", "大変申し訳ございませんでした"],
    ["super", "このたびは誠に申し訳ございませんでした"],
  ])("always returns the original fixed template for %s", (mode, expected) => {
    expect(generateApology(mode)).toBe(expected);
  });

  it("does not accept or inspect a situation, recipient, or other private context", () => {
    const privateContext = new Proxy(
      {},
      {
        get() {
          throw new Error("Private context must not be accessed");
        },
      },
    );

    for (const mode of ["normal", "polite", "super"] as const) {
      expect(
        Reflect.apply(generateApology, undefined, [mode, privateContext]),
      ).toBe(generateApology(mode));
    }
    expect(generateApology.length).toBe(1);
  });

  it.each(["unknown", "__proto__", "constructor", undefined, null])(
    "still returns an apology for an unexpected runtime mode: %s",
    (mode) => {
      expect(generateApology(mode as ApologyMode)).toBe("すみませんでした");
    },
  );
});
