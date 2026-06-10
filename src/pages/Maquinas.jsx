import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import {
  CheckCircle2,
  Copy,
  Cpu,
  Pencil,
  Plus,
  RefreshCcw,
  Rocket,
  Server,
  Trash2,
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import api, { getApiErrorMessage } from "../api/axios";
import { useAuth } from "../context/AuthContext";
import LoadingSpinner from "../components/LoadingSpinner";
import DateRangePicker from "../components/DateRangePicker";
import Modal from "../components/Modal";
import Button from "../components/Button";
import Toast from "../components/Toast";

const emptyForm = {
  id_hardware: "",
  nome: "",
  localizacao: "",
  cliente_id: "",
  banco_pagamento: "",
};

const paymentProviderLabels = {
  mercado_pago: "Mercado Pago",
  pagbank: "PagBank",
  s6pay: "S6Pay",
};

function getPaymentProviders(cliente) {
  if (!cliente) return [];
  return [
    cliente.cliente_mercado_pago || cliente.mp_configurado ? "mercado_pago" : null,
    cliente.cliente_pagbank ? "pagbank" : null,
    cliente.cliente_s6pay ? "s6pay" : null,
  ].filter(Boolean);
}

const emptyDeleteState = {
  open: false,
  machineId: "",
  confirmationText: "",
};

export default function Maquinas() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const persistedFilters = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("compactpay.maquinas.filters") || "{}");
    } catch {
      return {};
    }
  }, []);
  const [maquinas, setMaquinas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [periodo, setPeriodo] = useState(persistedFilters.periodo || "mes");
  const [dateRange, setDateRange] = useState(persistedFilters.dateRange || { start: "", end: "" });
  const [selectedClienteId, setSelectedClienteId] = useState(persistedFilters.cliente_id || "");
  const [showModal, setShowModal] = useState(false);
  const [editingMachineId, setEditingMachineId] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [generatingId, setGeneratingId] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState("");
  const [sendingCreditId, setSendingCreditId] = useState("");
  const [toast, setToast] = useState({ message: "", type: "success" });
  const [deleteState, setDeleteState] = useState(emptyDeleteState);
  const selectedCliente = usuarios.find((item) => String(item.cliente_id) === String(form.cliente_id));
  const paymentProviders = getPaymentProviders(selectedCliente);

  useEffect(() => {
    localStorage.setItem(
      "compactpay.maquinas.filters",
      JSON.stringify({ periodo, dateRange, cliente_id: selectedClienteId }),
    );
  }, [dateRange, periodo, selectedClienteId]);

  const loadMaquinas = async () => {
    if (!user) return;
    if (user.role === "admin" && !selectedClienteId) {
      setMaquinas([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const params = [];
    if (periodo) params.push(`periodo=${periodo}`);
    if (dateRange.start) params.push(`data_inicio=${dateRange.start}`);
    if (dateRange.end) params.push(`data_fim=${dateRange.end}`);
    if (user.role === "admin" && selectedClienteId) {
      params.push(`cliente_id=${encodeURIComponent(selectedClienteId)}`);
    }
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
  }, [user, periodo, dateRange, selectedClienteId]);

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

  const openCreateMachineModal = () => {
    setEditingMachineId("");
    const cliente = usuarios.find((item) => String(item.cliente_id) === String(selectedClienteId));
    const providers = getPaymentProviders(cliente);
    setForm({
      ...emptyForm,
      cliente_id: selectedClienteId || "",
      banco_pagamento: providers[0] || "",
    });
    setCopyFeedback("");
    setShowModal(true);
    generateId();
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
      const payload = {
        nome: form.nome,
        localizacao: form.localizacao,
        banco_pagamento: form.banco_pagamento || paymentProviders[0] || "mercado_pago",
        cliente_id:
          user?.role === "admin"
            ? form.cliente_id === ""
              ? null
              : Number(form.cliente_id)
            : user.cliente_id,
      };

      if (editingMachineId) {
        await api.put(`/maquinas/${editingMachineId}`, payload);
        setToast({ message: "Maquina atualizada com sucesso.", type: "success" });
      } else {
        await api.post("/maquinas", {
          id_hardware: form.id_hardware,
          ...payload,
        });
        setToast({ message: "Maquina cadastrada com sucesso.", type: "success" });
      }
      setShowModal(false);
      setEditingMachineId("");
      setForm(emptyForm);
      setCopyFeedback("");
      await loadMaquinas();
    } catch (error) {
      setToast({
        message: getApiErrorMessage(error, "Nao foi possivel salvar a maquina."),
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEditMachine = (machine) => {
    setEditingMachineId(machine.id_hardware);
    setForm({
      id_hardware: machine.id_hardware,
      nome: machine.nome || "",
      localizacao: machine.localizacao || "",
      cliente_id: machine.cliente_id == null ? "" : String(machine.cliente_id),
      banco_pagamento: machine.banco_pagamento || "mercado_pago",
    });
    setCopyFeedback("");
    setShowModal(true);
  };

  const requestDeleteMachine = (machineId) => {
    setDeleteState({
      open: true,
      machineId,
      confirmationText: "",
    });
  };

  const handleDeleteMachine = async () => {
    if (deleteState.confirmationText.trim().toLowerCase() !== "confirmar") return;
    await api.delete(`/maquinas/${deleteState.machineId}`);
    setToast({ message: "Maquina excluida com sucesso.", type: "success" });
    setDeleteState(emptyDeleteState);
    await loadMaquinas();
  };

  const sendTestCredit = async (machineId) => {
    setSendingCreditId(machineId);
    try {
      await api.post(`/maquinas/${machineId}/credito-teste`);
      setToast({ message: `Credito de teste enviado para ${machineId}.`, type: "success" });
    } finally {
      setSendingCreditId("");
    }
  };

  const onlineCount = maquinas.filter((m) => {
    if (!m.ultimo_sinal) return false;
    return dayjs().diff(dayjs(m.ultimo_sinal), "minute") < 3;
  }).length;

  return (
    <div className="flex min-h-full flex-col gap-4">
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ message: "", type: toast.type })}
      />

      <CardSectionHeader
        title="Maquinas"
        description="Cadastre novas unidades, gere IDs para o ESP e crie automaticamente o caixa no Mercado Pago do cliente."
        actions={
          user?.role === "admin" ? (
            <Button
              className="justify-center"
              onClick={openCreateMachineModal}
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
            {user?.role === "admin" ? (
              <label className="flex min-w-[260px] items-center gap-3 rounded-full border border-[var(--color-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--color-text)]">
                Cliente
                <select
                  className="min-w-0 flex-1 bg-transparent text-[var(--color-text-soft)] outline-none"
                  value={selectedClienteId}
                  onChange={(event) => setSelectedClienteId(event.target.value)}
                >
                  <option value="">Selecione um cliente</option>
                  {usuarios.map((item) => (
                    <option key={item.id} value={item.cliente_id ?? ""}>
                      {(item.nome || item.email) + (item.cliente_id ? ` - ${item.cliente_id}` : "")}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
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
          {user?.role === "admin" && !selectedClienteId ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 px-6 text-center">
              <div className="text-base font-semibold text-[var(--color-text)]">
                Selecione um cliente para listar as maquinas
              </div>
              <div className="max-w-md text-sm leading-6 text-[var(--color-text-soft)]">
                A listagem fica filtrada por cliente para manter a tela rapida e organizada mesmo com muitas maquinas cadastradas.
              </div>
            </div>
          ) : loading ? (
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
                    <th className="px-5 py-4 whitespace-nowrap">Ultima atividade</th>
                    <th className="px-5 py-4 whitespace-nowrap">Localizacao</th>
                    <th className="px-5 py-4 whitespace-nowrap">Banco</th>
                    <th className="px-5 py-4 whitespace-nowrap">Caixa MP</th>
                    <th className="px-5 py-4 whitespace-nowrap">Faturamento</th>
                    <th className="px-5 py-4 whitespace-nowrap">Teste</th>
                    {user?.role === "admin" ? (
                      <th className="px-5 py-4 whitespace-nowrap">Gerenciar</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {maquinas.map((m) => (
                      <tr
                        key={m.id_hardware}
                        className="border-t border-[var(--color-border)] text-sm text-[var(--color-text)]"
                      >
                        <td className="px-5 py-4 min-w-[220px]">
                          <button
                            type="button"
                            className="text-left"
                            onClick={() => navigate(`/maquinas/${m.id_hardware}`)}
                          >
                            <div className="font-semibold text-[var(--color-primary-strong)] hover:underline">
                              {m.id_hardware}
                            </div>
                          </button>
                          <div className="mt-1 text-xs text-[var(--color-text-soft)]">
                            Clique para abrir pagamentos e testes da maquina
                          </div>
                        </td>
                        <td className="px-5 py-4 min-w-[180px] font-medium">{m.nome || "--"}</td>
                        <td className="px-5 py-4 min-w-[140px]">
                          <span
                            className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold"
                            style={{
                              backgroundColor:
                                m.status_operacional === "operando"
                                  ? "var(--color-primary-soft)"
                                  : m.status_operacional === "atencao"
                                    ? "#fff2d8"
                                    : "#fee2e2",
                              color:
                                m.status_operacional === "operando"
                                  ? "var(--color-success)"
                                  : m.status_operacional === "atencao"
                                    ? "var(--color-warning)"
                                    : "var(--color-error)",
                            }}
                          >
                            {m.status_operacional === "operando" ? (
                              <CheckCircle2 size={15} />
                            ) : (
                              <XCircle size={15} />
                            )}
                            {m.status_operacional === "operando"
                              ? "Operando"
                              : m.status_operacional === "atencao"
                                ? "Atencao"
                                : "Offline"}
                          </span>
                        </td>
                        <td className="px-5 py-4 min-w-[180px] text-[var(--color-text-soft)]">
                          {m.ultima_atividade_em
                            ? dayjs(m.ultima_atividade_em).format("DD/MM/YYYY HH:mm:ss")
                            : "Sem atividade"}
                          <div className="mt-1 text-xs">
                            {m.ultimo_pagamento_em
                              ? `Pag.: ${dayjs(m.ultimo_pagamento_em).format("DD/MM HH:mm")}`
                              : m.ultimo_teste_em
                                ? `Teste: ${dayjs(m.ultimo_teste_em).format("DD/MM HH:mm")}`
                                : m.ultima_saida_em
                                  ? `Saida: ${dayjs(m.ultima_saida_em).format("DD/MM HH:mm")}`
                                  : "Sem eventos recentes"}
                          </div>
                        </td>
                        <td className="px-5 py-4 min-w-[180px] text-[var(--color-text-soft)]">
                          {m.localizacao || "--"}
                        </td>
                        <td className="px-5 py-4 min-w-[150px] font-semibold text-[var(--color-text)]">
                          {paymentProviderLabels[m.banco_pagamento || "mercado_pago"] || m.banco_pagamento || "--"}
                        </td>
                        <td className="px-5 py-4 min-w-[170px]">
                          <div className="font-semibold text-[var(--color-text)]">{m.mp_pos_external_id || "--"}</div>
                          <div className="mt-1 text-xs text-[var(--color-text-soft)]">
                            {m.mp_pos_id ? `POS ${m.mp_pos_id}` : "Ainda nao criado"}
                          </div>
                        </td>
                        <td className="px-5 py-4 min-w-[140px] font-semibold">
                          {m.faturamento?.toFixed ? `R$ ${m.faturamento.toFixed(2)}` : "--"}
                        </td>
                        <td className="px-5 py-4 min-w-[170px]">
                          <button
                            type="button"
                            className="pill-button pill-button--primary inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold"
                            onClick={() => sendTestCredit(m.id_hardware)}
                            disabled={sendingCreditId === m.id_hardware}
                          >
                            <Rocket size={15} />
                            {sendingCreditId === m.id_hardware ? "Enviando..." : "Enviar credito"}
                          </button>
                        </td>
                        {user?.role === "admin" ? (
                          <td className="px-5 py-4 min-w-[220px]">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                className="pill-button inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold"
                                onClick={() => handleEditMachine(m)}
                              >
                                <Pencil size={15} />
                                Editar
                              </button>
                              <button
                                type="button"
                                className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-[var(--color-error)] transition hover:bg-rose-100"
                                onClick={() => requestDeleteMachine(m.id_hardware)}
                              >
                                <Trash2 size={15} />
                                Excluir
                              </button>
                            </div>
                          </td>
                        ) : null}
                      </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <Modal
        open={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingMachineId("");
        }}
      >
        <div className="space-y-5">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--color-text-soft)]">
              Cadastro de maquina
            </div>
            <h2 className="mt-2 text-3xl font-extrabold tracking-[-0.04em] text-[var(--color-text)]">
              {editingMachineId ? "Editar maquina" : "Cadastrar e vincular ao ESP"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-soft)]">
              {editingMachineId
                ? "Atualize os dados cadastrais da maquina e mantenha o cliente responsavel correto."
                : "Escolha o usuario cliente. O sistema ja busca o proximo ID e cria automaticamente um caixa no Mercado Pago com o nome do ponto."}
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
                  placeholder="Ex.: 1000"
                  value={form.id_hardware}
                  onChange={(e) =>
                    setForm((current) => ({ ...current, id_hardware: e.target.value.toUpperCase() }))
                  }
                  disabled={Boolean(editingMachineId)}
                />
                <button
                  type="button"
                  className="pill-button inline-flex items-center justify-center gap-2 px-5 py-3 font-semibold"
                  onClick={generateId}
                  disabled={generatingId || Boolean(editingMachineId)}
                >
                  <RefreshCcw size={16} className={generatingId ? "animate-spin" : ""} />
                  {generatingId ? "Gerando" : "Proximo ID"}
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
                O ID e gerado automaticamente a partir de <span className="font-semibold text-[var(--color-text)]">1000</span>, mas voce pode alterar antes de cadastrar.
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
                      setForm((current) => {
                        const cliente = usuarios.find((item) => String(item.cliente_id) === e.target.value);
                        const providers = getPaymentProviders(cliente);
                        return {
                          ...current,
                          cliente_id: e.target.value,
                          banco_pagamento: providers[0] || "",
                        };
                      })
                    }
                    required
                  >
                    <option value="">Selecione o cliente responsavel</option>
                    {usuarios.map((item) => (
                      <option key={item.id} value={item.cliente_id ?? ""}>
                        {(item.nome || item.email) + (item.cliente_id ? ` - cliente ${item.cliente_id}` : "")}
                        {item.mp_configurado ? "" : " - Mercado Pago pendente"}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {user?.role === "admin" ? (
                <label className="block md:col-span-2">
                  <span className="mb-2 block text-sm font-semibold text-[var(--color-text)]">
                    Banco da maquina
                  </span>
                  <select
                    className="w-full rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-4 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
                    value={form.banco_pagamento}
                    onChange={(e) =>
                      setForm((current) => ({ ...current, banco_pagamento: e.target.value }))
                    }
                    required
                    disabled={!form.cliente_id || paymentProviders.length === 0 || Boolean(editingMachineId)}
                  >
                    <option value="">
                      {form.cliente_id ? "Selecione o banco da maquina" : "Selecione um cliente primeiro"}
                    </option>
                    {paymentProviders.map((provider) => (
                      <option
                        key={provider}
                        value={provider}
                        disabled={provider !== "mercado_pago"}
                      >
                        {paymentProviderLabels[provider]}{provider !== "mercado_pago" ? " - em breve" : ""}
                      </option>
                    ))}
                  </select>
                  {form.cliente_id && paymentProviders.length === 0 ? (
                    <span className="mt-2 block text-xs font-medium text-[var(--color-error)]">
                      Este cliente ainda nao tem banco de pagamento habilitado.
                    </span>
                  ) : null}
                </label>
              ) : null}

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-[var(--color-text)]">
                  Nome do ponto
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
              {saving ? "Salvando maquina..." : editingMachineId ? "Salvar alteracoes" : "Cadastrar maquina"}
            </Button>
          </form>
        </div>
      </Modal>

      <Modal
        open={deleteState.open}
        onClose={() => setDeleteState(emptyDeleteState)}
      >
        <div className="space-y-5">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--color-text-soft)]">
              Exclusao de maquina
            </div>
            <h2 className="mt-2 text-3xl font-extrabold tracking-[-0.04em] text-[var(--color-text)]">
              Confirmar exclusao
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-soft)]">
              Esta acao remove a maquina <span className="font-semibold text-[var(--color-text)]">{deleteState.machineId}</span> e todo o historico vinculado.
            </p>
            <p className="mt-3 text-sm leading-6 text-[var(--color-text-soft)]">
              Para continuar, digite <span className="font-semibold text-[var(--color-error)]">confirmar</span> no campo abaixo.
            </p>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[var(--color-text)]">
              Confirmacao
            </span>
            <input
              className="w-full rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-4 text-[var(--color-text)] outline-none transition focus:border-[var(--color-error)]"
              placeholder='Digite "confirmar"'
              value={deleteState.confirmationText}
              onChange={(e) =>
                setDeleteState((current) => ({
                  ...current,
                  confirmationText: e.target.value,
                }))
              }
            />
          </label>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="pill-button inline-flex flex-1 items-center justify-center px-5 py-3 font-semibold"
              onClick={() => setDeleteState(emptyDeleteState)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="inline-flex flex-1 items-center justify-center rounded-full border border-rose-200 bg-rose-50 px-5 py-3 font-semibold text-[var(--color-error)] transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={handleDeleteMachine}
              disabled={deleteState.confirmationText.trim().toLowerCase() !== "confirmar"}
            >
              Excluir maquina
            </button>
          </div>
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
