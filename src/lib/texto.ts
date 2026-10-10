/** Transforma um texto em trecho de URL: "Fone Bluetooth Pró" -> "fone-bluetooth-pro". */
export function slugify(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

/** Slug único para produto: nome + sufixo aleatório curto. */
export function gerarSlugProduto(nome: string): string {
  const base = slugify(nome) || "produto";
  const sufixo = crypto.randomUUID().replace(/-/g, "").slice(0, 6);
  return `${base}-${sufixo}`;
}

/**
 * Lê preço no formato brasileiro ou internacional.
 * "R$ 1.234,56" -> 1234.56 | "59,9" -> 59.9 | "1234.56" -> 1234.56 | "1.234" -> 1234
 * Devolve null quando o valor é ambíguo ou inválido (nunca "chuta").
 */
export function lerPreco(entrada: string | number | null | undefined): number | null {
  if (entrada === null || entrada === undefined) return null;
  let s = String(entrada).trim().replace(/^R\$\s*/i, "").replace(/\s/g, "");
  if (!/^\d[\d.,]*$/.test(s)) return null;

  const virgula = s.lastIndexOf(",");
  const ponto = s.lastIndexOf(".");
  if (virgula >= 0 && ponto >= 0) {
    const decimal = virgula > ponto ? "," : ".";
    const milhar = decimal === "," ? "." : ",";
    s = s.split(milhar).join("").replace(decimal, ".");
  } else if (virgula >= 0) {
    if ((s.match(/,/g) ?? []).length > 1) return null;
    s = s.replace(",", ".");
  } else if (ponto >= 0) {
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.split(".").join("");
    else if ((s.match(/\./g) ?? []).length > 1) return null;
  }

  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0 || n > 9_999_999_999.99) return null;
  return Math.round(n * 100) / 100;
}

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const formatarPreco = (valor: number) => BRL.format(valor).replace(/ /g, " ");

const DATA = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" });
const DATA_HORA = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
export const formatarData = (iso: string) => DATA.format(new Date(iso));
export const formatarDataHora = (iso: string) => DATA_HORA.format(new Date(iso));

/** Escapa os curingas do LIKE para que a busca trate o texto literalmente. */
export const escaparBusca = (termo: string) => termo.replace(/[\\%_]/g, (c) => "\\" + c);

/** Aceita somente letras, números, "-" e "_" (usado em canal e campanha de cliques). */
export function limparRotulo(valor: string | null | undefined, max: number): string | null {
  if (!valor) return null;
  const limpo = valor.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, max);
  return limpo || null;
}

export const EH_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
