"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CartaoProduto } from "@/components/CartaoProduto";
import { COLUNAS_CARTAO, type ProdutoCartao } from "@/lib/dados";
import { clientePublico } from "@/lib/supabase/publico";
import { EH_UUID } from "@/lib/texto";
import { useSalvos } from "./Salvos";

type Estado = { tipo: "carregando" } | { tipo: "erro" } | { tipo: "pronto"; itens: ProdutoCartao[] };

export function ListaSalvos() {
  const { salvos, pronto } = useSalvos();
  const [estado, setEstado] = useState<Estado>({ tipo: "carregando" });
  const chave = salvos.join(",");

  useEffect(() => {
    if (!pronto) return;
    const ids = chave ? chave.split(",").filter((id) => EH_UUID.test(id)) : [];
    if (ids.length === 0) {
      setEstado({ tipo: "pronto", itens: [] });
      return;
    }
    const sb = clientePublico();
    if (!sb) {
      setEstado({ tipo: "erro" });
      return;
    }
    let ativo = true;
    (async () => {
      try {
        const { data, error } = await sb
          .from("produtos")
          .select(COLUNAS_CARTAO)
          .in("id", ids)
          .eq("status_publicacao", "publicado");
        if (!ativo) return;
        if (error) throw error;
        const ordem = new Map(ids.map((id, i) => [id, i]));
        setEstado({ tipo: "pronto", itens: [...data].sort((a, b) => (ordem.get(b.id) ?? 0) - (ordem.get(a.id) ?? 0)) });
      } catch {
        if (ativo) setEstado({ tipo: "erro" });
      }
    })();
    return () => {
      ativo = false;
    };
  }, [chave, pronto]);

  if (estado.tipo === "carregando") return <p className="font-semibold text-cinza">Carregando seus salvos…</p>;
  if (estado.tipo === "erro") return <p className="font-semibold">Não foi possível carregar seus salvos agora. Tente de novo em instantes.</p>;
  if (estado.itens.length === 0) {
    return (
      <div className="rounded-3xl border-[2.5px] border-dashed border-tinta bg-pessego p-10 text-center">
        <p className="font-titulo text-xl font-bold">Você ainda não salvou nenhum achadinho.</p>
        <p className="mt-2">Toque no coração de um produto para guardar aqui.</p>
        <Link href="/ofertas" className="vm-btn vm-pilula mt-5 bg-tinta text-white">Ver ofertas</Link>
      </div>
    );
  }
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
      {estado.itens.map((p) => (
        <CartaoProduto key={p.id} produto={p} />
      ))}
    </ul>
  );
}
