import { getStore } from "@netlify/blobs";

/* Guarda e devolve os dados do estoque.
   O Netlify Blobs já vem ligado ao site — não precisa de conta,
   senha ou variável de ambiente. */

const cabecalhos = { "Content-Type": "application/json; charset=utf-8" };

export default async (req) => {
  const url = new URL(req.url);
  const chave = url.searchParams.get("chave");

  if (!chave) {
    return new Response(JSON.stringify({ erro: "Informe a chave." }), { status: 400, headers: cabecalhos });
  }

  const store = getStore({ name: "estoque", consistency: "strong" });

  try {
    if (req.method === "GET") {
      const valor = await store.get(chave, { type: "json" });
      return new Response(JSON.stringify({ valor: valor ?? null }), { headers: cabecalhos });
    }

    if (req.method === "POST" || req.method === "PUT") {
      const corpo = await req.json();
      await store.setJSON(chave, corpo.valor);
      return new Response(JSON.stringify({ ok: true }), { headers: cabecalhos });
    }

    return new Response(JSON.stringify({ erro: "Método não suportado." }), { status: 405, headers: cabecalhos });
  } catch (e) {
    return new Response(JSON.stringify({ erro: e.message }), { status: 500, headers: cabecalhos });
  }
};
