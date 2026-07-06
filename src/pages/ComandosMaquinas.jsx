import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  History,
  Radio,
  RefreshCcw,
  RotateCcw,
  Search,
  Send,
  XCircle,
} from "lucide-react";

import api, { getApiErrorMessage } from "../api/axios";
import LoadingSpinner from "../components/LoadingSpinner";
import Toast from "../components/Toast";
import { brasiliaDate } from "../utils/dateTime";

const emptyPayload = {
  items: [],
  count: 0,
};

const STATUS_OPTIONS = [
  ["", "Todos"],
  ["pendente", "Pendente"],
  ["enviado", "Enviado"],
  ["recebido", "Recebido"],
  ["executando", "Executando"],
  ["executado", "Executado"],
  ["aguardando_retry", "Retry"],
  ["falha_publicacao", "Falha publicacao"],
  ["falhou", "Falhou"],
];

const TIPO_OPTIONS = [
  ["", "Todos"],
  ["paid", "Credito"],
  ["pulse", "Pulso"],
  ["update", "Firmware"],
  ["ping", "Ping"],
];

function formatDateTime(value) {
  return value ? brasiliaDate(value).format("DD/MM/YYYY HH:mm:ss") : "--";
}

function statusMeta(status) {
  return {
    pendente: ["Pendente", "bg-slate-100 text-slate-700", Clock3],
    enviado: ["Enviado", "bg-sky-100 text-sky-800", Send],
    recebido: ["Recebido", "bg-indigo-100 text-indigo-800", Radio],
    executando: ["Executando", "bg-amber-100 text-amber-800", RotateCcw],
    executado: ["Executado", "bg-emerald-100 text-emerald-800", CheckCircle2],
    aguardando_retry: ["Retry", "bg-amber-100 text-amber-800", RotateCcw],
    falha_publicacao: ["Falha publicacao", "bg-rose-100 text-rose-800", XCircle],
    falhou: ["Falhou", "bg-rose-100 text-rose-800", XCircle],
  }[status] || [status || "Sem status", "bg-slate-100 text-slate-700", Clock3];
}

