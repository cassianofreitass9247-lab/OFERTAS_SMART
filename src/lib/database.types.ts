// Tipos do banco, escritos à mão para espelhar supabase/migrations.
// Ao criar uma nova migração, atualize este arquivo (o TypeScript passa a
// apontar qualquer consulta que use coluna inexistente).

export type Json = string | number | boolean | null | { [chave: string]: Json | undefined } | Json[];

export type OrigemProduto = "manual" | "csv" | "shopee_api" | "demo";
export type Disponibilidade = "disponivel" | "indisponivel" | "desconhecido";
export type StatusPublicacao = "rascunho" | "publicado" | "despublicado";

export type Categoria = {
  id: string;
  nome: string;
  slug: string;
  descricao: string | null;
  ativa: boolean;
  criado_em: string;
};

export type Produto = {
  id: string;
  nome: string;
  slug: string;
  descricao: string | null;
  imagem_url: string | null;
  /** Fotos adicionais, em ordem (a capa fica em imagem_url). Ausente até a migração 0003 ser aplicada. */
  imagens?: string[];
  /** Ausente até a migração 0002 ser aplicada. */
  video_url?: string | null;
  categoria_id: string | null;
  preco_atual: number;
  preco_anterior: number | null;
  preco_anterior_fonte: "historico_proprio" | "shopee_api" | null;
  preco_anterior_em: string | null;
  desconto_percentual: number | null;
  link_afiliado: string;
  id_externo: string | null;
  /** Lote de importação da Shopee em que o produto entrou. Ausente até a migração 0005 ser aplicada. */
  lote_id?: string | null;
  origem: OrigemProduto;
  ficticio: boolean;
  disponibilidade: Disponibilidade;
  status_publicacao: StatusPublicacao;
  destaque: boolean;
  preco_atualizado_em: string;
  preco_verificado_em: string | null;
  origem_atualizada_em: string;
  criado_em: string;
  atualizado_em: string;
};

type ProdutoGravavel = {
  nome: string;
  slug: string;
  preco_atual: number;
  link_afiliado: string;
  descricao?: string | null;
  imagem_url?: string | null;
  imagens?: string[];
  video_url?: string | null;
  categoria_id?: string | null;
  id_externo?: string | null;
  lote_id?: string | null;
  origem?: OrigemProduto;
  disponibilidade?: Disponibilidade;
  status_publicacao?: StatusPublicacao;
  destaque?: boolean;
  preco_anterior?: null;
};

export type HistoricoPreco = { id: number; produto_id: string; preco: number; registrado_em: string };
export type HistoricoAlteracao = {
  id: number;
  produto_id: string;
  campo: string;
  valor_antigo: string | null;
  valor_novo: string | null;
  alterado_por: string | null;
  alterado_em: string;
};
export type Clique = {
  id: number;
  produto_id: string;
  canal: string;
  campanha: string | null;
  pais: string | null;
  estado: string | null;
  cidade: string | null;
  criado_em: string;
};
export type Importacao = {
  id: string;
  arquivo_nome: string | null;
  total: number;
  inseridos: number;
  atualizados: number;
  rejeitados: number;
  erros: Json;
  criado_por: string | null;
  criado_em: string;
};

export type StatusPedido = "novo" | "respondido" | "arquivado";
export type Pedido = {
  id: string;
  nome: string;
  whatsapp: string;
  descricao: string;
  referencia_url: string | null;
  status: StatusPedido;
  produto_id: string | null;
  link_enviado: string | null;
  respondido_em: string | null;
  /** Ausente antes da migração 0004. */
  consentimento_em?: string | null;
  /** Código secreto da página pública do pedido. Ausente antes da migração 0011. */
  token?: string;
  busca_termo?: string | null;
  buscado_em?: string | null;
  busca_resultado?: string | null;
  criado_em: string;
};

export type PedidoOpcao = {
  id: string;
  pedido_id: string;
  posicao: number;
  rotulo: string;
  nome: string;
  imagem_url: string | null;
  preco: number | null;
  nota: number | null;
  vendas: number | null;
  loja: string | null;
  link_afiliado: string;
  id_externo: string | null;
  cliques: number;
  criado_em: string;
};

export type TipoCupom = "percentual" | "valor" | "frete" | "outro";
export type Cupom = {
  id: string;
  titulo: string;
  codigo: string | null;
  link_resgate: string | null;
  tipo: TipoCupom;
  valor: number | null;
  teto: number | null;
  minimo_compra: number | null;
  descricao: string | null;
  categoria_id: string | null;
  valido_de: string;
  valido_ate: string;
  destaque: boolean;
  ativo: boolean;
  cliques: number;
  criado_em: string;
  atualizado_em: string;
};
type CupomGravavel = {
  titulo: string;
  valido_ate: string;
  codigo?: string | null;
  link_resgate?: string | null;
  tipo?: TipoCupom;
  valor?: number | null;
  teto?: number | null;
  minimo_compra?: number | null;
  descricao?: string | null;
  categoria_id?: string | null;
  valido_de?: string;
  destaque?: boolean;
  ativo?: boolean;
};

type SomenteLeitura<R> = { Row: R; Insert: never; Update: never; Relationships: [] };

export type LoteImportacao = {
  id: string;
  criado_em: string;
  criado_por: string | null;
  publicado_direto: boolean;
  total: number;
  retidos_por_bloqueio: number;
  filtros: Json;
  /** Criado pela rotina automática. Ausente até a migração 0006 ser aplicada. */
  automatico?: boolean;
};

