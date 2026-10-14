"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirAdmin } from "@/lib/admin";
import { MAX_LOTE, nomeBloqueado } from "@/lib/lote";
import { linkAfiliadoValido, produtoSchema } from "@/lib/produto";
import type { Database } from "@/lib/database.types";
import { gerarSlugProduto } from "@/lib/texto";

const EH_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BASE = "/admin/shopee/lote";

const voltar = (caminho: string, tipo: "ok" | "erro", msg: string): never =>
  redirect(`${caminho}${caminho.includes("?") ? "&" : "?"}${tipo}=${encodeURIComponent(msg)}`);
const texto = (fd: FormData, campo: string) => {
  const v = fd.get(campo);
  return typeof v === "string" ? v : "";
};

const MSG_MIGRACAO = "O recurso de lotes precisa da migração 0005 no Supabase. Aplique o arquivo supabase/migrations/0005_lotes_de_importacao.sql e tente de novo.";
const faltaMigracao = (e: { code?: string; message?: string } | null) =>
  Boolean(e && (e.code === "42P01" || e.code === "42703" || e.code === "PGRST204" || e.code === "PGRST205" || /lote/i.test(e.message ?? "")));

type Linha = Database["public"]["Tables"]["produtos"]["Insert"];
type ItemLote = { itemId: string; shopId: string; nome: string; link: string; preco: number; imagem: string | null };

/** Lê um item do formulário: JSON compacto escrito pela própria tela. Qualquer coisa fora do formato é descartada. */
function lerItem(bruto: string): ItemLote | null {
  try {
    const j = JSON.parse(bruto) as Record<string, unknown>;
    const { i, s, n, l, p, m } = j;
    if (typeof i !== "string" || !/^\d{1,19}$/.test(i)) return null;
    if (typeof s !== "string" || !/^\d{1,19}$/.test(s)) return null;
    if (typeof n !== "string" || typeof l !== "string" || typeof p !== "number" || !Number.isFinite(p)) return null;
    return { itemId: i, shopId: s, nome: n, link: l, preco: p, imagem: typeof m === "string" && m ? m : null };
  } catch {
    return null;
  }
}

