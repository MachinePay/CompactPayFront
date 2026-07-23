import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  Cpu,
  Info,
  Radio,
  RefreshCcw,
  Search,
  Wifi,
  XCircle,
  Zap,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import api, { getApiErrorMessage } from "../api/axios";
import { useAuth } from "../context/useAuth";
import LoadingSpinner from "../components/LoadingSpinner";
import Toast from "../components/Toast";
import { brasiliaDate } from "../utils/dateTime";

const emptyPayload = {
  resumo: {
    total: 0,
    criticos: 0,
    avisos: 0,
    infos: 0,
    offline: 0,
    wifi_ruim: 0,
    pulso_ausente: 0,
    firmware: 0,
    ruido_contador: 0,
    filtrados: 0,
  },
  alertas: [],
};

function formatDateTime(value) {
  return value ? brasiliaDate(value).format("DD/MM/YYYY HH:mm:ss") : "--";
}

function alertIcon(tipo) {
  const icons = {
    offline: XCircle,
    wifi_ruim: Wifi,
    pulso_ausente: Zap,
    firmware: Cpu,
    ruido_contador: Radio,
    sem_pagamento_recente: Info,
  };
  return icons[tipo] || AlertTriangle;
}

function renderAlertIcon(tipo) {
  const Icon = alertIcon(tipo);
  return <Icon size={22} />;
}

function severityTone(severidade) {
  return {
    critico: "border-rose-200 bg-rose-50 text-rose-800",
    aviso: "border-amber-200 bg-amber-50 text-amber-800",
    info: "border-sky-200 bg-sky-50 text-sky-800",
  }[severidade] || "border-slate-200 bg-slate-50 text-slate-700";
}

