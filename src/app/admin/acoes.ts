"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { lerCupom } from "@/lib/cupom";
import { decodificarArquivo } from "@/lib/csv";
import type { Disponibilidade, Json, StatusPublicacao } from "@/lib/database.types";
import { linkAfiliadoValido, primeiroErro, produtoSchema, validarCsv, type ErroLinha } from "@/lib/produto";
import { exigirAdmin } from "@/lib/admin";
import { clienteServidor } from "@/lib/supabase/servidor";
import { verificarTurnstile } from "@/lib/turnstile";
import { EH_UUID, gerarSlugProduto, slugify } from "@/lib/texto";
import { resolverVideo, resolverVideosDoCsv } from "@/lib/video-servidor";

const texto = (fd: FormData, campo: string) => {
  const v = fd.get(campo);
  return typeof v === "string" ? v : "";
};
const STATUS: StatusPublicacao[] = ["rascunho", "publicado", "despublicado"];
const DISPONIBILIDADES: Disponibilidade[] = ["desconhecido", "disponivel", "indisponivel"];
const atualizarSite = () => revalidatePath("/", "layout");
const voltar = (caminho: string, tipo: "ok" | "erro", msg: string): never => redirect(`${caminho}?${tipo}=${encodeURIComponent(msg)}`);

export type Estado = { erro?: string; valores?: Record<string, string> };

// O navegador limpa o formulário depois do envio. Devolvemos o que foi digitado
// para que um erro não obrigue a pessoa a preencher tudo de novo.
function comErro(fd: FormData, erro: string): Estado {
  const valores: Record<string, string> = {};
  for (const [campo, valor] of fd) if (typeof valor === "string" && campo !== "senha" && campo !== "cf-turnstile-response") valores[campo] = valor;
  return { erro, valores };
}

// ---------------------------------------------------------------------------
// Acesso
// ---------------------------------------------------------------------------
export async function entrar(_: Estado, fd: FormData): Promise<Estado> {
  const email = texto(fd, "email").trim();
  const senha = texto(fd, "senha");
  if (!email || !senha) return comErro(fd, "Informe o e-mail e a senha.");

  // Bloqueia tentativas automáticas de adivinhar a senha (antes mesmo de consultar o Supabase).
  const robo = await verificarTurnstile(texto(fd, "cf-turnstile-response"), "login", {
    ip: (await headers()).get("cf-connecting-ip"),
  });
  if (!robo.ok) return comErro(fd, robo.erro);

  const sb = await clienteServidor();
  const { error } = await sb.auth.signInWithPassword({ email, password: senha });
  if (error) {
    return comErro(fd, error.status === 400 ? "E-mail ou senha incorretos." : "Não foi possível entrar agora. Tente de novo em instantes.");
  }
  const { data: admin } = await sb.rpc("eh_admin");
  if (!admin) {
    await sb.auth.signOut();
    return comErro(fd, "Esta conta existe, mas não tem permissão de administrador. Veja no README como liberar o acesso.");
  }
  redirect("/admin");
}

export async function sair() {
  const sb = await clienteServidor();
  await sb.auth.signOut();
  redirect("/admin/login");
}

