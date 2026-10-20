import { describe, expect, it } from "vitest";
import { MARCA_PADRAO, contraste, criarMarca, frases, iconeSvg, paleta, variaveisDeCor } from "@/lib/marca";

describe("marca: padrão (Vitrine da Moni)", () => {
  it("sem variáveis, devolve exatamente a marca atual, sem avisos", () => {
    const m = criarMarca({});
    expect(m.nomeSite).toBe("Vitrine da Moni");
    expect(m.apelido).toBe("Moni");
    expect(m.artigoPessoa).toBe("a");
    expect(m.instagramUsuario).toBe("moniquealbc_");
    expect(m.whatsappNumero).toBe("5584987779782");
    expect(m.foto).toBe("/moni.jpg");
    expect(m.bio).toEqual(MARCA_PADRAO.bio);
    expect(m.cores).toEqual({ principal: "#ff5b14", destaque: "#ffe14d" });
    expect(m.avisos).toEqual([]);
  });

  it("valores vazios ou só espaços equivalem a não configurar", () => {
    const m = criarMarca({ NEXT_PUBLIC_MARCA_NOME_SITE: "   ", NEXT_PUBLIC_MARCA_COR: "" });
    expect(m.nomeSite).toBe("Vitrine da Moni");
    expect(m.avisos).toEqual([]);
  });

  it("cores padrão não injetam variáveis CSS e mantêm a paleta original", () => {
    expect(variaveisDeCor(MARCA_PADRAO.cores)).toEqual({});
    expect(paleta("#ff5b14")).toEqual({ forte: "#c2410c", escuro: "#9a3412", pessego: "#ffe8db", fundo: "#fff6f0", claro: "#fff1e8" });
  });

  it("frases com o padrão reproduzem os textos originais", () => {
    const F = frases(criarMarca({}));
    expect(F.a).toBe("a Moni");
    expect(F.A).toBe("A Moni");
    expect(F.da).toBe("da Moni");
    expect(F.pra).toBe("pra Moni");
    expect(F.pela).toBe("pela Moni");
    expect(F.site).toBe("a Vitrine da Moni");
    expect(F.noSite).toBe("na Vitrine da Moni");
    expect(F.doSite).toBe("da Vitrine da Moni");
  });
});

