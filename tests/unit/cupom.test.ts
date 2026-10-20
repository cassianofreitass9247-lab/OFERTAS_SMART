import { describe, expect, it } from "vitest";
import { beneficio, diasParaVencer, lerCupom, regra, validade } from "@/lib/cupom";

const AGORA = new Date("2026-10-19T15:00:00Z"); // 12h em Brasília

describe("beneficio", () => {
  it("formata percentual, valor e frete", () => {
    expect(beneficio({ tipo: "percentual", valor: 10 })).toBe("10% OFF");
    expect(beneficio({ tipo: "percentual", valor: 7.5 })).toBe("7,50% OFF");
    expect(beneficio({ tipo: "valor", valor: 15 })).toBe("R$ 15 OFF");
    expect(beneficio({ tipo: "valor", valor: 12.5 })).toBe("R$ 12,50 OFF");
    expect(beneficio({ tipo: "frete", valor: null })).toBe("Frete grátis");
    expect(beneficio({ tipo: "outro", valor: null })).toBe("Cupom");
  });
});

describe("regra", () => {
  it("monta a linha de regra e some quando não há", () => {
    expect(regra({ tipo: "percentual", teto: 20, minimo_compra: 50 })).toBe("Compras a partir de R$ 50 · desconto de até R$ 20");
    expect(regra({ tipo: "valor", teto: 20, minimo_compra: null })).toBeNull();
    expect(regra({ tipo: "frete", teto: null, minimo_compra: 0 })).toBeNull();
  });
});

describe("validade", () => {
  it("conta dias pelo calendário de Brasília", () => {
    expect(diasParaVencer("2026-10-19T23:59:00-03:00", AGORA)).toBe(0);
    // 02:00 UTC de 20/10 ainda é 23h de 19/10 em Brasília
    expect(diasParaVencer("2026-10-20T02:00:00Z", AGORA)).toBe(0);
    expect(diasParaVencer("2026-10-20T12:00:00-03:00", AGORA)).toBe(1);
  });
  it("textos e urgência", () => {
    expect(validade("2026-10-19T23:59:00-03:00", AGORA)).toEqual({ texto: "Expira hoje", urgente: true });
    expect(validade("2026-10-20T20:00:00-03:00", AGORA)).toEqual({ texto: "Expira amanhã", urgente: true });
    expect(validade("2026-10-22T20:00:00-03:00", AGORA)).toEqual({ texto: "Expira em 3 dias", urgente: true });
    expect(validade("2026-10-31T20:00:00-03:00", AGORA)).toEqual({ texto: "Válido até 31/10", urgente: false });
  });
});

describe("lerCupom (formulário do painel)", () => {
  const base = { titulo: "10% na Beleza", codigo: "MONI10", tipo: "percentual", valor: "10", valido_ate: "2026-10-31", ativo: "on" };
  const ler = (extra: Record<string, string> = {}, exigirFuturo = true) => lerCupom({ ...base, ...extra }, { agora: AGORA, exigirFuturo });

  it("aceita um cupom válido e converte as datas para Brasília", () => {
    const r = ler({ minimo_compra: "50", teto: "20,00", destaque: "on" });
    expect(r).toEqual({
      dados: {
        titulo: "10% na Beleza", codigo: "MONI10", link_resgate: null, tipo: "percentual", valor: 10, teto: 20, minimo_compra: 50,
        descricao: null, categoria_id: null, valido_ate: "2026-10-31T23:59:59-03:00", destaque: true, ativo: true,
      },
    });
  });
  it("exige código ou link e valida o link", () => {
    expect(ler({ codigo: "" })).toMatchObject({ erro: expect.stringContaining("código") });
    expect(ler({ codigo: "", link_resgate: "https://evil.com/x" })).toMatchObject({ erro: expect.stringContaining("Link") });
    expect(ler({ codigo: "", link_resgate: "https://s.shopee.com.br/abc" })).toHaveProperty("dados");
  });
  it("valida valor, tipo e porcentagem", () => {
    expect(ler({ valor: "" })).toHaveProperty("erro");
    expect(ler({ valor: "150" })).toHaveProperty("erro");
    expect(ler({ tipo: "x" })).toHaveProperty("erro");
    const frete = ler({ tipo: "frete", valor: "", teto: "30" });
    expect(frete).toMatchObject({ dados: { valor: null, teto: null } });
  });
  it("valida datas", () => {
    expect(ler({ valido_ate: "31/10/2026" })).toHaveProperty("erro");
    expect(ler({ valido_ate: "2026-02-31" })).toHaveProperty("erro");
    expect(ler({ valido_ate: "2026-10-18" })).toMatchObject({ erro: expect.stringContaining("passou") });
    expect(ler({ valido_ate: "2026-10-18" }, false)).toHaveProperty("dados");
    expect(ler({ valido_de: "2026-11-05" })).toHaveProperty("erro");
    expect(ler({ valido_de: "2026-10-25" })).toMatchObject({ dados: { valido_de: "2026-10-25T00:00:00-03:00" } });
  });
  it("hoje ainda vale", () => {
    expect(ler({ valido_ate: "2026-10-19" })).toHaveProperty("dados");
  });
});
