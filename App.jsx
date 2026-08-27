import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { ler, gravar, atualizar, ehNuvem } from "./dados.js";

/* ────────────────────────────────────────────────────────────
   Chaves de armazenamento (compartilhadas entre todos)
   ──────────────────────────────────────────────────────────── */
const K_CATALOGO = "estoque:catalogo";
const K_CONTAGENS = "estoque:contagens";

const PALETA = ["#1F6F4A", "#B4491C", "#3D5A8F", "#7A5C2E", "#5F4B87", "#2A7480", "#8A2F4E", "#4C6B22"];

const HUBS_PADRAO = [
  { id: "h-sion", nome: "Varanda Sion" },
  { id: "h-cidade-nova", nome: "Varanda Cidade Nova" },
  { id: "h-buritis", nome: "Varanda Buritis" },
  { id: "h-castelo", nome: "Varanda Castelo" },
  { id: "h-orion", nome: "Expedição Órion Sion" },
];

const PESSOAS_PADRAO = [
  { id: "p-gabriel", nome: "Gabriel" },
  { id: "p-rafael-reis", nome: "Rafael Reis" },
  { id: "p-rafael-dias", nome: "Rafael Dias" },
  { id: "p-yuri", nome: "Yuri" },
  { id: "p-rene", nome: "Rene" },
];

/* ────────────────────────────────────────────────────────────
   Utilidades
   ──────────────────────────────────────────────────────────── */
const uid = () => Math.random().toString(36).slice(2, 9);

const hoje = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const dias = (a, b) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);

const dataBR = (iso) => {
  if (!iso) return "";
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
};

const dataCurta = (iso) => {
  if (!iso) return "";
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
};

const num = (v, casas = 1) => {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: casas });
};

const paraNumero = (s) => {
  if (typeof s === "number") return s;
  if (!s && s !== 0) return null;
  const limpo = String(s).replace(/\s/g, "").replace(",", ".");
  if (limpo === "") return null;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
};

const SEM_HUB = "__sem_hub__";

/* ────────────────────────────────────────────────────────────
   Dados de exemplo — 9 semanas de contagens nos 5 hubs
   ──────────────────────────────────────────────────────────── */
function gerarExemplo() {
  const categorias = [
    { id: "c1", nome: "Bebidas" },
    { id: "c2", nome: "Limpeza" },
    { id: "c3", nome: "Descartáveis" },
  ];

  const molde = [
    { nome: "Café em grãos", unidade: "kg", cat: "c1", inicial: 24, minimo: 6, consumo: 1.6 },
    { nome: "Leite integral", unidade: "L", cat: "c1", inicial: 60, minimo: 15, consumo: 5.2 },
    { nome: "Água com gás", unidade: "un", cat: "c1", inicial: 48, minimo: 12, consumo: 1.1 },
    { nome: "Detergente neutro", unidade: "L", cat: "c2", inicial: 20, minimo: 5, consumo: 0.9 },
    { nome: "Álcool 70%", unidade: "L", cat: "c2", inicial: 15, minimo: 4, consumo: 1.4 },
    { nome: "Pano multiuso", unidade: "un", cat: "c2", inicial: 40, minimo: 10, consumo: 0.35 },
    { nome: "Copo 300ml", unidade: "un", cat: "c3", inicial: 800, minimo: 200, consumo: 62 },
    { nome: "Guardanapo", unidade: "pct", cat: "c3", inicial: 30, minimo: 8, consumo: 1.8 },
    { nome: "Saco de lixo 100L", unidade: "un", cat: "c3", inicial: 100, minimo: 25, consumo: 4.5 },
  ];

  const itens = molde.map((m) => ({
    id: uid(),
    nome: m.nome,
    unidade: m.unidade,
    categoriaId: m.cat,
    minimo: m.minimo,
  }));

  // cada hub tem um porte diferente
  const porte = { "h-sion": 1.25, "h-cidade-nova": 1.0, "h-buritis": 0.8, "h-castelo": 0.65, "h-orion": 1.5 };
  const contagens = [];
  const base = new Date();
  base.setDate(base.getDate() - 7 * 8);

  HUBS_PADRAO.forEach((hub, hIdx) => {
    const saldo = {};
    itens.forEach((it, i) => (saldo[it.id] = Math.round(molde[i].inicial * porte[hub.id])));

    for (let semana = 0; semana <= 8; semana++) {
      const d = new Date(base);
      d.setDate(d.getDate() + semana * 7);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const quantidades = {};

      itens.forEach((it, i) => {
        const m = molde[i];
        if (semana > 0) {
          const ruido = 0.8 + Math.random() * 0.45;
          let novo = saldo[it.id] - m.consumo * porte[hub.id] * 7 * ruido;
          if (novo < m.minimo * porte[hub.id]) novo = m.inicial * porte[hub.id] * (0.9 + Math.random() * 0.15);
          const inteiro = m.unidade === "un" || m.unidade === "pct";
          saldo[it.id] = Math.max(0, inteiro ? Math.round(novo) : Math.round(novo * 10) / 10);
        }
        quantidades[it.id] = saldo[it.id];
      });

      contagens.push({
        id: uid(),
        data: iso,
        hubId: hub.id,
        responsavel: PESSOAS_PADRAO[(semana + hIdx) % PESSOAS_PADRAO.length].nome,
        quantidades,
        registradoEm: new Date().toISOString(),
      });
    }
  });

  return {
    catalogo: { categorias, itens, hubs: HUBS_PADRAO, pessoas: PESSOAS_PADRAO },
    contagens,
  };
}

/* ────────────────────────────────────────────────────────────
   Cálculo de consumo — sempre por hub, depois somado
   ──────────────────────────────────────────────────────────── */
function serieDoItem(itemId, contagensOrdenadas) {
  const pontos = contagensOrdenadas.filter(
    (c) => c.quantidades[itemId] !== undefined && c.quantidades[itemId] !== null
  );
  let consumoTotal = 0;
  let diasCobertos = 0;
  let reposicoes = 0;

  for (let i = 1; i < pontos.length; i++) {
    const d = dias(pontos[i - 1].data, pontos[i].data);
    if (d <= 0) continue;
    const delta = pontos[i - 1].quantidades[itemId] - pontos[i].quantidades[itemId];
    diasCobertos += d;
    if (delta > 0) consumoTotal += delta;
    else if (delta < 0) reposicoes += 1;
  }

  return {
    consumoTotal,
    diasCobertos,
    reposicoes,
    medicoes: pontos.length,
    atual: pontos.length ? pontos[pontos.length - 1].quantidades[itemId] : null,
    ultimaData: pontos.length ? pontos[pontos.length - 1].data : null,
    consumoDia: diasCobertos > 0 ? consumoTotal / diasCobertos : 0,
  };
}

