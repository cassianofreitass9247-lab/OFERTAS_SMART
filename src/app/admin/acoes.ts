"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { decodificarArquivo } from "@/lib/csv";
import type { Disponibilidade, Json, StatusPublicacao } from "@/lib/database.types";
import { primeiroErro, produtoSchema, validarCsv, type ErroLinha } from "@/lib/produto";
import { clienteServidor } from "@/lib/supabase/servidor";
import { EH_UUID, gerarSlugProduto, slugify } from "@/lib/texto";

// Toda ação confere a sessão e a permissão de administrador antes de agir.
// Mesmo que esta conferência falhasse, as políticas do banco (RLS) recusariam a gravação.
async function exigirAdmin() {
  const sb = await clienteServidor();
  const { data } = await sb.auth.getUser();
  if (!data.user) redirect("/admin/login");
  const { data: admin } = await sb.rpc("eh_admin");
  if (!admin) redirect("/admin");
  return sb;
}

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
  for (const [campo, valor] of fd) if (typeof valor === "string" && campo !== "senha") valores[campo] = valor;
  return { erro, valores };
}

// ---------------------------------------------------------------------------
// Acesso
// ---------------------------------------------------------------------------
export async function entrar(_: Estado, fd: FormData): Promise<Estado> {
  const email = texto(fd, "email").trim();
  const senha = texto(fd, "senha");
  if (!email || !senha) return comErro(fd, "Informe o e-mail e a senha.");

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
    id_externo: texto(fd, "id_externo"),
  });
  if (!r.success) return comErro(fd, primeiroErro(r.error));

  const categoria = texto(fd, "categoria_id");
  const status = texto(fd, "status_publicacao") as StatusPublicacao;
  const disponibilidade = texto(fd, "disponibilidade") as Disponibilidade;
  if (categoria && !EH_UUID.test(categoria)) return comErro(fd, "Categoria inválida.");
  if (!STATUS.includes(status) || !DISPONIBILIDADES.includes(disponibilidade)) return comErro(fd, "Situação inválida.");

  const campos = {
    ...r.data,
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

  const r = validarCsv(decodificarArquivo(await arquivo.arrayBuffer()), { publicarPorPadrao: fd.get("publicar") === "on" });
  if (r.erroGeral) return { erro: r.erroGeral };

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
