# Controle de estoque — Órion

App de contagem de estoque por hub, com relatório de consumo.
React + Vite, publicado no Netlify.

## Como subir para o GitHub

**O GitHub não descompacta arquivos .zip.** Descompacte na sua máquina e suba
o conteúdo, nunca o zip.

Quase tudo fica na raiz do repositório. Só existe uma pasta: `netlify`.

1. No repositório, clique em **Add file → Upload files**.
2. Abra a pasta descompactada no explorador de arquivos.
3. Selecione todos os arquivos soltos (Ctrl+A) e **arraste** para a área de
   upload do GitHub. Arraste, não use o botão "choose your files" — o botão
   não aceita pastas.
4. Confirme que na lista aparece `netlify/functions/dados.mjs` com a barra.
   Se aparecer só `dados.mjs`, o Chrome não pegou a pasta: remova e arraste a
   pasta `netlify` sozinha.
5. **Commit changes**. O deploy no Netlify dispara sozinho.

### Estrutura correta no repositório

```
index.html
main.jsx
App.jsx
dados.js
package.json
package-lock.json
vite.config.js
netlify.toml
netlify/functions/dados.mjs
```

Se a pasta `netlify` não subir, o site ainda funciona — só que salvando no
navegador de cada aparelho, sem compartilhar entre os hubs. Dá para adicionar
depois em **Add file → Create new file**, digitando o caminho
`netlify/functions/dados.mjs` no campo do nome (a barra cria a pasta).

Para rodar na sua máquina: `npm install` e depois `npm run dev`.

## O banco de dados

Os dados ficam no **Netlify Blobs**, um armazenamento que já vem junto com o
site. Não precisa de conta, senha nem configuração: no primeiro deploy ele
passa a existir sozinho. A função em `netlify/functions/dados.mjs` é quem lê e
grava, e o app conversa com ela por `/.netlify/functions/dados`.

Com isso os cinco hubs enxergam a mesma base. O Rafael conta no Buritis pelo
celular, salva, e o número aparece para você.

**Como conferir:** o indicador ao lado do título, no topo do site, mostra
bolinha verde com "atualizar" quando está gravando na nuvem. Bolinha amarela
com "só neste aparelho" quer dizer que a função não respondeu — no `npm run
dev` isso é normal, mas no site publicado indica que a pasta `netlify` não
subiu.

### Se preferir um Postgres de verdade

O código também aceita Supabase, útil para consultar os dados por fora ou ligar
em um BI depois:

1. Crie um projeto em [supabase.com](https://supabase.com).
2. No **SQL Editor**, cole e rode o conteúdo de `supabase.sql`.
3. Em **Project Settings → API**, copie a *Project URL* e a chave *anon public*.
4. No Netlify, em **Site configuration → Environment variables**, crie
   `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
5. Refaça o deploy — variável nova só vale em um build novo.

Com essas duas variáveis presentes, o Supabase tem prioridade sobre o Netlify
Blobs. Os dados **não** migram sozinhos de um para o outro.

## Duas coisas para saber

**Acesso.** Não há login. Qualquer pessoa com o endereço do site pode ver e
alterar os dados. Para uso interno costuma bastar, mas evite divulgar o link
fora da equipe.

**Contagens simultâneas.** Ao registrar, o app relê a lista do servidor antes de
gravar, então duas pessoas contando ao mesmo tempo não apagam o registro uma da
outra. O cadastro de itens não faz isso — evite dois gerentes mexendo no
catálogo no mesmo minuto.
