// Marca do site: nome, apelido, redes, foto, apresentação e cores. É o ÚNICO lugar com esses dados.
//
// Cada cliente tem o próprio Worker, que lê a marca de variáveis NEXT_PUBLIC_MARCA_* (veja .env.example). Todas são
// opcionais: sem nenhuma, o site continua sendo a Vitrine da Moni, igual a antes. Valor inválido é ignorado (vale o
// padrão) e vira um aviso no painel, em vez de quebrar o site.
//
// ATENÇÃO: as variáveis NEXT_PUBLIC_* são gravadas no site durante o build, então cadastre-as como variáveis de BUILD
// no Cloudflare antes do deploy (e refaça o deploy depois de mudar).

export type Env = Record<string, string | undefined>;

export type ConfigMarca = {
  nomeSite: string;
  /** "a" para "a Vitrine da Moni", "o" para "o Achados do João". */
  artigoSite: "a" | "o";
  nomePessoa: string;
  apelido: string;
  /** "a" para "a Moni", "o" para "o João". */
  artigoPessoa: "a" | "o";
  instagramUsuario: string;
  /** Só dígitos, com 55 na frente. */
  whatsappNumero: string;
  /** Caminho em /public (começa com "/") ou endereço https. */
  foto: string;
  bio: [string, string];
  descricaoSite: string;
  cores: { principal: string; destaque: string };
  /** Valores recebidos mas recusados (o padrão foi usado no lugar). Aparecem no painel. */
  avisos: string[];
};

export const MARCA_PADRAO = {
  nomeSite: "Vitrine da Moni",
  artigoSite: "a",
  nomePessoa: "Monique Albuquerque",
  apelido: "Moni",
  artigoPessoa: "a",
  instagramUsuario: "moniquealbc_",
  whatsappNumero: "5584987779782",
  foto: "/moni.jpg",
  bio: [
    "Sou Monique Albuquerque, empreendedora digital, mãe de três filhos e apaixonada por garimpar ofertas na Shopee.",
    "Compartilho achadinhos de beleza, casa, mundo infantil e muito mais para ajudar você a economizar.",
  ],
  descricaoSite:
    "Achadinhos da Shopee de beleza, casa, mundo infantil e muito mais, garimpados pela Moni. O desconto só aparece quando o preço cai de verdade.",
  cores: { principal: "#fd6002", destaque: "#fdb103" },
} as const;

// ---------------------------------------------------------------------------
// Cores
// ---------------------------------------------------------------------------
const TINTA = "#1c0152"; // texto e contornos: fixo (as sombras e os contornos do desenho dependem dele)
const HEX = /^#[0-9a-fA-F]{6}$/;

const paraRgb = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
const paraHex = (rgb: number[]) => "#" + rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("");

/** Mistura `a` com `b`: t = 0 é `a`, t = 1 é `b`. */
export function misturar(a: string, b: string, t: number): string {
  const [ra, rb] = [paraRgb(a), paraRgb(b)];
  return paraHex(ra.map((v, i) => v + (rb[i] - v) * t));
}