function analisar(itens, contagens, hubId) {
  const relevantes = hubId ? contagens.filter((c) => (c.hubId || SEM_HUB) === hubId) : contagens;
  const hubsPresentes = [...new Set(relevantes.map((c) => c.hubId || SEM_HUB))];

  return itens.map((item) => {
    const porHub = hubsPresentes.map((h) => {
      const doHub = relevantes
        .filter((c) => (c.hubId || SEM_HUB) === h)
        .sort((a, b) => a.data.localeCompare(b.data));
      return { hubId: h, ...serieDoItem(item.id, doHub) };
    });

    const comDados = porHub.filter((s) => s.medicoes > 0);
    const consumoTotal = comDados.reduce((s, x) => s + x.consumoTotal, 0);
    const consumoDia = comDados.reduce((s, x) => s + x.consumoDia, 0); // hubs consomem em paralelo
    const atual = comDados.length ? comDados.reduce((s, x) => s + (x.atual ?? 0), 0) : null;
    const reposicoes = comDados.reduce((s, x) => s + x.reposicoes, 0);
    const diasCobertos = Math.max(0, ...comDados.map((x) => x.diasCobertos));
    const medicoes = Math.max(0, ...comDados.map((x) => x.medicoes));
    const minimo = (item.minimo || 0) * (hubId ? 1 : Math.max(1, comDados.length));

    return {
      item,
      atual,
      minimoAplicado: minimo,
      consumoTotal,
      consumoDia,
      diasCobertos,
      reposicoes,
      medicoes,
      porHub,
      duracao: consumoDia > 0 && atual !== null ? atual / consumoDia : null,
    };
  });
}

function statusDe(l) {
  if (l.atual === null) return { rotulo: "Sem contagem", classe: "tag-neutro" };
  if (l.minimoAplicado && l.atual <= l.minimoAplicado) return { rotulo: "Abaixo do mínimo", classe: "tag-critico" };
  if (l.duracao !== null && l.duracao < 7) return { rotulo: "Acaba em menos de 7 dias", classe: "tag-critico" };
  if (l.duracao !== null && l.duracao < 14) return { rotulo: "Repor em breve", classe: "tag-atencao" };
  return { rotulo: "Confortável", classe: "tag-ok" };
}

/* ────────────────────────────────────────────────────────────
   Componentes de apoio
   ──────────────────────────────────────────────────────────── */
function Vazio({ titulo, texto, acao }) {
  return (
    <div className="vazio">
      <div className="vazio-titulo">{titulo}</div>
      <p className="vazio-texto">{texto}</p>
      {acao}
    </div>
  );
}

function Aviso({ tipo, texto, aoFechar }) {
  if (!texto) return null;
  return (
    <div className={`aviso aviso-${tipo}`}>
      <span>{texto}</span>
      {aoFechar && (
        <button className="aviso-x" onClick={aoFechar} aria-label="Fechar aviso">
          ×
        </button>
      )}
    </div>
  );
}