/** Cria vários produtos de uma vez, como rascunho (padrão) ou publicados direto (opcional, com confirmação). */
export async function importarLoteShopee(fd: FormData) {
  const sb = await exigirAdmin();
  const volta = texto(fd, "volta").startsWith(`${BASE}?`) ? texto(fd, "volta").slice(0, 600) : BASE;
  const direto = texto(fd, "modo") === "direto";
  if (direto && texto(fd, "confirmo") !== "sim") return voltar(volta, "erro", "Para publicar direto, marque a confirmação. Nada foi cadastrado.");

  const categoria = texto(fd, "categoria_id");
  if (categoria && !EH_UUID.test(categoria)) return voltar(volta, "erro", "Categoria inválida.");

  const itens: ItemLote[] = [];
  const vistos = new Set<string>();
  for (const v of fd.getAll("item")) {
    if (typeof v !== "string" || v.length > 4000) continue;
    const it = lerItem(v);
    if (!it || vistos.has(it.itemId)) continue;
    vistos.add(it.itemId);
    itens.push(it);
  }
  if (itens.length === 0) return voltar(volta, "erro", "Nenhum produto selecionado.");
  if (itens.length > MAX_LOTE) return voltar(volta, "erro", `Selecione no máximo ${MAX_LOTE} produtos por lote.`);

  // Já cadastrados (mesmo ID da Shopee ou mesmo link) ficam de fora.
  const ids = itens.map((i) => `${i.shopId}.${i.itemId}`);
  const links = itens.map((i) => i.link);
  const [{ data: porId }, { data: porLink }] = await Promise.all([
    sb.from("produtos").select("id_externo").in("id_externo", ids),
    sb.from("produtos").select("link_afiliado").in("link_afiliado", links),
  ]);
  const idsExistentes = new Set((porId ?? []).map((p) => p.id_externo));
  const linksExistentes = new Set((porLink ?? []).map((p) => p.link_afiliado));

  const linhas: Linha[] = [];
  let jaExistiam = 0;
  let invalidos = 0;
  let retidos = 0;
  const linksNoLote = new Set<string>();
  for (const it of itens) {
    const idExterno = `${it.shopId}.${it.itemId}`;
    if (idsExistentes.has(idExterno) || linksExistentes.has(it.link) || linksNoLote.has(it.link)) {
      jaExistiam++;
      continue;
    }
    if (!linkAfiliadoValido(it.link)) {
      invalidos++;
      continue;
    }
    const r = produtoSchema.safeParse({
      nome: it.nome,
      link_afiliado: it.link,
      preco_atual: String(it.preco),
      descricao: "",
      imagem_url: it.imagem ?? "",
      imagens: "",
      video_url: "",
      id_externo: idExterno,
    });
    // Publicação direta exige foto e preço; sem foto, o item não vai ao ar sozinho.
    if (!r.success || r.data.preco_atual <= 0) {
      invalidos++;
      continue;
    }
    let status: "rascunho" | "publicado" = "rascunho";
    if (direto) {
      if (nomeBloqueado(r.data.nome) || !r.data.imagem_url) retidos++;
      else status = "publicado";
    }
    linksNoLote.add(it.link);
    linhas.push({
      nome: r.data.nome,
      link_afiliado: r.data.link_afiliado,
      preco_atual: r.data.preco_atual,
      descricao: r.data.descricao,
      imagem_url: r.data.imagem_url,
      id_externo: r.data.id_externo,
      categoria_id: categoria || null,
      slug: gerarSlugProduto(r.data.nome),
      origem: "manual",
      status_publicacao: status,
    });
  }
  if (linhas.length === 0) {
    return voltar(volta, "erro", `Nada foi cadastrado: ${jaExistiam} já existiam e ${invalidos} foram recusados pela validação.`);
  }

  const { data: usuario } = await sb.auth.getUser();
  const filtros = {
    q: texto(fd, "f_q").slice(0, 100),
    ordem: texto(fd, "f_ordem").slice(0, 20),
    vendasMin: texto(fd, "f_vendas").slice(0, 8),
    descontoMin: texto(fd, "f_desconto").slice(0, 8),
    comissaoMin: texto(fd, "f_comissao").slice(0, 8),
    notaMin: texto(fd, "f_nota").slice(0, 8),
  };
  const { data: lote, error: erroLote } = await sb
    .from("lotes_importacao")
    .insert({ publicado_direto: direto, total: linhas.length, retidos_por_bloqueio: retidos, filtros, criado_por: usuario.user?.id ?? null })
    .select("id")
    .single();
  if (erroLote || !lote) {
    return voltar(volta, "erro", faltaMigracao(erroLote) ? MSG_MIGRACAO : `Não foi possível registrar o lote: ${erroLote?.message ?? "erro desconhecido"}`);
  }

  const { error } = await sb.from("produtos").insert(linhas.map((l) => ({ ...l, lote_id: lote.id })));
  if (error) {
    await sb.from("lotes_importacao").delete().eq("id", lote.id); // sem permissão de apagar: o registro vazio fica, sem efeito
    if (error.code === "23505") return voltar(volta, "erro", "Algum produto do lote já existe (mesmo link ou ID). Nada foi cadastrado; busque de novo.");
    return voltar(volta, "erro", faltaMigracao(error) ? MSG_MIGRACAO : `Não foi possível salvar o lote: ${error.message}`);
  }

  revalidatePath("/", "layout");
  const publicados = linhas.length - linhas.filter((l) => l.status_publicacao === "rascunho").length;
  const partes = [
    direto ? `${publicados} publicado(s)` : `${linhas.length} rascunho(s) criado(s)`,
    direto && linhas.length > publicados ? `${linhas.length - publicados} retido(s) como rascunho (palavra bloqueada ou sem foto)` : null,
    jaExistiam ? `${jaExistiam} já existia(m)` : null,
    invalidos ? `${invalidos} recusado(s)` : null,
  ].filter(Boolean);
  return voltar(BASE, "ok", `Lote concluído: ${partes.join("; ")}. Você pode desfazer o lote abaixo.`);
}

/** Desfaz um lote: despublica o que foi ao ar e apaga os rascunhos que ninguém editou. */
export async function desfazerLote(fd: FormData) {
  const sb = await exigirAdmin();
  const id = texto(fd, "lote");
  if (!EH_UUID.test(id)) return voltar(BASE, "erro", "Lote inválido.");

  const { data: pub, error: e1 } = await sb
    .from("produtos")
    .update({ status_publicacao: "despublicado" })
    .eq("lote_id", id)
    .eq("status_publicacao", "publicado")
    .select("id");
  if (e1) return voltar(BASE, "erro", faltaMigracao(e1) ? MSG_MIGRACAO : `Não foi possível desfazer: ${e1.message}`);

  const { data: rasc, error: e2 } = await sb.from("produtos").delete().eq("lote_id", id).eq("status_publicacao", "rascunho").select("id");
  if (e2) return voltar(BASE, "erro", `Os publicados foram despublicados, mas não foi possível apagar os rascunhos: ${e2.message}`);

  revalidatePath("/", "layout");
  return voltar(BASE, "ok", `Lote desfeito: ${pub?.length ?? 0} despublicado(s) e ${rasc?.length ?? 0} rascunho(s) apagado(s).`);
}
