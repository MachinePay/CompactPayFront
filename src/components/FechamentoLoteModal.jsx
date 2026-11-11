import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Layers,
  Loader2,
  RotateCcw,
  Search,
  ShieldCheck,
  Undo2,
  XCircle,
} from "lucide-react";

import api, { getApiErrorMessage } from "../api/axios";
import { brasiliaDate } from "../utils/dateTime";
import Modal from "./Modal";

// Fechamento / desfazer fechamento de varias maquinas de uma vez. O resumo
// (valor em aberto + ultimo fechamento) vem de GET /fechamentos-lote/maquinas;
// a execucao chama os endpoints de sempre, uma maquina por vez, pra mostrar o
// progresso e deixar refazer so as que falharem.

const MODO_FECHAR = "fechar";
const MODO_DESFAZER = "desfazer";

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatData(value) {
  return value ? brasiliaDate(value).format("DD/MM/YYYY HH:mm") : "";
}

// "2026-11-11T10:00" do input datetime-local e' horario do navegador, nao UTC.
function formatAte(ateLocal) {
  return brasiliaDate(new Date(ateLocal)).format("DD/MM/YYYY HH:mm");
}

// "fechar ate" escolhido pelo usuario: so faz sentido pra maquina cujo ultimo
// fechamento terminou ANTES dessa data (senao o novo fecharia "pra tras").
function fechadaDepoisDe(maquina, ateLocal) {
  if (!ateLocal || !maquina.ultimo_fechamento) return false;
  return !brasiliaDate(maquina.ultimo_fechamento.periodo_fim).isBefore(brasiliaDate(new Date(ateLocal)));
}

