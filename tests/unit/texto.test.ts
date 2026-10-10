import { describe, expect, it } from "vitest";
import { escaparBusca, formatarPreco, gerarSlugProduto, lerPreco, limparRotulo, slugify } from "@/lib/texto";

describe("slugify", () => {
  it("remove acentos, símbolos e espaços", () => {
    expect(slugify("  Fone Bluetooth Pró — 2ª Geração! ")).toBe("fone-bluetooth-pro-2-geracao");
    expect(slugify("Casa & Cozinha")).toBe("casa-cozinha");
    expect(slugify("!!!")).toBe("");
  });
  it("gera slug de produto válido mesmo com nome só de símbolos", () => {
    expect(gerarSlugProduto("★★★")).toMatch(/^produto-[0-9a-f]{6}$/);
    expect(gerarSlugProduto("Tênis")).toMatch(/^tenis-[0-9a-f]{6}$/);
    expect(gerarSlugProduto("a".repeat(300)).length).toBeLessThanOrEqual(87);
  });
});

describe("lerPreco", () => {
  it.each([
    ["59,90", 59.9], ["R$ 59,90", 59.9], ["1.234,56", 1234.56], ["1,234.56", 1234.56],
    ["1234.56", 1234.56], ["1.234", 1234], ["12.5", 12.5], ["100", 100], [79.9, 79.9], ["59,9", 59.9],
  ])("aceita %s", (entrada, esperado) => {
    expect(lerPreco(entrada)).toBe(esperado);
  });
  it.each(["", "abc", "-10", "0", "0,00", "12,345", "1,2,3", "1.2.3", "12.345.6", "R$", "10 reais", null, undefined])(
    "recusa %s",
    (entrada) => {
      expect(lerPreco(entrada)).toBeNull();
    },
  );
});

describe("utilidades", () => {
  it("formata em reais", () => {
    expect(formatarPreco(1234.5)).toBe("R$ 1.234,50");
  });
  it("escapa curingas da busca", () => {
    expect(escaparBusca("100%_ok\\")).toBe("100\\%\\_ok\\\\");
  });
  it("limpa rótulos de canal e campanha", () => {
    expect(limparRotulo("Telegram <script>", 40)).toBe("telegramscript");
    expect(limparRotulo("semana_1-oferta", 6)).toBe("semana");
    expect(limparRotulo("???", 40)).toBeNull();
    expect(limparRotulo(null, 40)).toBeNull();
  });
});
