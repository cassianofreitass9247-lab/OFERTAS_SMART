import type { SupabaseClient } from "@supabase/supabase-js";
import { categoriaAutomatica, type CategoriaBasica } from "./categoria-auto";
import type { Database } from "./database.types";
import { nomeBloqueado, passaNosFiltros, type FiltrosLote } from "./lote";
import { buscarVariasPaginas, precoDaOferta, type Oferta } from "./shopee";
import { gerarSlugProduto } from "./texto";

/**
 * Modo automático: uma vez por dia (agendamento do Cloudflare) busca na Shopee os produtos mais vendidos e com
 * maior desconto de cada categoria que já existe no site e publica até o limite diário. Também roda pelo botão
 * "Rodar agora" do painel. Tudo passa pelas funções automacao_* do banco, que conferem a chave, o "ligado" e o limite.
 *
 * Só publica produto com foto, preço, link de afiliado válido e sem termo da lista de bloqueio; o resto é ignorado
 * (não vira rascunho, para não encher o painel). O produto só entra se o nome combinar com a categoria buscada.
 */

type Ambiente = Record<string, string | undefined>;
type Cliente = SupabaseClient<Database>;

/** Categorias consultadas por execução (cada uma gasta 2 consultas à Shopee; o plano gratuito limita ~50 chamadas por execução). */
export const CATEGORIAS_POR_EXECUCAO = 6;
export const PAGINAS_POR_CATEGORIA = 2;

async function sha256Hex(texto: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Chave da automação, derivada do segredo da Shopee (que só o servidor conhece). Sem segredo, a automação não existe. */
export async function chaveDaAutomacao(env: Ambiente = process.env): Promise<string | null> {
  const segredo = (env.SHOPEE_SECRET ?? "").trim();
  return segredo ? sha256Hex(`vitrine-da-moni/automacao/${segredo}`) : null;
}
export const hashDaChaveAutomacao = sha256Hex;

/** Comparação sem pistas de tempo. */
export function chavesIguais(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

type Estado = {
  ativo: boolean;
  limite_diario: number;
  criados_hoje: number;
  vendas_min: number;
  nota_min: number;
  desconto_min: number;
  comissao_min: number;
  cursor: number;
  categorias: CategoriaBasica[];
};

export type ResultadoAutomacao =
  | { status: "pausada" }
  | { status: "limite"; criadosHoje: number }
  | { status: "ok"; criados: number; ignorados: number; consultadas: number; falhas: number; avisos: string[] }
  | { status: "erro"; erro: string };

/** Termo de busca de uma categoria: o nome sem ano ("Natal 2026" -> "Natal"). */
export const termoDaCategoria = (nome: string) => nome.replace(/\b20\d{2}\b/g, "").replace(/\s+/g, " ").trim();

const porDescontoEVendas = (a: Oferta, b: Oferta) => (b.desconto ?? 0) - (a.desconto ?? 0) || (b.vendas ?? 0) - (a.vendas ?? 0);

export async function executarAutomacao(
  sb: Cliente,
  chave: string,
  opcoes: { env?: Ambiente; buscar?: (url: string, init: RequestInit) => Promise<Response>; agora?: () => number } = {},
): Promise<ResultadoAutomacao> {
  const { data, error } = await sb.rpc("automacao_estado", { p_chave: chave });
  if (error || !data) return { status: "erro", erro: error?.message ?? "Não foi possível ler a configuração da automação." };
  const estado = data as unknown as Estado;
  if (!estado.ativo) return { status: "pausada" };

  const restante = estado.limite_diario - estado.criados_hoje;
  const falhar = async (msg: string): Promise<ResultadoAutomacao> => {
    await sb.rpc("automacao_falha", { p_chave: chave, p_msg: msg });
    return { status: "erro", erro: msg };
  };
  if (restante <= 0) {
    await sb.rpc("automacao_registrar", { p_chave: chave, p_itens: [], p_filtros: {}, p_cursor: estado.cursor });
    return { status: "limite", criadosHoje: estado.criados_hoje };
  }
  const cats = estado.categorias;
  if (cats.length === 0) return falhar("Nenhuma categoria ativa no site para buscar.");

  const filtros: FiltrosLote = { vendasMin: estado.vendas_min, notaMin: Number(estado.nota_min), descontoMin: estado.desconto_min, comissaoMin: Number(estado.comissao_min) };
  const quantas = Math.min(CATEGORIAS_POR_EXECUCAO, cats.length);
  const escolhidas = Array.from({ length: quantas }, (_, i) => cats[(estado.cursor + i) % cats.length]);
  const novoCursor = (estado.cursor + quantas) % cats.length;
  const porCategoria = Math.ceil(restante / quantas) + 2; // folga para os que o banco ignorar (duplicados)

  const filas: { cat: CategoriaBasica; ofertas: Oferta[] }[] = [];
  const avisos: string[] = [];
  let falhas = 0;
  let consultadas = 0;
  let ultimoErro = "";
  for (const cat of escolhidas) {
    try {
      const r = await buscarVariasPaginas({ termo: termoDaCategoria(cat.nome), ordem: "vendas", de: 1, paginas: PAGINAS_POR_CATEGORIA }, { env: opcoes.env, buscar: opcoes.buscar, agora: opcoes.agora });
      consultadas += r.ofertas.length;
      if (r.aviso) avisos.push(`${cat.nome}: ${r.aviso}`);
      const boas = r.ofertas
        .filter((o) => o.linkAfiliado && o.imagemUrl && precoDaOferta(o) !== null)
        .filter((o) => passaNosFiltros(o, filtros) && !nomeBloqueado(o.nome))
        .filter((o) => categoriaAutomatica(o.nome, cats) === cat.id)
        .sort(porDescontoEVendas)
        .slice(0, porCategoria);
      filas.push({ cat, ofertas: boas });
    } catch (e) {
      falhas++;
      ultimoErro = e instanceof Error ? e.message : "erro";
      avisos.push(`${cat.nome}: ${ultimoErro}`);
    }
  }
  if (falhas === quantas) return falhar(ultimoErro || "A Shopee não respondeu.");

  // Intercala as categorias (uma de cada vez) para a cota ser dividida entre elas.
  const itens: Database["public"]["Functions"]["automacao_registrar"]["Args"]["p_itens"][] = [];
  const vistos = new Set<string>();
  for (let rodada = 0; itens.length < restante && filas.some((f) => rodada < f.ofertas.length); rodada++) {
    for (const f of filas) {
      const o = f.ofertas[rodada];
      if (!o || vistos.has(o.itemId) || itens.length >= restante) continue;
      vistos.add(o.itemId);
      itens.push({
        nome: o.nome,
        link: o.linkAfiliado,
        imagem: o.imagemUrl,
        id_externo: `${o.shopId}.${o.itemId}`,
        slug: gerarSlugProduto(o.nome),
        preco: precoDaOferta(o),
        categoria_id: f.cat.id,
      });
    }
  }

  const { data: reg, error: erroReg } = await sb.rpc("automacao_registrar", {
    p_chave: chave,
    p_itens: itens,
    p_filtros: { automatico: true, categorias: escolhidas.map((c) => c.nome), ...filtros },
    p_cursor: novoCursor,
  });
  if (erroReg) return { status: "erro", erro: erroReg.message };
  const r = reg as unknown as { criados: number };
  return { status: "ok", criados: r.criados, ignorados: Math.max(consultadas - r.criados, 0), consultadas, falhas, avisos };
}
