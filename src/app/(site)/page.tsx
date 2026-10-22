/* eslint-disable @next/next/no-img-element -- foto local, sem otimizador pago */
import Link from "next/link";
import { CartaoProduto } from "@/components/CartaoProduto";
import { ImagemProduto } from "@/components/ImagemProduto";
import { Preco, SeloDesconto } from "@/components/Preco";
import {
  IconeBrilho,
  IconeCoracao,
  IconeEstrela,
  IconeInstagram,
  IconeSaida,
  IconeSeta,
  IconeTelegram,
  IconeWhatsapp,
} from "@/components/site/Icones";
import { BotaoSalvar } from "@/components/site/Salvos";
import { VitrineCategorias } from "@/components/site/VitrineCategorias";
import { INSTAGRAM_URL, TELEGRAM_URL, WHATSAPP_URL } from "@/lib/config";
import { CartaoCupom } from "@/components/site/CartaoCupom";
import { categoriasComCupom, listarCategorias, listarCuponsOuNada, listarProdutos } from "@/lib/dados";
import { formatarDataHora, formatarPreco } from "@/lib/texto";
import { F, MARCA } from "@/lib/marca";

// Dados ao vivo: a página é montada a cada acesso (não é gerada no build).
export const dynamic = "force-dynamic";

export default async function PaginaInicial() {
  const [categorias, destaques, promocoes, recentes, cupons] = await Promise.all([
    listarCategorias(),
    listarProdutos({ soDestaques: true, limite: 8 }),
    listarProdutos({ soPromocoes: true, ordenar: "maior-desconto", limite: 5 }),
    listarProdutos({ limite: 24 }),
    listarCuponsOuNada(),
  ]);
  const cuponsNaHome = cupons.slice(0, 3);
  const comCupom = categoriasComCupom(cupons);
  const nomes = new Map(categorias.map((c) => [c.id, c.nome]));
  const [principal, ...quedas] = promocoes.itens;
  const faixa = ["Radar de ofertas", ...categorias.map((c) => c.nome), "Achadinhos até R$ 50"];
  const grupo = TELEGRAM_URL
    ? { href: TELEGRAM_URL, rotulo: "Entrar no grupo", longo: "Entrar no grupo do Telegram", icone: <IconeTelegram tamanho={22} /> }
    : { href: INSTAGRAM_URL, rotulo: "Seguir no Instagram", longo: `Seguir ${F.a} no Instagram`, icone: <IconeInstagram tamanho={22} /> };

  return (
    <>
      {/* Apresentação */}
      <section className="border-b-[3px] border-tinta bg-neon">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-14 px-4 pt-10 pb-14 sm:px-8 lg:pt-16 lg:pb-20">
          <div className="min-w-0 flex-[1_1_480px]">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border-2 border-tinta bg-white px-3.5 py-1.5 text-[15px] font-bold">
              <IconeEstrela tamanho={16} />
              Beleza, casa, mundo infantil e muito mais
            </p>
            <h1 className="font-titulo text-[46px] leading-[0.95] font-extrabold tracking-[-0.04em] sm:text-6xl lg:text-[80px]">
              Os achadinhos da Shopee que valem o clique.
            </h1>
            <p className="mt-6 max-w-[34ch] text-xl leading-snug font-medium">
              Eu garimpo as ofertas e o site anota cada preço. Quando aparece desconto aqui, é porque o preço caiu de verdade.
            </p>
            <div className="mt-9 flex flex-wrap gap-3.5">
              <a href="#achadinhos" className="vm-btn vm-pilula min-h-14 border-tinta bg-tinta px-7 text-lg text-white shadow-branco">
                Ver ofertas de hoje
                <IconeSeta />
              </a>
              <a href={grupo.href} target="_blank" rel="noopener" className="vm-btn vm-pilula min-h-14 bg-white px-6 text-lg text-tinta">
                {grupo.icone}
                {grupo.rotulo}
              </a>
            </div>
          </div>

          <div className="relative flex min-w-0 flex-[1_1_400px] justify-center py-6">
            <div className="h-[440px] w-[min(430px,86%)] overflow-hidden rounded-t-[240px] rounded-b-[36px] border-[3px] border-tinta bg-pessego shadow-[14px_14px_0_#1e120c] sm:h-[560px]">
              <img src={MARCA.foto} alt={`Foto de ${MARCA.nomePessoa}`} width={1024} height={1536} className="block h-full w-full object-cover object-[center_18%]" />
            </div>

            <span className="vm-flutua absolute top-8 left-0 rounded-2xl border-[2.5px] border-tinta bg-sol px-4 py-2.5 font-titulo text-xl font-extrabold shadow-[5px_5px_0_#1e120c] sm:text-2xl" style={{ ["--r" as string]: "-9deg" }}>
              Preço caiu!
            </span>

            {principal && (
              <Link
                href={`/produto/${principal.slug}`}
                className="vm-flutua vm-d2 absolute top-[46%] right-0 flex w-[210px] items-center gap-3 rounded-[20px] border-[2.5px] border-tinta bg-white p-3 text-tinta no-underline shadow-[6px_6px_0_#1e120c]"
                style={{ ["--r" as string]: "4deg" }}
              >
                <span className="block size-14 flex-none overflow-hidden rounded-xl bg-pessego">
                  <ImagemProduto url={principal.imagem_url} nome={principal.nome} compacto />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold">{principal.nome}</span>
                  <span className="preco block text-xl font-extrabold">{formatarPreco(principal.preco_atual)}</span>
                  {principal.desconto_percentual && (
                    <span className="inline-block rounded-md border-[1.5px] border-tinta bg-neon px-1.5 text-[13px] font-extrabold">-{principal.desconto_percentual}%</span>
                  )}
                </span>
              </Link>
            )}

            <span className="vm-flutua vm-d3 absolute bottom-2 left-[6%] rounded-full bg-tinta px-5 py-3 font-titulo text-lg font-bold text-white shadow-[5px_5px_0_#ffffff] sm:text-xl" style={{ ["--r" as string]: "-4deg" }}>
              Oi, eu sou {F.a}!
            </span>
          </div>
        </div>
      </section>

      {/* Faixa que corre */}
      <div aria-hidden="true" className="overflow-hidden border-b-[3px] border-tinta bg-tinta">
        <div className="vm-faixa flex w-max gap-10 px-5 py-4 font-titulo text-2xl font-extrabold whitespace-nowrap text-neon sm:text-[28px]">
          {[...faixa, ...faixa].map((t, i) => (
            <span key={i} className="inline-flex items-center gap-10">
              {t}
              <IconeEstrela tamanho={22} />
            </span>
          ))}
        </div>
      </div>

      {/* Cupons vigentes (os 3 primeiros; o resto fica em /cupons) */}
      {cuponsNaHome.length > 0 && (
        <section id="cupons" className="mx-auto max-w-7xl scroll-mt-48 px-4 pt-16 pb-4 sm:px-8 lg:pt-24">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
            <div>
              <h2 className="vm-titulo">Cupons do dia</h2>
              <p className="mt-3 max-w-[52ch] text-lg text-cinza">Copie, cole no pagamento e economize. Cada um mostra até quando vale.</p>
            </div>
            {cupons.length > cuponsNaHome.length && (
              <Link href="/cupons" className="text-[17px] font-bold underline decoration-neon decoration-[3px] underline-offset-4">
                Ver todos os cupons
              </Link>
            )}
          </div>
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {cuponsNaHome.map((c) => (
              <CartaoCupom key={c.id} cupom={c} categoria={c.categoria_id ? nomes.get(c.categoria_id) : undefined} compacto />
            ))}
          </ul>
        </section>
      )}

      {/* Em destaque (produtos marcados no painel) */}
      {destaques.itens.length > 0 && (
        <section id="destaques" className="mx-auto max-w-7xl scroll-mt-48 px-4 pt-16 pb-4 sm:px-8 lg:pt-24">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
            <div>
              <h2 className="vm-titulo flex items-center gap-3">
                <IconeEstrela tamanho={34} />
                Em destaque
              </h2>
              <p className="mt-3 max-w-[52ch] text-lg text-cinza">Os achadinhos que {F.a} separou para você olhar primeiro.</p>
            </div>
            {destaques.total > destaques.itens.length && (
              <Link href="/destaques" className="text-[17px] font-bold underline decoration-neon decoration-[3px] underline-offset-4">
                Ver todos os destaques
              </Link>
            )}
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
            {destaques.itens.map((p) => (
              <CartaoProduto key={p.id} produto={p} categoria={p.categoria_id ? nomes.get(p.categoria_id) : undefined} comCupom={!!p.categoria_id && comCupom.has(p.categoria_id)} />
            ))}
          </ul>
        </section>
      )}

      {/* Radar de ofertas */}
      {principal && (
        <section id="ofertas" className="mx-auto max-w-7xl px-4 pt-16 pb-6 sm:px-8 lg:pt-24">
          <div className="mb-9 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
            <div>
              <h2 className="vm-titulo">Radar de ofertas</h2>
              <p className="mt-3 max-w-[52ch] text-lg text-cinza">O valor riscado é o último preço que o site registrou antes da queda.</p>
            </div>
            <Link href="/promocoes" className="text-[17px] font-bold underline decoration-neon decoration-[3px] underline-offset-4">
              Ver todas as promoções
            </Link>
          </div>

          <div className="flex flex-wrap gap-7">
            <article className="vm-cartao relative flex min-w-0 flex-[1_1_480px] flex-col gap-4 rounded-[30px] border-[3px] border-tinta bg-pessego p-5 shadow-duro sm:p-6">
              <div className="relative rounded-[22px] border-2 border-tinta bg-white">
                <div className="mx-auto max-w-[360px] overflow-hidden rounded-[22px]">
                  <ImagemProduto url={principal.imagem_url} nome={principal.nome} prioridade />
                </div>
                {principal.desconto_percentual && (
                  <span className="absolute -top-4 -right-3">
                    <SeloDesconto desconto={principal.desconto_percentual} grande />
                  </span>
                )}
              </div>
              {principal.ficticio && <p className="self-start rounded-md bg-tinta px-2 py-0.5 text-xs font-bold text-white">Demonstração: dado fictício</p>}
              <div className="flex items-start justify-between gap-4">
                <div>
                  {principal.categoria_id && nomes.get(principal.categoria_id) && (
                    <p className="mb-1.5 text-sm font-bold text-cinza">{nomes.get(principal.categoria_id)}</p>
                  )}
                  <h3 className="font-titulo text-2xl leading-tight font-bold tracking-[-0.02em] sm:text-3xl">
                    <Link href={`/produto/${principal.slug}`} className="text-tinta no-underline hover:underline">
                      {principal.nome}
                    </Link>
                  </h3>
                </div>
                <BotaoSalvar id={principal.id} nome={principal.nome} grande />
              </div>
              <Preco atual={principal.preco_atual} anterior={principal.preco_anterior} desconto={principal.desconto_percentual} grande />
              {principal.preco_anterior_em && (
                <p className="-mt-2 text-sm text-cinza">Preço anterior registrado em {formatarDataHora(principal.preco_anterior_em)}</p>
              )}
              {principal.ficticio ? (
                <Link href={`/produto/${principal.slug}`} className="vm-btn vm-pilula min-h-14 bg-white text-lg text-tinta">
                  Ver detalhes
                </Link>
              ) : (
                <a href={`/ir/${principal.id}`} target="_blank" rel="nofollow sponsored noopener" className="vm-btn vm-pilula min-h-[58px] bg-neon text-[19px] font-extrabold text-tinta">
                  Ver na Shopee
                  <IconeSaida />
                </a>
              )}
            </article>

            {quedas.length > 0 && (
              <ul className="grid min-w-0 flex-[1_1_480px] grid-cols-2 content-start gap-3 sm:gap-5">
                {quedas.map((p) => (
                  <CartaoProduto key={p.id} produto={p} categoria={p.categoria_id ? nomes.get(p.categoria_id) : undefined} comCupom={!!p.categoria_id && comCupom.has(p.categoria_id)} />
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {/* Achadinhos por categoria */}
      <section id="achadinhos" className="mx-auto max-w-7xl scroll-mt-48 px-4 pt-14 pb-20 sm:px-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <h2 className="vm-titulo">Achadinhos por categoria</h2>
          {recentes.total > recentes.itens.length && (
            <Link href="/ofertas" className="text-[17px] font-bold underline decoration-neon decoration-[3px] underline-offset-4">
              Ver todas as ofertas
            </Link>
          )}
        </div>
        {recentes.itens.length > 0 ? (
          <VitrineCategorias produtos={recentes.itens.map((p) => ({ ...p, categoriaNome: p.categoria_id ? nomes.get(p.categoria_id) : undefined }))} />
        ) : (
          <p className="rounded-3xl border-[2.5px] border-dashed border-tinta bg-pessego p-10 text-center font-titulo text-xl font-bold">
            Ainda não há ofertas publicadas. Volte em breve.
          </p>
        )}
      </section>

      {/* Pede pra Moni */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-x-10 gap-y-6 rounded-[30px] border-[3px] border-tinta bg-sol p-8 shadow-duro sm:p-10">
          <div className="min-w-0 flex-[1_1_420px]">
            <h2 className="font-titulo text-3xl leading-tight font-extrabold tracking-[-0.03em] sm:text-4xl">Não achou o que queria?</h2>
            <p className="mt-3 max-w-[52ch] text-lg leading-relaxed font-medium">
              Me conta o que você procura. Eu garimpo na Shopee e mando o link direto no seu WhatsApp.
            </p>
          </div>
          <Link href="/pedir" className="vm-btn vm-pilula min-h-14 bg-tinta px-7 text-lg font-extrabold text-white shadow-[5px_5px_0_#ffffff]">
            <IconeWhatsapp tamanho={22} />
            Pede {F.pra}
          </Link>
        </div>
      </section>

      {/* Quem é a Moni */}
      <section id="moni" className="scroll-mt-48 border-y-[3px] border-tinta bg-pessego">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-14 px-4 py-16 sm:px-8 lg:py-24">
          <div className="flex min-w-0 flex-[0_1_360px] justify-center">
            <div className="aspect-square w-[min(340px,78vw)] overflow-hidden rounded-full border-[3px] border-tinta bg-neon shadow-[0_0_0_12px_var(--color-neon),0_0_0_15px_#1e120c]">
              <img src={MARCA.foto} alt="" width={1024} height={1536} loading="lazy" className="block h-full w-full object-cover object-[center_12%]" />
            </div>
          </div>
          <div className="min-w-0 flex-[1_1_460px]">
            <h2 className="vm-titulo flex flex-wrap items-center gap-x-3.5 gap-y-1">
              Prazer, eu sou {F.a}!
              <IconeCoracao tamanho={48} />
            </h2>
            <p className="mt-5 max-w-[52ch] text-xl leading-relaxed">
              {MARCA.bio[0]}
            </p>
            {MARCA.bio[1] && (
              <p className="mt-3.5 max-w-[52ch] text-xl leading-relaxed">
                {MARCA.bio[1]} <IconeBrilho className="inline align-[-3px]" />
              </p>
            )}
            <div className="mt-7 flex flex-wrap gap-3">
              <a href={INSTAGRAM_URL} target="_blank" rel="noopener" aria-label={`Instagram ${F.da}`} title="Instagram" className="vm-btn flex size-[58px] items-center justify-center rounded-full border-[2.5px] border-tinta bg-white text-tinta shadow-duro-p">
                <IconeInstagram tamanho={26} />
              </a>
              {TELEGRAM_URL && (
                <a href={TELEGRAM_URL} target="_blank" rel="noopener" aria-label={`Grupo ${F.da} no Telegram`} title="Telegram" className="vm-btn flex size-[58px] items-center justify-center rounded-full border-[2.5px] border-tinta bg-white text-tinta shadow-duro-p">
                  <IconeTelegram tamanho={26} />
                </a>
              )}
              <a href={WHATSAPP_URL} target="_blank" rel="noopener" aria-label={`Falar com ${F.a} no WhatsApp`} title="WhatsApp" className="vm-btn flex size-[58px] items-center justify-center rounded-full border-[2.5px] border-tinta bg-white text-tinta shadow-duro-p">
                <IconeWhatsapp tamanho={26} />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Como funciona */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-8 lg:py-24">
        <h2 className="vm-titulo mb-8">Como funciona</h2>
        <ol className="grid list-none gap-5 p-0 sm:grid-cols-3">
          {[
            { n: 1, t: "Eu garimpo", d: "Escolho os produtos na Shopee e coloco aqui com o link oficial.", cor: "bg-neon" },
            { n: 2, t: "O site anota o preço", d: "Se o preço cair, o desconto aparece. Se subir, some. Sem desconto inventado.", cor: "bg-sol" },
            { n: 3, t: "Você compra na Shopee", d: "Pagamento, entrega e garantia são com a Shopee. Você não paga nada a mais.", cor: "bg-white" },
          ].map((p) => (
            <li key={p.n} className={`rounded-[26px] border-[3px] border-tinta p-7 shadow-duro ${p.cor}`}>
              <span className="font-titulo text-6xl leading-none font-extrabold">{p.n}</span>
              <h3 className="mt-3 mb-2 font-titulo text-2xl font-bold">{p.t}</h3>
              <p className="text-[17px] leading-relaxed font-medium">{p.d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Chamada final */}
      <section className="border-t-[3px] border-tinta bg-neon">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-10 gap-y-6 px-4 py-14 sm:px-8 lg:py-20">
          <h2 className="vm-titulo max-w-[16ch]">Quer receber os achadinhos primeiro?</h2>
          <a href={grupo.href} target="_blank" rel="noopener" className="vm-btn vm-pilula min-h-16 border-tinta bg-tinta px-8 text-xl font-extrabold text-white shadow-[6px_6px_0_#ffffff]">
            {grupo.icone}
            {grupo.longo}
          </a>
        </div>
      </section>
    </>
  );
}

