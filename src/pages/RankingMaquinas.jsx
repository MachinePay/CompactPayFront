import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCcw, Scale, Trophy, WifiOff } from "lucide-react";

import api, { getApiErrorMessage } from "../api/axios";
import LoadingSpinner from "../components/LoadingSpinner";
import Toast from "../components/Toast";
import { useAuth } from "../context/useAuth";

const PERIODOS = [
  ["dia", "Hoje"],
  ["semana", "Ultimos 7 dias"],
  ["mes", "Este mes"],
];
const TOP = 10;

const brl = (valor) => Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const PAYOUT_TEXTO = {
  dando_demais: ["Entregando demais", "bg-rose-50 text-rose-700", "Pelucia sai muito barata comparada as outras maquinas - confira a forca da garra."],
  segurando: ["Segurando demais", "bg-amber-50 text-amber-700", "Pelucia sai muito cara (ou nao sai) comparada as outras - cliente pode desanimar."],
};

export default function RankingMaquinas() {
  const { user } = useAuth();
  const [periodo, setPeriodo] = useState("semana");
  const [clientes, setClientes] = useState([]);
  const [clienteId, setClienteId] = useState("");
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "success" });

  useEffect(() => {
    if (user?.role !== "admin") return;
    api
      .get("/clientes")
      .then(({ data }) => setClientes(data || []))
      .catch(() => setClientes([]));
  }, [user?.role]);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ periodo });
      if (clienteId) params.set("cliente_id", clienteId);
      const { data } = await api.get(`/ranking-maquinas?${params.toString()}`);
      setDados(data);
    } catch (error) {
      setToast({ message: getApiErrorMessage(error, "Nao foi possivel carregar o ranking."), type: "error" });
    } finally {
      setLoading(false);
    }
  }, [periodo, clienteId]);

  useEffect(() => {
    const timer = window.setTimeout(carregar, 0);
    return () => window.clearTimeout(timer);
  }, [carregar]);

  const maquinas = useMemo(() => dados?.maquinas || [], [dados]);
  const maisFaturam = useMemo(
    () => [...maquinas].filter((m) => m.faturamento > 0).sort((a, b) => b.faturamento - a.faturamento).slice(0, TOP),
    [maquinas],
  );
  const maisCaem = useMemo(
    () => [...maquinas].filter((m) => m.quedas > 0).sort((a, b) => b.quedas - a.quedas).slice(0, TOP),
    [maquinas],
  );
  // Mais longe da mediana primeiro (sem pelucia nenhuma conta como o mais longe).
  const payoutForaDoNormal = useMemo(() => {
    const mediana = dados?.mediana_reais_por_pelucia || 1;
    const distancia = (m) => (m.reais_por_pelucia ? Math.abs(Math.log(m.reais_por_pelucia / mediana)) : Infinity);
    return maquinas.filter((m) => PAYOUT_TEXTO[m.payout_situacao]).sort((a, b) => distancia(b) - distancia(a));
  }, [maquinas, dados]);
  const maiorFaturamento = maisFaturam[0]?.faturamento || 1;

  return (
    <div className="flex min-h-full flex-col gap-4">
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: "", type: toast.type })} />

      <section className="app-panel rounded-[22px] p-4 sm:rounded-[30px] sm:p-6 md:p-7">
        <div className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--color-text-soft)]">Comparativo</div>
        <h1 className="mt-3 text-3xl font-extrabold text-[var(--color-text)] sm:text-4xl">Ranking das maquinas</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--color-text-soft)]">
          As maquinas que mais faturam, as que mais caem e as que estao com payout (quanto entra de dinheiro para cada
          pelucia que sai) muito diferente das outras.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-full border border-[var(--color-border)] bg-white p-1">
            {PERIODOS.map(([valor, rotulo]) => (
              <button
                key={valor}
                type="button"
                onClick={() => setPeriodo(valor)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  periodo === valor ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-text-soft)]"
                }`}
              >
                {rotulo}
              </button>
            ))}
          </div>
          {user?.role === "admin" ? (
            <select
              className="rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-3 text-sm text-[var(--color-text)]"
              value={clienteId}
              onChange={(event) => setClienteId(event.target.value)}
            >
              <option value="">Todos os clientes</option>
              {clientes.map((item) => (
                <option key={item.id} value={String(item.id)}>
                  {item.nome_empresa || item.email_contato}
                </option>
              ))}
            </select>
          ) : null}
          <button type="button" className="pill-button inline-flex items-center gap-2 px-4 py-3 font-semibold" onClick={carregar} disabled={loading}>
            <RefreshCcw size={16} className={loading ? "animate-spin" : ""} /> Atualizar
          </button>
        </div>
      </section>

      {loading && !dados ? (
        <LoadingSpinner className="h-40" />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <Bloco icone={<Trophy size={18} />} titulo="Mais faturam" vazio="Nenhum faturamento no periodo.">
            {maisFaturam.map((m, indice) => (
              <Linha key={m.maquina_id} posicao={indice + 1} maquina={m}>
                <div className="text-right">
                  <div className="font-extrabold text-[var(--color-text)]">{brl(m.faturamento)}</div>
                  <div className="text-xs text-[var(--color-text-soft)]">
                    {m.vendas} venda(s) - {m.pelucias} pelucia(s)
                  </div>
                </div>
                <div className="col-span-full mt-2 h-2 overflow-hidden rounded-full bg-[var(--color-bg-muted)]">
                  <div
                    className="h-full rounded-full bg-[var(--color-primary)]"
                    style={{ width: `${Math.max(4, (m.faturamento / maiorFaturamento) * 100)}%` }}
                  />
                </div>
              </Linha>
            ))}
          </Bloco>

          <Bloco icone={<WifiOff size={18} />} titulo="Mais caem" vazio="Nenhuma queda no periodo.">
            {maisCaem.map((m, indice) => (
              <Linha key={m.maquina_id} posicao={indice + 1} maquina={m}>
                <div className="text-right">
                  <div className="font-extrabold text-rose-700">{m.quedas} queda(s)</div>
                  <div className="text-xs text-[var(--color-text-soft)]">conexao perdida ou reinicio forcado</div>
                </div>
              </Linha>
            ))}
          </Bloco>

          <div className="xl:col-span-2">
            <Bloco
              icone={<Scale size={18} />}
              titulo="Payout fora do normal"
              subtitulo={
                dados?.mediana_reais_por_pelucia
                  ? `Normal da frota no periodo: cerca de ${brl(dados.mediana_reais_por_pelucia)} por pelucia. Aparece aqui quem esta com menos da metade ou mais do dobro disso.`
                  : "Ainda nao ha maquinas com movimento suficiente no periodo para comparar o payout."
              }
              vazio="Todas as maquinas com movimento suficiente estao dentro do normal."
            >
              {payoutForaDoNormal.map((m, indice) => {
                const [rotulo, estilo, dica] = PAYOUT_TEXTO[m.payout_situacao];
                return (
                  <Linha key={m.maquina_id} posicao={indice + 1} maquina={m}>
                    <div className="text-right">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${estilo}`} title={dica}>
                        {rotulo}
                      </span>
                      <div className="mt-1 text-xs text-[var(--color-text-soft)]">
                        {m.reais_por_pelucia ? `${brl(m.reais_por_pelucia)} por pelucia` : "nenhuma pelucia"} -{" "}
                        {brl(m.faturamento)} / {m.pelucias} pelucia(s)
                      </div>
                    </div>
                  </Linha>
                );
              })}
            </Bloco>
          </div>
        </div>
      )}
    </div>
  );
}

