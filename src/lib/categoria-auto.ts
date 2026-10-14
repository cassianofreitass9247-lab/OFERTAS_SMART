/**
 * Categoria automática: escolhe, entre as categorias que já existem no site, a que melhor combina com o nome do produto.
 * Não cria categorias novas e não usa categorias da Shopee. Sem nenhuma pista clara, devolve null (produto sem categoria),
 * em vez de chutar. Para ajustar, edite as palavras abaixo (chave = slug da categoria; palavras sem acento, em minúsculas).
 */
export type CategoriaBasica = { id: string; nome: string; slug: string };

const PALAVRAS: Record<string, string[]> = {
  "natal-2026": ["natal", "natalino", "natalina", "papai noel", "arvore de natal", "pisca pisca", "guirlanda", "presepio"],
  "moda-infantil": ["infantil", "menina", "menino", "juvenil", "kids"],
  "mae-e-bebe": ["bebe", "mamadeira", "fralda", "chupeta", "berco", "gestante", "amamentacao", "maternidade", "recem nascido", "babador"],
  brinquedos: ["brinquedo", "boneca", "boneco", "lego", "quebra cabeca", "pelucia", "massinha", "bloco de montar", "pista de carrinho", "jogo de tabuleiro", "carrinho de brinquedo", "hot wheels"],
  eletrodomesticos: ["fritadeira", "air fryer", "liquidificador", "batedeira", "cafeteira", "microondas", "aspirador", "ventilador", "ferro de passar", "sanduicheira", "panela eletrica", "geladeira", "forno eletrico", "mixer", "processador de alimentos", "purificador", "chaleira eletrica", "umidificador", "climatizador", "lava e seca"],
  eletronicos: ["fone", "headphone", "headset", "caixa de som", "carregador", "smartwatch", "relogio inteligente", "celular", "smartphone", "tablet", "mouse", "teclado", "webcam", "power bank", "bluetooth", "monitor", "notebook", "ssd", "pen drive", "cartao de memoria", "tv box", "roteador", "camera de seguranca", "cabo usb", "cabo hdmi", "capinha"],
  beleza: ["batom", "perfume", "shampoo", "condicionador", "hidratante", "esmalte", "maquiagem", "skincare", "serum", "protetor solar", "sombra", "rimel", "secador de cabelo", "chapinha", "escova de cabelo", "base liquida", "po compacto", "gloss", "sabonete facial", "creme facial", "unha"],
  "roupas-femininas": ["vestido", "blusa", "saia", "cropped", "legging", "camisola", "biquini", "sutia", "calcinha", "conjunto feminino", "calca feminina", "short feminino", "regata feminina", "body feminino", "pijama feminino"],
  "esporte-e-lazer": ["bicicleta", "halter", "yoga", "camping", "bola de", "garrafa termica", "mochila esportiva", "fitness", "academia", "corda de pular", "barraca", "caneleira", "tenis de corrida", "natacao", "pesca", "skate", "patins", "kettlebell", "elastico de treino"],
  saude: ["termometro", "medidor de pressao", "oximetro", "massageador", "suplemento", "colageno", "ortopedico", "curativo", "balanca digital", "tensiometro", "inalador", "vitamina"],
  "casa-e-construcao": ["organizador", "panela", "utensilio", "jogo de cama", "lencol", "toalha", "tapete", "cortina", "furadeira", "parafusadeira", "ferramenta", "lampada", "luminaria", "pote", "prateleira", "cabide", "tabua de", "faca", "escorredor", "decoracao", "colcha", "travesseiro", "fita led", "chuveiro", "torneira", "fechadura", "vassoura", "rodo", "lixeira", "talheres", "marmita", "frigideira"],
};

export const semAcento = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const contem = (texto: string, termo: string) => ` ${texto} `.includes(` ${termo} `);

/** Para palavra única aceita plural simples (fone -> fones). */
const casa = (texto: string, termo: string) => contem(texto, termo) || (!termo.includes(" ") && (contem(texto, termo + "s") || contem(texto, termo + "es")));

/**
 * Pontua cada categoria pelo número de palavras que aparecem no nome. Vence a maior pontuação; empate vai para a
 * categoria mais específica (a que vem antes na lista acima). Categorias com slug desconhecido usam as palavras do próprio nome.
 */
export function categoriaAutomatica(nomeProduto: string, categorias: CategoriaBasica[]): string | null {
  const texto = semAcento(nomeProduto);
  if (!texto) return null;
  const ordem = Object.keys(PALAVRAS);
  let melhor: { id: string; pontos: number; posicao: number } | null = null;
  for (const c of categorias) {
    const palavras = PALAVRAS[c.slug] ?? semAcento(c.nome).split(" ").filter((p) => p.length >= 4 && !["para", "casa"].includes(p));
    const pontos = palavras.filter((p) => casa(texto, p)).length;
    if (pontos === 0) continue;
    const idx = ordem.indexOf(c.slug);
    const posicao = idx === -1 ? ordem.length : idx;
    if (!melhor || pontos > melhor.pontos || (pontos === melhor.pontos && posicao < melhor.posicao)) melhor = { id: c.id, pontos, posicao };
  }
  return melhor?.id ?? null;
}