export default function AlertasMaquinas() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [clientes, setClientes] = useState([]);
  const [payload, setPayload] = useState(emptyPayload);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "success" });
  const [filters, setFilters] = useState({
    cliente_id: "",
    tipo: "todos",
    severidade: "todos",
    busca: "",
  });

  const query = useMemo(() => {
    const params = [];
    const add = (key, value) => {
      if (value && value !== "todos") params.push(`${key}=${encodeURIComponent(value)}`);
    };
    add("cliente_id", filters.cliente_id);
    add("tipo", filters.tipo);
    add("severidade", filters.severidade);
    if (filters.busca.trim()) params.push(`busca=${encodeURIComponent(filters.busca.trim())}`);
    return params.length ? `?${params.join("&")}` : "";
  }, [filters]);

  const loadAlerts = useCallback(async (options = {}) => {
    if (!options.silent) setLoading(true);
    try {
      const { data } = await api.get(`/maquinas/alertas${query}`);
      setPayload(data || emptyPayload);
    } catch (error) {
      setToast({
        message: getApiErrorMessage(error, "Nao foi possivel carregar os alertas."),
        type: "error",
      });
    } finally {
      if (!options.silent) setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const timer = window.setTimeout(loadAlerts, 0);
    return () => window.clearTimeout(timer);
  }, [loadAlerts]);

  useEffect(() => {
    const timer = window.setInterval(() => loadAlerts({ silent: true }), 15000);
    return () => window.clearInterval(timer);
  }, [loadAlerts]);

  useEffect(() => {
    if (user?.role !== "admin") return;
    const loadClientes = async () => {
      try {
        const { data } = await api.get("/clientes");
        setClientes(data);
      } catch {
        setClientes([]);
      }
    };
    loadClientes();
  }, [user?.role]);

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
              Central de alertas
            </div>
            <h1 className="mt-3 text-3xl font-extrabold text-[var(--color-text)] sm:text-4xl">
              Alertas das maquinas
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--color-text-soft)]">
              Acompanhe problemas que pedem acao: offline, Wi-Fi ruim, pulso ausente, firmware pendente e ruido no contador.
            </p>
          </div>

          <div className="grid w-full gap-2 sm:grid-cols-2 xl:w-auto xl:min-w-[560px] xl:grid-cols-2">
            {user?.role === "admin" ? (
              <FilterSelect
                label="Cliente"
                value={filters.cliente_id}
                onChange={(value) => setFilters((current) => ({ ...current, cliente_id: value }))}
                options={[
                  ["", "Todos"],
                  ...clientes.map((item) => [String(item.id), item.nome_empresa || item.email_contato]),
                ]}
              />
            ) : null}
            <FilterSelect
              label="Tipo"
              value={filters.tipo}
              onChange={(value) => setFilters((current) => ({ ...current, tipo: value }))}
              options={[
                ["todos", "Todos"],
                ["offline", "Offline"],
                ["wifi_ruim", "Wi-Fi ruim"],
                ["pulso_ausente", "Pulso ausente"],
                ["firmware", "Firmware"],
                ["ruido_contador", "Ruido"],
                ["sem_pagamento_recente", "Sem pagamento"],
              ]}
            />
            <FilterSelect
              label="Severidade"
              value={filters.severidade}
              onChange={(value) => setFilters((current) => ({ ...current, severidade: value }))}
              options={[["todos", "Todas"], ["critico", "Critico"], ["aviso", "Aviso"], ["info", "Info"]]}
            />
            <label className="flex min-w-0 items-center gap-2 rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-3 text-sm">
              <Search size={16} className="shrink-0 text-[var(--color-text-soft)]" />
              <input
                className="min-w-0 flex-1 bg-transparent outline-none"
                placeholder="Buscar alerta"
                value={filters.busca}
                onChange={(event) => setFilters((current) => ({ ...current, busca: event.target.value }))}
              />
            </label>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <SummaryCard label="Total" value={payload.resumo.total} icon={<Bell size={18} />} />
        <SummaryCard label="Criticos" value={payload.resumo.criticos} icon={<XCircle size={18} />} tone="danger" />
        <SummaryCard label="Avisos" value={payload.resumo.avisos} icon={<AlertTriangle size={18} />} tone="warning" />
        <SummaryCard label="Wi-Fi ruim" value={payload.resumo.wifi_ruim} icon={<Wifi size={18} />} tone="warning" />
        <SummaryCard label="Pulso ausente" value={payload.resumo.pulso_ausente} icon={<Zap size={18} />} tone="danger" />
        <SummaryCard label="Ruido" value={payload.resumo.ruido_contador} icon={<Radio size={18} />} tone="warning" />
      </div>

      <section className="overflow-hidden rounded-[24px] border border-[var(--color-border)] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg-muted)] px-5 py-4">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-text-soft)]">
              Alertas ativos
            </div>
            <div className="mt-1 text-sm text-[var(--color-text-soft)]">
              {payload.resumo.filtrados} alerta(s) no filtro atual
            </div>
          </div>
          <button
            type="button"
            className="pill-button inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold"
            onClick={() => loadAlerts()}
            disabled={loading}
          >
            <RefreshCcw size={15} className={loading ? "animate-spin" : ""} />
            Atualizar
          </button>
        </div>

        {loading ? (
          <LoadingSpinner className="h-56" />
        ) : payload.alertas.length === 0 ? (
          <div className="flex h-40 items-center justify-center px-6 text-center text-sm text-[var(--color-text-soft)]">
            Nenhum alerta ativo para os filtros selecionados.
          </div>
        ) : (
          <div className="grid gap-3 p-3">
            {payload.alertas.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                onOpen={() => navigate(`/maquinas/${alert.maquina.id_hardware}`)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
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
    warning: "bg-amber-50 text-amber-800",
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

function AlertCard({ alert, onOpen }) {
  return (
    <article className={`rounded-[18px] border p-4 ${severityTone(alert.severidade)}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/70">
            {renderAlertIcon(alert.tipo)}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-extrabold">{alert.titulo}</h2>
              <span className="rounded-full bg-white/70 px-2.5 py-1 text-xs font-bold uppercase">
                {alert.severidade}
              </span>
            </div>
            <p className="mt-2 text-sm font-semibold opacity-90">{alert.mensagem}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold opacity-80">
              <span>{alert.maquina.nome || alert.maquina.id_hardware}</span>
              <span>ID {alert.maquina.id_hardware}</span>
              {alert.maquina.cliente_nome ? <span>{alert.maquina.cliente_nome}</span> : null}
              <span>{formatDateTime(alert.detected_at)}</span>
            </div>
          </div>
        </div>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-bold text-[var(--color-text)] shadow-[0_8px_20px_rgba(34,61,43,0.08)]"
          onClick={onOpen}
        >
          Abrir maquina
        </button>
      </div>
    </article>
  );
}
