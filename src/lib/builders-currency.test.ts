import { describe, expect, it } from "vitest";
import { buildBuilderMetaPayload, parseBuilderCurrencyInput } from "./builders-currency";

describe("parseBuilderCurrencyInput", () => {
  it.each([
    ["3", 3],
    ["3.5", 3.5],
    ["3,5", 3.5],
    ["3.50", 3.5],
    ["3,50", 3.5],
    ["10,90", 10.9],
    ["0", 0],
    ["", 0],
    ["valor invalido", 0],
  ])("parses %s as %s", (input, expected) => {
    expect(parseBuilderCurrencyInput(input)).toBe(expected);
  });
});

describe("buildBuilderMetaPayload", () => {
  it("keeps builders.base_price and parses pt-BR decimal input", () => {
    const payload = buildBuilderMetaPayload({
      name: "Monte sua Pizza",
      emoji: "P",
      description: "Escolha os itens",
      image_url: "",
      base_price: "3,50",
    });

    expect(payload).toEqual({
      name: "Monte sua Pizza",
      emoji: "P",
      description: "Escolha os itens",
      image_url: null,
      base_price: 3.5,
    });
  });
});
