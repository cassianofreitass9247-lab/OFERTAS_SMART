# Vitrine da Moni

Vitrine da Moni: portal de ofertas da Shopee com links de afiliado, painel administrativo e importação por planilha.

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
| Publicação do site na internet | Configuração da Cloudflare pronta e testada localmente; falta o deploy (veja abaixo) |

## Regra do preço anterior ("de/por")

Não existe campo para digitar preço anterior. O sistema só mostra desconto quando ele mesmo registrou um preço maior antes:

1. Você cadastra o produto por R$ 200,00.
2. Dias depois, altera para R$ 150,00 (pelo painel ou reimportando a planilha).
3. O site passa a mostrar "de R$ 200,00 por R$ 150,00 (-25%)", com a data do registro.

Se o preço subir, o desconto some. Se você digitou um preço errado, marque "Estou corrigindo um preço digitado errado" ao salvar.

## Configuração do banco (Supabase)

Os nomes dos menus do Supabase podem mudar um pouco com o tempo.

1. Crie uma conta em https://supabase.com e um projeto novo (região São Paulo).
2. Abra **SQL Editor**, clique em **New query**, cole todo o conteúdo de `supabase/migrations/0001_base.sql` e clique em **Run**. Depois, em outra **New query**, faça o mesmo com `0002_pedidos_e_video.sql` (pedidos “Pede pra Moni” e vídeo do produto) depois com `0003_galeria_de_imagens.sql` (várias fotos por produto) e por último com `0004_protecao_contra_abuso.sql` (consentimento e chave do servidor nos pedidos, teto de cliques). Cada arquivo roda uma única vez, na ordem.
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

### Proteção contra robôs (Cloudflare Turnstile)

O formulário "Pede pra Moni" e o login do painel usam o Turnstile, o "não sou robô" gratuito do Cloudflare (quase sempre invisível). Ele usa duas variáveis **do Worker em execução** (não são variáveis de build):

| Variável | Tipo no Cloudflare | O que é |
|---|---|---|
| `TURNSTILE_SITE_KEY` | Text | Chave do site (pública) |
| `TURNSTILE_SECRET_KEY` | **Secret** | Chave secreta. Nunca no GitHub, no chat ou em `NEXT_PUBLIC_*` |

1. Cloudflare > **Turnstile** > **Add widget**. Nome: Vitrine da Moni. Hostname: `ofertasmart.vitrinedamoni.workers.dev` (e o domínio próprio, quando houver). Modo: **Managed**. Copie as duas chaves.
2. **Workers & Pages** > `ofertasmart` > **Settings** > **Variables and Secrets** > **Add**: `TURNSTILE_SITE_KEY` (Text) e `TURNSTILE_SECRET_KEY` (Secret). Salve (**Deploy**).
3. Abra o painel do site uma vez, logado como administradora. Isso registra no banco a chave que impede robôs de criar pedidos direto pela API do Supabase.

Sem as duas variáveis, a proteção fica desligada e o Resumo do painel mostra a pendência. Com só uma, o pedido e o login recusam envios (configuração incompleta). Se trocar a chave secreta, abra o painel de novo para registrar a nova chave; até lá, os pedidos são recusados.

## Importar da Shopee (Open API)

Em **Painel > Importar da Shopee**, cole o link de um produto (ou só o número dele) ou digite o que procura. O site consulta a Shopee Affiliate Open API (GraphQL), mostra nome, foto, preço e comissão e cria um **rascunho** com o seu link de afiliado. A comissão aparece só no painel. Nada é publicado sozinho.

Variáveis do **Worker em execução** (Cloudflare > Workers & Pages > `ofertasmart` > Settings > Variables and Secrets), não de build:

| Variável | Tipo | O que é |
|---|---|---|
| `SHOPEE_APP_ID` | Text | AppID da Open API (portal de afiliados) |
| `SHOPEE_SECRET` | **Secret** | Secret da Open API. Nunca no GitHub, no chat ou em `NEXT_PUBLIC_*` |

Depois de salvar, abra a tela e clique em **Testar conexão**. Se a Shopee recusar, a mensagem diz o motivo (credenciais, limite de consultas, conta sem acesso). A assinatura segue a documentação: `SHA256(AppID + Timestamp + corpo + Secret)`.

Notas: o preço importado é o menor entre as variações do produto; a categoria e a descrição ficam para você preencher; produtos já cadastrados (mesmo ID da Shopee) não são duplicados; links curtos (`s.shopee.com.br`, `shope.ee`) são resolvidos só em endereços da Shopee. A Shopee não dá suporte à API e não informa os limites de consulta.

### Importar em lote (painel > Importar em lote)

Busca na Shopee (palavra-chave opcional), filtra por vendas, nota, desconto e comissão, mostra fotos e importa até 30 produtos marcados de uma vez.
Padrão: tudo entra como **rascunho**. Opcional: "Publicar direto, sem rascunho" (exige confirmação; só vão ao ar produtos com foto e preço e sem termo da lista de bloqueio em `src/lib/lote.ts`; os demais ficam como rascunho). Cada importação vira um lote registrado, com botão **Desfazer lote** (despublica os publicados e apaga os rascunhos).
Requer a migração `0005_lotes_de_importacao.sql`. A Shopee não ordena por desconto: "Maior desconto" reordena só entre os produtos buscados (até 50 por busca; use "Buscar mais").

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

## Publicação na Cloudflare Workers

O projeto já está configurado (`wrangler.jsonc`, `open-next.config.ts`, adaptador `@opennextjs/cloudflare`).
O build da Cloudflare e as 27 verificações do navegador passaram no ambiente local `wrangler dev` (workerd), contra um banco de teste.

Medidas do build: pacote de 1,4 MB compactado (6,9 MiB no total). O limite atual documentado pela Cloudflare é de 64 MiB descompactado.

Comandos (para quem usa terminal): `npm run preview` testa no ambiente da Cloudflare e `npm run deploy` publica.

### Passo a passo pelo painel da Cloudflare

Os nomes das telas podem mudar. Esta parte não foi conferida na documentação oficial.

1. Crie a conta em https://dash.cloudflare.com e abra **Workers & Pages**.
2. Clique em **Create** e escolha importar um repositório do GitHub. Autorize a Cloudflare e selecione `OFERTAS_SMART`.
3. Nome do Worker: `ofertasmart` (precisa ser igual ao campo `name` do `wrangler.jsonc`).
4. Comando de build: `npx opennextjs-cloudflare build`. Comando de deploy: `npx opennextjs-cloudflare deploy`.
5. Em **Build variables and secrets**, cadastre as cinco variáveis do `.env.example`. A chave pública do Supabase deve usar o nome `NEXT_PUBLIC_SUPABASE_ANON_KEY`. As variáveis `NEXT_PUBLIC_` são gravadas no site durante o build, então precisam estar cadastradas antes do primeiro deploy.
6. Salve e faça o deploy. O site fica em um endereço `ofertasmart.<sua-conta>.workers.dev`.
7. Volte ao Supabase, em **Authentication > URL Configuration**, e informe esse endereço.
8. Atualize `NEXT_PUBLIC_SITE_URL` com o endereço final e faça um novo deploy.

### O que ainda não foi medido

- O consumo de CPU por requisição (limite de 10 ms no plano grátis) só pode ser medido no ambiente real da Cloudflare.
  As páginas com dados ao vivo consultam o banco a cada acesso. Se estourar, o plano pago custa a partir de US$ 5/mês.