const canal = (v: number) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
export function luminancia(hex: string): number {
  const [r, g, b] = paraRgb(hex);
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}
/** Razão de contraste da WCAG (1 a 21). */
export function contraste(a: string, b: string): number {
  const [la, lb] = [luminancia(a), luminancia(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Escurece a cor até o texto branco ficar legível sobre ela (contraste mínimo 4,5), para botões do painel. */
function corDeBotao(principal: string): string {
  let cor = principal;
  for (let i = 0; i < 12 && contraste(cor, "#ffffff") < 4.5; i++) cor = misturar(cor, "#000000", 0.1);
  return cor;
}

/** Tons derivados da cor principal. Com a cor padrão, são exatamente os do tema original (globals.css). */
export function paleta(principal: string) {
  if (principal === MARCA_PADRAO.cores.principal) {
    return { forte: "#c2410c", escuro: "#9a3412", pessego: "#efe6fc", fundo: "#f6f0ff", claro: "#fff1e8" };
  }
  const forte = corDeBotao(principal);
  return {
    forte,
    escuro: misturar(forte, "#000000", 0.25),
    pessego: misturar(principal, "#ffffff", 0.88),
    fundo: misturar(principal, "#ffffff", 0.96),
    claro: misturar(principal, "#ffffff", 0.9),
  };
}

/** Variáveis CSS que sobrepõem as do tema (globals.css). Vazio quando a marca usa as cores padrão. */
export function variaveisDeCor(c: { principal: string; destaque: string }): Record<string, string> {
  if (c.principal === MARCA_PADRAO.cores.principal && c.destaque === MARCA_PADRAO.cores.destaque) return {};
  const t = paleta(c.principal);
  return {
    "--color-neon": c.principal,
    "--color-sol": c.destaque,
    "--color-pessego": t.pessego,
    "--color-fundo": t.fundo,
    "--color-laranja": c.principal,
    "--color-laranja-forte": t.forte,
    "--color-laranja-escuro": t.escuro,
    "--color-laranja-claro": t.claro,
  };
}

// ---------------------------------------------------------------------------
// Leitura e validação
// ---------------------------------------------------------------------------
const limpar = (v: string | undefined, max: number) => (v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

export function criarMarca(env: Env): ConfigMarca {
  const avisos: string[] = [];
  const P = MARCA_PADRAO;

  // Texto livre: vazio = padrão.
  const texto = (nome: string, valor: string | undefined, padrao: string, max: number, minimo = 2) => {
    const v = limpar(valor, max + 1);
    if (!v) return padrao;
    if (v.length < minimo || v.length > max) {
      avisos.push(`${nome}: use de ${minimo} a ${max} caracteres. Usando o padrão.`);
      return padrao;
    }
    return v;
  };
  const artigo = (nome: string, valor: string | undefined, padrao: "a" | "o") => {
    const v = limpar(valor, 10).toLowerCase();
    if (!v) return padrao;
    if (v === "a" || v === "o") return v;
    avisos.push(`${nome}: use "a" ou "o". Usando "${padrao}".`);
    return padrao;
  };

  const nomeSite = texto("NEXT_PUBLIC_MARCA_NOME_SITE", env.NEXT_PUBLIC_MARCA_NOME_SITE, P.nomeSite, 60);
  const nomePessoa = texto("NEXT_PUBLIC_MARCA_NOME_PESSOA", env.NEXT_PUBLIC_MARCA_NOME_PESSOA, P.nomePessoa, 80);
  const apelido = texto("NEXT_PUBLIC_MARCA_APELIDO", env.NEXT_PUBLIC_MARCA_APELIDO, P.apelido, 30);

  let instagramUsuario: string = P.instagramUsuario;
  const ig = limpar(env.NEXT_PUBLIC_MARCA_INSTAGRAM, 80).replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/+$/, "");
  if (ig) {
    if (/^[A-Za-z0-9._]{1,30}$/.test(ig)) instagramUsuario = ig;
    else avisos.push("NEXT_PUBLIC_MARCA_INSTAGRAM: use só o @ da conta (letras, números, ponto e sublinhado). Usando o padrão.");
  }

  let whatsappNumero: string = P.whatsappNumero;
  const zap = limpar(env.NEXT_PUBLIC_MARCA_WHATSAPP, 30).replace(/\D/g, "");
  if (zap) {
    const comDdi = /^55/.test(zap) && zap.length >= 12 ? zap : "55" + zap;
    if (/^55[1-9][0-9]{9,10}$/.test(comDdi)) whatsappNumero = comDdi;
    else avisos.push("NEXT_PUBLIC_MARCA_WHATSAPP: informe DDD + número, por exemplo 11912345678. Usando o padrão.");
  }

  let foto: string = P.foto;
  const f = limpar(env.NEXT_PUBLIC_MARCA_FOTO, 500);
  if (f) {
    if (/^\/[A-Za-z0-9_\-./]+\.(jpe?g|png|webp|avif|svg)$/i.test(f) && !f.includes("..")) foto = f;
    else if (/^https:\/\/[^\s"'<>]+$/i.test(f)) foto = f;
    else avisos.push("NEXT_PUBLIC_MARCA_FOTO: use um caminho de /public (ex.: /foto.jpg) ou um endereço https. Usando o padrão.");
  }

  const cor = (nome: string, valor: string | undefined, padrao: string) => {
    const v = limpar(valor, 20);
    if (!v) return padrao;
    if (!HEX.test(v)) {
      avisos.push(`${nome}: use o formato #rrggbb. Usando o padrão.`);
      return padrao;
    }
    return v.toLowerCase();
  };
  let principal = cor("NEXT_PUBLIC_MARCA_COR", env.NEXT_PUBLIC_MARCA_COR, P.cores.principal);
  // Textos escuros ficam sobre a cor principal (cabeçalho, selos): ela não pode ser escura demais.
  if (contraste(principal, TINTA) < 3) {
    avisos.push("NEXT_PUBLIC_MARCA_COR: cor escura demais para os textos do cabeçalho (use uma cor mais viva ou clara). Usando o padrão.");
    principal = P.cores.principal;
  }
  const destaque = cor("NEXT_PUBLIC_MARCA_COR_DESTAQUE", env.NEXT_PUBLIC_MARCA_COR_DESTAQUE, P.cores.destaque);

  const bio1 = texto("NEXT_PUBLIC_MARCA_BIO", env.NEXT_PUBLIC_MARCA_BIO, P.bio[0], 280, 10);
  const bio2 = texto("NEXT_PUBLIC_MARCA_BIO2", env.NEXT_PUBLIC_MARCA_BIO2, P.bio[1], 280, 10);
  // Bio personalizada sem a segunda parte: não mistura o texto da Moni com o de outra pessoa.
  const bioPropria = Boolean(limpar(env.NEXT_PUBLIC_MARCA_BIO, 10));
  const bio: [string, string] = bioPropria && !limpar(env.NEXT_PUBLIC_MARCA_BIO2, 10) ? [bio1, ""] : [bio1, bio2];

  return {
    nomeSite,
    artigoSite: artigo("NEXT_PUBLIC_MARCA_ARTIGO_SITE", env.NEXT_PUBLIC_MARCA_ARTIGO_SITE, P.artigoSite),
    nomePessoa,
    apelido,
    artigoPessoa: artigo("NEXT_PUBLIC_MARCA_ARTIGO", env.NEXT_PUBLIC_MARCA_ARTIGO, P.artigoPessoa),
    instagramUsuario,
    whatsappNumero,
    foto,
    bio,
    descricaoSite: texto("NEXT_PUBLIC_MARCA_DESCRICAO", env.NEXT_PUBLIC_MARCA_DESCRICAO, P.descricaoSite, 200, 10),
    cores: { principal, destaque },
    avisos,
  };
}

// O Next.js só troca NEXT_PUBLIC_* quando o nome está escrito por extenso: por isso a lista literal.
export const MARCA: ConfigMarca = criarMarca({
  NEXT_PUBLIC_MARCA_NOME_SITE: process.env.NEXT_PUBLIC_MARCA_NOME_SITE,
  NEXT_PUBLIC_MARCA_ARTIGO_SITE: process.env.NEXT_PUBLIC_MARCA_ARTIGO_SITE,
  NEXT_PUBLIC_MARCA_NOME_PESSOA: process.env.NEXT_PUBLIC_MARCA_NOME_PESSOA,
  NEXT_PUBLIC_MARCA_APELIDO: process.env.NEXT_PUBLIC_MARCA_APELIDO,
  NEXT_PUBLIC_MARCA_ARTIGO: process.env.NEXT_PUBLIC_MARCA_ARTIGO,
  NEXT_PUBLIC_MARCA_INSTAGRAM: process.env.NEXT_PUBLIC_MARCA_INSTAGRAM,
  NEXT_PUBLIC_MARCA_WHATSAPP: process.env.NEXT_PUBLIC_MARCA_WHATSAPP,
  NEXT_PUBLIC_MARCA_FOTO: process.env.NEXT_PUBLIC_MARCA_FOTO,
  NEXT_PUBLIC_MARCA_BIO: process.env.NEXT_PUBLIC_MARCA_BIO,
  NEXT_PUBLIC_MARCA_BIO2: process.env.NEXT_PUBLIC_MARCA_BIO2,
  NEXT_PUBLIC_MARCA_DESCRICAO: process.env.NEXT_PUBLIC_MARCA_DESCRICAO,
  NEXT_PUBLIC_MARCA_COR: process.env.NEXT_PUBLIC_MARCA_COR,
  NEXT_PUBLIC_MARCA_COR_DESTAQUE: process.env.NEXT_PUBLIC_MARCA_COR_DESTAQUE,
});

// ---------------------------------------------------------------------------
// Frases que concordam com o gênero do nome (a Moni / o João)
// ---------------------------------------------------------------------------
const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

export function frases(m: Pick<ConfigMarca, "nomeSite" | "artigoSite" | "apelido" | "artigoPessoa">) {
  const f = m.artigoPessoa === "a";
  const a = `${m.artigoPessoa} ${m.apelido}`;
  return {
    /** "a Moni" / "o João" */ a,
    /** "A Moni" / "O João" */ A: maiuscula(a),
    /** "da Moni" / "do João" */ da: `${f ? "da" : "do"} ${m.apelido}`,
    /** "pra Moni" / "pro João" */ pra: `${f ? "pra" : "pro"} ${m.apelido}`,
    /** "pela Moni" / "pelo João" */ pela: `${f ? "pela" : "pelo"} ${m.apelido}`,
    /** "a Vitrine da Moni" / "o Achados do João" */ site: `${m.artigoSite} ${m.nomeSite}`,
    /** "A Vitrine da Moni" / "O Achados do João" */ siteComArtigo: `${maiuscula(m.artigoSite)} ${m.nomeSite}`,
    /** "na Vitrine da Moni" / "no Achados do João" */ noSite: `${m.artigoSite === "a" ? "na" : "no"} ${m.nomeSite}`,
    /** "da Vitrine da Moni" / "do Achados do João" */ doSite: `${m.artigoSite === "a" ? "da" : "do"} ${m.nomeSite}`,
  };
}

export const F = frases(MARCA);
