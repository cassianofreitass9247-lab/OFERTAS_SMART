import { z } from "zod";
import { lerCsv } from "./csv";
import { gerarSlugProduto, lerPreco, slugify } from "./texto";
import { analisarVideo, SITES_DE_VIDEO } from "./video";

/**
 * Domínios aceitos para links de afiliado. Só entram links gerados no painel
 * oficial da Shopee Brasil. Para aceitar outro domínio oficial, acrescente aqui.
 */
export const DOMINIOS_AFILIADO = ["shopee.com.br", "shope.ee"] as const;

export function linkAfiliadoValido(valor: string): boolean {
  let url: URL;
  try {
    url = new URL(valor);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
  const host = url.hostname.toLowerCase();
  return DOMINIOS_AFILIADO.some((d) => host === d || host.endsWith("." + d));
}

const urlHttps = (valor: string) => {
  try {
    return new URL(valor).protocol === "https:";
  } catch {
    return false;
  }
};

const textoOpcional = (max: number, rotulo: string) =>
  z
    .string()
    .trim()
    .max(max, `${rotulo}: máximo de ${max} caracteres`)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional()
    .transform((v) => v ?? null);

export const produtoSchema = z.object({
  nome: z.string().trim().min(3, "Nome: mínimo de 3 caracteres").max(200, "Nome: máximo de 200 caracteres"),
  link_afiliado: z
    .string()
    .trim()
    .max(2000, "Link: muito longo")
    .refine(linkAfiliadoValido, "Link de afiliado: use um link https gerado no painel da Shopee (shopee.com.br ou shope.ee)"),
  preco_atual: z
    .union([z.string(), z.number()])
    .transform((v) => lerPreco(v))
    .refine((v): v is number => v !== null, "Preço: valor inválido (exemplos aceitos: 59,90 ou 1.234,56)"),
  descricao: textoOpcional(5000, "Descrição"),
  imagem_url: textoOpcional(2000, "Imagem").refine((v) => v === null || urlHttps(v), "Imagem: o endereço precisa começar com https://"),
  video_url: textoOpcional(2000, "Vídeo").refine((v) => v === null || analisarVideo(v) !== null, `Vídeo: use um link do ${SITES_DE_VIDEO}`),
  id_externo: textoOpcional(64, "ID do produto na Shopee").refine((v) => v === null || /^[\w.-]+$/.test(v), "ID do produto na Shopee: use apenas letras, números, ponto, hífen ou _"),
});

export type ProdutoValidado = z.infer<typeof produtoSchema>;

export const primeiroErro = (erro: z.ZodError) => erro.issues[0]?.message ?? "Dados inválidos";

// ---------------------------------------------------------------------------
// Importação por CSV
// ---------------------------------------------------------------------------

export const MAX_LINHAS_CSV = 2000;

const APELIDOS: Record<string, string> = {
  nome: "nome", titulo: "nome", produto: "nome",
  link_afiliado: "link_afiliado", link: "link_afiliado", link_de_afiliado: "link_afiliado",
  preco_atual: "preco_atual", preco: "preco_atual",
  categoria: "categoria",
  descricao: "descricao",
  imagem_url: "imagem_url", imagem: "imagem_url",
  video_url: "video_url", video: "video_url", link_video: "video_url",
  id_externo: "id_externo", id_shopee: "id_externo", item_id: "id_externo",
  publicar: "publicar",
  preco_anterior: "preco_anterior", preco_original: "preco_anterior",
};

export type ItemImportacao = {
  nome: string;
  slug: string;
  preco_atual: number;
  link_afiliado: string;
  descricao: string | null;
  imagem_url: string | null;
  video_url: string | null;
  id_externo: string | null;
  categoria_nome: string | null;
  categoria_slug: string | null;
  status: "rascunho" | "publicado";
};

export type ErroLinha = { linha: number; motivo: string };

export type ResultadoCsv = {
  itens: ItemImportacao[];
  /** Número da linha do arquivo de cada item (mesma ordem de "itens"). */
  linhas: number[];
  erros: ErroLinha[];
  avisos: string[];
  totalLinhas: number;
  erroGeral?: string;
};

const SIM = new Set(["sim", "s", "1", "true", "x", "publicar", "publicado"]);
const NAO = new Set(["", "nao", "n", "0", "false", "rascunho"]);

export function validarCsv(texto: string, opcoes: { publicarPorPadrao?: boolean } = {}): ResultadoCsv {
  const vazio: ResultadoCsv = { itens: [], linhas: [], erros: [], avisos: [], totalLinhas: 0 };
  const linhas = lerCsv(texto);
  if (linhas.length === 0) return { ...vazio, erroGeral: "O arquivo está vazio." };

  const colunas = linhas[0].map((c) => APELIDOS[slugify(c).replace(/-/g, "_")] ?? null);
  for (const obrigatoria of ["nome", "link_afiliado", "preco_atual"]) {
    if (!colunas.includes(obrigatoria)) {
      return { ...vazio, erroGeral: `Falta a coluna obrigatória "${obrigatoria}" na primeira linha do arquivo.` };
    }
  }
  const dados = linhas.slice(1);
  if (dados.length === 0) return { ...vazio, erroGeral: "O arquivo só tem o cabeçalho, sem produtos." };
  if (dados.length > MAX_LINHAS_CSV) {
    return { ...vazio, erroGeral: `O arquivo tem ${dados.length} produtos. O limite por importação é ${MAX_LINHAS_CSV}; divida em arquivos menores.` };
  }

  const avisos: string[] = [];
  if (colunas.includes("preco_anterior")) {
    avisos.push('A coluna de preço anterior foi ignorada: o "de/por" só aparece quando o próprio sistema registra uma queda de preço.');
  }
  const ignoradas = linhas[0].filter((_, i) => colunas[i] === null).map((c) => c.trim()).filter(Boolean);
  if (ignoradas.length) avisos.push(`Colunas não reconhecidas e ignoradas: ${ignoradas.join(", ")}.`);

  const itens: ItemImportacao[] = [];
  const linhasItens: number[] = [];
  const erros: ErroLinha[] = [];
  const linksVistos = new Map<string, number>();
  const idsVistos = new Map<string, number>();

  dados.forEach((valores, i) => {
    const numero = i + 2; // linha 1 é o cabeçalho
    const bruto: Record<string, string> = {};
    colunas.forEach((col, j) => {
      if (col) bruto[col] = (valores[j] ?? "").trim();
    });

    const r = produtoSchema.safeParse(bruto);
    if (!r.success) return void erros.push({ linha: numero, motivo: primeiroErro(r.error) });
    const p = r.data;

    const publicar = slugify(bruto.publicar ?? "");
    let status: ItemImportacao["status"] = opcoes.publicarPorPadrao ? "publicado" : "rascunho";
    if (colunas.includes("publicar") && publicar !== "") {
      if (SIM.has(publicar)) status = "publicado";
      else if (NAO.has(publicar)) status = "rascunho";
      else return void erros.push({ linha: numero, motivo: 'Coluna "publicar": use sim ou não' });
    }

    const categoria = (bruto.categoria ?? "").replace(/\s+/g, " ").trim();
    const categoriaSlug = slugify(categoria);
    if (categoria && (categoria.length < 2 || categoria.length > 60 || !categoriaSlug)) {
      return void erros.push({ linha: numero, motivo: "Categoria: use de 2 a 60 caracteres" });
    }

    const repetidoLink = linksVistos.get(p.link_afiliado);
    if (repetidoLink) return void erros.push({ linha: numero, motivo: `Link repetido (já aparece na linha ${repetidoLink})` });
    const repetidoId = p.id_externo ? idsVistos.get(p.id_externo) : undefined;
    if (repetidoId) return void erros.push({ linha: numero, motivo: `ID do produto repetido (já aparece na linha ${repetidoId})` });
    linksVistos.set(p.link_afiliado, numero);
    if (p.id_externo) idsVistos.set(p.id_externo, numero);

    linhasItens.push(numero);
    itens.push({
      nome: p.nome,
      slug: gerarSlugProduto(p.nome),
      preco_atual: p.preco_atual,
      link_afiliado: p.link_afiliado,
      descricao: p.descricao,
      imagem_url: p.imagem_url,
      video_url: p.video_url,
      id_externo: p.id_externo,
      categoria_nome: categoria || null,
      categoria_slug: categoria ? categoriaSlug : null,
      status,
    });
  });

  return { itens, linhas: linhasItens, erros, avisos, totalLinhas: dados.length };
}
