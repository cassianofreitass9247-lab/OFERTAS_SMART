import { describe, expect, it } from "vitest";
import { lerLocais, lerLocal, rotuloCidade, rotuloEstado } from "@/lib/local";

describe("lerLocal", () => {
  it("lê país, estado e cidade do objeto cf", () => {
    expect(lerLocal({ country: "BR", regionCode: "RN", city: "Mossoró", latitude: "1", postalCode: "59600" })).toEqual({ pais: "BR", estado: "RN", cidade: "Mossoró" });
  });
  it("sem cf ou sem país, devolve tudo vazio", () => {
    const vazio = { pais: null, estado: null, cidade: null };
    expect(lerLocal(undefined)).toEqual(vazio);
    expect(lerLocal(null)).toEqual(vazio);
    expect(lerLocal({ city: "Natal" })).toEqual(vazio);
    expect(lerLocal({ country: "Brasil" })).toEqual(vazio);
  });
  it("aceita campos faltando e descarta valores fora do formato", () => {
    expect(lerLocal({ country: "br" })).toEqual({ pais: "BR", estado: null, cidade: null });
    expect(lerLocal({ country: "BR", regionCode: "Rio Grande do Norte", city: "" })).toEqual({ pais: "BR", estado: null, cidade: null });
    expect(lerLocal({ country: "BR", regionCode: 12, city: 5 })).toEqual({ pais: "BR", estado: null, cidade: null });
  });
  it("limpa caracteres de controle e limita o tamanho da cidade", () => {
    expect(lerLocal({ country: "BR", city: "Na\ntal\u0000" }).cidade).toBe("Natal");
    expect(lerLocal({ country: "BR", city: "x".repeat(200) }).cidade).toHaveLength(80);
  });
});

describe("rótulos", () => {
  it("estado: sigla no Brasil, país/região fora dele", () => {
    expect(rotuloEstado("BR", "RN")).toBe("RN");
    expect(rotuloEstado("BR", null)).toBe("Brasil (sem estado)");
    expect(rotuloEstado("US", "CA")).toBe("US/CA");
    expect(rotuloEstado("PT", null)).toBe("PT");
    expect(rotuloEstado(null, null)).toBe("Sem local");
  });
  it("cidade com estado no Brasil e país fora dele", () => {
    expect(rotuloCidade("Mossoró", "RN", "BR")).toBe("Mossoró, RN");
    expect(rotuloCidade("Lisboa", null, "PT")).toBe("Lisboa, PT");
    expect(rotuloCidade("Natal", null, "BR")).toBe("Natal");
  });
});

describe("lerLocais", () => {
  it("dado inesperado vira zeros", () => {
    expect(lerLocais(null)).toEqual({ total: 0, com_local: 0, por_estado: [], por_cidade: [] });
    expect(lerLocais({ por_estado: [null, { estado: "RN" }], por_cidade: [{ pais: "BR" }] }).por_estado).toEqual([]);
  });
  it("lê as listas completas", () => {
    const r = lerLocais({ total: 5, com_local: 4, por_estado: [{ pais: "BR", estado: "RN", cliques: 3 }], por_cidade: [{ pais: "BR", estado: "RN", cidade: "Mossoró", cliques: 3 }] });
    expect(r.por_estado[0]).toEqual({ pais: "BR", estado: "RN", cliques: 3 });
    expect(r.por_cidade[0].cidade).toBe("Mossoró");
  });
});
