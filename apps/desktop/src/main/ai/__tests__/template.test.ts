import { describe, expect, it } from "vitest";
import { renderPromptTemplate } from "../template.js";

describe("renderPromptTemplate", () => {
  it("substitutes simple string variables", () => {
    expect(renderPromptTemplate("Hello {{name}}", { name: "Ada" })).toBe("Hello Ada");
  });

  it("tolerates whitespace inside braces", () => {
    expect(renderPromptTemplate("Hi {{  name  }}", { name: "Ada" })).toBe("Hi Ada");
  });

  it("coerces numbers and booleans", () => {
    expect(renderPromptTemplate("n={{n}} b={{b}}", { n: 42, b: true })).toBe(
      "n=42 b=true"
    );
  });

  it("JSON-stringifies non-primitives", () => {
    expect(renderPromptTemplate("data={{x}}", { x: { a: 1 } })).toBe('data={"a":1}');
  });

  it("replaces missing variables with an empty string", () => {
    expect(renderPromptTemplate("Hello {{name}}!", {})).toBe("Hello !");
  });

  it("treats null and undefined as empty", () => {
    expect(renderPromptTemplate("[{{a}}][{{b}}]", { a: null, b: undefined })).toBe(
      "[][]"
    );
  });

  it("substitutes the same variable multiple times", () => {
    expect(renderPromptTemplate("{{x}}+{{x}}", { x: "1" })).toBe("1+1");
  });

  it("leaves unknown patterns alone if syntax does not match", () => {
    expect(renderPromptTemplate("{name}", { name: "Ada" })).toBe("{name}");
  });
});
