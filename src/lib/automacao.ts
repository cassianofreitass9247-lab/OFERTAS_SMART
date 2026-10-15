import type { SupabaseClient } from "@supabase/supabase-js";
import { categoriaAutomatica, EXCLUSOES_POR_CATEGORIA, semAcento, termosDeBusca, type CategoriaBasica } from "./categoria-auto";
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

/**
 * Orçamento de consultas por execução: o plano gratuito do Cloudflare limita ~50 chamadas externas. Gastamos
 * 6 categorias x 2 termos x 3 páginas = 36 à Shopee, mais 3 ao banco (estado, existentes, registrar).
 */
export const CATEGORIAS_POR_EXECUCAO = 6;
export const TERMOS_POR_CATEGORIA = 2;
export const PAGINAS_POR_TERMO = 3;
/** Produtos mais baratos que isso (em R$) não entram sozinhos: costumam ser acessórios de pouco valor. */
export const PRECO_MINIMO_AUTOMATICO = 15;

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

export const NOMES_DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"] as const;
export const NOMES_DIAS_CURTOS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;

/**
 * Próxima execução agendada, em horário de Brasília: o primeiro dia escolhido (a partir de hoje) cuja hora ainda não
 * passou, ou hoje mesmo se a hora já passou mas hoje ainda não rodou (o agendamento recupera na próxima hora cheia).
 */
export function proximaExecucao(dias: number[], hora: number, agoraMs: number, ultimaAgendada: string | null): { dia: Date; texto: string } | null {
  const validos = new Set(dias.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6));
  if (validos.size === 0) return null;
  const br = new Date(agoraMs - 3 * 3600_000); // lido com getUTC*, que aqui é o relógio de Brasília
  const hojeIso = br.toISOString().slice(0, 10);
  for (let i = 0; i < 8; i++) {
    const dia = new Date(Date.UTC(br.getUTCFullYear(), br.getUTCMonth(), br.getUTCDate() + i));
    if (!validos.has(dia.getUTCDay())) continue;
    if (i === 0) {
      if (ultimaAgendada === hojeIso) continue; // hoje já rodou
      const rotulo = br.getUTCHours() >= hora ? "hoje, na próxima hora cheia" : `hoje às ${String(hora).padStart(2, "0")}h`;
      return { dia, texto: rotulo };
    }
    const nome = i === 1 ? "amanhã" : NOMES_DIAS[dia.getUTCDay()];
    return { dia, texto: `${nome} (${String(dia.getUTCDate()).padStart(2, "0")}/${String(dia.getUTCMonth() + 1).padStart(2, "0")}) às ${String(hora).padStart(2, "0")}h` };
  }
  return null;
}

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
  | { status: "fora_do_horario" }
  | { status: "limite"; criadosHoje: number }
  | { status: "ok"; criados: number; ignorados: number; consultadas: number; falhas: number; avisos: string[] }
  | { status: "erro"; erro: string };

/** Termo de busca de uma categoria: o nome sem ano ("Natal 2026" -> "Natal"). */
export const termoDaCategoria = (nome: string) => nome.replace(/\b20\d{2}\b/g, "").replace(/\s+/g, " ").trim();

/** Termos do dia para uma categoria: avança pela lista a cada dia, para não buscar sempre os mesmos produtos. */
export function termosDoDia(cat: CategoriaBasica, dia: number, quantos = TERMOS_POR_CATEGORIA): string[] {
  const todos = termosDeBusca(cat);
  const n = Math.min(quantos, todos.length);
  return Array.from({ length: n }, (_, j) => todos[(((dia * quantos + j) % todos.length) + todos.length) % todos.length]);
}

/** Dia corrente no fuso de Brasília (UTC-3), em dias desde 1970. */
export const diaDeBrasilia = (agoraMs: number) => Math.floor((agoraMs - 3 * 3600_000) / 86_400_000);

