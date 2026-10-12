import { describe, expect, it } from "vitest";
import { formatarWhatsapp, linkWhatsapp, mensagemAchei, normalizarWhatsapp, pedidoSchema } from "@/lib/pedido";
import { analisarVideo } from "@/lib/video";

describe("WhatsApp", () => {
  it("normaliza formatos comuns", () => {
    expect(normalizarWhatsapp("(84) 98777-9782")).toBe("5584987779782");
    expect(normalizarWhatsapp("+55 84 98777-9782")).toBe("5584987779782");
    expect(normalizarWhatsapp("8433214567")).toBe("558433214567");
    expect(normalizarWhatsapp("(55) 99123-4567")).toBe("5555991234567"); // DDD 55 (RS)
  });
  it("recusa números inválidos", () => {
    expect(normalizarWhatsapp("12345")).toBeNull();
    expect(normalizarWhatsapp("(84) 88777-9782")).toBeNull(); // celular de 9 dígitos começa com 9
    expect(normalizarWhatsapp("(01) 98777-9782")).toBeNull();
  });
  it("formata para leitura", () => {
    expect(formatarWhatsapp("5584987779782")).toBe("(84) 98777-9782");
    expect(formatarWhatsapp("558433214567")).toBe("(84) 3321-4567");
  });
  it("exige consentimento", () => {
    const base = { nome: "Ana", whatsapp: "84987779782", descricao: "Mochila", referencia: "" };
    expect(pedidoSchema.safeParse({ ...base, consentimento: false }).success).toBe(false);
    expect(pedidoSchema.safeParse({ ...base, consentimento: true }).success).toBe(true);
  });
  it("monta link wa.me com a mensagem codificada e aviso de afiliado", () => {
    const msg = mensagemAchei({ nome: "Ana Maria", descricao: "Mochila", produto: "Mochila X", link: "https://s.shopee.com.br/abc" });
    expect(msg).toContain("Oi, Ana!");
    expect(msg).toContain("link de afiliado");
    const url = new URL(linkWhatsapp("5584987779782", msg));
    expect(url.host).toBe("wa.me");
    expect(url.searchParams.get("text")).toBe(msg);
  });
});

