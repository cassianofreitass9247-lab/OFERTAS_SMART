type Busca = Record<string, string | string[] | undefined>;
const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Mostra a mensagem de sucesso ou de erro que as ações do painel devolvem pela URL. */
export function Aviso({ parametros }: { parametros: Busca }) {
  const ok = um(parametros.ok);
  const erro = um(parametros.erro);
  if (!ok && !erro) return null;
  return (
    <p role={erro ? "alert" : "status"} className={`mb-4 rounded-md border p-3 text-sm ${erro ? "border-laranja bg-laranja-claro" : "border-linha bg-white"}`}>
      {(erro ?? ok ?? "").slice(0, 300)}
    </p>
  );
}
