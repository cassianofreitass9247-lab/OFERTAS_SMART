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
export type Clique = { id: number; produto_id: string; canal: string; campanha: string | null; criado_em: string };
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
  criado_em: string;
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
      registrar_clique: { Args: { p_produto: string; p_canal?: string; p_campanha?: string | null }; Returns: string | null };
      importar_produtos: {
        Args: { p_itens: Json; p_arquivo?: string | null; p_rejeitados?: number; p_erros?: Json };
        Returns: { inseridos: number; atualizados: number };
      };
      produtos_mais_clicados: {
        Args: { p_dias?: number; p_limite?: number };
        Returns: { produto_id: string; nome: string; slug: string; cliques: number }[];
      };
      cliques_por_canal: { Args: { p_dias?: number }; Returns: { canal: string; campanha: string; cliques: number }[] };
      criar_pedido: {
        Args: { p_nome: string; p_whatsapp: string; p_descricao: string; p_referencia?: string | null; p_consentimento?: boolean; p_chave?: string | null };
        Returns: string;
      };
      sincronizar_chave_servidor: { Args: { p_hash: string | null }; Returns: boolean };
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
