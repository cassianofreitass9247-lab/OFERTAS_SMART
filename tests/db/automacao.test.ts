import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createHash } from "node:crypto";
import { como, criarBanco } from "./banco";

let db: PGlite;
const CHAVE = "chave-da-automacao-de-teste";
const sha = (t: string) => createHash("sha256").update(t).digest("hex");
let n = 0;
const item = (extra: Record<string, unknown> = {}) => {
  n++;
  return { nome: `Produto auto ${n}`, link: `https://s.shopee.com.br/AUTO${n}`, imagem: "https://down-br.img.susercontent.com/file/x", id_externo: `9.${1000 + n}`, slug: `produto-auto-${n}-abc123`, preco: 49.9, categoria_id: null, ...extra };
};
const registrar = (itens: unknown[], chave: string | null = CHAVE, papel: "anon" | "admin" = "anon") =>
  como<{ r: { criados: number; ignorados: number; restante_antes: number } }>(db, papel, "select public.automacao_registrar($1, $2::jsonb, '{}'::jsonb, 3) as r", [chave, JSON.stringify(itens)]).then((x) => x[0].r);
const ligar = (ativo: boolean, limite = 30) => como(db, "admin", "update public.automacao_config set ativo = $1, limite_diario = $2 where id = 1", [ativo, limite]);

beforeAll(async () => {
  db = await criarBanco();
});

describe("automação (migração 0006)", () => {
  it("sem chave registrada ou com chave errada, tudo é recusado", async () => {
    await expect(como(db, "anon", "select public.automacao_estado($1)", [CHAVE])).rejects.toThrow(/Acesso negado/);
    await como(db, "admin", "select public.sincronizar_chave_automacao($1)", [sha(CHAVE)]);
    await expect(como(db, "anon", "select public.automacao_estado($1)", ["outra"])).rejects.toThrow(/Acesso negado/);
    await expect(como(db, "anon", "select public.automacao_estado(null)")).rejects.toThrow(/Acesso negado/);
    await expect(registrar([item()], "outra")).rejects.toThrow(/Acesso negado/);
    await expect(como(db, "anon", "select public.automacao_falha('outra', 'x')")).rejects.toThrow(/Acesso negado/);
  });

  it("só a administradora registra a chave e mexe na configuração; anônimo não lê nada", async () => {
    await expect(como(db, "anon", "select public.sincronizar_chave_automacao($1)", [sha(CHAVE)])).rejects.toThrow(/permission denied/);
    await expect(como(db, "comum", "select public.sincronizar_chave_automacao($1)", [sha(CHAVE)])).rejects.toThrow(/Acesso negado/);
    await expect(como(db, "anon", "select * from public.automacao_config")).rejects.toThrow(/permission denied/);
    expect(await como(db, "comum", "select * from public.automacao_config")).toHaveLength(0);
    expect(await como(db, "admin", "select * from public.automacao_config")).toHaveLength(1);
    await expect(como(db, "admin", "update public.automacao_config set limite_diario = 500")).rejects.toThrow(/check/);
  });

  it("pausada: recusa registrar", async () => {
    await expect(registrar([item()])).rejects.toThrow(/pausada/);
  });

  it("ligada: publica como disponível, em lote automático, e valida cada item", async () => {
    await ligar(true);
    const r = await registrar([
      item(),
      item({ link: "https://exemplo.com/fora" }),
      item({ imagem: "http://sem-https" }),
      item({ preco: 0 }),
      item({ id_externo: "abc" }),
      item({ slug: "SLUG RUIM" }),
      item({ link: "https://shopee.com.br@evil.com/x" }),
    ]);
    expect(r).toMatchObject({ criados: 1, ignorados: 6 });
    const [p] = await como<{ status_publicacao: string; disponibilidade: string; automatico: boolean }>(db, "admin", "select p.status_publicacao, p.disponibilidade, l.automatico from public.produtos p join public.lotes_importacao l on l.id = p.lote_id limit 1");
    expect(p).toEqual({ status_publicacao: "publicado", disponibilidade: "disponivel", automatico: true });
  });

  it("não duplica produto já cadastrado (mesmo ID ou link)", async () => {
    const [{ id_externo, link_afiliado }] = await como<{ id_externo: string; link_afiliado: string }>(db, "admin", "select id_externo, link_afiliado from public.produtos limit 1");
    const r = await registrar([item({ id_externo }), item({ link: link_afiliado })]);
    expect(r).toMatchObject({ criados: 0, ignorados: 2 });
  });

  it("impõe o limite diário no banco, mesmo que a rotina mande mais", async () => {
    await ligar(true, 3); // já existe 1 criado hoje
    const r = await registrar([item(), item(), item(), item()]);
    expect(r.criados).toBe(2);
    const r2 = await registrar([item()]);
    expect(r2).toMatchObject({ criados: 0, restante_antes: 0 });
    const [{ s }] = await como<{ s: number }>(db, "admin", "select public.automacao_criados_hoje() as s");
    expect(s).toBe(3);
  });

  it("desfazer o lote não libera a cota do dia", async () => {
    await como(db, "admin", "delete from public.produtos where lote_id in (select id from public.lotes_importacao where automatico)");
    const r = await registrar([item()]);
    expect(r.criados).toBe(0);
  });

  it("categoria inexistente vira sem categoria; categoria ativa é aplicada", async () => {
    await ligar(true, 60);
    const [{ id }] = await como<{ id: string }>(db, "admin", "insert into public.categorias (nome, slug) values ('Teste', 'teste') returning id");
    await registrar([item({ categoria_id: id }), item({ categoria_id: "11111111-1111-1111-1111-111111111111" })]);
    const linhas = await como<{ categoria_id: string | null }>(db, "admin", "select categoria_id from public.produtos order by criado_em desc limit 2");
    expect(linhas.filter((l) => l.categoria_id === id)).toHaveLength(1);
    expect(linhas.filter((l) => l.categoria_id === null)).toHaveLength(1);
    const [{ e }] = await como<{ e: { categorias: { slug: string }[]; ativo: boolean } }>(db, "anon", "select public.automacao_estado($1) as e", [CHAVE]);
    expect(e.ativo).toBe(true);
    expect(e.categorias.map((c) => c.slug)).toContain("teste");
  });

  it("3 falhas seguidas pausam sozinha; sucesso zera o contador", async () => {
    await ligar(true, 60);
    await como(db, "anon", "select public.automacao_falha($1, 'Shopee fora do ar')", [CHAVE]);
    await como(db, "anon", "select public.automacao_falha($1, 'Shopee fora do ar')", [CHAVE]);
    await registrar([]); // sucesso
    const [a] = await como<{ erros_seguidos: number }>(db, "admin", "select erros_seguidos from public.automacao_config");
    expect(a.erros_seguidos).toBe(0);
    for (let i = 0; i < 3; i++) await como(db, "anon", "select public.automacao_falha($1, 'Shopee fora do ar')", [CHAVE]);
    const [b] = await como<{ ativo: boolean; pausado_motivo: string }>(db, "admin", "select ativo, pausado_motivo from public.automacao_config");
    expect(b.ativo).toBe(false);
    expect(b.pausado_motivo).toMatch(/3 falhas/);
  });
});

