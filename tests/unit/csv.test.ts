import { describe, expect, it } from "vitest";
import { decodificarArquivo, lerCsv } from "@/lib/csv";
import { linkAfiliadoValido, produtoSchema, validarCsv } from "@/lib/produto";

describe("lerCsv", () => {
  it("lê ponto e vírgula, aspas, quebra de linha dentro do campo e BOM", () => {
    const txt = '﻿nome;preco\r\n"Kit; 3 peças";"10,50"\r\n"Linha 1\nLinha 2";5\r\n\r\n';
    expect(lerCsv(txt)).toEqual([["nome", "preco"], ["Kit; 3 peças", "10,50"], ["Linha 1\nLinha 2", "5"]]);
  });
  it("lê vírgula e aspas duplicadas", () => {
    expect(lerCsv('a,b\n"diz ""oi""",2')).toEqual([["a", "b"], ['diz "oi"', "2"]]);
  });
  it("decodifica arquivo do Excel em Windows-1252", () => {
    const bytes = new Uint8Array([0x50, 0x72, 0x65, 0xe7, 0x6f]); // "Preço" em 1252
    expect(decodificarArquivo(bytes.buffer)).toBe("Preço");
    expect(decodificarArquivo(new TextEncoder().encode("Preço").buffer as ArrayBuffer)).toBe("Preço");
  });
  const FRASE = 'Sofá Baú Retrátil; Casa e construção; Eletrônicos; Eletrodomésticos';
  it("reconhece arquivo em CP850 (CSV MS-DOS) em vez de embaralhar os acentos", () => {
    expect(decodificarArquivo(new Uint8Array([83, 111, 102, 160, 32, 66, 97, 163, 32, 82, 101, 116, 114, 160, 116, 105, 108, 59, 32, 67, 97, 115, 97, 32, 101, 32, 99, 111, 110, 115, 116, 114, 117, 135, 198, 111, 59, 32, 69, 108, 101, 116, 114, 147, 110, 105, 99, 111, 115, 59, 32, 69, 108, 101, 116, 114, 111, 100, 111, 109, 130, 115, 116, 105, 99, 111, 115]).buffer)).toBe(FRASE);
  });
  it("mantém Windows-1252 quando o texto tem acentos típicos dele", () => {
    expect(decodificarArquivo(new Uint8Array([83, 111, 102, 225, 32, 66, 97, 250, 32, 82, 101, 116, 114, 225, 116, 105, 108, 59, 32, 67, 97, 115, 97, 32, 101, 32, 99, 111, 110, 115, 116, 114, 117, 231, 227, 111, 59, 32, 69, 108, 101, 116, 114, 244, 110, 105, 99, 111, 115, 59, 32, 69, 108, 101, 116, 114, 111, 100, 111, 109, 233, 115, 116, 105, 99, 111, 115]).buffer)).toBe(FRASE);
  });
});

describe("link de afiliado", () => {
  it.each(["https://s.shopee.com.br/abc123", "https://shopee.com.br/produto-i.1.2", "https://shope.ee/xyz"])("aceita %s", (l) => {
    expect(linkAfiliadoValido(l)).toBe(true);
  });
  it.each([
    "http://s.shopee.com.br/abc", "https://shopee.com.br.golpe.com/x", "https://golpe.com/?u=shopee.com.br",
    "https://evilshopee.com.br/x", "javascript:alert(1)", "https://user@shopee.com.br/x", "shopee.com.br/x", "",
  ])("recusa %s", (l) => {
    expect(linkAfiliadoValido(l)).toBe(false);
  });
});

describe("produtoSchema", () => {
  it("normaliza campos opcionais vazios para null", () => {
    const r = produtoSchema.parse({ nome: " Mouse ", link_afiliado: "https://s.shopee.com.br/m", preco_atual: "49,90", descricao: " ", imagem_url: "" });
    expect(r).toEqual({ nome: "Mouse", link_afiliado: "https://s.shopee.com.br/m", preco_atual: 49.9, descricao: null, imagem_url: null, id_externo: null });
  });
  it("recusa imagem sem https", () => {
    const r = produtoSchema.safeParse({ nome: "Mouse", link_afiliado: "https://s.shopee.com.br/m", preco_atual: "1", imagem_url: "http://x.com/a.jpg" });
    expect(r.success).toBe(false);
  });
});

describe("validarCsv", () => {
  const cab = "Nome;Link de Afiliado;Preço;Categoria;Publicar;Preço Anterior;Coluna Extra";
  it("separa linhas válidas das rejeitadas, com motivo e número da linha", () => {
    const csv = [
      cab,
      "Mouse Gamer;https://s.shopee.com.br/a;R$ 89,90;Informática;sim;199;x",
      "Teclado;https://site-qualquer.com/b;50;;;;",
      "Cabo USB;https://s.shopee.com.br/c;grátis;;;;",
      "Mouse Repetido;https://s.shopee.com.br/a;10;;;;",
      "Suporte;https://s.shopee.com.br/d;25,00;Informática;talvez;;",
      "Hub USB;https://s.shopee.com.br/e;1.099,00;;não;;",
    ].join("\n");
    const r = validarCsv(csv);
    expect(r.erroGeral).toBeUndefined();
    expect(r.totalLinhas).toBe(6);
    expect(r.itens.map((i) => [i.nome, i.preco_atual, i.status, i.categoria_slug])).toEqual([
      ["Mouse Gamer", 89.9, "publicado", "informatica"],
      ["Hub USB", 1099, "rascunho", null],
    ]);
    expect(r.erros.map((e) => e.linha)).toEqual([3, 4, 5, 6]);
    expect(r.erros[0].motivo).toMatch(/Link de afiliado/);
    expect(r.erros[1].motivo).toMatch(/Preço/);
    expect(r.erros[2].motivo).toMatch(/repetido.*linha 2/);
    expect(r.erros[3].motivo).toMatch(/publicar/);
    expect(r.avisos.join(" ")).toMatch(/preço anterior foi ignorada/);
    expect(r.avisos.join(" ")).toMatch(/Coluna Extra/);
    expect(r.itens[0]).not.toHaveProperty("preco_anterior");
  });

  it("sem a coluna publicar, respeita a opção padrão", () => {
    const csv = "nome,link,preco\nMouse,https://s.shopee.com.br/a,10";
    expect(validarCsv(csv).itens[0].status).toBe("rascunho");
    expect(validarCsv(csv, { publicarPorPadrao: true }).itens[0].status).toBe("publicado");
  });

  it("explica problemas do arquivo inteiro", () => {
    expect(validarCsv("").erroGeral).toMatch(/vazio/);
    expect(validarCsv("nome;preco\nA;1").erroGeral).toMatch(/link_afiliado/);
    expect(validarCsv("nome;link;preco\n").erroGeral).toMatch(/cabeçalho/);
    const grande = "nome;link;preco\n" + Array.from({ length: 2001 }, (_, i) => `P${i};https://s.shopee.com.br/${i};1`).join("\n");
    expect(validarCsv(grande).erroGeral).toMatch(/limite/);
  });
});