// ---------------------------------------------------------------------------
// Produtos
// ---------------------------------------------------------------------------
export async function salvarProduto(_: Estado, fd: FormData): Promise<Estado> {
  const sb = await exigirAdmin();
  const id = texto(fd, "id");
  if (id && !EH_UUID.test(id)) return comErro(fd, "Produto inválido.");

  const r = produtoSchema.safeParse({
    nome: texto(fd, "nome"),
    link_afiliado: texto(fd, "link_afiliado"),
    preco_atual: texto(fd, "preco_atual"),
    descricao: texto(fd, "descricao"),
    imagem_url: texto(fd, "imagem_url"),
    imagens: String(fd.get("imagens") ?? ""),
    video_url: texto(fd, "video_url"),
    id_externo: texto(fd, "id_externo"),
  });
  if (!r.success) return comErro(fd, primeiroErro(r.error));
  // Só envia a coluna de vídeo quando há vídeo (ou havia e foi apagado). Assim o cadastro
  // continua funcionando mesmo antes de a migração 0002 ser aplicada no banco.
  const { video_url: videoDigitado, imagens, ...dados } = r.data;
  let video_url = videoDigitado;
  if (videoDigitado) {
    const rv = await resolverVideo(videoDigitado);
    if ("erro" in rv) return comErro(fd, rv.erro);
    video_url = rv.url; // link curto do TikTok vira o completo
  }
  const comVideo = video_url !== null || fd.get("tinha_video") === "1" ? { video_url } : {};
  // Mesmo cuidado com a galeria: só envia a coluna quando há fotos (ou havia) — vale antes da migração 0003.
  const comImagens = imagens.length > 0 || fd.get("tinha_imagens") === "1" ? { imagens } : {};

  const categoria = texto(fd, "categoria_id");
  const status = texto(fd, "status_publicacao") as StatusPublicacao;
  const disponibilidade = texto(fd, "disponibilidade") as Disponibilidade;
  if (categoria && !EH_UUID.test(categoria)) return comErro(fd, "Categoria inválida.");
  if (!STATUS.includes(status) || !DISPONIBILIDADES.includes(disponibilidade)) return comErro(fd, "Situação inválida.");

  const campos = {
    ...dados,
    ...comVideo,
    ...comImagens,
    categoria_id: categoria || null,
    status_publicacao: status,
    disponibilidade,
    destaque: fd.get("destaque") === "on",
  };

  const { error } = id
    ? await sb.from("produtos").update(campos).eq("id", id)
    : await sb.from("produtos").insert({ ...campos, slug: gerarSlugProduto(r.data.nome), origem: "manual" });

  if (error) {
    if (error.code === "23505") return comErro(fd, "Já existe outro produto com este link de afiliado ou com este ID da Shopee.");
    if (error.message.includes("imagens")) return comErro(fd, "Para salvar fotos adicionais, aplique antes a migração 0003 no Supabase (veja o README).");
    if (error.message.includes("video_url")) return comErro(fd, "Para salvar vídeo, aplique antes a migração 0002 no Supabase (veja o README).");
    return comErro(fd, `Não foi possível salvar: ${error.message}`);
  }

  // Correção de erro de digitação: não deixa a correção virar um "desconto" falso.
  if (id && fd.get("correcao") === "on") {
    const { error: e2 } = await sb.from("produtos").update({ preco_anterior: null }).eq("id", id);
    if (e2) return comErro(fd, `O produto foi salvo, mas não foi possível remover o preço anterior: ${e2.message}`);
  }

  atualizarSite();
  redirect(`/admin/produtos?ok=${encodeURIComponent(id ? "Produto salvo." : "Produto cadastrado.")}`);
}

export async function alterarStatus(fd: FormData) {
  const sb = await exigirAdmin();
  const id = texto(fd, "id");
  const status = texto(fd, "status") as StatusPublicacao;
  if (!EH_UUID.test(id) || !STATUS.includes(status)) voltar("/admin/produtos", "erro", "Pedido inválido.");
  const { error } = await sb.from("produtos").update({ status_publicacao: status }).eq("id", id);
  if (error) voltar("/admin/produtos", "erro", `Não foi possível alterar: ${error.message}`);
  atualizarSite();
  voltar("/admin/produtos", "ok", status === "publicado" ? "Produto publicado." : "Produto despublicado.");
}

export async function excluirProduto(fd: FormData) {
  const sb = await exigirAdmin();
  const id = texto(fd, "id");
  if (!EH_UUID.test(id)) voltar("/admin/produtos", "erro", "Pedido inválido.");
  if (fd.get("confirmar") !== "on") voltar(`/admin/produtos/${id}`, "erro", "Marque a caixa de confirmação para excluir.");
  const { error } = await sb.from("produtos").delete().eq("id", id);
  if (error) voltar(`/admin/produtos/${id}`, "erro", `Não foi possível excluir: ${error.message}`);
  atualizarSite();
  voltar("/admin/produtos", "ok", "Produto excluído.");
}

// ---------------------------------------------------------------------------
// Categorias
// ---------------------------------------------------------------------------
export async function criarCategoria(fd: FormData) {
  const sb = await exigirAdmin();
  const nome = texto(fd, "nome").replace(/\s+/g, " ").trim();
  const descricao = texto(fd, "descricao").trim();
  const slug = slugify(nome);
  if (nome.length < 2 || nome.length > 60 || !slug) voltar("/admin/categorias", "erro", "Nome da categoria: use de 2 a 60 caracteres.");
  if (descricao.length > 500) voltar("/admin/categorias", "erro", "Descrição: máximo de 500 caracteres.");
  const { error } = await sb.from("categorias").insert({ nome, slug, descricao: descricao || null });
  if (error) voltar("/admin/categorias", "erro", error.code === "23505" ? "Já existe uma categoria com esse nome." : `Não foi possível criar: ${error.message}`);
  atualizarSite();
  voltar("/admin/categorias", "ok", "Categoria criada.");
}

