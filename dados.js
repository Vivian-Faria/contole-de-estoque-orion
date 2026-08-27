/* ────────────────────────────────────────────────────────────
   Camada de dados

   Três modos, escolhidos automaticamente:

   1. Netlify Blobs (padrão em produção) — banco embutido no
      próprio site, sem conta nem configuração. Passa pela função
      em netlify/functions/dados.mjs.
   2. Supabase — usado se VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
      estiverem definidas. Útil se você quiser os dados em um banco
      Postgres que dá para consultar por fora.
   3. Navegador — usado quando nenhum dos dois responde, como no
      `npm run dev`. Cada aparelho fica com uma base isolada.
   ──────────────────────────────────────────────────────────── */

const URL_SUPABASE = import.meta.env.VITE_SUPABASE_URL;
const CHAVE_SUPABASE = import.meta.env.VITE_SUPABASE_ANON_KEY;
const USA_SUPABASE = Boolean(URL_SUPABASE && CHAVE_SUPABASE);

const ENDPOINT_SUPABASE = USA_SUPABASE
  ? `${URL_SUPABASE.replace(/\/$/, "")}/rest/v1/estoque_dados`
  : null;
const ENDPOINT_FUNCAO = "/.netlify/functions/dados";

/* "nuvem" | "local" | null enquanto não sabemos */
let modo = USA_SUPABASE ? "nuvem" : null;

export function modoAtual() {
  return modo;
}
export function ehNuvem() {
  return modo === "nuvem";
}

/* ── Navegador ──────────────────────────────────────────────── */
function lerLocal(chave) {
  try {
    const bruto = localStorage.getItem(chave);
    return bruto ? JSON.parse(bruto) : null;
  } catch {
    return null;
  }
}

function gravarLocal(chave, valor) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    /* modo anônimo ou armazenamento cheio */
  }
}

/* ── Supabase ───────────────────────────────────────────────── */
const cabecalhosSupabase = () => ({
  apikey: CHAVE_SUPABASE,
  Authorization: `Bearer ${CHAVE_SUPABASE}`,
  "Content-Type": "application/json",
});

async function lerSupabase(chave) {
  const r = await fetch(`${ENDPOINT_SUPABASE}?chave=eq.${encodeURIComponent(chave)}&select=valor`, {
    headers: cabecalhosSupabase(),
  });
  if (!r.ok) throw new Error(`Supabase respondeu ${r.status}`);
  const linhas = await r.json();
  return linhas.length ? linhas[0].valor : null;
}

async function gravarSupabase(chave, valor) {
  const r = await fetch(`${ENDPOINT_SUPABASE}?on_conflict=chave`, {
    method: "POST",
    headers: { ...cabecalhosSupabase(), Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify([{ chave, valor, atualizado_em: new Date().toISOString() }]),
  });
  if (!r.ok) throw new Error(`Supabase respondeu ${r.status}`);
}

/* ── Netlify Blobs ──────────────────────────────────────────── */
async function lerFuncao(chave) {
  const r = await fetch(`${ENDPOINT_FUNCAO}?chave=${encodeURIComponent(chave)}`, {
    headers: { Accept: "application/json" },
  });
  if (!r.ok) throw new Error(`Servidor respondeu ${r.status}`);
  const corpo = await r.json();
  if (corpo.erro) throw new Error(corpo.erro);
  return corpo.valor ?? null;
}

async function gravarFuncao(chave, valor) {
  const r = await fetch(`${ENDPOINT_FUNCAO}?chave=${encodeURIComponent(chave)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ valor }),
  });
  if (!r.ok) throw new Error(`Servidor respondeu ${r.status}`);
  const corpo = await r.json();
  if (corpo.erro) throw new Error(corpo.erro);
}

/* ── API pública ────────────────────────────────────────────── */
export async function ler(chave) {
  if (USA_SUPABASE) return lerSupabase(chave);
  if (modo === "local") return lerLocal(chave);

  try {
    const valor = await lerFuncao(chave);
    modo = "nuvem";
    return valor;
  } catch (e) {
    if (modo === "nuvem") throw e; // já funcionou antes: é falha de rede, não ausência de banco
    modo = "local";
    return lerLocal(chave);
  }
}

export async function gravar(chave, valor) {
  if (USA_SUPABASE) return gravarSupabase(chave, valor);
  if (modo === "local") return gravarLocal(chave, valor);
  return gravarFuncao(chave, valor);
}

/* Relê o valor mais recente, aplica a mudança e grava.
   Evita que dois hubs registrando ao mesmo tempo apaguem o registro um do outro. */
export async function atualizar(chave, transformar, padrao = []) {
  const atual = (await ler(chave)) ?? padrao;
  const novo = transformar(atual);
  await gravar(chave, novo);
  return novo;
}
