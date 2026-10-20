// Regras de exibição dos cupons (texto do benefício, regra de uso e validade). Sem acesso a banco.
import type { Cupom } from "./database.types";
import { linkAfiliadoValido } from "./produto";
import { EH_UUID, formatarPreco, lerPreco } from "./texto";

export type CupomExibivel = Pick<Cupom, "tipo" | "valor" | "teto" | "minimo_compra" | "valido_ate">;

const DIA = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });
const DIA_MES = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });

const numero = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2).replace(".", ","));

/** Destaque do cartão: "10% OFF", "R$ 15 OFF" ou "Frete grátis". */
export function beneficio(c: Pick<Cupom, "tipo" | "valor">): string {
  if (c.tipo === "percentual" && c.valor) return `${numero(c.valor)}% OFF`;
  if (c.tipo === "valor" && c.valor) return `${formatarPreco(c.valor).replace(",00", "")} OFF`;
  if (c.tipo === "frete") return "Frete grátis";
  return "Cupom";
}

/** Regra em uma linha: "Compras acima de R$ 50 · desconto de até R$ 20". */
export function regra(c: Pick<Cupom, "tipo" | "teto" | "minimo_compra">): string | null {
  const partes: string[] = [];
  if (c.minimo_compra && c.minimo_compra > 0) partes.push(`Compras a partir de ${formatarPreco(c.minimo_compra).replace(",00", "")}`);
  if (c.teto && c.tipo === "percentual") partes.push(`desconto de até ${formatarPreco(c.teto).replace(",00", "")}`);
  return partes.length ? partes.join(" · ") : null;
}

/** Dias de calendário (fuso de Brasília) entre agora e o fim da validade: 0 = vence hoje. */
export function diasParaVencer(validoAte: string, agora: Date = new Date()): number {
  const dia = (d: Date) => Date.parse(DIA.format(d) + "T00:00:00Z");
  return Math.round((dia(new Date(validoAte)) - dia(agora)) / 86_400_000);
}

export function validade(validoAte: string, agora: Date = new Date()): { texto: string; urgente: boolean } {
  const d = diasParaVencer(validoAte, agora);
  if (d <= 0) return { texto: "Expira hoje", urgente: true };
  if (d === 1) return { texto: "Expira amanhã", urgente: true };
  if (d <= 3) return { texto: `Expira em ${d} dias`, urgente: true };
  return { texto: `Válido até ${DIA_MES.format(new Date(validoAte))}`, urgente: false };
}

// ---------------------------------------------------------------------------
// Validação do formulário do painel
// ---------------------------------------------------------------------------
export const TIPOS_CUPOM = ["percentual", "valor", "frete", "outro"] as const;
export const ROTULO_TIPO: Record<(typeof TIPOS_CUPOM)[number], string> = {
  percentual: "Percentual (ex.: 10% OFF)",
  valor: "Valor em reais (ex.: R$ 15 OFF)",
  frete: "Frete grátis",
  outro: "Outro (só o título aparece)",
};

export type CupomDigitado = {
  titulo: string;
  codigo: string | null;
  link_resgate: string | null;
  tipo: Cupom["tipo"];
  valor: number | null;
  teto: number | null;
  minimo_compra: number | null;
  descricao: string | null;
  categoria_id: string | null;
  valido_de?: string;
  valido_ate: string;
  destaque: boolean;
  ativo: boolean;
};

const EH_DATA = /^\d{4}-\d{2}-\d{2}$/;
const dataValida = (d: string) => EH_DATA.test(d) && !Number.isNaN(Date.parse(`${d}T12:00:00Z`)) && new Date(`${d}T12:00:00Z`).toISOString().startsWith(d);
const hojeEmBrasilia = (agora: Date) => DIA.format(agora);

/**
 * Converte o que foi digitado no painel em dados prontos para gravar. As datas são dias do calendário de Brasília:
 * "válido até 31/10" vale até 23:59:59 daquele dia. `agora` existe só para os testes.
 */
export function lerCupom(f: Record<string, string>, opcoes: { agora?: Date; exigirFuturo?: boolean } = {}): { dados: CupomDigitado } | { erro: string } {
  const agora = opcoes.agora ?? new Date();
  const t = (campo: string) => (f[campo] ?? "").trim();

  const titulo = t("titulo").replace(/\s+/g, " ");
  if (titulo.length < 3 || titulo.length > 120) return { erro: "Título: use de 3 a 120 caracteres." };

  const codigo = t("codigo").replace(/\s+/g, "");
  if (codigo && !/^[A-Za-z0-9_.-]{2,40}$/.test(codigo)) return { erro: "Código: use de 2 a 40 letras, números, ponto, hífen ou sublinhado, sem espaços." };
  const link = t("link_resgate");
  if (link && !linkAfiliadoValido(link)) return { erro: "Link de resgate: use um link https da Shopee (shopee.com.br ou shope.ee)." };
  if (link.length > 2000) return { erro: "Link de resgate: muito longo." };
  if (!codigo && !link) return { erro: "Informe o código do cupom, o link de resgate, ou os dois." };

  const tipo = t("tipo") as Cupom["tipo"];
  if (!TIPOS_CUPOM.includes(tipo)) return { erro: "Tipo de cupom inválido." };

  let valor: number | null = null;
  if (tipo === "percentual" || tipo === "valor") {
    valor = lerPreco(t("valor"));
    if (valor === null) return { erro: tipo === "percentual" ? "Valor: informe a porcentagem (ex.: 10)." : "Valor: informe o desconto em reais (ex.: 15 ou 12,50)." };
    if (tipo === "percentual" && valor > 100) return { erro: "Valor: a porcentagem não pode passar de 100." };
  }

  const opcional = (campo: string, rotulo: string): { v: number | null } | { erro: string } => {
    const bruto = t(campo);
    if (!bruto || /^0+([.,]0+)?$/.test(bruto)) return { v: null };
    const n = lerPreco(bruto);
    return n === null ? { erro: `${rotulo}: valor inválido (exemplos: 50 ou 49,90).` } : { v: n };
  };
  const m = opcional("minimo_compra", "Compra mínima");
  if ("erro" in m) return m;
  let teto: number | null = null;
  if (tipo === "percentual") {
    const r = opcional("teto", "Desconto máximo");
    if ("erro" in r) return r;
    teto = r.v;
  }

  const descricao = t("descricao");
  if (descricao.length > 500) return { erro: "Descrição: máximo de 500 caracteres." };

  const categoria = t("categoria_id");
  if (categoria && !EH_UUID.test(categoria)) return { erro: "Categoria inválida." };

  const ate = t("valido_ate");
  if (!dataValida(ate)) return { erro: "Válido até: informe uma data válida." };
  if (opcoes.exigirFuturo && ate < hojeEmBrasilia(agora)) return { erro: "Válido até: a data já passou." };
  const de = t("valido_de");
  if (de && !dataValida(de)) return { erro: "Começa em: data inválida." };
  if (de && de > ate) return { erro: "Começa em: precisa ser antes (ou no mesmo dia) do fim da validade." };

  return {
    dados: {
      titulo,
      codigo: codigo || null,
      link_resgate: link || null,
      tipo,
      valor,
      teto,
      minimo_compra: m.v,
      descricao: descricao || null,
      categoria_id: categoria || null,
      ...(de ? { valido_de: `${de}T00:00:00-03:00` } : {}),
      valido_ate: `${ate}T23:59:59-03:00`,
      destaque: f.destaque === "on",
      ativo: f.ativo === "on",
    },
  };
}