function ListaEditavel({ titulo, sub, lista, placeholder, onAdd, onRemove, cor }) {
  const [texto, setTexto] = useState("");
  const [confirmando, setConfirmando] = useState(null);

  const adicionar = () => {
    const nome = texto.trim();
    if (!nome) return;
    onAdd(nome);
    setTexto("");
  };

  return (
    <section className="cartao">
      <h2 className="cartao-titulo">{titulo}</h2>
      <p className="cartao-sub">{sub}</p>
      <div className="linha-form">
        <input
          className="campo"
          placeholder={placeholder}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && adicionar()}
        />
        <button className="btn btn-primario" onClick={adicionar}>
          Adicionar
        </button>
      </div>
      {lista.length > 0 && (
        <div className="chips">
          {lista.map((x, i) => (
            <span className="chip" key={x.id} style={{ borderLeftColor: cor ? PALETA[i % PALETA.length] : "#B6BDB2" }}>
              {x.nome}
              {confirmando === x.id ? (
                <button className="chip-x chip-x-ativo" onClick={() => { onRemove(x.id); setConfirmando(null); }}>
                  remover?
                </button>
              ) : (
                <button className="chip-x" onClick={() => setConfirmando(x.id)} aria-label={`Remover ${x.nome}`}>
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

/* ────────────────────────────────────────────────────────────
   Tela: Cadastro
   ──────────────────────────────────────────────────────────── */
function Cadastro({ catalogo, salvarCatalogo, carregarExemplo, temContagens, limparTudo }) {
  const [form, setForm] = useState({ nome: "", unidade: "un", categoriaId: "", minimo: "" });
  const [novaCategoria, setNovaCategoria] = useState("");
  const [erro, setErro] = useState("");
  const [confirmando, setConfirmando] = useState(null);

  const cats = catalogo.categorias;

  const addCategoria = () => {
    const nome = novaCategoria.trim();
    if (!nome) return;
    if (cats.some((c) => c.nome.toLowerCase() === nome.toLowerCase())) {
      setErro("Essa categoria já existe.");
      return;
    }
    salvarCatalogo({ ...catalogo, categorias: [...cats, { id: uid(), nome }] });
    setNovaCategoria("");
    setErro("");
  };

  const addItem = () => {
    const nome = form.nome.trim();
    if (!nome) return setErro("Dê um nome ao item.");
    if (!form.categoriaId) return setErro("Escolha uma categoria para o item.");
    if (catalogo.itens.some((i) => i.nome.toLowerCase() === nome.toLowerCase()))
      return setErro("Já existe um item com esse nome.");

    salvarCatalogo({
      ...catalogo,
      itens: [
        ...catalogo.itens,
        {
          id: uid(),
          nome,
          unidade: form.unidade.trim() || "un",
          categoriaId: form.categoriaId,
          minimo: paraNumero(form.minimo) ?? 0,
        },
      ],
    });
    setForm({ nome: "", unidade: form.unidade, categoriaId: form.categoriaId, minimo: "" });
    setErro("");
  };

  return (
    <div className="coluna">
      <Aviso tipo="erro" texto={erro} aoFechar={() => setErro("")} />

      <ListaEditavel
        titulo="Hubs"
        sub="Cada hub tem o próprio estoque. A contagem é sempre feita para um hub."
        lista={catalogo.hubs}
        placeholder="Ex.: Varanda Savassi"
        cor
        onAdd={(nome) => salvarCatalogo({ ...catalogo, hubs: [...catalogo.hubs, { id: uid(), nome }] })}
        onRemove={(id) => salvarCatalogo({ ...catalogo, hubs: catalogo.hubs.filter((h) => h.id !== id) })}
      />

      <ListaEditavel
        titulo="Equipe"
        sub="Quem aparece na lista de responsáveis pela contagem."
        lista={catalogo.pessoas}
        placeholder="Nome do funcionário"
        onAdd={(nome) => salvarCatalogo({ ...catalogo, pessoas: [...catalogo.pessoas, { id: uid(), nome }] })}
        onRemove={(id) => salvarCatalogo({ ...catalogo, pessoas: catalogo.pessoas.filter((p) => p.id !== id) })}
      />

      <section className="cartao">
        <h2 className="cartao-titulo">Categorias</h2>
        <p className="cartao-sub">Agrupam os itens na ficha de contagem e no relatório.</p>
        <div className="linha-form">
          <input
            className="campo"
            placeholder="Ex.: Bebidas"
            value={novaCategoria}
            onChange={(e) => setNovaCategoria(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCategoria()}
          />
          <button className="btn btn-primario" onClick={addCategoria}>
            Criar categoria
          </button>
        </div>
        {cats.length > 0 && (
          <div className="chips">
            {cats.map((c, i) => (
              <span className="chip" key={c.id} style={{ borderLeftColor: PALETA[i % PALETA.length] }}>
                {c.nome}
                <span className="chip-cont">{catalogo.itens.filter((it) => it.categoriaId === c.id).length}</span>
                {confirmando === `cat-${c.id}` ? (
                  <button
                    className="chip-x chip-x-ativo"
                    onClick={() => {
                      salvarCatalogo({
                        ...catalogo,
                        categorias: cats.filter((x) => x.id !== c.id),
                        itens: catalogo.itens.filter((i) => i.categoriaId !== c.id),
                      });
                      setConfirmando(null);
                    }}
                  >
                    excluir com os itens?
                  </button>
                ) : (
                  <button className="chip-x" onClick={() => setConfirmando(`cat-${c.id}`)}>
                    ×
                  </button>
                )}
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="cartao">
        <h2 className="cartao-titulo">Novo item</h2>
        <p className="cartao-sub">
          O catálogo é o mesmo para todos os hubs. O mínimo é o ponto em que o item entra como crítico.
        </p>
        <div className="grade-form">
          <label className="rotulo">
            Item
            <input
              className="campo"
              placeholder="Ex.: Café em grãos"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && addItem()}
            />
          </label>
          <label className="rotulo">
            Categoria
            <select
              className="campo"
              value={form.categoriaId}
              onChange={(e) => setForm({ ...form, categoriaId: e.target.value })}
            >
              <option value="">Selecione</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="rotulo">
            Unidade
            <input
              className="campo"
              placeholder="un, kg, L"
              value={form.unidade}
              onChange={(e) => setForm({ ...form, unidade: e.target.value })}
            />
          </label>
          <label className="rotulo">
            Mínimo
            <input
              className="campo campo-num"
              inputMode="decimal"
              placeholder="0"
              value={form.minimo}
              onChange={(e) => setForm({ ...form, minimo: e.target.value })}
            />
          </label>
        </div>
        <button className="btn btn-primario" onClick={addItem} disabled={!cats.length}>
          Adicionar item
        </button>
        {!cats.length && <span className="dica">Crie uma categoria antes de cadastrar itens.</span>}
      </section>

      {catalogo.itens.length === 0 ? (
        <Vazio
          titulo="Nenhum item cadastrado"
          texto="Cadastre os itens acima ou carregue um exemplo com 9 semanas de contagens nos 5 hubs para ver como os padrões aparecem."
          acao={
            <button className="btn btn-contorno" onClick={carregarExemplo}>
              Carregar estoque de exemplo
            </button>
          }
        />
      ) : (
        <section className="cartao">
          <div className="cartao-cabecalho">
            <h2 className="cartao-titulo">
              Itens cadastrados <span className="contador">{catalogo.itens.length}</span>
            </h2>
            {confirmando === "tudo" ? (
              <button className="btn btn-perigo" onClick={() => { limparTudo(); setConfirmando(null); }}>
                Confirmar: apagar tudo
              </button>
            ) : (
              <button className="btn btn-texto" onClick={() => setConfirmando("tudo")}>
                Apagar todos os dados
              </button>
            )}
          </div>
          {cats.map((c, i) => {
            const doGrupo = catalogo.itens.filter((it) => it.categoriaId === c.id);
            if (!doGrupo.length) return null;
            return (
              <div className="grupo" key={c.id}>
                <div className="grupo-titulo" style={{ color: PALETA[i % PALETA.length] }}>
                  {c.nome}
                </div>
                <ul className="lista">
                  {doGrupo.map((it) => (
                    <li className="lista-item" key={it.id}>
                      <span className="lista-nome">{it.nome}</span>
                      <span className="pontilhado" />
                      <span className="lista-meta">
                        {it.unidade} · mín {num(it.minimo)}
                      </span>
                      {confirmando === it.id ? (
                        <button
                          className="btn-mini btn-mini-perigo"
                          onClick={() => {
                            salvarCatalogo({ ...catalogo, itens: catalogo.itens.filter((x) => x.id !== it.id) });
                            setConfirmando(null);
                          }}
                        >
                          excluir
                        </button>
                      ) : (
                        <button className="btn-mini" onClick={() => setConfirmando(it.id)}>
                          remover
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          {temContagens && (
            <p className="nota">
              Remover um item apaga só o cadastro. As quantidades já contadas continuam nos registros antigos.
            </p>
          )}
        </section>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Tela: Contagem
   ──────────────────────────────────────────────────────────── */
function Contagem({ catalogo, contagens, registrar, excluirContagem, irParaCadastro }) {
  const [hubId, setHubId] = useState(catalogo.hubs[0]?.id ?? "");
  const [data, setData] = useState(hoje());
  const [responsavel, setResponsavel] = useState("");
  const [valores, setValores] = useState({});
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");
  const [confirmando, setConfirmando] = useState(null);

  const nomeHub = (id) => catalogo.hubs.find((h) => h.id === id)?.nome ?? "Sem hub";

  const ordenadas = useMemo(() => [...contagens].sort((a, b) => b.data.localeCompare(a.data)), [contagens]);
  const ultimaDoHub = ordenadas.find((c) => c.hubId === hubId);
  const preenchidos = catalogo.itens.filter((i) => paraNumero(valores[i.id]) !== null).length;

  const jaExiste = contagens.some((c) => c.hubId === hubId && c.data === data);

  const salvar = () => {
    if (!hubId) return setErro("Escolha o hub da contagem.");
    if (!responsavel) return setErro("Selecione quem está fazendo a contagem.");
    if (!data) return setErro("Escolha a data da contagem.");
    if (preenchidos === 0) return setErro("Preencha a quantidade de pelo menos um item.");

    const quantidades = {};
    catalogo.itens.forEach((i) => {
      const v = paraNumero(valores[i.id]);
      if (v !== null) quantidades[i.id] = v;
    });

    registrar({
      id: uid(),
      data,
      hubId,
      responsavel,
      quantidades,
      registradoEm: new Date().toISOString(),
    });
    setValores({});
    setErro("");
    setOk(`${nomeHub(hubId)} · ${dataBR(data)} registrado com ${preenchidos} ${preenchidos === 1 ? "item" : "itens"}.`);
  };

  if (!catalogo.itens.length) {
    return (
      <Vazio
        titulo="A ficha está em branco"
        texto="Cadastre os itens primeiro. Depois eles aparecem aqui prontos para a contagem em qualquer hub."
        acao={
          <button className="btn btn-primario" onClick={irParaCadastro}>
            Ir para o cadastro
          </button>
        }
      />
    );
  }

  return (
    <div className="coluna">
      <Aviso tipo="erro" texto={erro} aoFechar={() => setErro("")} />
      <Aviso tipo="ok" texto={ok} aoFechar={() => setOk("")} />

      <section className="cartao ficha">
        <div className="ficha-topo">
          <div className="ficha-selo">Ficha de contagem</div>
          <div className="ficha-progresso">
            <span className="ficha-progresso-num">{preenchidos}</span>
            <span className="ficha-progresso-den">/ {catalogo.itens.length} itens</span>
          </div>
        </div>

        <div className="grade-form grade-3">
          <label className="rotulo">
            Hub
            <select className="campo" value={hubId} onChange={(e) => setHubId(e.target.value)}>
              <option value="">Selecione</option>
              {catalogo.hubs.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="rotulo">
            Data da contagem
            <input className="campo" type="date" value={data} max={hoje()} onChange={(e) => setData(e.target.value)} />
          </label>
          <label className="rotulo">
            Quem contou
            <select className="campo" value={responsavel} onChange={(e) => setResponsavel(e.target.value)}>
              <option value="">Selecione</option>
              {catalogo.pessoas.map((p) => (
                <option key={p.id} value={p.nome}>
                  {p.nome}
                </option>
              ))}
            </select>
          </label>
        </div>

        {jaExiste && (
          <Aviso tipo="erro" texto={`Já existe uma contagem de ${nomeHub(hubId)} nessa data. Registrar de novo cria um segundo registro.`} />
        )}

        {ultimaDoHub ? (
          <p className="nota">
            Última contagem deste hub: {dataBR(ultimaDoHub.data)} por {ultimaDoHub.responsavel}. Os valores em cinza são
            os dela.
          </p>
        ) : (
          hubId && <p className="nota">Primeira contagem deste hub.</p>
        )}

        {catalogo.categorias.map((c, i) => {
          const doGrupo = catalogo.itens.filter((it) => it.categoriaId === c.id);
          if (!doGrupo.length) return null;
          return (
            <div className="grupo" key={c.id}>
              <div className="grupo-titulo" style={{ color: PALETA[i % PALETA.length] }}>
                {c.nome}
              </div>
              <ul className="lista">
                {doGrupo.map((it) => {
                  const anterior = ultimaDoHub?.quantidades?.[it.id];
                  return (
                    <li className="lista-item lista-item-contagem" key={it.id}>
                      <span className="lista-nome">{it.nome}</span>
                      <span className="pontilhado" />
                      <span className="anterior">{anterior !== undefined ? `antes ${num(anterior)}` : "—"}</span>
                      <input
                        className="campo campo-qtd"
                        inputMode="decimal"
                        placeholder="0"
                        value={valores[it.id] ?? ""}
                        onChange={(e) => setValores({ ...valores, [it.id]: e.target.value })}
                      />
                      <span className="unidade">{it.unidade}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}

        <div className="ficha-rodape">
          <button className="btn btn-primario btn-grande" onClick={salvar}>
            Registrar contagem
          </button>
          {preenchidos > 0 && (
            <button className="btn btn-texto" onClick={() => setValores({})}>
              Limpar campos
            </button>
          )}
        </div>
      </section>

      {ordenadas.length > 0 && (
        <section className="cartao">
          <h2 className="cartao-titulo">
            Contagens registradas <span className="contador">{ordenadas.length}</span>
          </h2>
          <ul className="lista">
            {ordenadas.slice(0, 14).map((c) => (
              <li className="lista-item" key={c.id}>
                <span className="lista-nome mono">{dataBR(c.data)}</span>
                <span className="lista-hub">{nomeHub(c.hubId)}</span>
                <span className="pontilhado" />
                <span className="lista-meta">
                  {c.responsavel} · {Object.keys(c.quantidades).length} itens
                </span>
                {confirmando === c.id ? (
                  <button
                    className="btn-mini btn-mini-perigo"
                    onClick={() => {
                      excluirContagem(c.id);
                      setConfirmando(null);
                    }}
                  >
                    excluir
                  </button>
                ) : (
                  <button className="btn-mini" onClick={() => setConfirmando(c.id)}>
                    remover
                  </button>
                )}
              </li>
            ))}
          </ul>
          {ordenadas.length > 14 && <p className="nota">Mostrando as 14 mais recentes de {ordenadas.length}.</p>}
        </section>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Tela: Consumo
   ──────────────────────────────────────────────────────────── */
function Consumo({ catalogo, contagens }) {
  const [hubFiltro, setHubFiltro] = useState("");
  const [selecionados, setSelecionados] = useState([]);
  const [ordem, setOrdem] = useState("consumo");

  const nomeHub = (id) => catalogo.hubs.find((h) => h.id === id)?.nome ?? "Sem hub";

  const hubsComDados = useMemo(() => {
    const ids = [...new Set(contagens.map((c) => c.hubId || SEM_HUB))];
    return ids.map((id) => ({ id, nome: nomeHub(id) }));
  }, [contagens, catalogo.hubs]);

  const relevantes = useMemo(
    () => (hubFiltro ? contagens.filter((c) => (c.hubId || SEM_HUB) === hubFiltro) : contagens),
    [contagens, hubFiltro]
  );

  const linhas = useMemo(
    () => analisar(catalogo.itens, contagens, hubFiltro || null),
    [catalogo.itens, contagens, hubFiltro]
  );
  const comDados = linhas.filter((l) => l.medicoes >= 2);

  const porConsumo = useMemo(() => [...comDados].sort((a, b) => b.consumoDia - a.consumoDia), [comDados]);

  useEffect(() => {
    if (porConsumo.length) setSelecionados(porConsumo.slice(0, 3).map((l) => l.item.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hubFiltro]);

  useEffect(() => {
    if (!selecionados.length && porConsumo.length) setSelecionados(porConsumo.slice(0, 3).map((l) => l.item.id));
  }, [porConsumo, selecionados.length]);

  const seletorHub = (
    <div className="chips chips-select">
      <button className={`chip-btn ${!hubFiltro ? "chip-btn-ativo" : ""}`} onClick={() => setHubFiltro("")}>
        Todos os hubs
      </button>
      {hubsComDados.map((h) => (
        <button
          key={h.id}
          className={`chip-btn ${hubFiltro === h.id ? "chip-btn-ativo" : ""}`}
          onClick={() => setHubFiltro(h.id)}
        >
          {h.nome}
        </button>
      ))}
    </div>
  );

  if (relevantes.length < 2 || comDados.length === 0) {
    return (
      <div className="coluna">
        {hubsComDados.length > 0 && <section className="cartao">{seletorHub}</section>}
        <Vazio
          titulo="Faltam contagens para comparar"
          texto="O consumo é a diferença entre uma contagem e a seguinte, dentro do mesmo hub. Registre pelo menos duas contagens em datas diferentes e os padrões aparecem aqui."
        />
      </div>
    );
  }

  const ordenadasData = [...relevantes].sort((a, b) => a.data.localeCompare(b.data));
  const periodo = dias(ordenadasData[0].data, ordenadasData[ordenadasData.length - 1].data);
  const maisRapido = porConsumo[0];
  const maisLento = porConsumo[porConsumo.length - 1];
  const criticos = comDados.filter((l) => statusDe(l).classe === "tag-critico");

  const dadosBarra = porConsumo.slice(0, 10).map((l) => ({
    nome: l.item.nome,
    consumo: Math.round(l.consumoDia * 100) / 100,
    unidade: l.item.unidade,
  }));

  // consumo por hub (só faz sentido na visão consolidada)
  const dadosHub = hubsComDados
    .map((h, i) => {
      const total = analisar(catalogo.itens, contagens, h.id)
        .filter((l) => l.medicoes >= 2)
        .reduce((s, l) => s + l.consumoTotal, 0);
      return { nome: h.nome, total: Math.round(total * 10) / 10, cor: PALETA[i % PALETA.length] };
    })
    .filter((d) => d.total > 0);

  const dadosCategoria = catalogo.categorias
    .map((c, i) => ({
      nome: c.nome,
      total: Math.round(comDados.filter((l) => l.item.categoriaId === c.id).reduce((s, l) => s + l.consumoTotal, 0) * 10) / 10,
      cor: PALETA[i % PALETA.length],
    }))
    .filter((d) => d.total > 0);

  // estoque no tempo: soma por data (quando "todos", soma os hubs daquela data)
  const datas = [...new Set(ordenadasData.map((c) => c.data))].sort();
  const dadosLinha = datas.map((d) => {
    const ponto = { data: dataCurta(d) };
    const doDia = ordenadasData.filter((c) => c.data === d);
    selecionados.forEach((id) => {
      const item = catalogo.itens.find((i) => i.id === id);
      if (!item) return;
      const vals = doDia.map((c) => c.quantidades[id]).filter((v) => v !== undefined && v !== null);
      if (vals.length) ponto[item.nome] = vals.reduce((s, v) => s + v, 0);
    });
    return ponto;
  });

  const tabela = [...comDados].sort((a, b) => {
    if (ordem === "consumo") return b.consumoDia - a.consumoDia;
    if (ordem === "duracao") return (a.duracao ?? Infinity) - (b.duracao ?? Infinity);
    return a.item.nome.localeCompare(b.item.nome);
  });

  const duracaoMax = Math.max(30, ...comDados.map((l) => (l.duracao === null ? 0 : Math.min(l.duracao, 90))));

  return (
    <div className="coluna">
      <section className="cartao cartao-filtro">
        <div className="filtro-rotulo">Mostrando</div>
        {seletorHub}
      </section>

      <section className="resumo">
        <div className="resumo-cel">
          <div className="resumo-rotulo">Período observado</div>
          <div className="resumo-valor mono">{periodo}</div>
          <div className="resumo-unid">
            dias · {relevantes.length} contagens{!hubFiltro ? ` · ${hubsComDados.length} hubs` : ""}
          </div>
        </div>
        <div className="resumo-cel">
          <div className="resumo-rotulo">Sai mais rápido</div>
          <div className="resumo-valor-txt">{maisRapido.item.nome}</div>
          <div className="resumo-unid mono">
            {num(maisRapido.consumoDia, 2)} {maisRapido.item.unidade}/dia
          </div>
        </div>
        <div className="resumo-cel">
          <div className="resumo-rotulo">Quase parado</div>
          <div className="resumo-valor-txt">{maisLento.item.nome}</div>
          <div className="resumo-unid mono">
            {num(maisLento.consumoDia, 2)} {maisLento.item.unidade}/dia
          </div>
        </div>
        <div className="resumo-cel">
          <div className="resumo-rotulo">Precisam de reposição</div>
          <div className="resumo-valor mono">{criticos.length}</div>
          <div className="resumo-unid">de {comDados.length} itens</div>
        </div>
      </section>

      {!hubFiltro && dadosHub.length > 1 && (
        <section className="cartao">
          <h2 className="cartao-titulo">Consumo por hub</h2>
          <p className="cartao-sub">Soma bruta das saídas no período. Serve para comparar o porte de cada unidade.</p>
          <div className="grafico" style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosHub} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid vertical={false} stroke="#D6D9D1" />
                <XAxis dataKey="nome" tick={{ fontSize: 10.5, fill: "#2A2E27" }} interval={0} />
                <YAxis tick={{ fontSize: 11, fill: "#6B6F66" }} />
                <Tooltip
                  formatter={(v) => [num(v, 1), "Total consumido"]}
                  contentStyle={{ fontSize: 12, borderRadius: 2, border: "1px solid #C9CDC3" }}
                />
                <Bar dataKey="total" radius={[2, 2, 0, 0]}>
                  {dadosHub.map((d, i) => (
                    <Cell key={i} fill={d.cor} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      <section className="cartao">
        <h2 className="cartao-titulo">Quanto tempo o estoque atual dura</h2>
        <p className="cartao-sub">
          Estoque da última contagem dividido pelo consumo médio por dia. A marca vertical é o limite de 14 dias.
        </p>
        <div className="regua">
          {[...comDados]
            .sort((a, b) => (a.duracao ?? Infinity) - (b.duracao ?? Infinity))
            .map((l) => {
              const d = l.duracao === null ? null : Math.min(l.duracao, 90);
              const pct = d === null ? 0 : Math.max(2, (d / duracaoMax) * 100);
              const st = statusDe(l);
              return (
                <div className="regua-linha" key={l.item.id}>
                  <div className="regua-nome">{l.item.nome}</div>
                  <div className="regua-trilho">
                    <div className={`regua-barra ${st.classe}-barra`} style={{ width: `${pct}%` }} />
                    <div className="regua-marca" style={{ left: `${(14 / duracaoMax) * 100}%` }} />
                  </div>
                  <div className="regua-valor mono">{l.duracao === null ? "sem consumo" : `${num(l.duracao, 0)} d`}</div>
                </div>
              );
            })}
        </div>
      </section>

      <section className="cartao">
        <h2 className="cartao-titulo">Consumo médio por dia</h2>
        <p className="cartao-sub">
          {hubFiltro ? "Ritmo de saída neste hub." : "Ritmo somado de todos os hubs. Cada item na sua própria unidade."}
        </p>
        <div className="grafico" style={{ height: Math.max(220, dadosBarra.length * 38) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dadosBarra} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 4 }}>
              <CartesianGrid horizontal={false} stroke="#D6D9D1" />
              <XAxis type="number" tick={{ fontSize: 11, fill: "#6B6F66" }} />
              <YAxis type="category" dataKey="nome" width={130} tick={{ fontSize: 11, fill: "#2A2E27" }} interval={0} />
              <Tooltip
                formatter={(v, _n, p) => [`${num(v, 2)} ${p.payload.unidade}/dia`, "Consumo"]}
                contentStyle={{ fontSize: 12, borderRadius: 2, border: "1px solid #C9CDC3" }}
              />
              <Bar dataKey="consumo" radius={[0, 2, 2, 0]}>
                {dadosBarra.map((_, i) => (
                  <Cell key={i} fill={PALETA[i % PALETA.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="cartao">
        <h2 className="cartao-titulo">Estoque ao longo do tempo</h2>
        <p className="cartao-sub">As subidas são reposições. As descidas mostram o ritmo de saída.</p>
        <div className="chips chips-select">
          {porConsumo.map((l) => {
            const ativo = selecionados.includes(l.item.id);
            return (
              <button
                key={l.item.id}
                className={`chip-btn ${ativo ? "chip-btn-ativo" : ""}`}
                onClick={() =>
                  setSelecionados(ativo ? selecionados.filter((s) => s !== l.item.id) : [...selecionados, l.item.id])
                }
              >
                {l.item.nome}
              </button>
            );
          })}
        </div>
        <div className="grafico" style={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dadosLinha} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid stroke="#D6D9D1" strokeDasharray="2 4" />
              <XAxis dataKey="data" tick={{ fontSize: 11, fill: "#6B6F66" }} />
              <YAxis tick={{ fontSize: 11, fill: "#6B6F66" }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 2, border: "1px solid #C9CDC3" }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {selecionados.map((id, i) => {
                const item = catalogo.itens.find((it) => it.id === id);
                if (!item) return null;
                return (
                  <Line
                    key={id}
                    type="monotone"
                    dataKey={item.nome}
                    stroke={PALETA[i % PALETA.length]}
                    strokeWidth={2}
                    dot={{ r: 2.5 }}
                    connectNulls
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {dadosCategoria.length > 1 && (
        <section className="cartao">
          <h2 className="cartao-titulo">Volume consumido por categoria</h2>
          <p className="cartao-sub">Soma bruta das saídas no período, sem converter unidades.</p>
          <div className="grafico" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosCategoria} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid vertical={false} stroke="#D6D9D1" />
                <XAxis dataKey="nome" tick={{ fontSize: 11, fill: "#2A2E27" }} />
                <YAxis tick={{ fontSize: 11, fill: "#6B6F66" }} />
                <Tooltip
                  formatter={(v) => [num(v, 1), "Total consumido"]}
                  contentStyle={{ fontSize: 12, borderRadius: 2, border: "1px solid #C9CDC3" }}
                />
                <Bar dataKey="total" radius={[2, 2, 0, 0]}>
                  {dadosCategoria.map((d, i) => (
                    <Cell key={i} fill={d.cor} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      <section className="cartao">
        <div className="cartao-cabecalho">
          <h2 className="cartao-titulo">Detalhe por item</h2>
          <div className="ordenar">
            <span>Ordenar por</span>
            <select className="campo campo-mini" value={ordem} onChange={(e) => setOrdem(e.target.value)}>
              <option value="consumo">Consumo</option>
              <option value="duracao">Urgência</option>
              <option value="nome">Nome</option>
            </select>
          </div>
        </div>
        <div className="tabela-rolagem">
          <table className="tabela">
            <thead>
              <tr>
                <th>Item</th>
                <th className="dir">Em estoque</th>
                <th className="dir">Consumo/dia</th>
                <th className="dir">Total no período</th>
                <th className="dir">Reposições</th>
                <th className="dir">Duração</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {tabela.map((l) => {
                const st = statusDe(l);
                return (
                  <tr key={l.item.id}>
                    <td>
                      <div className="td-nome">{l.item.nome}</div>
                      <div className="td-sub">
                        {catalogo.categorias.find((c) => c.id === l.item.categoriaId)?.nome ?? "—"}
                      </div>
                    </td>
                    <td className="dir mono">
                      {num(l.atual)} <span className="td-unid">{l.item.unidade}</span>
                    </td>
                    <td className="dir mono">{num(l.consumoDia, 2)}</td>
                    <td className="dir mono">{num(l.consumoTotal, 1)}</td>
                    <td className="dir mono">{l.reposicoes}</td>
                    <td className="dir mono">{l.duracao === null ? "—" : `${num(l.duracao, 0)} d`}</td>
                    <td>
                      <span className={`tag ${st.classe}`}>{st.rotulo}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!hubFiltro && (
          <p className="nota">
            Na visão consolidada o estoque é a soma dos hubs e o consumo por dia é a soma dos ritmos de cada um.
          </p>
        )}
      </section>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   App
   ──────────────────────────────────────────────────────────── */
export default function App() {
  const [aba, setAba] = useState("contagem");
  const [catalogo, setCatalogo] = useState({ categorias: [], itens: [], hubs: HUBS_PADRAO, pessoas: PESSOAS_PADRAO });
  const [contagens, setContagens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erroDados, setErroDados] = useState("");
  const [sincronizando, setSincronizando] = useState(false);
  const [naNuvem, setNaNuvem] = useState(false);

  const carregar = useCallback(async () => {
    setSincronizando(true);
    try {
      const [cat, cts] = await Promise.all([ler(K_CATALOGO), ler(K_CONTAGENS)]);
      if (cat) {
        setCatalogo({
          categorias: cat.categorias ?? [],
          itens: cat.itens ?? [],
          hubs: cat.hubs?.length ? cat.hubs : HUBS_PADRAO,
          pessoas: cat.pessoas?.length ? cat.pessoas : PESSOAS_PADRAO,
        });
      }
      if (Array.isArray(cts)) setContagens(cts);
      setNaNuvem(ehNuvem());
      setErroDados("");
    } catch (e) {
      setErroDados("Não foi possível carregar os dados. Verifique a conexão e atualize.");
    } finally {
      setSincronizando(false);
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Traz o que os outros hubs registraram quando a aba volta ao foco
  useEffect(() => {
    if (!naNuvem) return;
    const aoFocar = () => carregar();
    window.addEventListener("focus", aoFocar);
    return () => window.removeEventListener("focus", aoFocar);
  }, [carregar, naNuvem]);

  const salvarCatalogo = async (novo) => {
    setCatalogo(novo);
    try {
      await gravar(K_CATALOGO, novo);
      setErroDados("");
    } catch (e) {
      setErroDados("O cadastro não foi salvo. Tente de novo.");
    }
  };

  const registrar = async (contagem) => {
    setContagens((c) => [...c, contagem]);
    setSincronizando(true);
    try {
      const atualizadas = await atualizar(K_CONTAGENS, (lista) =>
        lista.some((c) => c.id === contagem.id) ? lista : [...lista, contagem]
      );
      setContagens(atualizadas);
      setErroDados("");
    } catch (e) {
      setErroDados("A contagem não foi salva. Confira a conexão e registre de novo.");
    } finally {
      setSincronizando(false);
    }
  };

  const excluirContagem = async (id) => {
    setContagens((c) => c.filter((x) => x.id !== id));
    try {
      const atualizadas = await atualizar(K_CONTAGENS, (lista) => lista.filter((c) => c.id !== id));
      setContagens(atualizadas);
    } catch (e) {
      setErroDados("Não foi possível remover a contagem.");
    }
  };

  const carregarExemplo = async () => {
    const { catalogo: cat, contagens: cts } = gerarExemplo();
    setCatalogo(cat);
    setContagens(cts);
    setAba("consumo");
    try {
      await Promise.all([gravar(K_CATALOGO, cat), gravar(K_CONTAGENS, cts)]);
    } catch (e) {
      setErroDados("O exemplo não foi salvo, mas você pode navegar por ele agora.");
    }
  };

  const limparTudo = async () => {
    const vazio = { categorias: [], itens: [], hubs: catalogo.hubs, pessoas: catalogo.pessoas };
    setCatalogo(vazio);
    setContagens([]);
    try {
      await Promise.all([gravar(K_CATALOGO, vazio), gravar(K_CONTAGENS, [])]);
    } catch (e) {
      setErroDados("Não foi possível apagar os dados no servidor.");
    }
  };

  const abas = [
    { id: "cadastro", nome: "Cadastro" },
    { id: "contagem", nome: "Contagem" },
    { id: "consumo", nome: "Consumo" },
  ];

  return (
    <div className="app">
      <style>{`
/* As fontes são carregadas no index.html */

.app {
  --tinta: #23271F;
  --tinta-fraca: #6B6F66;
  --papel: #FCFCFA;
  --fundo: #E7E9E3;
  --borda: #D2D6CB;
  --verde: #1F6F4A;
  --laranja: #B4491C;
  --ambar: #8A6B12;
  --sans: 'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif;
  --cond: 'IBM Plex Sans Condensed', 'IBM Plex Sans', sans-serif;
  --mono: 'IBM Plex Mono', ui-monospace, monospace;
  background: var(--fundo);
  color: var(--tinta);
  font-family: var(--sans);
  min-height: 100vh;
  font-size: 15px;
  line-height: 1.5;
}
.app *, .app *::before, .app *::after { box-sizing: border-box; }
.mono { font-family: var(--mono); font-variant-numeric: tabular-nums; }

.topo { background: var(--tinta); color: var(--papel); padding: 18px 20px 0; position: sticky; top: 0; z-index: 20; }
.topo-interno { max-width: 900px; margin: 0 auto; }
.topo-marca { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.topo-titulo { font-family: var(--cond); font-weight: 700; font-size: 20px; letter-spacing: 0.06em; text-transform: uppercase; margin: 0; }
.topo-sub { font-size: 12px; color: #A9AFA2; font-family: var(--mono); }
.topo-sinc {
  display: inline-flex; align-items: center; gap: 6px; background: transparent;
  border: 1px solid #4A4F45; border-radius: 999px; color: #A9AFA2; cursor: pointer;
  font-family: var(--mono); font-size: 11px; padding: 2px 10px;
}
.topo-sinc:hover:not(:disabled) { color: var(--papel); border-color: #7C8275; }
.topo-sinc:disabled { cursor: default; opacity: 0.7; }
.ponto { width: 7px; height: 7px; border-radius: 50%; display: inline-block; }
.ponto-nuvem { background: #4FA97A; }
.ponto-local { background: #C99A16; }
.abas { display: flex; gap: 2px; margin-top: 14px; }
.aba {
  background: transparent; border: 0; color: #A9AFA2; cursor: pointer;
  font-family: var(--cond); font-weight: 600; font-size: 13.5px;
  letter-spacing: 0.08em; text-transform: uppercase; padding: 9px 16px; border-radius: 3px 3px 0 0;
}
.aba:hover { color: var(--papel); }
.aba-ativa { background: var(--fundo); color: var(--tinta); }
.aba:focus-visible { outline: 2px solid #E9C46A; outline-offset: -2px; }

.conteudo { max-width: 900px; margin: 0 auto; padding: 22px 16px 60px; }
.coluna { display: flex; flex-direction: column; gap: 18px; }
.cartao { background: var(--papel); border: 1px solid var(--borda); border-radius: 4px; padding: 18px 18px 20px; }
.cartao-filtro { padding: 14px 18px 6px; }
.filtro-rotulo { font-family: var(--cond); font-size: 11px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--tinta-fraca); margin-bottom: 8px; }
.cartao-cabecalho { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; }
.cartao-titulo { font-family: var(--cond); font-weight: 700; font-size: 15px; letter-spacing: 0.07em; text-transform: uppercase; margin: 0 0 2px; }
.cartao-sub { font-size: 13px; color: var(--tinta-fraca); margin: 0 0 14px; }
.contador { font-family: var(--mono); font-size: 11px; background: var(--fundo); border: 1px solid var(--borda); border-radius: 999px; padding: 1px 7px; margin-left: 6px; letter-spacing: 0; color: var(--tinta-fraca); }
.nota { font-size: 12.5px; color: var(--tinta-fraca); margin: 12px 0 0; }
.dica { font-size: 12.5px; color: var(--laranja); margin-left: 10px; }

.linha-form { display: flex; gap: 8px; flex-wrap: wrap; }
.linha-form .campo { flex: 1 1 200px; }
.grade-form { display: grid; grid-template-columns: 2fr 1.2fr 0.9fr 0.7fr; gap: 10px; margin-bottom: 14px; }
.grade-3 { grid-template-columns: 1.4fr 1fr 1fr; }
.rotulo { display: flex; flex-direction: column; gap: 5px; font-family: var(--cond); font-size: 11.5px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--tinta-fraca); }
.campo { font-family: var(--sans); font-size: 15px; color: var(--tinta); background: #fff; border: 1px solid var(--borda); border-radius: 3px; padding: 8px 10px; width: 100%; }
.campo:focus-visible { outline: 2px solid var(--verde); outline-offset: -1px; border-color: var(--verde); }
.campo-num, .campo-qtd { font-family: var(--mono); text-align: right; }
.campo-qtd { width: 78px; flex: 0 0 78px; padding: 6px 8px; }
.campo-mini { width: auto; padding: 4px 8px; font-size: 13px; }

.btn { font-family: var(--cond); font-weight: 600; font-size: 13px; letter-spacing: 0.07em; text-transform: uppercase; padding: 9px 16px; border-radius: 3px; border: 1px solid transparent; cursor: pointer; }
.btn-primario { background: var(--verde); color: #fff; }
.btn-primario:hover { background: #185639; }
.btn-primario:disabled { background: #B6BDB2; cursor: not-allowed; }
.btn-contorno { background: transparent; border-color: var(--tinta); color: var(--tinta); }
.btn-contorno:hover { background: var(--tinta); color: var(--papel); }
.btn-perigo { background: var(--laranja); color: #fff; }
.btn-texto { background: transparent; color: var(--tinta-fraca); border: 0; text-decoration: underline; }
.btn-texto:hover { color: var(--laranja); }
.btn-grande { padding: 12px 26px; font-size: 14px; }
.btn:focus-visible { outline: 2px solid var(--tinta); outline-offset: 2px; }
.btn-mini { background: transparent; border: 0; cursor: pointer; color: #9AA095; font-family: var(--cond); font-size: 11.5px; letter-spacing: 0.06em; text-transform: uppercase; padding: 2px 4px; }
.btn-mini:hover { color: var(--laranja); }
.btn-mini-perigo { color: #fff; background: var(--laranja); border-radius: 3px; padding: 3px 8px; }

.chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
.chips-select { margin: 0 0 14px; }
.chip { display: inline-flex; align-items: center; gap: 7px; background: var(--fundo); border: 1px solid var(--borda); border-left: 3px solid; border-radius: 3px; padding: 5px 8px 5px 10px; font-size: 13.5px; }
.chip-cont { font-family: var(--mono); font-size: 11px; color: var(--tinta-fraca); }
.chip-x { background: transparent; border: 0; cursor: pointer; color: #9AA095; font-size: 16px; line-height: 1; padding: 0 2px; }
.chip-x:hover { color: var(--laranja); }
.chip-x-ativo { font-size: 11px; font-family: var(--cond); text-transform: uppercase; color: var(--laranja); letter-spacing: 0.05em; }
.chip-btn { background: #fff; border: 1px solid var(--borda); border-radius: 999px; padding: 4px 12px; font-size: 12.5px; cursor: pointer; color: var(--tinta-fraca); font-family: var(--sans); }
.chip-btn-ativo { background: var(--tinta); color: var(--papel); border-color: var(--tinta); }

.grupo { margin-top: 16px; }
.grupo-titulo { font-family: var(--cond); font-weight: 700; font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; padding-bottom: 5px; border-bottom: 1px solid var(--borda); margin-bottom: 2px; }
.lista { list-style: none; margin: 0; padding: 0; }
.lista-item { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid #EDEEE9; }
.lista-item:last-child { border-bottom: 0; }
.lista-nome { flex: 0 1 auto; font-size: 14.5px; }
.lista-hub { font-family: var(--cond); font-size: 11.5px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; color: var(--verde); background: #EAF1EC; border-radius: 2px; padding: 1px 6px; white-space: nowrap; }
.pontilhado { flex: 1 1 auto; border-bottom: 1px dotted #C2C7BA; height: 1px; min-width: 12px; }
.lista-meta { font-family: var(--mono); font-size: 11.5px; color: var(--tinta-fraca); white-space: nowrap; }
.anterior { font-family: var(--mono); font-size: 11.5px; color: #A2A79A; white-space: nowrap; }
.unidade { font-family: var(--mono); font-size: 11.5px; color: var(--tinta-fraca); width: 32px; }
.lista-item-contagem { padding: 5px 0; }

.ficha { border-top: 4px solid var(--verde); }
.ficha-topo { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; gap: 12px; }
.ficha-selo { font-family: var(--cond); font-weight: 700; font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--verde); border: 1px solid var(--verde); border-radius: 2px; padding: 3px 9px; }
.ficha-progresso { font-family: var(--mono); color: var(--tinta-fraca); font-size: 12px; }
.ficha-progresso-num { font-size: 22px; color: var(--tinta); font-weight: 600; }
.ficha-rodape { display: flex; align-items: center; gap: 14px; margin-top: 22px; padding-top: 16px; border-top: 1px dashed var(--borda); flex-wrap: wrap; }

.aviso { display: flex; justify-content: space-between; align-items: center; gap: 12px; border-radius: 3px; padding: 10px 14px; font-size: 13.5px; }
.aviso-erro { background: #F7E4DB; border: 1px solid #E0B7A3; color: #8A3512; }
.aviso-ok { background: #DFEDE4; border: 1px solid #A9CBB6; color: #175C3D; }
.aviso-x { background: transparent; border: 0; font-size: 18px; cursor: pointer; color: inherit; line-height: 1; }
.vazio { background: var(--papel); border: 1px dashed var(--borda); border-radius: 4px; padding: 44px 24px; text-align: center; }
.vazio-titulo { font-family: var(--cond); font-weight: 700; font-size: 16px; letter-spacing: 0.06em; text-transform: uppercase; }
.vazio-texto { color: var(--tinta-fraca); font-size: 14px; max-width: 460px; margin: 8px auto 18px; }

.resumo { display: grid; grid-template-columns: repeat(4, 1fr); background: var(--papel); border: 1px solid var(--borda); border-radius: 4px; }
.resumo-cel { padding: 16px 16px 18px; border-right: 1px solid var(--borda); }
.resumo-cel:last-child { border-right: 0; }
.resumo-rotulo { font-family: var(--cond); font-size: 11px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--tinta-fraca); }
.resumo-valor { font-size: 30px; font-weight: 600; line-height: 1.15; margin-top: 4px; }
.resumo-valor-txt { font-size: 16px; font-weight: 600; line-height: 1.25; margin-top: 6px; }
.resumo-unid { font-size: 11.5px; color: var(--tinta-fraca); margin-top: 2px; }

.regua { display: flex; flex-direction: column; gap: 7px; }
.regua-linha { display: grid; grid-template-columns: 150px 1fr 74px; align-items: center; gap: 10px; }
.regua-nome { font-size: 13.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.regua-trilho { position: relative; height: 16px; background: var(--fundo); border-radius: 2px; overflow: hidden; }
.regua-barra { height: 100%; border-radius: 2px 0 0 2px; }
.tag-ok-barra { background: var(--verde); }
.tag-atencao-barra { background: #C99A16; }
.tag-critico-barra { background: var(--laranja); }
.tag-neutro-barra { background: #B6BDB2; }
.regua-marca { position: absolute; top: 0; bottom: 0; width: 1px; background: var(--tinta); opacity: 0.45; }
.regua-valor { font-size: 12.5px; text-align: right; color: var(--tinta-fraca); }

.tabela-rolagem { overflow-x: auto; }
.tabela { width: 100%; border-collapse: collapse; font-size: 13.5px; }
.tabela th { font-family: var(--cond); font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--tinta-fraca); text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--tinta); white-space: nowrap; }
.tabela td { padding: 9px 10px; border-bottom: 1px solid #EDEEE9; vertical-align: top; }
.tabela .dir { text-align: right; }
.td-nome { font-weight: 500; }
.td-sub { font-size: 11.5px; color: var(--tinta-fraca); }
.td-unid { font-size: 11px; color: var(--tinta-fraca); }
.tag { display: inline-block; font-family: var(--cond); font-size: 10.5px; font-weight: 600; letter-spacing: 0.07em; text-transform: uppercase; padding: 2px 7px; border-radius: 2px; white-space: nowrap; }
.tag-ok { background: #DFEDE4; color: var(--verde); }
.tag-atencao { background: #F6EDD3; color: var(--ambar); }
.tag-critico { background: #F7E4DB; color: var(--laranja); }
.tag-neutro { background: var(--fundo); color: var(--tinta-fraca); }
.ordenar { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--tinta-fraca); }
.carregando { padding: 60px 20px; text-align: center; color: var(--tinta-fraca); font-family: var(--mono); font-size: 13px; }

@media (max-width: 720px) {
  .grade-form, .grade-3 { grid-template-columns: 1fr 1fr; }
  .resumo { grid-template-columns: 1fr 1fr; }
  .resumo-cel:nth-child(2n) { border-right: 0; }
  .resumo-cel:nth-child(-n+2) { border-bottom: 1px solid var(--borda); }
  .regua-linha { grid-template-columns: 108px 1fr 60px; }
  .conteudo { padding: 16px 12px 50px; }
  .anterior, .lista-hub { display: none; }
}
@media (prefers-reduced-motion: no-preference) {
  .btn, .chip-btn, .aba { transition: background-color 120ms ease, color 120ms ease; }
}
      `}</style>

      <header className="topo">
        <div className="topo-interno">
          <div className="topo-marca">
            <h1 className="topo-titulo">Controle de estoque</h1>
            <span className="topo-sub">
              {catalogo.hubs.length} hubs · {catalogo.itens.length} itens · {contagens.length} contagens
            </span>
            <button className="topo-sinc" onClick={carregar} disabled={sincronizando}>
              <span className={`ponto ${naNuvem ? "ponto-nuvem" : "ponto-local"}`} />
              {sincronizando ? "sincronizando…" : naNuvem ? "atualizar" : "só neste aparelho"}
            </button>
          </div>
          <nav className="abas">
            {abas.map((a) => (
              <button key={a.id} className={`aba ${aba === a.id ? "aba-ativa" : ""}`} onClick={() => setAba(a.id)}>
                {a.nome}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="conteudo">
        {erroDados && (
          <div style={{ marginBottom: 16 }}>
            <Aviso tipo="erro" texto={erroDados} aoFechar={() => setErroDados("")} />
          </div>
        )}

        {carregando ? (
          <div className="carregando">Carregando os dados…</div>
        ) : aba === "cadastro" ? (
          <Cadastro
            catalogo={catalogo}
            salvarCatalogo={salvarCatalogo}
            carregarExemplo={carregarExemplo}
            temContagens={contagens.length > 0}
            limparTudo={limparTudo}
          />
        ) : aba === "contagem" ? (
          <Contagem
            catalogo={catalogo}
            contagens={contagens}
            registrar={registrar}
            excluirContagem={excluirContagem}
            irParaCadastro={() => setAba("cadastro")}
          />
        ) : (
          <Consumo catalogo={catalogo} contagens={contagens} />
        )}
      </main>
    </div>
  );
}
