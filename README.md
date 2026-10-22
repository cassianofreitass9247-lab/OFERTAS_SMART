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

1. Cloudflare > **Turnstile** > **Add widget**. Nome: Vitrine da Moni. Hostname: `ofertasmart.cfsolutions.workers.dev` (e o domínio próprio, quando houver; se o endereço mudar, inclua o novo hostname no widget, senão o login e o pedido deixam de funcionar). Modo: **Managed**. Copie as duas chaves.
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
Padrão: os produtos entram **publicados e disponíveis**, com **categoria automática** (pelo nome, entre as categorias existentes; `src/lib/categoria-auto.ts`). Opcional: "Criar como rascunho". Na publicação, só vão ao ar produtos com foto e preço e sem termo da lista de bloqueio em `src/lib/lote.ts`; os demais ficam como rascunho). Cada importação vira um lote registrado, com botão **Desfazer lote** (despublica os publicados e apaga os rascunhos).
Requer a migração `0005_lotes_de_importacao.sql`. A Shopee não ordena por desconto: "Maior desconto" reordena só entre os produtos buscados (até 50 por busca; use "Buscar mais").


### Modo automático (painel > Automação)

Uma vez por dia, nos **dias da semana e na hora (Brasília) escolhidos no painel** (padrão: todos os dias, 9h), o site busca na Shopee os mais vendidos e com maior desconto de cada categoria já existente e publica, já disponível, até o limite diário (padrão 30; o banco também impõe o limite). O Cloudflare acorda de hora em hora (Cron Trigger `0 * * * *` em `wrangler.jsonc`) e chama a rota interna `/api/automacao` com o cabeçalho `x-automacao-agendada`; quem decide se é a vez é o banco (`automacao_reivindicar`: ligada, dia escolhido, hora já chegou, hoje ainda não rodou). Se um disparo se perder, o seguinte recupera. "Rodar agora" não conta como a execução do dia.

Busca: 6 categorias por execução, em rodízio; para cada uma, 2 termos do dia (palavras da própria categoria em `src/lib/categoria-auto.ts`, que avançam a cada dia) x 3 páginas, ~36 chamadas à Shopee + 3 ao banco (o plano gratuito do Cloudflare permite ~50 chamadas externas por execução). Antes de contar a cota, o banco informa quais candidatos já existem (`automacao_existentes`). Só entram produtos com foto, preço de pelo menos R$ 15, link de afiliado válido, sem termo da lista de bloqueio, sem palavra de exclusão da categoria (ex.: "gato"/"cachorro" em Brinquedos) e cujo nome combine com a categoria buscada. A cota se divide entre as categorias (uma de cada vez) e o que uma não preenche vai para as outras. Cada execução vira um lote "automático" com "Desfazer lote". Pausa sozinha após 3 falhas seguidas. Começa **pausada**: ligue em Automação.
### Sincronização de preços (painel > Automação > Preços dos produtos)

Nas horas em que a importação não roda, o agendamento de hora em hora confere na Shopee o preço de até 35 produtos publicados (os verificados há mais tempo primeiro; 1 consulta por produto, dentro do limite de ~50 chamadas externas do plano gratuito do Cloudflare) e grava o novo preço pelas funções `precos_pendentes` / `precos_aplicar`. A queda aparece sozinha em "Radar de ofertas" pelo gatilho que já existia (o preço anterior é o último que o próprio site registrou); uma alta remove o valor riscado. Diferenças de menos de 1% são ignoradas, e quedas acima de 60% também (provável outra variação do anúncio). O preço vem da mesma consulta da importação (preço de lista da API: não considera Pix nem cupom). Botão "Conferir preços agora" e chave para pausar. Requer a migração `0009_sincronizar_precos.sql`.

- Requer as migrações `0006_automacao.sql`, `0007_automacao_existentes.sql` e `0008_automacao_agenda.sql` e as variáveis `SHOPEE_APP_ID` e `SHOPEE_SECRET` (a chave do agendamento é derivada do Secret; nada vai ao GitHub nem existe conta de robô).
- `worker.ts` é a entrada do Worker (site + agendamento); `main` em `wrangler.jsonc` aponta para ele.
- "Maior desconto" vale entre os mais vendidos que a Shopee devolve (a API não ordena por desconto).

## Cupons

Os cupons exclusivos do programa de afiliados (aba "Vouchers" do portal) são cadastrados à mão em **painel > Cupons**, porque a API de afiliados da Shopee não os expõe. Cada cupom tem título, código para copiar e/ou link de resgate, tipo (percentual, valor, frete grátis), compra mínima, categoria opcional e a data final da validade (vale até 23:59 de Brasília). O banco só entrega ao público o cupom ativo e dentro da validade, então o vencido some sozinho, sem rotina agendada. Aparecem em `/cupons`, nos 3 primeiros da página inicial, no selo "Cupom disponível" dos produtos da categoria do cupom e na página do produto. "Usos" soma os cliques no link (`/cupom/<id>`) e as cópias do código, sem dados pessoais. Requer a migração `0010_cupons.sql`.

## Opções automáticas nos pedidos ("Pede pra Moni")