describe("automacao_existentes (migração 0007)", () => {
  it("exige a chave e devolve só os ids que já existem entre os perguntados", async () => {
    await ligar(true, 60);
    const novo = item();
    await registrar([novo]);
    const existentes = (chave: string | null, ids: string[]) =>
      como<{ r: string[] }>(db, "anon", "select public.automacao_existentes($1, $2::text[]) as r", [chave, ids]).then((x) => x[0].r);
    expect(await existentes(CHAVE, [novo.id_externo as string, "9.999999999"])).toEqual([novo.id_externo]);
    expect(await existentes(CHAVE, [])).toEqual([]);
    await expect(existentes("outra", [novo.id_externo as string])).rejects.toThrow(/Acesso negado/);
    await expect(existentes(null, [novo.id_externo as string])).rejects.toThrow(/Acesso negado/);
    await expect(existentes(CHAVE, Array.from({ length: 1001 }, (_, i) => `9.${i}`))).rejects.toThrow(/demais/);
  });
});

describe("agenda da automação (migração 0008)", () => {
  const agora = async () => {
    const [x] = await como<{ dow: number; hora: number }>(db, "admin", "select extract(dow from now() at time zone 'America/Sao_Paulo')::int as dow, extract(hour from now() at time zone 'America/Sao_Paulo')::int as hora");
    return x;
  };
  const reivindicar = (chave: string | null = CHAVE) => como<{ r: boolean }>(db, "anon", "select public.automacao_reivindicar($1) as r", [chave]).then((x) => x[0].r);
  const agenda = (dias: number[], hora: number, ativo = true) =>
    como(db, "admin", "update public.automacao_config set ativo = $1, dias_semana = $2::smallint[], hora_execucao = $3, ultima_agendada = null, erros_seguidos = 0, pausado_motivo = null where id = 1", [ativo, `{${dias.join(",")}}`, hora]);

  it("padrão: todos os dias, 9h", async () => {
    const [c] = await como<{ dias_semana: number[]; hora_execucao: number }>(db, "admin", "select dias_semana, hora_execucao from public.automacao_config");
    expect(c.dias_semana).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(c.hora_execucao).toBe(9);
  });

  it("valida dias e hora", async () => {
    await expect(como(db, "admin", "update public.automacao_config set dias_semana = '{}'")).rejects.toThrow(/check/);
    await expect(como(db, "admin", "update public.automacao_config set dias_semana = '{7}'")).rejects.toThrow(/check/);
    await expect(como(db, "admin", "update public.automacao_config set hora_execucao = 24")).rejects.toThrow(/check/);
    await expect(como(db, "admin", "update public.automacao_config set hora_execucao = -1")).rejects.toThrow(/check/);
  });

  it("exige a chave", async () => {
    await expect(reivindicar("outra")).rejects.toThrow(/Acesso negado/);
    await expect(reivindicar(null)).rejects.toThrow(/Acesso negado/);
  });

  it("devolve true uma única vez por dia, quando a hora já chegou, hoje é dia escolhido e está ligada", async () => {
    const { dow } = await agora();
    await agenda([dow], 0);
    expect(await reivindicar()).toBe(true);
    expect(await reivindicar()).toBe(false); // já rodou hoje
    const [c] = await como<{ ok: boolean }>(db, "admin", "select ultima_agendada = (now() at time zone 'America/Sao_Paulo')::date as ok from public.automacao_config");
    expect(c.ok).toBe(true);
  });

  it("não roda em dia não escolhido, antes da hora ou pausada", async () => {
    const { dow, hora } = await agora();
    await agenda([0, 1, 2, 3, 4, 5, 6].filter((d) => d !== dow), 0);
    expect(await reivindicar()).toBe(false);
    if (hora < 23) {
      await agenda([dow], hora + 1);
      expect(await reivindicar()).toBe(false);
    }
    await agenda([dow], 0, false);
    expect(await reivindicar()).toBe(false);
  });

  it("anônimo não lê nem altera a agenda", async () => {
    await expect(como(db, "anon", "update public.automacao_config set hora_execucao = 3")).rejects.toThrow(/permission denied/);
  });
});