describe("vídeo", () => {
  it("YouTube comum e Shorts", () => {
    expect(analisarVideo("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toMatchObject({ tipo: "youtube", vertical: false });
    expect(analisarVideo("https://youtube.com/shorts/dQw4w9WgXcQ?si=1")).toMatchObject({
      tipo: "youtube",
      vertical: true,
      embed: expect.stringContaining("youtube-nocookie.com/embed/dQw4w9WgXcQ"),
    });
    expect(analisarVideo("https://youtu.be/dQw4w9WgXcQ")).toMatchObject({ tipo: "youtube" });
  });
  it("TikTok e Instagram", () => {
    expect(analisarVideo("https://www.tiktok.com/@moni/video/7301234567890123456")).toMatchObject({ tipo: "tiktok", embed: "https://www.tiktok.com/player/v1/7301234567890123456?autoplay=1&rel=0" });
    expect(analisarVideo("https://www.instagram.com/reel/C1a2B3c4D5e/")).toMatchObject({ tipo: "instagram", embed: "https://www.instagram.com/p/C1a2B3c4D5e/embed/" });
  });
  it("Shopee Video vira link e mp4 vira arquivo", () => {
    expect(analisarVideo("https://sv.shopee.com.br/share-video/abc")).toMatchObject({ tipo: "shopee" });
    expect(analisarVideo("https://s.shopee.com.br/xyz")).toMatchObject({ tipo: "shopee" });
    expect(analisarVideo("https://cdn.exemplo.com/v.mp4")).toMatchObject({ tipo: "arquivo" });
  });
  it("recusa o resto", () => {
    expect(analisarVideo("http://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(analisarVideo("https://vimeo.com/123")).toBeNull();
    expect(analisarVideo("https://www.youtube.com/watch?v=curto")).toBeNull();
    expect(analisarVideo("https://evil.com/youtube.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(analisarVideo("javascript:alert(1)")).toBeNull();
  });
});

import { MAX_CURTOS_POR_IMPORTACAO, resolverVideo, resolverVideosDoCsv } from "@/lib/video-servidor";
import type { ItemImportacao } from "@/lib/produto";

const ID = "1AbCdEfGhIjKlMnOpQrStUvWxYz012345";
describe("Google Drive", () => {
  it("aceita os formatos de link do Drive e gera o player", () => {
    for (const u of [
      `https://drive.google.com/file/d/${ID}/view?usp=sharing`,
      `https://drive.google.com/file/d/${ID}/preview`,
      `https://drive.google.com/file/u/0/d/${ID}/view`,
      `https://drive.google.com/open?id=${ID}`,
      `https://drive.google.com/uc?export=download&id=${ID}`,
    ]) {
      expect(analisarVideo(u), u).toMatchObject({ tipo: "drive", embed: `https://drive.google.com/file/d/${ID}/preview` });
    }
  });
  it("recusa pasta, id curto e outros sites", () => {
    expect(analisarVideo("https://drive.google.com/drive/folders/" + ID)).toBeNull();
    expect(analisarVideo("https://drive.google.com/file/d/abc/view")).toBeNull();
    expect(analisarVideo(`https://evil.com/drive.google.com/file/d/${ID}/view`)).toBeNull();
    expect(analisarVideo(`http://drive.google.com/file/d/${ID}/view`)).toBeNull();
  });
});

describe("link curto do TikTok", () => {
  const resposta = (status: number, location?: string) => new Response(null, { status, headers: location ? { location } : {} });
  const completo = "https://www.tiktok.com/@moni/video/7301234567890123456";

  it("reconhece os formatos curtos", () => {
    for (const u of ["https://vm.tiktok.com/ZMabc123/", "https://vt.tiktok.com/ZSabc123/", "https://www.tiktok.com/t/ZTabc123/"]) {
      expect(analisarVideo(u), u).toMatchObject({ tipo: "tiktok-curto" });
    }
  });
  it("segue o redirecionamento e guarda o endereço completo, sem rastreadores", async () => {
    const chamadas: string[] = [];
    const r = await resolverVideo("https://vm.tiktok.com/ZMabc123/", async (url, init) => {
      chamadas.push(url);
      expect(init.redirect).toBe("manual");
      return resposta(301, completo + "?_r=1&u_code=xyz&share_link_id=abc");
    });
    expect(r).toEqual({ url: completo });
    expect(chamadas).toEqual(["https://vm.tiktok.com/ZMabc123/"]);
  });
  it("aceita um salto intermediário dentro do TikTok", async () => {
    const r = await resolverVideo("https://vm.tiktok.com/ZMabc123/", async (url) =>
      url.startsWith("https://vm.") ? resposta(302, "https://www.tiktok.com/t/ZTabc123/") : resposta(301, completo),
    );
    expect(r).toEqual({ url: completo });
  });
  it("não segue redirecionamento para fora do TikTok", async () => {
    let chamadas = 0;
    const r = await resolverVideo("https://vm.tiktok.com/ZMabc123/", async () => {
      chamadas++;
      return resposta(302, "https://evil.example.com/video/123456789");
    });
    expect(r).toMatchObject({ erro: expect.stringContaining("endereço completo") });
    expect(chamadas).toBe(1);
  });
  it("não faz nenhuma busca para link que não é curto do TikTok", async () => {
    const nunca = async () => {
      throw new Error("não deveria buscar");
    };
    expect(await resolverVideo(completo, nunca)).toEqual({ url: completo });
    expect(await resolverVideo("https://internal.local/x", nunca)).toMatchObject({ erro: expect.any(String) });
  });
  it("trata erro de rede, resposta sem redirecionamento e laço infinito", async () => {
    expect(await resolverVideo("https://vm.tiktok.com/ZMabc123/", async () => { throw new Error("rede"); })).toHaveProperty("erro");
    expect(await resolverVideo("https://vm.tiktok.com/ZMabc123/", async () => resposta(200))).toHaveProperty("erro");
    let n = 0;
    expect(await resolverVideo("https://vm.tiktok.com/ZMabc123/", async () => { n++; return resposta(302, "https://vm.tiktok.com/ZMabc123/"); })).toHaveProperty("erro");
    expect(n).toBeLessThanOrEqual(4);
  });
  it("CSV: troca links curtos, recusa só a linha com problema e respeita o limite", async () => {
    const base = { slug: "x", preco_atual: 1, link_afiliado: "https://s.shopee.com.br/a", descricao: null, imagem_url: null, id_externo: null, categoria_nome: null, categoria_slug: null, status: "rascunho" } as const;
    const item = (nome: string, video: string | null): ItemImportacao => ({ ...base, nome, video_url: video });
    const itens = [item("A", "https://vm.tiktok.com/ZMokok1/"), item("B", "https://vm.tiktok.com/ZMruim1/"), item("C", null), item("D", "https://vm.tiktok.com/ZMokok1/")];
    const r = await resolverVideosDoCsv(itens, [2, 3, 4, 5], async (url) => (url.includes("ruim") ? resposta(404) : resposta(301, completo)));
    expect(r.itens.map((i) => [i.nome, i.video_url])).toEqual([["A", completo], ["C", null], ["D", completo]]);
    expect(r.erros).toEqual([{ linha: 3, motivo: expect.stringContaining("endereço completo") }]);

    const muitos = Array.from({ length: MAX_CURTOS_POR_IMPORTACAO + 2 }, (_, i) => item("P" + i, `https://vm.tiktok.com/ZMlink${i}abc/`));
    const r2 = await resolverVideosDoCsv(muitos, muitos.map((_, i) => i + 2), async () => resposta(301, completo));
    expect(r2.itens).toHaveLength(MAX_CURTOS_POR_IMPORTACAO);
    expect(r2.erros).toHaveLength(2);
  });
});