export type AutomacaoConfig = {
  id: number;
  ativo: boolean;
  limite_diario: number;
  vendas_min: number;
  nota_min: number;
  desconto_min: number;
  comissao_min: number;
  cursor_categoria: number;
  erros_seguidos: number;
  pausado_motivo: string | null;
  ultima_execucao: string | null;
  ultimo_resultado: string | null;
  dias_semana: number[];
  hora_execucao: number;
  ultima_agendada: string | null;
  precos_ativo: boolean;
  precos_ultima_execucao: string | null;
  precos_ultimo_resultado: string | null;
  atualizado_em: string;
};

export type Database = {
  public: {
    Tables: {
      administradores: SomenteLeitura<{ user_id: string; criado_em: string }>;
      categorias: {
        Row: Categoria;
        Insert: { nome: string; slug: string; descricao?: string | null; ativa?: boolean };
        Update: { nome?: string; slug?: string; descricao?: string | null; ativa?: boolean };
        Relationships: [];
      };
      produtos: { Row: Produto; Insert: ProdutoGravavel; Update: Partial<ProdutoGravavel>; Relationships: [] };
      historico_precos: SomenteLeitura<HistoricoPreco>;
      historico_alteracoes: SomenteLeitura<HistoricoAlteracao>;
      cliques: SomenteLeitura<Clique>;
      importacoes: SomenteLeitura<Importacao>;
      lotes_importacao: {
        Row: LoteImportacao;
        Insert: { publicado_direto?: boolean; total: number; retidos_por_bloqueio?: number; filtros?: Json; criado_por?: string | null };
        Update: never;
        Relationships: [];
      };
      automacao_config: {
        Row: AutomacaoConfig;
        Insert: never;
        Update: Partial<Pick<AutomacaoConfig, "ativo" | "limite_diario" | "vendas_min" | "nota_min" | "desconto_min" | "comissao_min" | "dias_semana" | "hora_execucao" | "precos_ativo" | "erros_seguidos" | "pausado_motivo" | "atualizado_em">>;
        Relationships: [];
      };
      cupons: { Row: Cupom; Insert: CupomGravavel; Update: Partial<CupomGravavel>; Relationships: [] };
      pedido_opcoes: SomenteLeitura<PedidoOpcao>;
      pedidos: {
        Row: Pedido;
        Insert: never;
        Update: { status?: StatusPedido; produto_id?: string | null; link_enviado?: string | null; respondido_em?: string | null };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      eh_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      registrar_clique: {
        Args: { p_produto: string; p_canal?: string; p_campanha?: string | null; p_pais?: string | null; p_estado?: string | null; p_cidade?: string | null };
        Returns: string | null;
      };
      cliques_locais: { Args: { p_dias?: number }; Returns: Json };
      importar_produtos: {
        Args: { p_itens: Json; p_arquivo?: string | null; p_rejeitados?: number; p_erros?: Json };
        Returns: { inseridos: number; atualizados: number };
      };
      produtos_mais_clicados: {
        Args: { p_dias?: number; p_limite?: number };
        Returns: { produto_id: string; nome: string; slug: string; cliques: number }[];
      };
      cliques_resumo: { Args: { p_dias?: number }; Returns: Json };
      cliques_por_canal: { Args: { p_dias?: number }; Returns: { canal: string; campanha: string; cliques: number }[] };
      criar_pedido: {
        Args: { p_nome: string; p_whatsapp: string; p_descricao: string; p_referencia?: string | null; p_consentimento?: boolean; p_chave?: string | null };
        Returns: string;
      };
      registrar_uso_cupom: { Args: { p_cupom: string }; Returns: string | null };
      pedido_gravar_opcoes: { Args: { p_chave: string; p_pedido: string; p_termo: string | null; p_resultado: string | null; p_opcoes: Json }; Returns: number };
      pedido_publico: { Args: { p_token: string }; Returns: Json };
      registrar_clique_opcao: { Args: { p_opcao: string }; Returns: string | null };
      definir_pedidos_auto: { Args: { p_ligado: boolean }; Returns: boolean };
      pedidos_auto_ligado: { Args: Record<PropertyKey, never>; Returns: boolean };
      pedidos_auto_disponivel: { Args: Record<PropertyKey, never>; Returns: boolean };
      pedido_token: { Args: { p_chave: string; p_pedido: string }; Returns: string | null };
      sincronizar_chave_servidor: { Args: { p_hash: string | null }; Returns: boolean };
      sincronizar_chave_automacao: { Args: { p_hash: string | null }; Returns: boolean };
      automacao_criados_hoje: { Args: Record<PropertyKey, never>; Returns: number };
      automacao_estado: { Args: { p_chave: string }; Returns: Json };
      automacao_registrar: { Args: { p_chave: string; p_itens: Json; p_filtros: Json; p_cursor: number }; Returns: Json };
      automacao_existentes: { Args: { p_chave: string; p_ids: string[] }; Returns: string[] };
      automacao_reivindicar: { Args: { p_chave: string }; Returns: boolean };
      precos_pendentes: { Args: { p_chave: string; p_limite: number }; Returns: Json };
      precos_aplicar: { Args: { p_chave: string; p_itens: Json }; Returns: Json };
      precos_falha: { Args: { p_chave: string; p_msg: string }; Returns: undefined };
      automacao_falha: { Args: { p_chave: string; p_msg: string }; Returns: undefined };
      carregar_dados_demo: { Args: Record<PropertyKey, never>; Returns: number };
      remover_dados_demo: { Args: Record<PropertyKey, never>; Returns: number };
    };
    Enums: {
      origem_produto: OrigemProduto;
      disponibilidade_produto: Disponibilidade;
      status_publicacao: StatusPublicacao;
    };
    CompositeTypes: Record<never, never>;
  };
};
