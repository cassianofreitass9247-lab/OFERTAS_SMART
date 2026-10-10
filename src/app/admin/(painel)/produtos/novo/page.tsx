import type { Metadata } from "next";
import { FormularioProduto } from "@/components/admin/FormularioProduto";
import { clienteServidor } from "@/lib/supabase/servidor";

export const metadata: Metadata = { title: "Cadastrar produto" };

export default async function PaginaNovoProduto() {
  const sb = await clienteServidor();
  const { data } = await sb.from("categorias").select("id, nome").order("nome");
  return (
    <>
      <h1 className="mb-4 font-titulo text-3xl font-extrabold">Cadastrar produto</h1>
      <FormularioProduto categorias={data ?? []} />
    </>
  );
}
