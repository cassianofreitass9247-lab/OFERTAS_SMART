import { z } from "zod";

/**
 * WhatsApp do visitante: guarda só dígitos, com o 55 na frente.
 * Aceita "(11) 91234-5678", "11912345678" ou "+55 84 98777-9782".
 * Devolve null se não parecer um número brasileiro (DDD + 8 ou 9 dígitos).
 * A mesma regra é aplicada de novo no banco (função criar_pedido).
 */
export function normalizarWhatsapp(valor: string): string | null {
  let d = valor.replace(/\D/g, "");
  if (!d.startsWith("55") || d.length < 12) d = "55" + d;
  if (!/^55[1-9][0-9]{9,10}$/.test(d)) return null;
  // Celular com 9 dígitos começa com 9.
  if (d.length === 13 && d[4] !== "9") return null;
  return d;
}

export function formatarWhatsapp(d: string): string {
  const local = d.startsWith("55") ? d.slice(2) : d;
  const ddd = local.slice(0, 2);
  const num = local.slice(2);
  const meio = num.length === 9 ? 5 : 4;
  return `(${ddd}) ${num.slice(0, meio)}-${num.slice(meio)}`;
}

const urlHttps = (v: string) => {
  try {
    return new URL(v).protocol === "https:";
  } catch {
    return false;
  }
};

export const pedidoSchema = z.object({
  nome: z
    .string()
    .transform((v) => v.replace(/\s+/g, " ").trim())
    .pipe(z.string().min(2, "Nome: escreva pelo menos 2 letras").max(60, "Nome: máximo de 60 caracteres")),
  whatsapp: z
    .string()
    .transform((v) => normalizarWhatsapp(v))
    .refine((v): v is string => v !== null, "WhatsApp: informe DDD + número, por exemplo (11) 91234-5678"),
  descricao: z.string().trim().min(3, "Conte qual produto você procura").max(500, "Descrição: máximo de 500 caracteres"),
  referencia: z
    .string()
    .trim()
    .max(2000, "Link: muito longo")
    .refine((v) => v === "" || urlHttps(v), "Link de exemplo: precisa começar com https://")
    .transform((v) => (v === "" ? null : v)),
  consentimento: z.literal(true, { error: "Marque a autorização para a Moni chamar você no WhatsApp" }),
});

// ---------------------------------------------------------------------------
// Resposta pelo WhatsApp (painel)
// ---------------------------------------------------------------------------
export const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0] ?? "";

const resumir = (texto: string, max = 120) => {
  const t = texto.replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max - 1).trimEnd() + "…" : t;
};

export function mensagemAchei(p: { nome: string; descricao: string; produto: string; link: string }): string {
  return [
    `Oi, ${primeiroNome(p.nome)}! Aqui é a Moni, da Vitrine da Moni 🧡`,
    `Você me pediu: "${resumir(p.descricao)}"`,
    "",
    `Achei este: ${p.produto.trim()}`,
    p.link.trim(),
    "",
    "É link de afiliado da Shopee: se você comprar por ele, posso ganhar uma comissão, sem custo extra pra você. Confira preço e frete na Shopee antes de fechar 😉",
  ].join("\n");
}

export function mensagemNaoAchei(p: { nome: string; descricao: string }): string {
  return [
    `Oi, ${primeiroNome(p.nome)}! Aqui é a Moni, da Vitrine da Moni 🧡`,
    `Procurei "${resumir(p.descricao)}", mas ainda não encontrei uma opção boa na Shopee.`,
    "Se eu achar, te mando por aqui!",
  ].join("\n");
}

/** Link de conversa do WhatsApp (abre o app ou o WhatsApp Web com a mensagem pronta). */
export const linkWhatsapp = (numero: string, mensagem: string) => `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