describe("marca: personalização", () => {
  const env = {
    NEXT_PUBLIC_MARCA_NOME_SITE: "Achados do João",
    NEXT_PUBLIC_MARCA_ARTIGO_SITE: "o",
    NEXT_PUBLIC_MARCA_NOME_PESSOA: "João Silva",
    NEXT_PUBLIC_MARCA_APELIDO: "João",
    NEXT_PUBLIC_MARCA_ARTIGO: "O",
    NEXT_PUBLIC_MARCA_INSTAGRAM: "@achadosdojoao",
    NEXT_PUBLIC_MARCA_WHATSAPP: "(11) 91234-5678",
    NEXT_PUBLIC_MARCA_COR: "#0ea5a4",
    NEXT_PUBLIC_MARCA_COR_DESTAQUE: "#ffd23f",
    NEXT_PUBLIC_MARCA_BIO: "Sou João, pai de família e caçador de promoções na Shopee.",
  };

  it("aplica os valores e normaliza", () => {
    const m = criarMarca(env);
    expect(m.nomeSite).toBe("Achados do João");
    expect(m.artigoSite).toBe("o");
    expect(m.artigoPessoa).toBe("o");
    expect(m.instagramUsuario).toBe("achadosdojoao");
    expect(m.whatsappNumero).toBe("5511912345678");
    expect(m.cores.principal).toBe("#0ea5a4");
    expect(m.avisos).toEqual([]);
  });

  it("bio própria sem segunda parte não herda o texto da Moni", () => {
    expect(criarMarca(env).bio).toEqual(["Sou João, pai de família e caçador de promoções na Shopee.", ""]);
  });

  it("concorda o gênero masculino", () => {
    const F = frases(criarMarca(env));
    expect(F.a).toBe("o João");
    expect(F.A).toBe("O João");
    expect(F.da).toBe("do João");
    expect(F.pra).toBe("pro João");
    expect(F.pela).toBe("pelo João");
    expect(F.site).toBe("o Achados do João");
    expect(F.siteComArtigo).toBe("O Achados do João");
    expect(F.noSite).toBe("no Achados do João");
    expect(F.doSite).toBe("do Achados do João");
  });

  it("aceita Instagram como URL e WhatsApp já com 55", () => {
    const m = criarMarca({ NEXT_PUBLIC_MARCA_INSTAGRAM: "https://www.instagram.com/loja.teste/", NEXT_PUBLIC_MARCA_WHATSAPP: "+55 21 98888-7777" });
    expect(m.instagramUsuario).toBe("loja.teste");
    expect(m.whatsappNumero).toBe("5521988887777");
  });

  it("cores personalizadas geram variáveis com texto branco legível no botão", () => {
    const v = variaveisDeCor(criarMarca(env).cores);
    expect(v["--color-neon"]).toBe("#0ea5a4");
    expect(v["--color-sol"]).toBe("#ffd23f");
    expect(contraste(v["--color-laranja-forte"], "#ffffff")).toBeGreaterThanOrEqual(4.5);
    for (const valor of Object.values(v)) expect(valor).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("marca: valores inválidos voltam ao padrão e geram aviso", () => {
  const casos: [string, Record<string, string>][] = [
    ["nome curto demais", { NEXT_PUBLIC_MARCA_NOME_SITE: "A" }],
    ["nome longo demais", { NEXT_PUBLIC_MARCA_NOME_SITE: "x".repeat(61) }],
    ["artigo inválido", { NEXT_PUBLIC_MARCA_ARTIGO: "os" }],
    ["instagram inválido", { NEXT_PUBLIC_MARCA_INSTAGRAM: "nome com espaço!" }],
    ["whatsapp inválido", { NEXT_PUBLIC_MARCA_WHATSAPP: "123" }],
    ["foto com ..", { NEXT_PUBLIC_MARCA_FOTO: "/../segredo.jpg" }],
    ["foto http (não https)", { NEXT_PUBLIC_MARCA_FOTO: "http://x.com/a.jpg" }],
    ["cor fora do formato", { NEXT_PUBLIC_MARCA_COR: "laranja" }],
    ["cor escura demais", { NEXT_PUBLIC_MARCA_COR: "#111111" }],
    ["cor de destaque inválida", { NEXT_PUBLIC_MARCA_COR_DESTAQUE: "#fff" }],
  ];
  it.each(casos)("%s", (_nome, env) => {
    const m = criarMarca(env);
    expect(m.avisos).toHaveLength(1);
    expect(m.avisos[0]).toContain("NEXT_PUBLIC_MARCA_");
    expect(m.nomeSite).toBe("Vitrine da Moni");
    expect(m.artigoPessoa).toBe("a");
    expect(m.instagramUsuario).toBe("moniquealbc_");
    expect(m.whatsappNumero).toBe("5584987779782");
    expect(m.foto).toBe("/moni.jpg");
    expect(m.cores).toEqual({ principal: "#ff5b14", destaque: "#ffe14d" });
  });

  it("aceita foto em /public e em https", () => {
    expect(criarMarca({ NEXT_PUBLIC_MARCA_FOTO: "/foto-padrao.svg" }).foto).toBe("/foto-padrao.svg");
    expect(criarMarca({ NEXT_PUBLIC_MARCA_FOTO: "https://exemplo.com/a.jpg" }).foto).toBe("https://exemplo.com/a.jpg");
  });
});

describe("ícone", () => {
  it("usa as cores da marca e é um SVG válido", () => {
    const svg = iconeSvg({ principal: "#0ea5a4", destaque: "#ffd23f" });
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain('fill="#0ea5a4"');
    expect(svg).toContain('fill="#ffd23f"');
    expect(svg).not.toContain("#ff5b14");
  });
  it("com as cores padrão mantém o desenho laranja", () => {
    const svg = iconeSvg(MARCA_PADRAO.cores);
    expect(svg).toContain('fill="#ff5b14"');
    expect(svg).toContain('fill="#c2410c"');
  });
});
