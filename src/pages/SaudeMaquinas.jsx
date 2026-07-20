import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Radio,
  RefreshCcw,
  Search,
  Server,
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

const emptyHealth = {
  resumo: {
    total: 0,
    online: 0,
    atencao: 0,
    offline: 0,
    wifi_ruim: 0,
    pulso_ausente: 0,
    firmware_pendente: 0,
    filtradas: 0,
  },
  maquinas: [],
};

function formatDateTime(value) {
  return value ? brasiliaDate(value).format("DD/MM/YYYY HH:mm:ss") : "--";
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatFirmwareStatus(status) {
  const labels = {
    sent: "Enviada",
    downloading: "Baixando",
    restarting: "Reiniciando",
    updated: "Atualizado",
    failed: "Falhou",
    no_update: "Sem novidade",
  };
  return labels[status] || status || "Sem status";
}

function formatUptime(seconds) {
  if (seconds == null) return "--";
  const total = Number(seconds);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatHeap(bytes) {
  if (bytes == null) return "--";
  return `${Math.round(Number(bytes) / 1024)} KB`;
}

function formatResetReason(reason) {
  const labels = {
    poweron: "Energizado",
    ext: "Reset externo",
    sw: "Reset por software",
    panic: "Pane (panic)",
    int_wdt: "Watchdog (int)",
    task_wdt: "Watchdog (task)",
    wdt: "Watchdog",
    deepsleep: "Deep sleep",
    brownout: "Queda de energia",
    sdio: "SDIO",
    unknown: "Desconhecido",
  };
  return labels[reason] || reason || "--";
}

function formatPulseStatus(status) {
  const labels = {
    pendente: "Aguardando envio",
    comando_enviado: "Comando enviado",
    cmd_recebido: "Comando recebido",
    pulso_iniciado: "Pulso iniciado",
    pulso_enviado: "Pulso enviado",
    pulso_unitario: "Pulso unitario",
    pulso_sem_retorno: "Pulso sem retorno",
    pulso_confirmado: "Pulso confirmado",
    liberado: "Pulso enviado",
    fisico: "Pagamento fisico",
    falha_timeout: "Sem confirmacao",
    falha_sem_confirmacao: "Pulso ausente",
    falha_publicacao: "Falha publicacao",
    falha_cmd_ignorado: "Comando ignorado",
    falha_bloqueado: "Pulso bloqueado",
    teste: "Pulso de teste",
  };
  const normalized = String(status || "").toLowerCase();
  return labels[normalized] || status || "Sem pulso";
}

export default function SaudeMaquinas() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [clientes, setClientes] = useState([]);
  const [health, setHealth] = useState(emptyHealth);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "success" });
  const [filters, setFilters] = useState({
    cliente_id: "",
    status: "todos",
    wifi: "todos",
    firmware: "todos",
    pulso: "todos",
    busca: "",
  });

  const query = useMemo(() => {
    const params = [];
    const add = (key, value) => {
      if (value && value !== "todos") {
        params.push(`${key}=${encodeURIComponent(value)}`);
      }
    };
    add("cliente_id", filters.cliente_id);
    add("status", filters.status);
    add("wifi", filters.wifi);
    add("firmware", filters.firmware);
    add("pulso", filters.pulso);
    if (filters.busca.trim()) {
      params.push(`busca=${encodeURIComponent(filters.busca.trim())}`);
    }
    return params.length ? `?${params.join("&")}` : "";
  }, [filters]);

  const loadHealth = useCallback(async (options = {}) => {
    if (!options.silent) setLoading(true);
    try {
      const { data } = await api.get(`/maquinas/saude${query}`);
      setHealth(data || emptyHealth);
    } catch (error) {
      setToast({
        message: getApiErrorMessage(error, "Nao foi possivel carregar a saude das maquinas."),
        type: "error",
      });
    } finally {
      if (!options.silent) setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const timer = window.setTimeout(loadHealth, 0);
    return () => window.clearTimeout(timer);
  }, [loadHealth]);

  useEffect(() => {
    const timer = window.setInterval(() => loadHealth({ silent: true }), 15000);
    return () => window.clearInterval(timer);
  }, [loadHealth]);

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
              Radar operacional
            </div>
            <h1 className="mt-3 text-3xl font-extrabold text-[var(--color-text)] sm:text-4xl">
              Saude das maquinas
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--color-text-soft)]">
              Monitore conexao, Wi-Fi, firmware, pagamento e pulso em tempo quase real para priorizar manutencao.
            </p>
          </div>

          <div className="grid w-full gap-2 sm:grid-cols-2 xl:w-auto xl:min-w-[620px] xl:grid-cols-3">
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
              label="Estado"
              value={filters.status}
              onChange={(value) => setFilters((current) => ({ ...current, status: value }))}
              options={[["todos", "Todos"], ["online", "Online"], ["atencao", "Atencao"], ["offline", "Offline"]]}
            />
            <FilterSelect
              label="Wi-Fi"
              value={filters.wifi}
              onChange={(value) => setFilters((current) => ({ ...current, wifi: value }))}
              options={[["todos", "Todos"], ["ruim", "Ruim"], ["bom", "Bom"], ["otimo", "Otimo"], ["sem_leitura", "Sem leitura"]]}
            />
            <FilterSelect
              label="Firmware"
              value={filters.firmware}
              onChange={(value) => setFilters((current) => ({ ...current, firmware: value }))}
              options={[["todos", "Todos"], ["pendente", "Pendente"], ["ok", "OK"]]}
            />
            <FilterSelect
              label="Pulso"
              value={filters.pulso}
              onChange={(value) => setFilters((current) => ({ ...current, pulso: value }))}
              options={[["todos", "Todos"], ["confirmado", "Confirmado"], ["ausente", "Ausente"]]}
            />
            <label className="flex min-w-0 items-center gap-2 rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-3 text-sm">
              <Search size={16} className="shrink-0 text-[var(--color-text-soft)]" />
              <input
                className="min-w-0 flex-1 bg-transparent outline-none"
                placeholder="Buscar maquina"
                value={filters.busca}
                onChange={(event) => setFilters((current) => ({ ...current, busca: event.target.value }))}
              />
            </label>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
        <HealthCard label="Total" value={health.resumo.total} icon={<Server size={18} />} />
        <HealthCard label="Online" value={health.resumo.online} icon={<CheckCircle2 size={18} />} tone="success" />
        <HealthCard label="Atencao" value={health.resumo.atencao} icon={<AlertTriangle size={18} />} tone="warning" />
        <HealthCard label="Offline" value={health.resumo.offline} icon={<XCircle size={18} />} tone="danger" />
        <HealthCard label="Wi-Fi ruim" value={health.resumo.wifi_ruim} icon={<Wifi size={18} />} tone="warning" />
        <HealthCard label="Pulso ausente" value={health.resumo.pulso_ausente} icon={<Zap size={18} />} tone="danger" />
        <HealthCard label="Firmware" value={health.resumo.firmware_pendente} icon={<Cpu size={18} />} tone="warning" />
      </div>

      <section className="overflow-hidden rounded-[24px] border border-[var(--color-border)] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg-muted)] px-5 py-4">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-text-soft)]">
              Maquinas monitoradas
            </div>
            <div className="mt-1 text-sm text-[var(--color-text-soft)]">
              {health.resumo.filtradas} de {health.resumo.total} maquina(s)
            </div>
          </div>
          <button
            type="button"
            className="pill-button inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold"
            onClick={() => loadHealth()}
            disabled={loading}
          >
            <RefreshCcw size={15} className={loading ? "animate-spin" : ""} />
            Atualizar
          </button>
        </div>

        {loading ? (
          <LoadingSpinner className="h-56" />
        ) : health.maquinas.length === 0 ? (
          <div className="flex h-40 items-center justify-center px-6 text-center text-sm text-[var(--color-text-soft)]">
            Nenhuma maquina encontrada para os filtros selecionados.
          </div>
        ) : (
          <>
            <div className="grid gap-3 p-3 lg:hidden">
              {health.maquinas.map((machine) => (
                <HealthMobileCard
                  key={machine.id_hardware}
                  machine={machine}
                  onOpen={() => navigate(`/maquinas/${machine.id_hardware}`)}
                />
              ))}
            </div>
            <div className="hidden overflow-x-auto lg:block">
              <table className="min-w-[1220px]">
                <thead className="text-left text-xs uppercase tracking-[0.16em] text-[var(--color-text-soft)]">
                  <tr>
                    <th className="px-5 py-4">Maquina</th>
                    <th className="px-5 py-4">Estado</th>
                    <th className="px-5 py-4">Ultimo sinal</th>
                    <th className="px-5 py-4">Wi-Fi</th>
                    <th className="px-5 py-4">Firmware</th>
                    <th className="px-5 py-4">MQTT</th>
                    <th className="px-5 py-4">Ultimo pagamento</th>
                    <th className="px-5 py-4">Ultimo pulso</th>
                    <th className="px-5 py-4">Diagnostico</th>
                    <th className="px-5 py-4">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {health.maquinas.map((machine) => (
                    <tr key={machine.id_hardware} className="border-t border-[var(--color-border)] align-top text-sm">
                      <td className="px-5 py-4 min-w-[210px]">
                        <div className="font-extrabold text-[var(--color-text)]">{machine.nome || machine.id_hardware}</div>
                        <div className="mt-1 text-xs font-semibold text-[var(--color-primary)]">{machine.id_hardware}</div>
                        <div className="mt-1 text-xs text-[var(--color-text-soft)]">{machine.cliente_nome || machine.localizacao || "--"}</div>
                      </td>
                      <td className="px-5 py-4"><StatusBadge status={machine.health_status} /></td>
                      <td className="px-5 py-4 min-w-[160px] text-[var(--color-text-soft)]">{formatDateTime(machine.ultimo_sinal)}</td>
                      <td className="px-5 py-4 min-w-[150px]"><WifiBadge machine={machine} /></td>
                      <td className="px-5 py-4 min-w-[190px]"><FirmwareBadge machine={machine} /></td>
                      <td className="px-5 py-4"><MqttBadge status={machine.mqtt_status} /></td>
                      <td className="px-5 py-4 min-w-[190px]"><PaymentInfo payment={machine.ultimo_pagamento} /></td>
                      <td className="px-5 py-4 min-w-[180px]"><PulseInfo pulse={machine.ultimo_pulso} alert={machine.pulse_alert} /></td>
                      <td className="px-5 py-4 min-w-[210px]"><DiagnosticoInfo machine={machine} /></td>
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          className="pill-button inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold"
                          onClick={() => navigate(`/maquinas/${machine.id_hardware}`)}
                        >
                          <Activity size={15} />
                          Abrir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
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

function HealthCard({ label, value, icon, tone = "neutral" }) {
  const toneClass = {
    neutral: "bg-white text-[var(--color-text)]",
    success: "bg-emerald-50 text-emerald-800",
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

function StatusBadge({ status }) {
  const meta = {
    online: ["Online", "bg-emerald-100 text-emerald-700", CheckCircle2],
    atencao: ["Atencao", "bg-amber-100 text-amber-800", AlertTriangle],
    offline: ["Offline", "bg-rose-100 text-rose-700", XCircle],
  }[status] || ["Sem status", "bg-slate-100 text-slate-600", AlertTriangle];
  const Icon = meta[2];
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold ${meta[1]}`}>
      <Icon size={15} />
      {meta[0]}
    </span>
  );
}

function WifiBadge({ machine }) {
  const quality = machine.wifi_quality;
  const status = machine.wifi_status;
  const tone =
    status === "otimo"
      ? "text-emerald-700"
      : status === "bom"
        ? "text-amber-700"
        : status === "ruim"
          ? "text-rose-700"
          : "text-slate-500";
  return (
    <div className={tone}>
      <div className="flex items-center gap-2 text-sm font-extrabold">
        <Wifi size={17} />
        {quality == null ? "Sem leitura" : `${quality}%`}
      </div>
      <div className="mt-1 text-xs font-semibold opacity-75">
        {machine.wifi_rssi == null ? "--" : `${machine.wifi_rssi} dBm`}
      </div>
    </div>
  );
}

function FirmwareBadge({ machine }) {
  return (
    <div className={machine.firmware_alert ? "text-amber-800" : "text-emerald-800"}>
      <div className="flex items-center gap-2 font-extrabold">
        <Cpu size={16} />
        {machine.firmware_version || "Sem versao"}
      </div>
      <div className="mt-1 text-xs font-semibold opacity-75">
        {formatFirmwareStatus(machine.firmware_update_status)}
      </div>
      {machine.firmware_target_version ? (
        <div className="mt-1 text-xs opacity-75">Alvo: {machine.firmware_target_version}</div>
      ) : null}
    </div>
  );
}

function MqttBadge({ status }) {
  const online = status === "conectado";
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold ${
      online ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
    }`}>
      <Radio size={14} />
      {online ? "Conectado" : "Sem sinal"}
    </span>
  );
}

function PaymentInfo({ payment }) {
  if (!payment) return <span className="text-sm text-[var(--color-text-soft)]">Sem pagamento</span>;
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="font-extrabold text-[var(--color-text)]">{formatCurrency(payment.valor)}</span>
        {payment.is_teste ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
            Teste
          </span>
        ) : null}
      </div>
      <div className="mt-1 text-xs text-[var(--color-text-soft)]">{formatDateTime(payment.data)}</div>
      <div className="mt-1 text-xs font-semibold text-[var(--color-primary)]">
        {formatPaymentOrigin(payment)}
      </div>
    </div>
  );
}

function formatPaymentOrigin(payment) {
  if (payment?.origem === "app_agarra" || payment?.payment_type === "pagamento_app_agarra") {
    return "Aplicativo Agarra";
  }
  return [payment?.origem, payment?.payment_type].filter(Boolean).join(" - ") || "--";
}

function PulseInfo({ pulse, alert }) {
  if (!pulse) return <span className="text-sm text-[var(--color-text-soft)]">Sem pulso</span>;
  return (
    <div className={alert ? "text-rose-700" : "text-emerald-700"}>
      <div className="font-extrabold">{formatPulseStatus(pulse.status)}</div>
      <div className="mt-1 text-xs opacity-75">{formatDateTime(pulse.data)}</div>
      {pulse.command_id ? <div className="mt-1 text-xs opacity-75">cmd {pulse.command_id}</div> : null}
    </div>
  );
}

function DiagnosticoInfo({ machine }) {
  return (
    <div className="space-y-1 text-xs text-[var(--color-text-soft)]">
      <div>
        <span className="font-semibold text-[var(--color-text)]">Uptime:</span> {formatUptime(machine.uptime_seconds)}
      </div>
      <div>
        <span className="font-semibold text-[var(--color-text)]">Heap livre:</span> {formatHeap(machine.free_heap_bytes)}
      </div>
      <div>
        <span className="font-semibold text-[var(--color-text)]">Ultimo reset:</span> {formatResetReason(machine.last_reset_reason)}
      </div>
      <div>
        <span className="font-semibold text-[var(--color-text)]">Reconexoes:</span> Wi-Fi {machine.wifi_reconnect_count ?? 0} / MQTT {machine.mqtt_reconnect_count ?? 0}
      </div>
      <div>
        <span className="font-semibold text-[var(--color-text)]">Pulsos curtos:</span> {machine.short_pulse_count ?? 0}
      </div>
    </div>
  );
}

function HealthMobileCard({ machine, onOpen }) {
  return (
    <article className="rounded-[18px] border border-[var(--color-border)] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-base font-extrabold text-[var(--color-text)]">
            {machine.nome || machine.id_hardware}
          </div>
          <div className="mt-1 text-xs font-semibold text-[var(--color-primary)]">
            {machine.id_hardware}
          </div>
        </div>
        <StatusBadge status={machine.health_status} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <InfoTile label="Sinal" value={formatDateTime(machine.ultimo_sinal)} />
        <InfoTile label="Wi-Fi" value={<WifiBadge machine={machine} />} />
        <InfoTile label="Firmware" value={<FirmwareBadge machine={machine} />} wide />
        <InfoTile label="Pagamento" value={<PaymentInfo payment={machine.ultimo_pagamento} />} />
        <InfoTile label="Pulso" value={<PulseInfo pulse={machine.ultimo_pulso} alert={machine.pulse_alert} />} />
        <InfoTile label="Diagnostico" value={<DiagnosticoInfo machine={machine} />} wide />
      </div>
      <button
        type="button"
        className="pill-button mt-4 inline-flex w-full items-center justify-center gap-2 px-4 py-2 text-sm font-semibold"
        onClick={onOpen}
      >
        <Activity size={15} />
        Abrir maquina
      </button>
    </article>
  );
}

function InfoTile({ label, value, wide = false }) {
  return (
    <div className={`rounded-[14px] bg-[var(--color-bg-muted)] px-3 py-2 ${wide ? "col-span-2" : ""}`}>
      <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-text-soft)]">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-[var(--color-text)]">{value}</div>
    </div>
  );
}