export async function alternarCategoria(fd: FormData) {
  const sb = await exigirAdmin();
  const id = texto(fd, "id");
  if (!EH_UUID.test(id)) voltar("/admin/categorias", "erro", "Pedido inválido.");
  const ativa = texto(fd, "ativa") === "true";
  const { error } = await sb.from("categorias").update({ ativa }).eq("id", id);
  if (error) voltar("/admin/categorias", "erro", `Não foi possível alterar: ${error.message}`);
  atualizarSite();
  voltar("/admin/categorias", "ok", ativa ? "Categoria reativada." : "Categoria ocultada do site.");
}

export async function excluirCategoria(fd: FormData) {
  const sb = await exigirAdmin();
  const id = texto(fd, "id");
  if (!EH_UUID.test(id)) voltar("/admin/categorias", "erro", "Pedido inválido.");
  const { error } = await sb.from("categorias").delete().eq("id", id);
  if (error) voltar("/admin/categorias", "erro", `Não foi possível excluir: ${error.message}`);
  atualizarSite();
  voltar("/admin/categorias", "ok", "Categoria excluída. Os produtos dela ficaram sem categoria.");
}

// ---------------------------------------------------------------------------
// Importação por CSV
// ---------------------------------------------------------------------------
const MAX_BYTES = 1_500_000;

export type EstadoImportacao = {
  erro?: string;
  resultado?: {
    gravado: boolean;
    totalLinhas: number;
    validos: number;
    inseridos: number;
    atualizados: number;
    erros: ErroLinha[];
    avisos: string[];
  };
};

export async function importarCsv(_: EstadoImportacao, fd: FormData): Promise<EstadoImportacao> {
  const sb = await exigirAdmin();
  const arquivo = fd.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) return { erro: "Escolha um arquivo CSV." };
  if (arquivo.size > MAX_BYTES) return { erro: "Arquivo grande demais (limite de 1,5 MB). Divida em arquivos menores." };

  const lido = validarCsv(decodificarArquivo(await arquivo.arrayBuffer()), { publicarPorPadrao: fd.get("publicar") === "on" });
  if (lido.erroGeral) return { erro: lido.erroGeral };

  // Links curtos do TikTok viram completos; linha cujo link não abre é recusada, o resto segue.
  const videos = await resolverVideosDoCsv(lido.itens, lido.linhas);
  const r = { ...lido, itens: videos.itens, erros: [...lido.erros, ...videos.erros].sort((a, b) => a.linha - b.linha) };

  const base = { totalLinhas: r.totalLinhas, validos: r.itens.length, erros: r.erros, avisos: r.avisos };
  if (fd.get("so_validar") === "on" || r.itens.length === 0) {
    return { resultado: { ...base, gravado: false, inseridos: 0, atualizados: 0 } };
  }

  const { data, error } = await sb.rpc("importar_produtos", {
    p_itens: r.itens as unknown as Json,
    p_arquivo: arquivo.name,
    p_rejeitados: r.erros.length,
    p_erros: r.erros.slice(0, 200) as unknown as Json,
  });
  if (error) {
    return {
      erro:
        error.code === "23505"
          ? "Nada foi importado: um produto do arquivo usa o link de um produto já cadastrado e o ID de outro. Corrija o arquivo e envie de novo."
          : `Nada foi importado. Motivo informado pelo banco: ${error.message}`,
    };
  }
  atualizarSite();
  return { resultado: { ...base, gravado: true, inseridos: data.inseridos, atualizados: data.atualizados } };
}

// ---------------------------------------------------------------------------
// Dados de demonstração
// ---------------------------------------------------------------------------
export async function carregarDemo() {
  const sb = await exigirAdmin();
  const { data, error } = await sb.rpc("carregar_dados_demo");
  if (error) voltar("/admin", "erro", `Não foi possível carregar: ${error.message}`);
  atualizarSite();
  voltar("/admin", "ok", data ? `${data} produtos fictícios carregados.` : "Os produtos fictícios já estavam carregados.");
}

export async function removerDemo() {
  const sb = await exigirAdmin();
  const { data, error } = await sb.rpc("remover_dados_demo");
  if (error) voltar("/admin", "erro", `Não foi possível remover: ${error.message}`);
  atualizarSite();
  voltar("/admin", "ok", `${data ?? 0} produtos fictícios removidos.`);
}

// ---------------------------------------------------------------------------
// Pedidos de visitantes ("Pede pra Moni", ou o nome da marca)
// ---------------------------------------------------------------------------
const STATUS_PEDIDO = ["novo", "respondido", "arquivado"] as const;