export default function ComandosMaquinas() {
  const [payload, setPayload] = useState(emptyPayload);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "success" });
  const [filters, setFilters] = useState({
    machine_id: "",
    status: "",
    tipo: "",
  });

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.machine_id.trim()) params.set("machine_id", filters.machine_id.trim());
    if (filters.status) params.set("status", filters.status);
    if (filters.tipo) params.set("tipo", filters.tipo);
    params.set("limite", "150");
    return `?${params.toString()}`;
  }, [filters]);

  const loadCommands = useCallback(async (options = {}) => {
    if (!options.silent) setLoading(true);
    try {
      const { data } = await api.get(`/comandos-maquinas${query}`);
      setPayload(data || emptyPayload);
    } catch (error) {
      setToast({
        message: getApiErrorMessage(error, "Nao foi possivel carregar a fila de comandos."),
        type: "error",
      });
    } finally {
      if (!options.silent) setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const timer = window.setTimeout(loadCommands, 0);
    return () => window.clearTimeout(timer);
  }, [loadCommands]);

  useEffect(() => {
    const timer = window.setInterval(() => loadCommands({ silent: true }), 10000);
    return () => window.clearInterval(timer);
  }, [loadCommands]);

  const summary = useMemo(() => {
    return payload.items.reduce(
      (acc, item) => {
        acc.total += 1;
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
      },
      { total: 0 },
    );
  }, [payload.items]);

  return (
    <div className="flex min-h-full min-w-0 flex-col gap-4">
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ message: "", type: toast.type })}
      />

      <section className="app-panel rounded-[22px] p-4 sm:rounded-[30px] sm:p-6 md:p-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--color-text-soft)]">
              Operacao MQTT
            </div>
            <h1 className="mt-3 text-3xl font-extrabold text-[var(--color-text)] sm:text-4xl">
              Fila de comandos
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--color-text-soft)]">
              Acompanhe cada comando enviado para as maquinas com tentativas, resposta da placa e resultado final.
            </p>
          </div>

          <div className="grid w-full gap-2 sm:grid-cols-3 xl:w-auto xl:min-w-[680px]">
            <label className="flex min-w-0 items-center gap-2 rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-3 text-sm">
              <Search size={16} className="shrink-0 text-[var(--color-text-soft)]" />
              <input
                className="min-w-0 flex-1 bg-transparent outline-none"
                placeholder="ID da maquina"
                value={filters.machine_id}
                onChange={(event) => setFilters((current) => ({ ...current, machine_id: event.target.value }))}
              />
            </label>
            <FilterSelect
              label="Status"
              value={filters.status}
              onChange={(value) => setFilters((current) => ({ ...current, status: value }))}
              options={STATUS_OPTIONS}
            />
            <FilterSelect
              label="Tipo"
              value={filters.tipo}
              onChange={(value) => setFilters((current) => ({ ...current, tipo: value }))}
              options={TIPO_OPTIONS}
            />
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Total" value={summary.total} icon={<History size={18} />} />
        <SummaryCard label="Enviados" value={summary.enviado || 0} icon={<Send size={18} />} tone="info" />
        <SummaryCard label="Recebidos" value={summary.recebido || 0} icon={<Radio size={18} />} tone="info" />
        <SummaryCard label="Executados" value={summary.executado || 0} icon={<CheckCircle2 size={18} />} tone="success" />
        <SummaryCard label="Falhas" value={(summary.falhou || 0) + (summary.falha_publicacao || 0)} icon={<XCircle size={18} />} tone="danger" />
      </div>

      <section className="overflow-hidden rounded-[24px] border border-[var(--color-border)] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg-muted)] px-5 py-4">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-text-soft)]">
              Historico recente
            </div>
            <div className="mt-1 text-sm text-[var(--color-text-soft)]">
              {payload.count} comando(s) no filtro atual
            </div>
          </div>
          <button
            type="button"
            className="pill-button inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold"
            onClick={() => loadCommands()}
            disabled={loading}
          >
            <RefreshCcw size={15} className={loading ? "animate-spin" : ""} />
            Atualizar
          </button>
        </div>

        {loading ? (
          <LoadingSpinner className="h-56" />
        ) : payload.items.length === 0 ? (
          <div className="flex h-40 items-center justify-center px-6 text-center text-sm text-[var(--color-text-soft)]">
            Nenhum comando encontrado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1120px]">
              <thead className="text-left text-xs uppercase tracking-[0.16em] text-[var(--color-text-soft)]">
                <tr>
                  <th className="px-5 py-4">Maquina</th>
                  <th className="px-5 py-4">Comando</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Tentativas</th>
                  <th className="px-5 py-4">Enviado</th>
                  <th className="px-5 py-4">ACK</th>
                  <th className="px-5 py-4">Finalizado</th>
                  <th className="px-5 py-4">Payload</th>
                </tr>
              </thead>
              <tbody>
                {payload.items.map((item) => (
                  <CommandRow key={item.id || item.command_id} item={item} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function CommandRow({ item }) {
  return (
    <tr className="border-t border-[var(--color-border)] align-top text-sm">
      <td className="px-5 py-4 min-w-[190px]">
        <div className="font-extrabold text-[var(--color-text)]">{item.nome_local || item.maquina_id}</div>
        <div className="mt-1 text-xs font-semibold text-[var(--color-primary)]">{item.maquina_id}</div>
      </td>
      <td className="px-5 py-4 min-w-[230px]">
        <div className="font-extrabold text-[var(--color-text)]">{item.tipo}</div>
        <div className="mt-1 max-w-[220px] truncate text-xs text-[var(--color-text-soft)]" title={item.command_id}>
          {item.command_id}
        </div>
        {item.detalhe_status ? (
          <div className="mt-1 text-xs font-semibold text-[var(--color-primary)]">{item.detalhe_status}</div>
        ) : null}
      </td>
      <td className="px-5 py-4"><StatusBadge status={item.status} /></td>
      <td className="px-5 py-4 font-bold text-[var(--color-text)]">
        {item.tentativas || 0}/{item.max_tentativas || 0}
        {item.next_retry_at ? (
          <div className="mt-1 text-xs font-normal text-[var(--color-text-soft)]">
            Retry: {formatDateTime(item.next_retry_at)}
          </div>
        ) : null}
        {item.ultimo_erro ? (
          <div className="mt-1 max-w-[180px] text-xs font-normal text-rose-700" title={item.ultimo_erro}>
            {item.ultimo_erro}
          </div>
        ) : null}
      </td>
      <td className="px-5 py-4 text-[var(--color-text-soft)]">{formatDateTime(item.sent_at || item.created_at)}</td>
      <td className="px-5 py-4 text-[var(--color-text-soft)]">{formatDateTime(item.ack_at)}</td>
      <td className="px-5 py-4 text-[var(--color-text-soft)]">{formatDateTime(item.finished_at)}</td>
      <td className="px-5 py-4">
        <code className="block max-w-[260px] truncate rounded-[10px] bg-[var(--color-bg-muted)] px-3 py-2 text-xs text-[var(--color-text)]" title={item.payload}>
          {item.payload}
        </code>
      </td>
    </tr>
  );
}

function StatusBadge({ status }) {
  const [label, className, Icon] = statusMeta(status);
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold ${className}`}>
      <Icon size={15} />
      {label}
    </span>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="flex min-w-0 items-center gap-3 rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--color-text)]">
      {label}
      <select
        className="min-w-0 flex-1 bg-transparent text-[var(--color-text-soft)] outline-none"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function SummaryCard({ label, value, icon, tone = "neutral" }) {
  const toneClass = {
    neutral: "bg-white text-[var(--color-text)]",
    info: "bg-sky-50 text-sky-800",
    success: "bg-emerald-50 text-emerald-800",
    danger: "bg-rose-50 text-rose-800",
  }[tone];
  return (
    <section className={`rounded-[18px] border border-[var(--color-border)] p-4 ${toneClass}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-bold uppercase tracking-[0.14em] opacity-70">{label}</div>
        {icon}
      </div>
      <div className="mt-3 text-3xl font-extrabold">{value ?? 0}</div>
    </section>
  );
}
