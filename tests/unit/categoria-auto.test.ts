import { describe, expect, it } from "vitest";
import { categoriaAutomatica, type CategoriaBasica } from "@/lib/categoria-auto";

const cats: CategoriaBasica[] = ["Beleza", "Brinquedos", "Casa e construção", "Eletrodomésticos", "Eletrônicos", "Esporte e Lazer", "Mãe e Bebê", "Moda Infantil", "Natal 2026", "Roupas Femininas", "Saúde"].map((nome) => ({
  id: nome,
  nome,
  slug: nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/ /g, "-"),
}));
const c = (n: string) => categoriaAutomatica(n, cats);

describe("categoria automática", () => {
  it("classifica pelos nomes mais comuns", () => {
    expect(c("Fritadeira Air Fryer Oven AFON-12L-FG 12L Digital 2000W Mondial")).toBe("Eletrodomésticos");
    expect(c("Fone de Ouvido Bluetooth TWS")).toBe("Eletrônicos");
    expect(c("Vestido Midi Feminino Canelado")).toBe("Roupas Femininas");
    expect(c("Kit Organizador de Gaveta 6 peças")).toBe("Casa e construção");
    expect(c("Batom Líquido Matte")).toBe("Beleza");
    expect(c("Halter Emborrachado 5kg")).toBe("Esporte e Lazer");
  });
  it("usa a pontuação para casos ambíguos e prefere a categoria mais específica no empate", () => {
    expect(c("Carrinho de Bebê Dobrável com Berço")).toBe("Mãe e Bebê");
    expect(c("Árvore de Natal 1,80m com Pisca-pisca")).toBe("Natal 2026");
    expect(c("Conjunto Infantil Menina Verão")).toBe("Moda Infantil");
  });
  it("não casa palavra dentro de outra (arma x armário) e aceita plural simples", () => {
    expect(c("Armário Multiuso")).toBeNull();
    expect(c("Fones de Ouvido sem fio")).toBe("Eletrônicos");
  });
  it("sem pista clara devolve null; categoria nova usa as palavras do próprio nome", () => {
    expect(c("Produto Misterioso XYZ")).toBeNull();
    expect(categoriaAutomatica("Coleira Ajustável para Cachorro", [{ id: "p", nome: "Cachorro", slug: "cachorro" }])).toBe("p");
  });
});
