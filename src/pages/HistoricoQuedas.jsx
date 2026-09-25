import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Clock, Power, RefreshCcw, Zap } from "lucide-react";

import api, { getApiErrorMessage } from "../api/axios";
import DateRangePicker from "../components/DateRangePicker";
import LoadingSpinner from "../components/LoadingSpinner";
import Toast from "../components/Toast";
import { useAuth } from "../context/useAuth";
import { brasiliaDate } from "../utils/dateTime";

const emptyDateRange = { start: "", end: "" };

function formatDuracao(segundos) {
  if (segundos == null) return "--";
  const total = Math.max(0, Math.round(Number(segundos)));
  const horas = Math.floor(total / 3600);
  const minutos = Math.floor((total % 3600) / 60);
  const segs = total % 60;
  if (horas > 0) return `${horas}h ${minutos}m`;
  if (minutos > 0) return `${minutos}m ${segs}s`;
  return `${segs}s`;
}

function TipoBadge({ tipo }) {
  const isReinicio = tipo === "reinicio_forcado";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
        isReinicio ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"
      }`}
    >
      {isReinicio ? <RefreshCcw size={12} /> : <Power size={12} />}
      {isReinicio ? "Reinicio forcado" : "Queda de conexao"}
    </span>
  );
}

export default function HistoricoQuedas() {
  const { user } = useAuth();
  const [clientes, setClientes] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [quedas, setQuedas] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "success" });
  const [clienteId, setClienteId] = useState("");
  const [maquinaId, setMaquinaId] = useState("");
  const [dateRange, setDateRange] = useState(emptyDateRange);
  const [limite, setLimite] = useState("300");

  useEffect(() => {
    api
      .get("/maquinas")
      .then(({ data }) => setMaquinas(data || []))
      .catch(() => setMaquinas([]));
  }, []);

  useEffect(() => {
    if (user?.role !== "admin") return;
    api
      .get("/clientes")
      .then(({ data }) => setClientes(data || []))
      .catch(() => setClientes([]));
  }, [user?.role]);

  const maquinasDoCliente = useMemo(() => {
    if (!clienteId) return maquinas;
    return maquinas.filter((item) => String(item.cliente_id || "") === clienteId);
  }, [maquinas, clienteId]);

  const handleClienteChange = (value) => {
    setClienteId(value);
    if (maquinaId && !maquinas.some((item) => item.id_hardware === maquinaId && String(item.cliente_id || "") === value)) {
      setMaquinaId("");
    }
  };

  const loadQuedas = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (clienteId) params.set("cliente_id", clienteId);
      if (maquinaId) params.set("maquina_id", maquinaId);
      if (dateRange.start) params.set("data_inicio", dateRange.start);
      if (dateRange.end) params.set("data_fim", `${dateRange.end}T23:59:59`);
      params.set("limit", limite);
      const { data } = await api.get(`/maquinas/quedas?${params.toString()}`);
      setQuedas(data.quedas || []);
      setTotal(data.total || 0);
    } catch (error) {
      setToast({
        message: getApiErrorMessage(error, "Nao foi possivel carregar o historico de quedas."),
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [clienteId, maquinaId, dateRange, limite]);

  useEffect(() => {
    const timer = window.setTimeout(loadQuedas, 0);
    return () => window.clearTimeout(timer);
  }, [loadQuedas]);

  const stats = useMemo(() => {
    const quedaConexao = quedas.filter((item) => item.tipo === "queda_conexao").length;
    const reinicioForcado = quedas.filter((item) => item.tipo === "reinicio_forcado").length;
    return { quedaConexao, reinicioForcado };
  }, [quedas]);

  return (
    <div className="flex min-h-full flex-col gap-4">
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: "", type: toast.type })} />

      <section className="app-panel rounded-[22px] p-4 sm:rounded-[30px] sm:p-6 md:p-7">
        <div className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--color-text-soft)]">
          Radar operacional
        </div>
        <h1 className="mt-3 text-3xl font-extrabold text-[var(--color-text)] sm:text-4xl">Historico de quedas</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--color-text-soft)]">
          Todas as vezes que uma maquina caiu ou se reiniciou sozinha, com data, hora, motivo tecnico e quanto tempo
          ficou fora do ar - filtre por maquina e por periodo.
        </p>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard icon={<AlertTriangle size={18} />} label="Total de quedas" value={String(total)} />
        <SummaryCard icon={<Power size={18} />} label="Quedas de conexao" value={String(stats.quedaConexao)} />
        <SummaryCard icon={<RefreshCcw size={18} />} label="Reinicios forcados" value={String(stats.reinicioForcado)} />
      </div>

      <section className="app-panel rounded-[30px] p-5 md:p-6">
        <div className={`grid gap-3 ${user?.role === "admin" ? "md:grid-cols-[220px_1fr_auto_140px_auto]" : "md:grid-cols-[1fr_auto_140px_auto]"}`}>
          {user?.role === "admin" ? (
            <select
              className="min-w-0 rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-4 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
              value={clienteId}
              onChange={(event) => handleClienteChange(event.target.value)}
            >
              <option value="">Todos os clientes</option>
              {clientes.map((item) => (
                <option key={item.id} value={String(item.id)}>
                  {item.nome_empresa || item.email_contato}
                </option>
              ))}
            </select>
          ) : null}
          <select
            className="min-w-0 rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-4 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
            value={maquinaId}
            onChange={(event) => setMaquinaId(event.target.value)}
          >
            <option value="">Todas as maquinas</option>
            {maquinasDoCliente.map((item) => (
              <option key={item.id_hardware} value={item.id_hardware}>
                {(item.nome || item.id_hardware) + ` - ${item.id_hardware}`}
              </option>
            ))}
          </select>
          <DateRangePicker value={dateRange} onChange={setDateRange} />
          <select
            className="rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-4 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
            value={limite}
            onChange={(event) => setLimite(event.target.value)}
          >
            <option value="100">100</option>
            <option value="300">300</option>
            <option value="500">500</option>
          </select>
          <button
            type="button"
            className="pill-button pill-button--primary inline-flex items-center justify-center gap-2 px-5 py-3 font-semibold"
            onClick={loadQuedas}
            disabled={loading}
          >
            <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
            Filtrar
          </button>
        </div>

        <div className="mt-6 overflow-hidden rounded-[26px] border border-[var(--color-border)] bg-white">
          {loading ? (
            <LoadingSpinner className="h-40" />
          ) : quedas.length === 0 ? (
            <div className="flex h-40 items-center justify-center px-6 text-center text-sm text-[var(--color-text-soft)]">
              Nenhuma queda registrada para os filtros selecionados.
            </div>
          ) : (
            <>
              <div className="grid gap-3 p-3 md:hidden">
                {quedas.map((item) => (
                  <QuedaMobileCard key={item.id} item={item} />
                ))}
              </div>
              <div className="hidden overflow-x-auto md:block">
                <table className="min-w-full">
                  <thead className="bg-[var(--color-bg-muted)] text-left text-xs uppercase tracking-[0.16em] text-[var(--color-text-soft)]">
                    <tr>
                      <th className="px-5 py-4 whitespace-nowrap">Data/hora da queda</th>
                      <th className="px-5 py-4 whitespace-nowrap">Maquina</th>
                      <th className="px-5 py-4 whitespace-nowrap">Tipo</th>
                      <th className="px-5 py-4">Motivo</th>
                      <th className="px-5 py-4 whitespace-nowrap">Reconectou</th>
                      <th className="px-5 py-4 whitespace-nowrap">Tempo offline</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quedas.map((item) => (
                      <tr key={item.id} className="border-t border-[var(--color-border)] align-top text-sm text-[var(--color-text)]">
                        <td className="px-5 py-4 min-w-[170px]">
                          <div className="font-semibold">{brasiliaDate(item.created_at).format("DD/MM/YYYY")}</div>
                          <div className="mt-1 text-xs text-[var(--color-text-soft)]">
                            {brasiliaDate(item.created_at).format("HH:mm:ss")}
                          </div>
                        </td>
                        <td className="px-5 py-4 min-w-[190px]">
                          <div className="font-extrabold">{item.maquina_nome || item.maquina_id}</div>
                          <div className="mt-1 text-xs font-semibold text-[var(--color-primary)]">{item.maquina_id}</div>
                        </td>
                        <td className="px-5 py-4 min-w-[190px]">
                          <TipoBadge tipo={item.tipo} />
                        </td>
                        <td className="px-5 py-4 min-w-[320px] leading-6 text-[var(--color-text-soft)]">{item.motivo}</td>
                        <td className="px-5 py-4 min-w-[160px] text-[var(--color-text-soft)]">
                          {item.reconectou_em ? brasiliaDate(item.reconectou_em).format("DD/MM HH:mm:ss") : "Ainda nao"}
                        </td>
                        <td className="px-5 py-4 min-w-[130px]">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-bg-muted)] px-3 py-1.5 text-xs font-bold text-[var(--color-text)]">
                            <Clock size={12} />
                            {formatDuracao(item.duracao_offline_segundos)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function SummaryCard({ icon, label, value }) {
  return (
    <section className="app-panel rounded-[24px] p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-[var(--color-text-soft)]">{label}</div>
          <div className="mt-3 text-3xl font-extrabold tracking-[-0.05em] text-[var(--color-text)]">{value}</div>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
          {icon}
        </div>
      </div>
    </section>
  );
}

function QuedaMobileCard({ item }) {
  return (
    <article className="rounded-[18px] border border-[var(--color-border)] bg-white p-4 shadow-[0_8px_20px_rgba(34,61,43,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-extrabold text-[var(--color-text)]">{item.maquina_nome || item.maquina_id}</div>
          <div className="mt-1 text-xs font-semibold text-[var(--color-primary)]">{item.maquina_id}</div>
        </div>
        <TipoBadge tipo={item.tipo} />
      </div>
      <div className="mt-3 text-xs text-[var(--color-text-soft)]">
        <span className="font-semibold text-[var(--color-text)]">
          {brasiliaDate(item.created_at).format("DD/MM/YYYY HH:mm:ss")}
        </span>
      </div>
      <div className="mt-3 rounded-[16px] border border-[var(--color-border)] bg-[var(--color-bg-muted)] px-3 py-3 text-sm leading-6 text-[var(--color-text-soft)]">
        {item.motivo}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-[16px] border border-[var(--color-border)] px-3 py-3">
          <div className="font-bold uppercase tracking-[0.1em] text-[var(--color-text-soft)]">Reconectou</div>
          <div className="mt-1 font-semibold text-[var(--color-text)]">
            {item.reconectou_em ? brasiliaDate(item.reconectou_em).format("DD/MM HH:mm:ss") : "Ainda nao"}
          </div>
        </div>
        <div className="rounded-[16px] border border-[var(--color-border)] px-3 py-3">
          <div className="font-bold uppercase tracking-[0.1em] text-[var(--color-text-soft)]">Tempo offline</div>
          <div className="mt-1 flex items-center gap-1.5 font-semibold text-[var(--color-text)]">
            <Zap size={12} />
            {formatDuracao(item.duracao_offline_segundos)}
          </div>
        </div>
      </div>
    </article>
  );
}
