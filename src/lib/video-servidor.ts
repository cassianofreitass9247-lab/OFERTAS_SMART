import type { ItemImportacao } from "./produto";
import { analisarVideo } from "./video";

/**
 * Links curtos do TikTok (o que o botão "Copiar link" do app gera) apontam para o vídeo por redirecionamento.
 * Ao salvar, o site segue esse redirecionamento e guarda o endereço completo.
 *
 * Segurança (SSRF): só se busca um endereço que já passou por analisarVideo como link curto do TikTok, e cada
 * redirecionamento só é seguido se continuar em tiktok.com. Nada de outros destinos, no máximo 4 saltos, 6 s por busca.
 */
const MAX_SALTOS = 4;
const TEMPO_MS = 6000;
/** O plano gratuito do Cloudflare limita as chamadas externas por requisição; por isso o teto na importação. */
export const MAX_CURTOS_POR_IMPORTACAO = 10;

type Busca = (url: string, init: RequestInit) => Promise<Response>;
export type ResultadoVideo = { url: string } | { erro: string };

const doTikTok = (u: URL) => u.protocol === "https:" && (u.hostname === "tiktok.com" || u.hostname.endsWith(".tiktok.com"));

const ERRO_CURTO =
  "Não consegui abrir este link curto do TikTok. Abra o vídeo no navegador e copie o endereço completo (tiktok.com/@usuario/video/…).";

export async function resolverVideo(valor: string, buscar: Busca = fetch): Promise<ResultadoVideo> {
  const inicial = analisarVideo(valor);
  if (!inicial) return { erro: "Vídeo: link não reconhecido." };
  if (inicial.tipo !== "tiktok-curto") return { url: valor.trim() };

  let atual = new URL(inicial.link);
  try {
    for (let salto = 0; salto < MAX_SALTOS; salto++) {
      const resposta = await buscar(atual.toString(), {
        redirect: "manual",
        signal: AbortSignal.timeout(TEMPO_MS),
        headers: { "user-agent": "Mozilla/5.0 (compatible; VitrineDaMoni/1.0)", accept: "text/html" },
      });
      const destino = resposta.headers.get("location");
      if (![301, 302, 303, 307, 308].includes(resposta.status) || !destino) return { erro: ERRO_CURTO };

      const proximo = new URL(destino, atual);
      if (!doTikTok(proximo)) return { erro: ERRO_CURTO };
      // Guarda só o caminho: a parte depois do "?" tem rastreadores e não é necessária.
      const limpo = `https://www.tiktok.com${proximo.pathname}`;
      const v = analisarVideo(limpo);
      if (v?.tipo === "tiktok") return { url: limpo };
      if (v?.tipo === "tiktok-curto") {
        atual = proximo;
        continue;
      }
      return { erro: ERRO_CURTO };
    }
  } catch {
    return { erro: ERRO_CURTO };
  }
  return { erro: ERRO_CURTO };
}

/**
 * Importação por CSV: troca os links curtos pelos completos. Linha com link que não abre vira erro de linha
 * (o resto do arquivo segue normalmente). Links repetidos são resolvidos uma vez só.
 */
export async function resolverVideosDoCsv(
  itens: ItemImportacao[],
  linhas: number[],
  buscar: Busca = fetch,
): Promise<{ itens: ItemImportacao[]; erros: { linha: number; motivo: string }[] }> {
  const cache = new Map<string, ResultadoVideo>();
  const erros: { linha: number; motivo: string }[] = [];
  const saida: ItemImportacao[] = [];

  for (const [i, item] of itens.entries()) {
    const v = item.video_url ? analisarVideo(item.video_url) : null;
    if (v?.tipo !== "tiktok-curto") {
      saida.push(item);
      continue;
    }
    let r = cache.get(item.video_url!);
    if (!r) {
      r =
        cache.size >= MAX_CURTOS_POR_IMPORTACAO
          ? { erro: `Mais de ${MAX_CURTOS_POR_IMPORTACAO} links curtos do TikTok no arquivo: use o link completo ou divida o arquivo.` }
          : await resolverVideo(item.video_url!, buscar);
      cache.set(item.video_url!, r);
    }
    if ("erro" in r) erros.push({ linha: linhas[i], motivo: r.erro });
    else saida.push({ ...item, video_url: r.url });
  }
  return { itens: saida, erros };
}