Em **painel > Pedidos**, cada pedido novo tem o botão **Buscar opções**. O servidor procura na Shopee (por relevância e por mais vendidos), escolhe de 3 a 5 produtos variados (o mais parecido com o pedido, o mais vendido, o mais bem avaliado, o mais barato e o de maior desconto). Cada selo vale para o melhor entre TODOS os candidatos, então não mente: se o mesmo produto vence dois critérios, aparece uma vez com os dois selos ("Mais vendido e mais barato") e a vaga que sobra vira "Outra opção". "Mais barato" exige nota de pelo menos 4,3 e 20 vendas; "maior desconto" exige 20% de desconto e 50 vendas; produto de nota abaixo de 4,0 e anúncio repetido ficam de fora e gera o link de afiliado de cada um com `generateShortLink`, usando como `subIds` só o código do pedido e a posição da opção (nenhum dado pessoal), para o relatório de conversões mostrar a comissão por pedido. Se o pedido trouxe um link da Shopee como exemplo, esse produto entra primeiro e a busca parte do nome dele. O termo da busca vem do texto do pedido e pode ser ajustado antes de buscar.

A cliente recebe uma única página, `/pedido/<código secreto>` (122 bits aleatórios, sem indexação e sem cache), com as opções; o clique passa por `/pedido/ir/<id>`, que conta e leva ao link de afiliado. A página mostra só o primeiro nome e o pedido, nunca o WhatsApp. O botão **Enviar pelo WhatsApp e marcar como respondido** abre o WhatsApp da Moni com a mensagem pronta (o envio é feito por ela, no aparelho). As opções são gravadas por `pedido_gravar_opcoes`, protegida pela chave da automação (a aplicação continua sem usar a chave service_role), e apagam junto com o pedido, em até 90 dias. Requer a migração `0011_pedido_opcoes.sql` e as variáveis `SHOPEE_APP_ID` e `SHOPEE_SECRET`.

### Busca automática ao receber o pedido

Em **painel > Pedidos**, o interruptor **Busca automática ao receber o pedido** (migração `0012_pedidos_busca_automatica.sql`; nasce **desligado**). Ligado, assim que a pessoa envia o pedido o servidor faz a mesma busca do botão (até 20 segundos de espera) e a tela de confirmação mostra o botão **Ver as opções**, que leva à página `/pedido/<código secreto>`. O pedido é sempre salvo antes: se a busca falhar, demorar, achar nada ou o interruptor estiver desligado, a pessoa vê a confirmação de sempre e a Moni responde pelo botão manual. Teto de 30 buscas por hora (cada uma gasta cerca de 10 chamadas da cota da Shopee, que o site também usa para importar produtos e conferir preços); passado o teto, os pedidos seguem sem busca automática. O código da página sai do banco só para o servidor (`pedido_token`, com a chave da automação, e só na primeira hora do pedido). O envio da mensagem continua sendo da Moni pelo WhatsApp; enviar sozinho exigiria a API do WhatsApp Business (paga e com aprovação da Meta), que não está implementada.

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

## Marca configurável (um site por cliente)

Nome, apelido, gênero ("a Moni" / "o João"), Instagram, WhatsApp, foto, apresentação, descrição para o Google e as duas cores vêm de variáveis `NEXT_PUBLIC_MARCA_*` (lista comentada no `.env.example`). Sem nenhuma delas o site é a Vitrine da Moni, idêntico ao anterior.

- São valores de **build**: cadastre em *Build variables* da Cloudflare e faça novo deploy após qualquer mudança.
- Valor inválido é ignorado (vale o padrão) e aparece como "Marca: ..." nas pendências do painel.
- A cor principal é validada (precisa contrastar com o texto escuro); os tons de apoio e o ícone do site são derivados dela.
- Ao trocar a foto, coloque o arquivo em `public/` (ou use um endereço https). `public/foto-padrao.svg` é um espaço reservado neutro.
- O painel e os textos legais (privacidade, termos) usam o nome configurado. Revise-os para cada cliente: o responsável e o e-mail vêm de `NEXT_PUBLIC_RESPONSAVEL` e `NEXT_PUBLIC_CONTATO_EMAIL`.

### Checklist para um novo cliente

1. Contas **no nome do cliente**: Supabase, Cloudflare e programa de afiliados da Shopee (a chave Open API é dele).
2. Novo projeto Supabase; rode `supabase/migrations/0001` a `0012` em ordem; crie o primeiro usuário e dê a ele o papel de admin.
3. Novo Worker apontando para este repositório (nome do Worker diferente do `name` do `wrangler.jsonc` ou uma cópia da configuração).
4. Variáveis de build: Supabase, `NEXT_PUBLIC_SITE_URL`, contato, responsável e `NEXT_PUBLIC_MARCA_*`. Segredos no Worker: Turnstile e Shopee.
5. Supabase > Authentication > URL Configuration com o endereço do site; deploy; conferir o painel (pendências).

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

## Local dos cliques (estado e cidade)

Cada clique em "Ver na Shopee" (`/ir/<id>`) guarda país, estado e cidade aproximados, lidos pela Cloudflare no momento do clique (`getCloudflareContext().cf`, campos `country`, `regionCode` e `city`). **O endereço IP não é lido nem guardado.** A localização é uma estimativa pelo IP: o estado costuma acertar mais que a cidade, e em internet de celular a cidade pode errar. Cliques anteriores à migração `0014_local_dos_cliques.sql` ficam sem local. O painel mostra os dez estados e as dez cidades do período em **Resumo > De onde vêm os cliques**. A política de privacidade menciona esse dado. Fora da Cloudflare (ambiente local) o clique é registrado sem local.
