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
