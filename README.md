# OfertaSmart

Portal de ofertas da Shopee com links de afiliado, painel administrativo e importação por planilha.

## O que já funciona (etapas 1 e 2 do plano)

- Site público: página inicial, ofertas com busca e ordenação, promoções, categorias, página de produto, páginas de afiliados, privacidade, termos e contato, sitemap e robots.
- Painel em `/admin`: login, resumo com cliques, cadastro e edição de produtos, categorias, importação por CSV, publicar e despublicar.
- Contagem de cliques por produto, canal e campanha, sem guardar dados pessoais.
- Histórico de preços e de alterações de cada produto.
- Dados de demonstração sempre marcados como fictícios, sem botão de compra.

## O que ainda não existe

| Item | Situação |
|---|---|
| Integração com a API da Shopee | Depende de a Shopee liberar a Open API na sua conta de afiliado |
| Sincronização automática e fila de tarefas | Próxima etapa |
| Publicação no Telegram, Instagram, Facebook e Pinterest | Etapas seguintes |
| Cupons | Etapa seguinte |
| Vendas e comissões | Só com a API da Shopee |
| Publicação do site na internet | Próximo passo, junto com você |

## Regra do preço anterior ("de/por")

Não existe campo para digitar preço anterior. O sistema só mostra desconto quando ele mesmo registrou um preço maior antes:

1. Você cadastra o produto por R$ 200,00.
2. Dias depois, altera para R$ 150,00 (pelo painel ou reimportando a planilha).
3. O site passa a mostrar "de R$ 200,00 por R$ 150,00 (-25%)", com a data do registro.

Se o preço subir, o desconto some. Se você digitou um preço errado, marque "Estou corrigindo um preço digitado errado" ao salvar.

## Configuração do banco (Supabase)

Os nomes dos menus do Supabase podem mudar um pouco com o tempo.

1. Crie uma conta em https://supabase.com e um projeto novo (região São Paulo).
2. Abra **SQL Editor**, clique em **New query**, cole todo o conteúdo de `supabase/migrations/0001_base.sql` e clique em **Run**.
3. Abra **Authentication > Users > Add user**, informe seu e-mail e uma senha forte, e marque a confirmação automática do e-mail.
4. Volte ao **SQL Editor** e rode, trocando o e-mail pelo seu:

   ```sql
   insert into public.administradores (user_id)
   select id from auth.users where email = 'seu-email@exemplo.com';
   ```

5. Em **Authentication**, nas configurações de cadastro, desative a opção de novos usuários se cadastrarem sozinhos. Mesmo se ficar ligada, uma conta nova não consegue alterar nada, porque só quem está na tabela `administradores` tem permissão.
6. Em **Project Settings > API**, copie a **Project URL** e a chave pública (**anon** ou **publishable**).

Este projeto não usa a chave secreta (**service_role**). Não a copie para lugar nenhum.

## Variáveis de ambiente

Veja `.env.example`. São cinco valores, nenhum deles secreto:

| Variável | O que é |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL do Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave pública do Supabase |
| `NEXT_PUBLIC_SITE_URL` | Endereço do site, sem barra no final |
| `NEXT_PUBLIC_CONTATO_EMAIL` | E-mail exibido na página de contato |
| `NEXT_PUBLIC_RESPONSAVEL` | Nome do responsável, exibido na política de privacidade |

## Importação por CSV

No painel, em **Importar CSV**, há a planilha modelo e a explicação de cada coluna. Resumo:

- Colunas obrigatórias: `nome`, `link_afiliado`, `preco_atual`.
- Só são aceitos links `https` dos domínios `shopee.com.br` (inclui `s.shopee.com.br`) e `shope.ee`. A lista fica em `src/lib/produto.ts`.
- Produto com o mesmo link ou o mesmo ID da Shopee é atualizado, não duplicado.
- Linhas com erro são rejeitadas com o motivo e o número da linha. As demais entram.
- Marque "Só conferir o arquivo" para ver o resultado sem gravar nada.

## Medir cliques por canal

Divulgue o endereço `SEU-SITE/ir/ID-DO-PRODUTO?canal=telegram&campanha=semana-1`. O endereço pronto aparece na tela de edição de cada produto.

## Para quem for mexer no código

```bash
npm install
cp .env.example .env.local   # preencha os valores
npm run dev                  # http://localhost:3000
npm run verificar            # lint + tipos + testes + build
```

- `supabase/migrations/`: estrutura do banco e políticas de acesso (RLS).
- `tests/db/`: testes das regras do banco, rodando as migrações reais em um PostgreSQL em memória.
- `tests/unit/`: testes de preço, CSV e validação de links.
- `src/lib/database.types.ts`: tipos do banco. Atualize junto com cada migração.

## Limites conhecidos

- Os testes do banco usam PostgreSQL em memória com os papéis do Supabase imitados. O primeiro uso em um projeto Supabase real ainda precisa ser conferido.
- O contador de cliques não tem limite de requisições: alguém mal-intencionado pode inflar os números. Será tratado na etapa de automação.
- As páginas de privacidade e termos são um ponto de partida e não substituem a revisão de um advogado.
