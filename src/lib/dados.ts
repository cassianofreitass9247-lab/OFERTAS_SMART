// Leituras públicas do site (visitante anônimo). As políticas do banco garantem
// que só produtos publicados e categorias ativas saiam daqui.
import type { Categoria, HistoricoPreco, Produto } from "./database.types";
import { clientePublico } from "./supabase/publico";
import { escaparBusca } from "./texto";

export const POR_PAGINA = 24;

export const ORDENACOES = {
  recentes: "Mais recentes",
  "menor-preco": "Menor preço",
  "maior-desconto": "Maior desconto",
} as const;
export type Ordenacao = keyof typeof ORDENACOES;

export const COLUNAS_CARTAO =
  "id, nome, slug, imagem_url, categoria_id, preco_atual, preco_anterior, preco_anterior_em, desconto_percentual, ficticio, disponibilidade, destaque" as const;

export type ProdutoCartao = Pick<
  Produto,
  | "id" | "nome" | "slug" | "imagem_url" | "categoria_id" | "preco_atual" | "preco_anterior"
  | "preco_anterior_em" | "desconto_percentual" | "ficticio" | "disponibilidade" | "destaque"
>;

export type Filtros = {
  busca?: string;
  categoriaId?: string;
  soPromocoes?: boolean;
  soDestaques?: boolean;
  precoMax?: number;
  ordenar?: Ordenacao;
  pagina?: number;
  limite?: number;
};

function falha(contexto: string, mensagem: string): never {
  throw new Error(`Não foi possível carregar ${contexto}: ${mensagem}`);
}

export async function listarCategorias(): Promise<Categoria[]> {
  const sb = clientePublico();
  if (!sb) return [];
  const { data, error } = await sb.from("categorias").select("*").eq("ativa", true).order("nome");
  if (error) falha("as categorias", error.message);
  return data;
}

export async function listarProdutos(f: Filtros = {}): Promise<{ itens: ProdutoCartao[]; total: number }> {
  const sb = clientePublico();
  if (!sb) return { itens: [], total: 0 };

  const limite = f.limite ?? POR_PAGINA;
  const pagina = Math.max(1, f.pagina ?? 1);
  let q = sb.from("produtos").select(COLUNAS_CARTAO, { count: "exact" }).eq("status_publicacao", "publicado");

  const busca = f.busca?.trim().slice(0, 80);
  if (busca) q = q.ilike("nome", `%${escaparBusca(busca)}%`);
  if (f.categoriaId) q = q.eq("categoria_id", f.categoriaId);
  if (f.soPromocoes) q = q.not("desconto_percentual", "is", null);
  if (f.soDestaques) q = q.eq("destaque", true);
  if (f.precoMax && f.precoMax > 0) q = q.lte("preco_atual", f.precoMax);

  if (f.ordenar === "menor-preco") q = q.order("preco_atual", { ascending: true });
  else if (f.ordenar === "maior-desconto") q = q.order("desconto_percentual", { ascending: false, nullsFirst: false });
  q = q.order("criado_em", { ascending: false }).order("id");

  const inicio = (pagina - 1) * limite;
  const { data, error, count } = await q.range(inicio, inicio + limite - 1);
  // Página além do fim: o PostgREST responde 416; tratamos como lista vazia.
  if (error && error.code === "PGRST103") return { itens: [], total: 0 };
  if (error) falha("as ofertas", error.message);
  return { itens: data, total: count ?? data.length };
}

export async function obterProduto(slug: string): Promise<Produto | null> {
  const sb = clientePublico();
  if (!sb) return null;
  const { data, error } = await sb
    .from("produtos")
    .select("*")
    .eq("slug", slug)
    .eq("status_publicacao", "publicado")
    .maybeSingle();
  if (error) falha("o produto", error.message);
  return data;
}

export async function historicoDePrecos(produtoId: string, limite = 12): Promise<HistoricoPreco[]> {
  const sb = clientePublico();
  if (!sb) return [];
  const { data, error } = await sb
    .from("historico_precos")
    .select("*")
    .eq("produto_id", produtoId)
    .order("registrado_em", { ascending: false })
    .limit(limite);
  if (error) falha("o histórico de preços", error.message);
  return data;
}

export async function slugsParaSitemap(): Promise<{ produtos: { slug: string; atualizado_em: string }[]; categorias: string[] }> {
  const sb = clientePublico();
  if (!sb) return { produtos: [], categorias: [] };
  const [p, c] = await Promise.all([
    sb.from("produtos").select("slug, atualizado_em").eq("status_publicacao", "publicado").eq("ficticio", false).order("atualizado_em", { ascending: false }).limit(5000),
    sb.from("categorias").select("slug").eq("ativa", true),
  ]);
  return { produtos: p.data ?? [], categorias: (c.data ?? []).map((x) => x.slug) };
}
