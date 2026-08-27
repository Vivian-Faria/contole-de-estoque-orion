# Controle de estoque

App de contagem de estoque por hub, com relatório de consumo.
React + Vite, publicado no Netlify.

## Por que a página estava quebrada

O arquivo `.jsx` sozinho não é um site. Ele é o código-fonte de um componente:
o navegador não entende `import`, nem JSX, nem sabe onde buscar o React e o
Recharts. O Netlify serviu o arquivo como texto e a página ficou em branco.

O que faltava, e está aqui:

- `index.html` — a página que o navegador abre de fato
- `src/main.jsx` — o ponto que monta o React dentro dela
- `package.json` — as bibliotecas (React, Recharts)
- `vite.config.js` — o build que transforma tudo em HTML, CSS e JS comuns
- `netlify.toml` — diz ao Netlify como buildar e o que publicar
- `netlify/functions/dados.mjs` — o banco de dados (veja abaixo)

## Publicando

1. Suba **esta pasta inteira** para o repositório do GitHub (não só o `.jsx`).
2. No Netlify, refaça o deploy.

É só isso. O `netlify.toml` já define o build command (`npm run build`), a pasta
publicada (`dist`) e a pasta das funções. Não há nada para configurar na
interface do Netlify e nenhuma variável de ambiente para criar.

Para rodar na sua máquina: `npm install` e depois `npm run dev`.

## O banco de dados

Os dados ficam no **Netlify Blobs**, um armazenamento que já vem junto com o
site. Não precisa de conta, senha nem configuração: no primeiro deploy ele
passa a existir sozinho. A função em `netlify/functions/dados.mjs` é quem lê e
grava, e o app conversa com ela por `/.netlify/functions/dados`.

Isso significa que os cinco hubs enxergam a mesma base. O Rafael conta no
Buritis pelo celular, salva, e o número aparece para você.

**Como conferir:** o indicador ao lado do título, no topo do site, mostra
bolinha verde com "atualizar" quando está gravando na nuvem. Bolinha amarela
com "só neste aparelho" quer dizer que a função não respondeu e o app caiu para
o armazenamento local do navegador — é o que acontece no `npm run dev`, e é
normal ali.

### Se preferir um Postgres de verdade

O código também aceita Supabase, útil se você quiser consultar os dados por
fora ou ligar em um BI depois. Nesse caso:

1. Crie um projeto em [supabase.com](https://supabase.com).
2. No **SQL Editor**, cole e rode o conteúdo de `supabase.sql`.
3. Em **Project Settings → API**, copie a *Project URL* e a chave *anon public*.
4. No Netlify, em **Site configuration → Environment variables**, crie
   `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
5. Refaça o deploy — variável nova só vale em um build novo.

Com essas duas variáveis presentes, o Supabase passa a ter prioridade sobre o
Netlify Blobs. Os dados **não** migram sozinhos de um para o outro.

## Duas coisas para saber

**Acesso.** Não há login. Qualquer pessoa com o endereço do site pode ver e
alterar os dados. Para uso interno costuma bastar, mas evite divulgar o link
fora da equipe. Se um dia precisar restringir, o caminho é o Netlify Identity
ou a autenticação do Supabase.

**Contagens simultâneas.** Ao registrar, o app relê a lista do servidor antes de
gravar, então duas pessoas contando ao mesmo tempo não apagam o registro uma da
outra. O cadastro de itens não faz isso — evite dois gerentes mexendo no
catálogo no mesmo minuto.
