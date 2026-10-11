/** Faixa laranja com o título das páginas internas. */
export function Cabecalho({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children?: React.ReactNode }) {
  return (
    <section className="border-b-[3px] border-tinta bg-neon">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-8 lg:py-14">
        {children}
        <h1 className="vm-titulo">{titulo}</h1>
        {subtitulo && <p className="mt-3 max-w-[60ch] text-lg leading-snug font-medium">{subtitulo}</p>}
      </div>
    </section>
  );
}

export function Conteudo({ children, estreito = false }: { children: React.ReactNode; estreito?: boolean }) {
  return <div className={`mx-auto px-4 py-10 sm:px-8 lg:py-14 ${estreito ? "max-w-3xl" : "max-w-7xl"}`}>{children}</div>;
}