function Bloco({ icone, titulo, subtitulo, vazio, children }) {
  const itens = Array.isArray(children) ? children : [children];
  return (
    <section className="app-panel h-full rounded-[30px] p-5 md:p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
          {icone}
        </div>
        <h2 className="text-lg font-extrabold text-[var(--color-text)]">{titulo}</h2>
      </div>
      {subtitulo ? <p className="mt-2 text-sm text-[var(--color-text-soft)]">{subtitulo}</p> : null}
      <div className="mt-4 space-y-2">
        {itens.filter(Boolean).length === 0 ? (
          <div className="rounded-[18px] bg-white px-4 py-8 text-center text-sm text-[var(--color-text-soft)]">{vazio}</div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

function Linha({ posicao, maquina, children }) {
  const medalha = posicao === 1 ? "bg-amber-400 text-white" : posicao === 2 ? "bg-slate-300 text-white" : posicao === 3 ? "bg-orange-300 text-white" : "bg-[var(--color-bg-muted)] text-[var(--color-text-soft)]";
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-3 text-sm">
      <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-extrabold ${medalha}`}>{posicao}</span>
      <div className="min-w-0">
        <div className="truncate font-bold text-[var(--color-text)]">{maquina.maquina_nome}</div>
        <div className="truncate text-xs text-[var(--color-text-soft)]">
          {maquina.maquina_id}
          {maquina.cliente_nome ? ` - ${maquina.cliente_nome}` : ""}
        </div>
      </div>
      {children}
    </div>
  );
}
