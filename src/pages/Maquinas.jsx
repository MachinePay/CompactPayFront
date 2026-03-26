import { useEffect, useState } from "react";
import dayjs from "dayjs";
import {
  CheckCircle2,
  Copy,
  Cpu,
  Plus,
  RefreshCcw,
  Server,
  XCircle,
} from "lucide-react";

import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import LoadingSpinner from "../components/LoadingSpinner";
import DateRangePicker from "../components/DateRangePicker";
import Modal from "../components/Modal";
import Button from "../components/Button";

const emptyForm = {
  id_hardware: "",
  nome: "",
  localizacao: "",
  cliente_id: "",
};

export default function Maquinas() {
  const { user } = useAuth();
  const [maquinas, setMaquinas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [periodo, setPeriodo] = useState("mes");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [generatingId, setGeneratingId] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState("");

  const loadMaquinas = async () => {
    if (!user) return;
    setLoading(true);
    const params = [];
    if (user.cliente_id != null) params.push(`cliente_id=${user.cliente_id}`);
    if (periodo) params.push(`periodo=${periodo}`);
    if (dateRange.start) params.push(`data_inicio=${dateRange.start}`);
    if (dateRange.end) params.push(`data_fim=${dateRange.end}`);
    const paramStr = params.length ? `?${params.join("&")}` : "";
    try {
      const res = await api.get(`/maquinas${paramStr}`);
      setMaquinas(res.data);
    } finally {
      setLoading(false);
    }
  };

  const loadUsuarios = async () => {
    if (user?.role !== "admin") return;
    const res = await api.get("/usuarios");
    setUsuarios(res.data.filter((item) => item.role === "cliente"));
  };

  useEffect(() => {
    loadMaquinas();
  }, [user, periodo, dateRange]);

  useEffect(() => {
    loadUsuarios();
  }, [user]);

  const generateId = async () => {
    setGeneratingId(true);
    try {
      const { data } = await api.get("/maquinas/novo-id");
      setForm((current) => ({ ...current, id_hardware: data.id_hardware }));
      setCopyFeedback("");
    } finally {
      setGeneratingId(false);
    }
  };

  const copyMachineId = async () => {
    if (!form.id_hardware) return;
    await navigator.clipboard.writeText(form.id_hardware);
    setCopyFeedback("ID copiado para configurar no ESP.");
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/maquinas", {
        id_hardware: form.id_hardware,
        nome: form.nome,
        localizacao: form.localizacao,
        cliente_id:
          user?.role === "admin"
            ? form.cliente_id === ""
              ? null
              : Number(form.cliente_id)
            : user.cliente_id,
      });
      setShowModal(false);
      setForm(emptyForm);
      setCopyFeedback("");
      await loadMaquinas();
    } finally {
      setSaving(false);
    }
  };

  const onlineCount = maquinas.filter((m) => {
    if (!m.ultimo_sinal) return false;
    return dayjs().diff(dayjs(m.ultimo_sinal), "minute") < 3;
  }).length;

  return (
    <div className="flex min-h-full flex-col gap-4">
      <CardSectionHeader
        title="Maquinas"
        description="Cadastre novas unidades, gere IDs para o ESP e acompanhe o status de cada maquina."
        actions={
          user?.role === "admin" ? (
            <Button
              className="justify-center"
              onClick={() => {
                setForm(emptyForm);
                setCopyFeedback("");
                setShowModal(true);
              }}
            >
              <Plus size={18} />
              Nova maquina
            </Button>
          ) : null
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          icon={<Server size={18} />}
          label="Maquinas cadastradas"
          value={String(maquinas.length)}
          helper="Total visivel no painel"
        />
        <SummaryCard
          icon={<CheckCircle2 size={18} />}
          label="Ativas agora"
          value={String(onlineCount)}
          helper="Ultimo sinal recebido nos ultimos 3 minutos"
          featured
        />
        <SummaryCard
          icon={<Cpu size={18} />}
          label="Prontas para ESP"
          value={String(maquinas.length)}
          helper="IDs prontos para vinculacao no ESP"
        />
      </div>

      <section className="app-panel rounded-[30px] p-5 md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-3 rounded-full border border-[var(--color-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--color-text)]">
              Periodo
              <select
                className="bg-transparent text-[var(--color-text-soft)] outline-none"
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value)}
              >
                <option value="dia">Dia</option>
                <option value="mes">Mes</option>
              </select>
            </label>
            <DateRangePicker value={dateRange} onChange={setDateRange} />
          </div>

          <button
            className="pill-button inline-flex items-center justify-center gap-2 px-5 py-3 font-semibold"
            onClick={loadMaquinas}
            type="button"
          >
            <RefreshCcw size={16} />
            Recarregar
          </button>
        </div>

        <div className="mt-6 overflow-hidden rounded-[26px] border border-[var(--color-border)] bg-white">
          {loading ? (
            <LoadingSpinner className="h-40" />
          ) : maquinas.length === 0 ? (
            <div className="flex h-40 items-center justify-center px-6 text-center text-sm text-[var(--color-text-soft)]">
              Nenhuma maquina cadastrada ainda. Gere um ID, configure o ESP e crie a unidade por aqui.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-[var(--color-bg-muted)] text-left text-xs uppercase tracking-[0.18em] text-[var(--color-text-soft)]">
                  <tr>
                    <th className="px-5 py-4 whitespace-nowrap">ID da maquina</th>
                    <th className="px-5 py-4 whitespace-nowrap">Nome</th>
                    <th className="px-5 py-4 whitespace-nowrap">Status</th>
                    <th className="px-5 py-4 whitespace-nowrap">Localizacao</th>
                    <th className="px-5 py-4 whitespace-nowrap">Faturamento</th>
                  </tr>
                </thead>
                <tbody>
                  {maquinas.map((m) => {
                    const online =
                      m.ultimo_sinal &&
                      dayjs().diff(dayjs(m.ultimo_sinal), "minute") < 3;

                    return (
                      <tr
                        key={m.id_hardware}
                        className="border-t border-[var(--color-border)] text-sm text-[var(--color-text)]"
                      >
                        <td className="px-5 py-4 min-w-[220px]">
                          <div className="font-semibold">{m.id_hardware}</div>
                          <div className="mt-1 text-xs text-[var(--color-text-soft)]">
                            Use este ID na configuracao do ESP
                          </div>
                        </td>
                        <td className="px-5 py-4 min-w-[180px] font-medium">{m.nome || "--"}</td>
                        <td className="px-5 py-4 min-w-[140px]">
                          {online ? (
                            <span className="inline-flex items-center gap-2 rounded-full bg-[var(--color-primary-soft)] px-3 py-2 text-xs font-semibold text-[var(--color-success)]">
                              <CheckCircle2 size={15} /> Online
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-2 text-xs font-semibold text-[var(--color-error)]">
                              <XCircle size={15} /> Offline
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 min-w-[180px] text-[var(--color-text-soft)]">
                          {m.localizacao || "--"}
                        </td>
                        <td className="px-5 py-4 min-w-[140px] font-semibold">
                          {m.faturamento?.toFixed ? `R$ ${m.faturamento.toFixed(2)}` : "--"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <Modal open={showModal} onClose={() => setShowModal(false)}>
        <div className="space-y-5">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--color-text-soft)]">
              Cadastro de maquina
            </div>
            <h2 className="mt-2 text-3xl font-extrabold tracking-[-0.04em] text-[var(--color-text)]">
              Gerar ID e vincular ao ESP
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-soft)]">
              Gere um ID unico, copie esse valor e use no firmware ou no portal de configuracao do ESP antes de instalar a maquina.
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleCreate}>
            <div className="rounded-[24px] border border-[var(--color-border)] bg-[var(--color-bg-muted)] p-4">
              <div className="text-sm font-semibold text-[var(--color-text)]">
                ID da maquina
              </div>
              <div className="mt-3 flex flex-col gap-3 md:flex-row">
                <input
                  className="w-full rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-4 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
                  placeholder="Clique em gerar um ID"
                  value={form.id_hardware}
                  onChange={(e) =>
                    setForm((current) => ({ ...current, id_hardware: e.target.value.toUpperCase() }))
                  }
                />
                <button
                  type="button"
                  className="pill-button inline-flex items-center justify-center gap-2 px-5 py-3 font-semibold"
                  onClick={generateId}
                  disabled={generatingId}
                >
                  <RefreshCcw size={16} className={generatingId ? "animate-spin" : ""} />
                  {generatingId ? "Gerando" : "Gerar ID"}
                </button>
                <button
                  type="button"
                  className="pill-button inline-flex items-center justify-center gap-2 px-5 py-3 font-semibold"
                  onClick={copyMachineId}
                  disabled={!form.id_hardware}
                >
                  <Copy size={16} />
                  Copiar
                </button>
              </div>
              <div className="mt-3 text-xs text-[var(--color-text-soft)]">
                Exemplo de identificador: <span className="font-semibold text-[var(--color-text)]">CPM-A1B2C3</span>
              </div>
              {copyFeedback ? (
                <div className="mt-3 text-sm font-medium text-[var(--color-success)]">
                  {copyFeedback}
                </div>
              ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {user?.role === "admin" ? (
                <label className="block md:col-span-2">
                  <span className="mb-2 block text-sm font-semibold text-[var(--color-text)]">
                    Vincular ao cliente
                  </span>
                  <select
                    className="w-full rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-4 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
                    value={form.cliente_id || ""}
                    onChange={(e) =>
                      setForm((current) => ({ ...current, cliente_id: e.target.value }))
                    }
                    required
                  >
                    <option value="">Selecione o cliente responsavel</option>
                    {usuarios.map((item) => (
                      <option key={item.id} value={item.cliente_id ?? ""}>
                        {(item.nome || item.email) + (item.cliente_id ? ` - cliente ${item.cliente_id}` : "")}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-[var(--color-text)]">
                  Nome da maquina
                </span>
                <input
                  className="w-full rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-4 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
                  placeholder="Ex.: Grua Shopping Centro"
                  value={form.nome}
                  onChange={(e) =>
                    setForm((current) => ({ ...current, nome: e.target.value }))
                  }
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-[var(--color-text)]">
                  Localizacao
                </span>
                <input
                  className="w-full rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-4 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
                  placeholder="Ex.: Piso 2 - corredor central"
                  value={form.localizacao}
                  onChange={(e) =>
                    setForm((current) => ({ ...current, localizacao: e.target.value }))
                  }
                />
              </label>
            </div>

            <Button type="submit" className="w-full justify-center" disabled={saving}>
              {saving ? "Salvando maquina..." : "Cadastrar maquina"}
            </Button>
          </form>
        </div>
      </Modal>
    </div>
  );
}

function CardSectionHeader({ title, description, actions }) {
  return (
    <section className="app-panel rounded-[30px] p-6 md:p-7">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--color-text-soft)]">
            Operacao
          </div>
          <h1 className="mt-3 text-4xl font-extrabold tracking-[-0.05em] text-[var(--color-text)] md:text-5xl">
            {title}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--color-text-soft)] md:text-base">
            {description}
          </p>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
      </div>
    </section>
  );
}

function SummaryCard({ icon, label, value, helper, featured = false }) {
  return (
    <section
      className={`app-panel rounded-[28px] p-6 ${
        featured
          ? "bg-[linear-gradient(135deg,var(--color-primary)_0%,var(--color-primary-strong)_100%)] text-white shadow-[0_22px_40px_rgba(31,122,76,0.28)]"
          : ""
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className={`text-sm font-semibold ${featured ? "text-white/72" : "text-[var(--color-text-soft)]"}`}>
            {label}
          </div>
          <div className="mt-4 text-4xl font-extrabold tracking-[-0.05em]">{value}</div>
        </div>
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-full ${
            featured
              ? "bg-white/16 text-white"
              : "bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
          }`}
        >
          {icon}
        </div>
      </div>
      <div className={`mt-4 text-sm ${featured ? "text-white/74" : "text-[var(--color-text-soft)]"}`}>
        {helper}
      </div>
    </section>
  );
}