export default function FechamentoLoteModal({ open, clienteId, clienteNome, onClose, onDone }) {
  const [etapa, setEtapa] = useState("escolher");
  const [modo, setModo] = useState(MODO_FECHAR);
  const [maquinas, setMaquinas] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erroCarga, setErroCarga] = useState("");
  const [selecionadas, setSelecionadas] = useState(() => new Set());
  const [busca, setBusca] = useState("");
  const [ateAgora, setAteAgora] = useState(true);
  const [ateLocal, setAteLocal] = useState("");
  const [resultados, setResultados] = useState({});
  // Maquinas do lote em andamento - congela a lista (recarregar o resumo pra
  // tentar de novo nao pode tirar da tela as que ja deram certo).
  const [lote, setLote] = useState([]);
  const [houveAlteracao, setHouveAlteracao] = useState(false);

  const carregar = useCallback(async () => {
    if (!clienteId) return;
    setCarregando(true);
    setErroCarga("");
    try {
      const { data } = await api.get(`/fechamentos-lote/maquinas?cliente_id=${encodeURIComponent(clienteId)}`);
      setMaquinas(data);
      return data;
    } catch (error) {
      setErroCarga(getApiErrorMessage(error, "Nao foi possivel carregar as maquinas."));
      return null;
    } finally {
      setCarregando(false);
    }
  }, [clienteId]);

  useEffect(() => {
    if (!open) return;
    setEtapa("escolher");
    setModo(MODO_FECHAR);
    setBusca("");
    setAteAgora(true);
    setAteLocal("");
    setResultados({});
    setLote([]);
    setHouveAlteracao(false);
    carregar().then((data) => {
      // Ja vem marcado o caso mais comum: fechar tudo que tem valor em aberto.
      setSelecionadas(new Set((data || []).filter((m) => m.aberto_total > 0).map((m) => m.id_hardware)));
    });
  }, [open, carregar]);

  const ate = ateAgora ? "" : ateLocal;

  const disponivel = useCallback(
    (maquina) => {
      if (modo === MODO_DESFAZER) return Boolean(maquina.ultimo_fechamento);
      return !fechadaDepoisDe(maquina, ate);
    },
    [modo, ate],
  );

  const visiveis = useMemo(() => {
    const termos = busca.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!termos.length) return maquinas;
    return maquinas.filter((m) => {
      const texto = `${m.nome || ""} ${m.id_hardware} ${m.localizacao || ""}`.toLowerCase();
      return termos.every((termo) => texto.includes(termo));
    });
  }, [busca, maquinas]);

  const escolhidas = useMemo(
    () => maquinas.filter((m) => selecionadas.has(m.id_hardware) && disponivel(m)),
    [maquinas, selecionadas, disponivel],
  );

  const totalEscolhido = escolhidas.reduce(
    (soma, m) => soma + (modo === MODO_FECHAR ? m.aberto_total : m.ultimo_fechamento?.total_pagamentos || 0),
    0,
  );

  const trocarModo = (novoModo) => {
    if (novoModo === modo) return;
    setModo(novoModo);
    // Desfazer apaga registro: nunca comeca com nada marcado.
    setSelecionadas(
      novoModo === MODO_FECHAR
        ? new Set(maquinas.filter((m) => m.aberto_total > 0).map((m) => m.id_hardware))
        : new Set(),
    );
  };

  const alternar = (id) => {
    setSelecionadas((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });
  };

  const marcar = (filtro) => {
    setSelecionadas((atual) => {
      const proximo = new Set(atual);
      visiveis.filter((m) => disponivel(m) && filtro(m)).forEach((m) => proximo.add(m.id_hardware));
      return proximo;
    });
  };

  const desmarcarVisiveis = () => {
    setSelecionadas((atual) => {
      const proximo = new Set(atual);
      visiveis.forEach((m) => proximo.delete(m.id_hardware));
      return proximo;
    });
  };

  const executar = async (alvo) => {
    setEtapa("executando");
    setResultados((atual) => {
      const proximo = { ...atual };
      alvo.forEach((m) => {
        proximo[m.id_hardware] = { status: "pendente" };
      });
      return proximo;
    });
    for (const maquina of alvo) {
      setResultados((atual) => ({ ...atual, [maquina.id_hardware]: { status: "rodando" } }));
      try {
        let valor;
        if (modo === MODO_FECHAR) {
          const params = ["periodo=fechamento"];
          if (ate) params.push(`data_fim=${encodeURIComponent(ate)}`);
          const { data } = await api.post(`/maquinas/${maquina.id_hardware}/fechamentos?${params.join("&")}`);
          valor = data.total_pagamentos;
        } else {
          await api.delete(`/maquinas/${maquina.id_hardware}/fechamentos/${maquina.ultimo_fechamento.id}`);
          valor = maquina.ultimo_fechamento.total_pagamentos;
        }
        setHouveAlteracao(true);
        setResultados((atual) => ({ ...atual, [maquina.id_hardware]: { status: "ok", valor } }));
      } catch (error) {
        setResultados((atual) => ({
          ...atual,
          [maquina.id_hardware]: {
            status: "erro",
            mensagem: getApiErrorMessage(error, "Falhou."),
          },
        }));
      }
    }
    setEtapa("concluido");
  };

  const fechar = () => {
    if (etapa === "executando") return;
    if (houveAlteracao) onDone?.();
    onClose();
  };

  const falhas = lote.filter((m) => resultados[m.id_hardware]?.status === "erro");
  const sucessos = lote.filter((m) => resultados[m.id_hardware]?.status === "ok");
  const processadas = lote.filter((m) => ["ok", "erro"].includes(resultados[m.id_hardware]?.status));

  const tentarFalhasDeNovo = async () => {
    // O "ultimo fechamento" pode ter mudado (ex.: desfez numa outra aba).
    const data = await carregar();
    if (!data) return;
    const ids = new Set(falhas.map((m) => m.id_hardware));
    const alvo = data.filter((m) => ids.has(m.id_hardware));
    if (modo === MODO_DESFAZER) {
      // Ja ficou sem fechamento (desfeito por outro caminho): nada a fazer.
      const semFechamento = alvo.filter((m) => !m.ultimo_fechamento);
      setResultados((atual) => {
        const proximo = { ...atual };
        semFechamento.forEach((m) => {
          proximo[m.id_hardware] = { status: "ok", valor: 0, nota: "Ja estava sem fechamento" };
        });
        return proximo;
      });
      executar(alvo.filter((m) => m.ultimo_fechamento));
      return;
    }
    executar(alvo);
  };

  const baixarCsv = () => {
    const linhas = [["maquina", "id", "resultado", "valor", "detalhe"]];
    lote.forEach((m) => {
      const r = resultados[m.id_hardware] || {};
      linhas.push([
        m.nome || "",
        m.id_hardware,
        r.status === "ok" ? (modo === MODO_FECHAR ? "fechada" : "desfeito") : "falhou",
        r.status === "ok" ? Number(r.valor || 0).toFixed(2).replace(".", ",") : "",
        r.mensagem || "",
      ]);
    });
    const csv = linhas.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([String.fromCharCode(0xfeff), csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${modo === MODO_FECHAR ? "fechamento" : "desfazer-fechamento"}-lote-${brasiliaDate(new Date()).format("YYYY-MM-DD-HHmm")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const fecharModo = modo === MODO_FECHAR;
  const corAcao = fecharModo
    ? "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-strong)]"
    : "bg-[var(--color-error)] text-white hover:opacity-90";

  return (
    <Modal open={open} onClose={fechar}>
      <div className="space-y-5">
        <div className="flex items-start gap-4 pr-10">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
            <Layers size={22} />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--color-text-soft)]">
              {clienteNome || "Cliente"}
            </div>
            <h2 className="mt-1 text-2xl font-extrabold tracking-[-0.04em] text-[var(--color-text)] sm:text-3xl">
              Fechamento em lote
            </h2>
          </div>
        </div>

        {etapa === "escolher" ? (
          <>
            <div className="grid grid-cols-2 gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-muted)] p-1">
              {[
                { valor: MODO_FECHAR, label: "Fazer fechamento", icon: <ShieldCheck size={16} /> },
                { valor: MODO_DESFAZER, label: "Desfazer ultimo", icon: <Undo2 size={16} /> },
              ].map((opcao) => (
                <button
                  key={opcao.valor}
                  type="button"
                  onClick={() => trocarModo(opcao.valor)}
                  className={`inline-flex items-center justify-center gap-2 rounded-full px-3 py-2.5 text-sm font-semibold transition ${
                    modo === opcao.valor
                      ? opcao.valor === MODO_FECHAR
                        ? "bg-white text-[var(--color-primary)] shadow-sm"
                        : "bg-white text-[var(--color-error)] shadow-sm"
                      : "text-[var(--color-text-soft)] hover:text-[var(--color-text)]"
                  }`}
                >
                  {opcao.icon}
                  {opcao.label}
                </button>
              ))}
            </div>

            {fecharModo ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold text-[var(--color-text)]">Fechar ate</span>
                <button
                  type="button"
                  onClick={() => setAteAgora(true)}
                  className={`rounded-full border px-4 py-2 font-semibold transition ${
                    ateAgora
                      ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
                      : "border-[var(--color-border)] bg-white text-[var(--color-text-soft)]"
                  }`}
                >
                  Agora
                </button>
                <button
                  type="button"
                  onClick={() => setAteAgora(false)}
                  className={`rounded-full border px-4 py-2 font-semibold transition ${
                    !ateAgora
                      ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
                      : "border-[var(--color-border)] bg-white text-[var(--color-text-soft)]"
                  }`}
                >
                  Data e hora
                </button>
                {!ateAgora ? (
                  <input
                    type="datetime-local"
                    value={ateLocal}
                    max={brasiliaDate(new Date()).format("YYYY-MM-DDTHH:mm")}
                    onChange={(event) => setAteLocal(event.target.value)}
                    className="rounded-full border border-[var(--color-border)] bg-white px-4 py-2 text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
                  />
                ) : null}
              </div>
            ) : (
              <div className="flex items-start gap-3 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-[var(--color-error)]">
                <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                Apaga o ultimo fechamento de cada maquina marcada. As vendas continuam no historico e voltam a contar como
                em aberto.
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <label className="flex min-w-[200px] flex-1 items-center gap-2 rounded-full border border-[var(--color-border)] bg-white px-4 py-2.5 text-sm">
                <Search size={16} className="shrink-0 text-[var(--color-text-soft)]" />
                <input
                  className="min-w-0 flex-1 bg-transparent outline-none"
                  placeholder="Filtrar maquinas"
                  value={busca}
                  onChange={(event) => setBusca(event.target.value)}
                />
              </label>
              <button type="button" className="pill-button px-4 py-2 text-xs font-semibold" onClick={() => marcar(() => true)}>
                Todas
              </button>
              {fecharModo ? (
                <button
                  type="button"
                  className="pill-button px-4 py-2 text-xs font-semibold"
                  onClick={() => marcar((m) => m.aberto_total > 0)}
                >
                  Com valor em aberto
                </button>
              ) : null}
              <button type="button" className="pill-button px-4 py-2 text-xs font-semibold" onClick={desmarcarVisiveis}>
                Nenhuma
              </button>
            </div>

            <div className="max-h-[42vh] overflow-y-auto rounded-[22px] border border-[var(--color-border)] bg-white">
              {carregando ? (
                <div className="flex h-32 items-center justify-center gap-2 text-sm text-[var(--color-text-soft)]">
                  <Loader2 size={18} className="animate-spin" /> Carregando maquinas...
                </div>
              ) : erroCarga ? (
                <div className="flex h-32 flex-col items-center justify-center gap-3 text-sm text-[var(--color-error)]">
                  {erroCarga}
                  <button type="button" className="pill-button px-4 py-2 text-xs font-semibold" onClick={carregar}>
                    Tentar de novo
                  </button>
                </div>
              ) : visiveis.length === 0 ? (
                <div className="flex h-32 items-center justify-center text-sm text-[var(--color-text-soft)]">
                  Nenhuma maquina encontrada.
                </div>
              ) : (
                visiveis.map((m) => (
                  <LinhaMaquina
                    key={m.id_hardware}
                    maquina={m}
                    modo={modo}
                    marcada={selecionadas.has(m.id_hardware)}
                    disponivel={disponivel(m)}
                    onToggle={() => alternar(m.id_hardware)}
                  />
                ))
              )}
            </div>

            <div className="flex flex-col gap-3 rounded-[22px] bg-[var(--color-bg-muted)] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm text-[var(--color-text-soft)]">
                  {escolhidas.length} de {maquinas.filter(disponivel).length} maquina(s)
                </div>
                <div className="text-xl font-extrabold text-[var(--color-text)]">{formatCurrency(totalEscolhido)}</div>
              </div>
              <button
                type="button"
                disabled={!escolhidas.length || (fecharModo && !ateAgora && !ateLocal)}
                onClick={() => setEtapa("confirmar")}
                className={`inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${corAcao}`}
              >
                {fecharModo ? <ShieldCheck size={18} /> : <Undo2 size={18} />}
                {fecharModo ? `Fechar ${escolhidas.length} maquina(s)` : `Desfazer ${escolhidas.length} fechamento(s)`}
              </button>
            </div>
          </>
        ) : null}

        {etapa === "confirmar" ? (
          <div className="space-y-4">
            <div
              className={`rounded-[22px] border p-5 ${
                fecharModo ? "border-[var(--color-border)] bg-[var(--color-primary-soft)]" : "border-rose-200 bg-rose-50"
              }`}
            >
              <div className="text-sm font-semibold text-[var(--color-text-soft)]">
                {fecharModo
                  ? `Fechar ${escolhidas.length} maquina(s) ${ate ? `ate ${formatAte(ate)}` : "ate agora"}`
                  : `Desfazer o ultimo fechamento de ${escolhidas.length} maquina(s)`}
              </div>
              <div className="mt-1 text-3xl font-extrabold tracking-[-0.03em] text-[var(--color-text)]">
                {formatCurrency(totalEscolhido)}
              </div>
              {fecharModo && ate ? (
                <div className="mt-1 text-xs text-[var(--color-text-soft)]">
                  O valor acima e' o que esta em aberto ate agora; o fechamento grava so o que entrou ate a data escolhida.
                </div>
              ) : null}
            </div>
            <div className="max-h-[32vh] overflow-y-auto rounded-[22px] border border-[var(--color-border)] bg-white">
              {escolhidas.map((m) => (
                <div
                  key={m.id_hardware}
                  className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-2.5 text-sm last:border-b-0"
                >
                  <span className="min-w-0 truncate text-[var(--color-text)]">
                    {m.nome || m.id_hardware} <span className="text-[var(--color-text-soft)]">· {m.id_hardware}</span>
                  </span>
                  <span className="shrink-0 font-semibold">
                    {formatCurrency(fecharModo ? m.aberto_total : m.ultimo_fechamento?.total_pagamentos)}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" className="pill-button px-5 py-3 font-semibold" onClick={() => setEtapa("escolher")}>
                Voltar
              </button>
              <button
                type="button"
                onClick={() => {
                  setLote(escolhidas);
                  executar(escolhidas);
                }}
                className={`inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 font-semibold transition ${corAcao}`}
              >
                {fecharModo ? "Confirmar fechamento" : "Confirmar e desfazer"}
              </button>
            </div>
          </div>
        ) : null}

        {etapa === "executando" || etapa === "concluido" ? (
          <div className="space-y-4">
            <div>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-semibold text-[var(--color-text)]">
                  {etapa === "executando"
                    ? fecharModo
                      ? "Fechando maquinas..."
                      : "Desfazendo fechamentos..."
                    : falhas.length
                      ? `${sucessos.length} concluida(s), ${falhas.length} com falha`
                      : "Tudo certo!"}
                </span>
                <span className="text-[var(--color-text-soft)]">
                  {processadas.length} de {lote.length}
                </span>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[var(--color-bg-muted)]">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    falhas.length ? "bg-amber-500" : fecharModo ? "bg-[var(--color-primary)]" : "bg-[var(--color-error)]"
                  }`}
                  style={{ width: `${lote.length ? (processadas.length / lote.length) * 100 : 0}%` }}
                />
              </div>
              {etapa === "concluido" && sucessos.length ? (
                <div className="mt-3 text-sm text-[var(--color-text-soft)]">
                  {fecharModo ? "Total fechado" : "Total reaberto"}:{" "}
                  <strong className="text-[var(--color-text)]">
                    {formatCurrency(sucessos.reduce((soma, m) => soma + Number(resultados[m.id_hardware]?.valor || 0), 0))}
                  </strong>
                </div>
              ) : null}
            </div>

            <div className="max-h-[40vh] overflow-y-auto rounded-[22px] border border-[var(--color-border)] bg-white">
              {lote.map((m) => (
                <LinhaResultado key={m.id_hardware} maquina={m} resultado={resultados[m.id_hardware]} />
              ))}
            </div>

            {etapa === "concluido" ? (
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  className="pill-button inline-flex items-center justify-center gap-2 px-5 py-3 font-semibold"
                  onClick={baixarCsv}
                >
                  <Download size={16} /> Baixar resumo
                </button>
                {falhas.length ? (
                  <button
                    type="button"
                    className="pill-button inline-flex items-center justify-center gap-2 px-5 py-3 font-semibold"
                    onClick={tentarFalhasDeNovo}
                  >
                    <RotateCcw size={16} /> Tentar de novo ({falhas.length})
                  </button>
                ) : null}
                <button
                  type="button"
                  className="pill-button pill-button--primary inline-flex items-center justify-center px-6 py-3 font-semibold"
                  onClick={fechar}
                >
                  Concluir
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

function LinhaMaquina({ maquina, modo, marcada, disponivel, onToggle }) {
  const ultimo = maquina.ultimo_fechamento;
  let detalhe;
  let valor;
  if (modo === MODO_FECHAR) {
    valor = formatCurrency(maquina.aberto_total);
    detalhe = !disponivel
      ? "Ja fechada depois dessa data"
      : ultimo
        ? `Ultimo fechamento ${formatData(ultimo.periodo_fim)}`
        : "Nunca foi fechada";
  } else {
    valor = ultimo ? formatCurrency(ultimo.total_pagamentos) : "";
    detalhe = ultimo
      ? `${brasiliaDate(ultimo.periodo_inicio).year() <= 2000 ? "Desde o inicio" : formatData(ultimo.periodo_inicio)} ate ${formatData(ultimo.periodo_fim)} · ${ultimo.criado_por_email}`
      : "Sem fechamento para desfazer";
  }

  return (
    <label
      className={`flex items-center gap-3 border-b border-[var(--color-border)] px-4 py-3 last:border-b-0 ${
        disponivel ? "cursor-pointer hover:bg-[var(--color-primary-soft)]" : "cursor-not-allowed opacity-45"
      }`}
    >
      <input
        type="checkbox"
        className="h-4 w-4 shrink-0 accent-[var(--color-primary)]"
        checked={marcada && disponivel}
        disabled={!disponivel}
        onChange={onToggle}
      />
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${maquina.status_online ? "bg-emerald-500" : "bg-slate-300"}`}
        title={maquina.status_online ? "Online" : "Offline"}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-[var(--color-text)]">
          {maquina.nome || maquina.id_hardware}
          <span className="ml-1.5 font-normal text-[var(--color-text-soft)]">{maquina.id_hardware}</span>
        </span>
        <span className="block truncate text-xs text-[var(--color-text-soft)]">{detalhe}</span>
      </span>
      <span
        className={`shrink-0 text-sm font-bold ${
          modo === MODO_FECHAR && maquina.aberto_total <= 0 ? "text-[var(--color-text-soft)]" : "text-[var(--color-text)]"
        }`}
      >
        {valor}
      </span>
    </label>
  );
}

function LinhaResultado({ maquina, resultado }) {
  const status = resultado?.status || "pendente";
  const icone = {
    pendente: <span className="h-4 w-4 rounded-full border-2 border-[var(--color-border)]" />,
    rodando: <Loader2 size={18} className="animate-spin text-[var(--color-primary)]" />,
    ok: <CheckCircle2 size={18} className="text-emerald-600" />,
    erro: <XCircle size={18} className="text-[var(--color-error)]" />,
  }[status];

  return (
    <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-4 py-2.5 text-sm last:border-b-0">
      <span className="flex w-5 shrink-0 justify-center">{icone}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[var(--color-text)]">
          {maquina.nome || maquina.id_hardware}
          <span className="ml-1.5 text-[var(--color-text-soft)]">{maquina.id_hardware}</span>
        </span>
        {status === "erro" ? (
          <span className="block truncate text-xs text-[var(--color-error)]">{resultado.mensagem}</span>
        ) : null}
        {resultado?.nota ? (
          <span className="block truncate text-xs text-[var(--color-text-soft)]">{resultado.nota}</span>
        ) : null}
      </span>
      {status === "ok" ? <span className="shrink-0 font-semibold">{formatCurrency(resultado.valor)}</span> : null}
    </div>
  );
}