/** Chamada pelo botão do WhatsApp: registra a resposta (o envio em si acontece no WhatsApp do site). */
export async function registrarRespostaPedido(id: string, dados: { produtoId: string | null; link: string | null }): Promise<{ erro?: string }> {
  const sb = await exigirAdmin();
  if (!EH_UUID.test(id) || (dados.produtoId && !EH_UUID.test(dados.produtoId))) return { erro: "Pedido inválido." };
  if (dados.link && (dados.link.length > 2000 || !linkAfiliadoValido(dados.link))) return { erro: "Link de afiliado inválido." };
  const { error } = await sb
    .from("pedidos")
    .update({ status: "respondido", produto_id: dados.produtoId, link_enviado: dados.link, respondido_em: new Date().toISOString() })
    .eq("id", id);
  if (error) return { erro: `Não foi possível marcar como respondido: ${error.message}` };
  revalidatePath("/admin", "layout");
  return {};
}

export async function alterarStatusPedido(fd: FormData) {
  const sb = await exigirAdmin();
  const id = texto(fd, "id");
  const status = texto(fd, "status") as (typeof STATUS_PEDIDO)[number];
  const volta = texto(fd, "voltar").startsWith("/admin/pedidos") ? texto(fd, "voltar") : "/admin/pedidos";
  if (!EH_UUID.test(id) || !STATUS_PEDIDO.includes(status)) voltar(volta, "erro", "Pedido inválido.");
  const { error } = await sb.from("pedidos").update({ status }).eq("id", id);
  if (error) voltar(volta, "erro", `Não foi possível alterar: ${error.message}`);
  revalidatePath("/admin", "layout");
  voltar(volta, "ok", status === "arquivado" ? "Pedido arquivado." : status === "novo" ? "Pedido reaberto." : "Pedido marcado como respondido.");
}

export async function excluirPedido(fd: FormData) {
  const sb = await exigirAdmin();
  const id = texto(fd, "id");
  const volta = texto(fd, "voltar").startsWith("/admin/pedidos") ? texto(fd, "voltar") : "/admin/pedidos";
  if (!EH_UUID.test(id)) voltar(volta, "erro", "Pedido inválido.");
  const { error } = await sb.from("pedidos").delete().eq("id", id);
  if (error) voltar(volta, "erro", `Não foi possível excluir: ${error.message}`);
  revalidatePath("/admin", "layout");
  voltar(volta, "ok", "Pedido excluído, com os dados da pessoa.");
}

// ---------------------------------------------------------------------------
// Cupons
// ---------------------------------------------------------------------------
export async function salvarCupom(_: Estado, fd: FormData): Promise<Estado> {
  const sb = await exigirAdmin();
  const id = texto(fd, "id");
  if (id && !EH_UUID.test(id)) return comErro(fd, "Cupom inválido.");

  const campos: Record<string, string> = {};
  for (const [campo, valor] of fd) if (typeof valor === "string") campos[campo] = valor;
  const r = lerCupom(campos, { exigirFuturo: !id });
  if ("erro" in r) return comErro(fd, r.erro);

  const { error } = id ? await sb.from("cupons").update(r.dados).eq("id", id) : await sb.from("cupons").insert(r.dados);
  if (error) {
    if (error.message.includes("cupons")) return comErro(fd, "Para usar cupons, aplique antes a migração 0010 no Supabase (veja o README).");
    return comErro(fd, `Não foi possível salvar: ${error.message}`);
  }
  atualizarSite();
  redirect(`/admin/cupons?ok=${encodeURIComponent(id ? "Cupom salvo." : "Cupom cadastrado.")}`);
}

export async function alternarCupom(fd: FormData) {
  const sb = await exigirAdmin();
  const id = texto(fd, "id");
  if (!EH_UUID.test(id)) voltar("/admin/cupons", "erro", "Pedido inválido.");
  const ativo = texto(fd, "ativo") === "true";
  const { error } = await sb.from("cupons").update({ ativo }).eq("id", id);
  if (error) voltar("/admin/cupons", "erro", `Não foi possível alterar: ${error.message}`);
  atualizarSite();
  voltar("/admin/cupons", "ok", ativo ? "Cupom reativado." : "Cupom ocultado do site.");
}

export async function excluirCupom(fd: FormData) {
  const sb = await exigirAdmin();
  const id = texto(fd, "id");
  if (!EH_UUID.test(id)) voltar("/admin/cupons", "erro", "Pedido inválido.");
  const { error } = await sb.from("cupons").delete().eq("id", id);
  if (error) voltar("/admin/cupons", "erro", `Não foi possível excluir: ${error.message}`);
  atualizarSite();
  voltar("/admin/cupons", "ok", "Cupom excluído.");
}