const temExclusao = (nome: string, slug: string) => {
  const termos = EXCLUSOES_POR_CATEGORIA[slug];
  if (!termos) return false;
  const texto = ` ${semAcento(nome)} `;
  return termos.some((t) => texto.includes(` ${t} `));
};

const porDescontoEVendas = (a: Oferta, b: Oferta) => (b.desconto ?? 0) - (a.desconto ?? 0) || (b.vendas ?? 0) - (a.vendas ?? 0);

export async function executarAutomacao(
  sb: Cliente,
  chave: string,
  opcoes: { env?: Ambiente; buscar?: (url: string, init: RequestInit) => Promise<Response>; agora?: () => number; agendada?: boolean } = {},
): Promise<ResultadoAutomacao> {
  // Execução do agendamento (de hora em hora): o banco diz se é a vez de rodar hoje (dia, hora e "ainda não rodou").
  if (opcoes.agendada) {
    const { data: vez, error: erroVez } = await sb.rpc("automacao_reivindicar", { p_chave: chave });
    if (erroVez) return { status: "erro", erro: erroVez.message };
    if (!vez) return { status: "fora_do_horario" };
  }
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
  const dia = diaDeBrasilia((opcoes.agora ?? Date.now)());

  const filas: { cat: CategoriaBasica; ofertas: Oferta[] }[] = [];
  const avisos: string[] = [];
  let falhas = 0;
  let consultadas = 0;
  let ultimoErro = "";
  for (const cat of escolhidas) {
    const achadas = new Map<string, Oferta>();
    let falhouTodas = true;
    for (const termo of termosDoDia(cat, dia)) {
      try {
        const r = await buscarVariasPaginas({ termo, ordem: "vendas", de: 1, paginas: PAGINAS_POR_TERMO }, { env: opcoes.env, buscar: opcoes.buscar, agora: opcoes.agora });
        falhouTodas = false;
        if (r.aviso) avisos.push(`${cat.nome} (${termo}): ${r.aviso}`);
        for (const o of r.ofertas) if (!achadas.has(o.itemId)) achadas.set(o.itemId, o);
      } catch (e) {
        ultimoErro = e instanceof Error ? e.message : "erro";
        avisos.push(`${cat.nome} (${termo}): ${ultimoErro}`);
      }
    }
    if (falhouTodas) {
      falhas++;
      continue;
    }
    consultadas += achadas.size;
    const boas = [...achadas.values()]
      .filter((o) => o.linkAfiliado && o.imagemUrl)
      .filter((o) => {
        const preco = precoDaOferta(o);
        return preco !== null && preco >= PRECO_MINIMO_AUTOMATICO;
      })
      .filter((o) => passaNosFiltros(o, filtros) && !nomeBloqueado(o.nome) && !temExclusao(o.nome, cat.slug))
      .filter((o) => categoriaAutomatica(o.nome, cats) === cat.id)
      .sort(porDescontoEVendas);
    filas.push({ cat, ofertas: boas });
  }
  if (falhas === quantas) return falhar(ultimoErro || "A Shopee não respondeu.");

  // Tira os que já existem no site: sem isso, os de maior desconto são sempre os mesmos e a cota se perde em repetidos.
  const candidatos = [...new Set(filas.flatMap((f) => f.ofertas.map((o) => `${o.shopId}.${o.itemId}`)))];
  if (candidatos.length > 0) {
    const { data: ja, error: erroJa } = await sb.rpc("automacao_existentes", { p_chave: chave, p_ids: candidatos.slice(0, 1000) });
    if (erroJa) return { status: "erro", erro: erroJa.message };
    const existentes = new Set((ja ?? []) as string[]);
    for (const f of filas) f.ofertas = f.ofertas.filter((o) => !existentes.has(`${o.shopId}.${o.itemId}`));
  }

  // Intercala as categorias (uma de cada vez): a cota se divide entre elas e o que uma não preenche vai para as outras.
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
