"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirAdmin } from "@/lib/admin";
import { linkAfiliadoValido, primeiroErro, produtoSchema } from "@/lib/produto";
import { buscarOfertaPorItem, buscarOfertas, ErroShopee, precoDaOferta } from "@/lib/shopee";
import { gerarSlugProduto } from "@/lib/texto";

const voltar = (caminho: string, tipo: "ok" | "erro", msg: string): never =>
  redirect(`${caminho}${caminho.includes("?") ? "&" : "?"}${tipo}=${encodeURIComponent(msg)}`);
const texto = (fd: FormData, campo: string) => {
  const v = fd.get(campo);
  return typeof v === "string" ? v : "";
};
const mensagemDe = (e: unknown) => (e instanceof ErroShopee ? e.message : "Não foi possível consultar a Shopee agora. Tente de novo em instantes.");

/** Faz uma consulta mínima para confirmar que o AppID e o Secret estão valendo. */
export async function testarConexaoShopee() {
  await exigirAdmin();
  let msg: string;
  try {
    const { ofertas } = await buscarOfertas({ termo: "fone", ordem: "vendas" });
    const o = ofertas[0];
    if (!o) return voltar("/admin/shopee", "erro", "A Shopee respondeu, mas sem nenhum produto para a busca de teste.");
    // Valores como a Shopee entrega, para conferir a leitura de preço e comissão na primeira vez.
    msg = `Conexão funcionando. Exemplo: "${o.nome.slice(0, 50)}": preço mínimo ${o.precoMin ?? "?"}, comissão lida ${o.comissao ?? "?"}%.`;
  } catch (e) {
    return voltar("/admin/shopee", "erro", mensagemDe(e));
  }
  return voltar("/admin/shopee", "ok", msg);
}

/** Cria um RASCUNHO a partir do produto da Shopee. Os dados são consultados de novo na Shopee: nada vem do formulário. */
export async function criarRascunhoShopee(fd: FormData) {
  const sb = await exigirAdmin();
  const itemId = texto(fd, "item");
  const shopId = texto(fd, "loja");
  const volta = `/admin/shopee?q=${encodeURIComponent(texto(fd, "q").slice(0, 200))}`;
  if (!/^\d{1,19}$/.test(itemId) || !/^\d{1,19}$/.test(shopId)) return voltar(volta, "erro", "Produto inválido.");

  const idExterno = `${shopId}.${itemId}`;
  const { data: existente } = await sb.from("produtos").select("id").eq("id_externo", idExterno).maybeSingle();
  if (existente) return redirect(`/admin/produtos/${existente.id}?ok=${encodeURIComponent("Este produto já estava cadastrado.")}`);

  let oferta;
  try {
    oferta = await buscarOfertaPorItem(itemId, shopId);
  } catch (e) {
    return voltar(volta, "erro", mensagemDe(e));
  }
  if (!oferta) return voltar(volta, "erro", "A Shopee não devolveu este produto (pode ter saído do ar).");
  if (!oferta.linkAfiliado || !linkAfiliadoValido(oferta.linkAfiliado)) {
    return voltar(volta, "erro", "A Shopee não devolveu um link de afiliado em shopee.com.br ou shope.ee para este produto. Nada foi cadastrado.");
  }
  const preco = precoDaOferta(oferta);
  if (preco === null) return voltar(volta, "erro", "A Shopee não informou o preço deste produto. Nada foi cadastrado.");

  // Mesmas regras do cadastro manual: o que entra aqui passa pela mesma validação.
  const r = produtoSchema.safeParse({
    nome: oferta.nome,
    link_afiliado: oferta.linkAfiliado,
    preco_atual: String(preco),
    descricao: "",
    imagem_url: oferta.imagemUrl ?? "",
    imagens: "",
    video_url: "",
    id_externo: idExterno,
  });
  if (!r.success) return voltar(volta, "erro", `Dados da Shopee recusados pela validação: ${primeiroErro(r.error)}`);

  const { nome, link_afiliado, preco_atual, descricao, imagem_url, id_externo } = r.data;
  const { data: criado, error } = await sb
    .from("produtos")
    .insert({
      nome,
      link_afiliado,
      preco_atual,
      descricao,
      imagem_url,
      id_externo,
      slug: gerarSlugProduto(nome),
      origem: "manual",
      status_publicacao: "rascunho",
    })
    .select("id")
    .single();
  if (error || !criado) {
    if (error?.code === "23505") return voltar(volta, "erro", "Já existe um produto com este link de afiliado ou com este ID da Shopee.");
    return voltar(volta, "erro", `Não foi possível salvar: ${error?.message ?? "erro desconhecido"}`);
  }
  revalidatePath("/admin/produtos");
  return redirect(`/admin/produtos/${criado.id}?ok=${encodeURIComponent("Rascunho criado a partir da Shopee. Revise (categoria, descrição) e publique quando quiser.")}`);
}
