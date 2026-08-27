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
- `src/dados.js` — onde os dados ficam salvos (veja abaixo)

## Publicando

1. Suba **esta pasta inteira** para o repositório do GitHub (não só o `.jsx`).
2. No Netlify, em **Site configuration → Build & deploy**, confirme:
   - Build command: `npm run build`
   - Publish directory: `dist`
   O `netlify.toml` já define isso, então normalmente não precisa mexer.
3. Refaça o deploy.

Para rodar na sua máquina: `npm install` e depois `npm run dev`.

## Onde os dados ficam salvos

Sem configuração, o app salva no navegador de cada aparelho. Funciona, mas
**cada celular fica com uma base separada** — o que o Buritis contar não
aparece para você. Serve só para testar.

Para os cinco hubs enxergarem os mesmos dados, use o Supabase (plano gratuito):

1. Crie um projeto em [supabase.com](https://supabase.com).
2. No **SQL Editor**, cole e rode o conteúdo de `supabase.sql`.
3. Em **Project Settings → API**, copie a *Project URL* e a chave *anon public*.
4. No Netlify, em **Site configuration → Environment variables**, crie:
   - `VITE_SUPABASE_URL` = a Project URL
   - `VITE_SUPABASE_ANON_KEY` = a chave anon
5. Refaça o deploy (variáveis novas só valem em um build novo).

O indicador no topo do site mostra em qual modo você está: bolinha verde é
nuvem compartilhada, bolinha amarela é só neste aparelho.

## Duas coisas para saber

**Segurança.** A chave anon é pública e a política do SQL libera leitura e
escrita para quem tem o link. É o suficiente para uso interno, mas qualquer
pessoa com o endereço do site pode ver e alterar os dados. Se precisar
restringir, o caminho é ativar autenticação no Supabase.

**Contagens simultâneas.** Ao registrar, o app relê a lista do servidor antes
de gravar, então duas pessoas contando ao mesmo tempo não apagam o registro uma
da outra. O cadastro de itens não faz isso — evite dois gerentes mexendo no
catálogo no mesmo minuto.
