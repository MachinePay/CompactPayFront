import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Cpu,
  Pencil,
  Plus,
  RefreshCcw,
  Rocket,
  Server,
  Trash2,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import api, { getApiErrorMessage } from "../api/axios";
import { useAuth } from "../context/useAuth";
import LoadingSpinner from "../components/LoadingSpinner";
import DateRangePicker from "../components/DateRangePicker";
import Modal from "../components/Modal";
import Button from "../components/Button";
import Toast from "../components/Toast";
import ConfirmModal from "../components/ConfirmModal";
import { brasiliaDate } from "../utils/dateTime";

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
    cliente.cliente_mercado_pago || cliente.mp_configurado
      ? "mercado_pago"
      : null,
    cliente.cliente_pagbank ? "pagbank" : null,
    cliente.cliente_s6pay ? "s6pay" : null,
  ].filter(Boolean);
}

const emptyDeleteState = {
  open: false,
  machineId: "",
  confirmationText: "",
};

const emptyUpdateState = {
  open: false,
  machine: null,
  firmwareId: "",
};

const emptyCreditState = {
  open: false,
  machine: null,
  value: "",
};

const quickCreditValues = [2, 5, 10, 20, 50, 100];

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default function Maquinas() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const persistedFilters = useMemo(() => {
    try {
      return JSON.parse(
        localStorage.getItem("compactpay.maquinas.filters") || "{}",
      );
    } catch {
      return {};
    }
  }, []);
  const [maquinas, setMaquinas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [firmwareVersions, setFirmwareVersions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [periodo, setPeriodo] = useState(persistedFilters.periodo || "mes");
  const [dateRange, setDateRange] = useState(
    persistedFilters.dateRange || { start: "", end: "" },
  );
  const [selectedClienteId, setSelectedClienteId] = useState(
    persistedFilters.cliente_id || "",
  );
  const [showModal, setShowModal] = useState(false);
  const [editingMachineId, setEditingMachineId] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [generatingId, setGeneratingId] = useState(false);
  const [validatingMp, setValidatingMp] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState("");
  const [sendingCreditId, setSendingCreditId] = useState("");
  const [sendingUpdateId, setSendingUpdateId] = useState("");
  const [verifyingMachineId, setVerifyingMachineId] = useState("");
  const [toast, setToast] = useState({ message: "", type: "success" });
  const [deleteState, setDeleteState] = useState(emptyDeleteState);
  const [updateState, setUpdateState] = useState(emptyUpdateState);
  const [creditState, setCreditState] = useState(emptyCreditState);
  const selectedCliente = usuarios.find(
    (item) => String(item.cliente_id) === String(form.cliente_id),
  );
  const paymentProviders = getPaymentProviders(selectedCliente);

  useEffect(() => {
    localStorage.setItem(
      "compactpay.maquinas.filters",
      JSON.stringify({ periodo, dateRange, cliente_id: selectedClienteId }),
    );
  }, [dateRange, periodo, selectedClienteId]);

  const loadMaquinas = useCallback(async () => {
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
    } catch (error) {
      setToast({
        message: getApiErrorMessage(
          error,
          "Nao foi possivel carregar as maquinas.",
        ),
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [dateRange, periodo, selectedClienteId, user]);

  const loadUsuarios = useCallback(async () => {
    if (user?.role !== "admin") return;
    try {
      const res = await api.get("/usuarios");
      setUsuarios(res.data.filter((item) => item.role === "cliente"));
    } catch (error) {
      setToast({
        message: getApiErrorMessage(
          error,
          "Nao foi possivel carregar os clientes.",
        ),
        type: "error",
      });
    }
  }, [user?.role]);

  const loadFirmwareVersions = useCallback(async () => {
    if (user?.role !== "admin") return;
    try {
      const { data } = await api.get("/firmware-versions");
      setFirmwareVersions(data);
    } catch (error) {
      setToast({
        message: getApiErrorMessage(
          error,
          "Nao foi possivel carregar as versoes de firmware.",
        ),
        type: "error",
      });
    }
  }, [user?.role]);

  useEffect(() => {
    const timer = window.setTimeout(loadMaquinas, 0);
    return () => window.clearTimeout(timer);
  }, [loadMaquinas]);

  useEffect(() => {
    const timer = window.setTimeout(loadUsuarios, 0);
    return () => window.clearTimeout(timer);
  }, [loadUsuarios]);

  useEffect(() => {
    const timer = window.setTimeout(loadFirmwareVersions, 0);
    return () => window.clearTimeout(timer);
  }, [loadFirmwareVersions]);

  useEffect(() => {
    const hasUpdateInProgress = maquinas.some((item) =>
      ["sent", "downloading", "restarting"].includes(
        item.firmware_update_status,
      ),
    );
    if (!hasUpdateInProgress) return undefined;
    const timer = window.setInterval(loadMaquinas, 5000);
    return () => window.clearInterval(timer);
  }, [loadMaquinas, maquinas]);

  const generateId = async () => {
    setGeneratingId(true);
    try {
      const { data } = await api.get("/maquinas/novo-id");
      setForm((current) => ({ ...current, id_hardware: data.id_hardware }));
      setCopyFeedback("");
    } catch (error) {
      setToast({
        message: getApiErrorMessage(
          error,
          "Nao foi possivel gerar o ID da maquina.",
        ),
        type: "error",
      });
    } finally {
      setGeneratingId(false);
    }
  };

  const openCreateMachineModal = () => {
    setEditingMachineId("");
    const cliente = usuarios.find(
      (item) => String(item.cliente_id) === String(selectedClienteId),
    );
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

  const validateSelectedMercadoPago = async () => {
    if (!form.cliente_id) return null;
    setValidatingMp(true);
    try {
      const { data } = await api.get(
        `/mercado-pago/clientes/${form.cliente_id}/validacao`,
      );
      if (data?.ok) {
        setToast({
          message: "Mercado Pago validado. Cliente pronto para criar maquina.",
          type: "success",
        });
        return data;
      }
      const blockingChecks = (data?.checks || []).filter(
        (item) => !item.ok && (item.severity || "error") === "error",
      );
      const message = blockingChecks.length
        ? blockingChecks
            .map((item) => `${item.label}: ${item.message}`)
            .join(" ")
        : data?.next_step ||
          "Revise a integracao Mercado Pago antes de criar a maquina.";
      setToast({ message, type: "error" });
      return data;
    } catch (error) {
      setToast({
        message: getApiErrorMessage(
          error,
          "Nao foi possivel validar o Mercado Pago.",
        ),
        type: "error",
      });
      return null;
    } finally {
      setValidatingMp(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const selectedProvider =
        form.banco_pagamento || paymentProviders[0] || "mercado_pago";
      const payload = {
        nome: form.nome,
        localizacao: form.localizacao,
        banco_pagamento: selectedProvider,
        cliente_id:
          user?.role === "admin"
            ? form.cliente_id === ""
              ? null
              : Number(form.cliente_id)
            : user.cliente_id,
      };

      if (
        !editingMachineId &&
        user?.role === "admin" &&
        selectedProvider === "mercado_pago"
      ) {
        const data = await validateSelectedMercadoPago();
        if (!data?.ok) {
          const blockingChecks = (data?.checks || []).filter(
            (item) => !item.ok && (item.severity || "error") === "error",
          );
          const message = blockingChecks.length
            ? blockingChecks
                .map((item) => `${item.label}: ${item.message}`)
                .join(" ")
            : data?.next_step ||
              "Valide a integracao Mercado Pago antes de criar a maquina.";
          throw new Error(message);
        }
      }

      if (editingMachineId) {
        await api.put(`/maquinas/${editingMachineId}`, payload);
        setToast({
          message: "Maquina atualizada com sucesso.",
          type: "success",
        });
      } else {
        await api.post("/maquinas", {
          id_hardware: form.id_hardware,
          ...payload,
        });
        setToast({
          message: "Maquina cadastrada com sucesso.",
          type: "success",
        });
      }
      setShowModal(false);
      setEditingMachineId("");
      setForm(emptyForm);
      setCopyFeedback("");
      await loadMaquinas();
    } catch (error) {
      setToast({
        message: getApiErrorMessage(
          error,
          "Nao foi possivel salvar a maquina.",
        ),
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
    try {
      await api.delete(`/maquinas/${deleteState.machineId}`);
      setToast({ message: "Maquina excluida com sucesso.", type: "success" });
      setDeleteState(emptyDeleteState);
      await loadMaquinas();
    } catch (error) {
      setToast({
        message: getApiErrorMessage(
          error,
          "Nao foi possivel excluir a maquina.",
        ),
        type: "error",
      });
    }
  };

  const openCreditModal = (machine) => {
    setCreditState({
      open: true,
      machine,
      value: "",
    });
  };

  const sendTestCredit = async () => {
    const machine = creditState.machine;
    if (!machine) return;
    const value = Number(String(creditState.value).replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) {
      setToast({
        message: "Informe um valor maior que zero.",
        type: "error",
      });
      return;
    }

    setSendingCreditId(machine.id_hardware);
    try {
      await api.post(`/maquinas/${machine.id_hardware}/credito-teste`, {
        valor: value,
      });
      setCreditState(emptyCreditState);
      setToast({
        message: `Pagamento de teste de ${formatCurrency(value)} enviado para ${machine.id_hardware}.`,
        type: "success",
      });
      await loadMaquinas();
    } catch (error) {
      setToast({
        message: getApiErrorMessage(
          error,
          "Nao foi possivel enviar o credito de teste.",
        ),
        type: "error",
      });
    } finally {
      setSendingCreditId("");
    }
  };

  const requestFirmwareUpdate = (machine) => {
    if (!machine.status_online) {
      setToast({
        message: "Maquina offline. Aguarde ela ficar online para atualizar.",
        type: "error",
      });
      return;
    }
    setUpdateState({
      open: true,
      machine,
      firmwareId: firmwareVersions[0]?.id ? String(firmwareVersions[0].id) : "",
    });
  };

  const verifyMachineOnline = async (machine) => {
    setVerifyingMachineId(machine.id_hardware);
    try {
      const { data } = await api.post(
        `/maquinas/${machine.id_hardware}/verificar-online`,
      );
      setToast({
        message: data.online
          ? `A placa ${machine.id_hardware} respondeu e esta online.`
          : `A placa ${machine.id_hardware} nao respondeu e foi marcada como offline.`,
        type: data.online ? "success" : "error",
      });
      await loadMaquinas();
    } catch (error) {
      setToast({
        message: getApiErrorMessage(
          error,
          "Nao foi possivel verificar a placa.",
        ),
        type: "error",
      });
      await loadMaquinas();
    } finally {
      setVerifyingMachineId("");
    }
  };

  const sendFirmwareUpdate = async () => {
    const machine = updateState.machine;
    if (!machine) return;
    if (!updateState.firmwareId) {
      setToast({
        message: "Selecione uma versao de firmware antes de atualizar.",
        type: "error",
      });
      return;
    }
    setSendingUpdateId(machine.id_hardware);
    try {
      await api.post(`/maquinas/${machine.id_hardware}/atualizacao`, {
        firmware_version_id: Number(updateState.firmwareId),
      });
      setToast({
        message: `Atualizacao enviada para ${machine.id_hardware}.`,
        type: "success",
      });
      setUpdateState(emptyUpdateState);
      await loadMaquinas();
    } catch (error) {
      setToast({
        message: getApiErrorMessage(
          error,
          "Nao foi possivel enviar a atualizacao.",
        ),
        type: "error",
      });
    } finally {
      setSendingUpdateId("");
    }
  };

  const onlineCount = maquinas.filter((m) => m.status_online).length;

  return (
    <div className="flex min-h-full flex-col gap-4">
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ message: "", type: toast.type })}
      />

      <Modal
        open={updateState.open}
        onClose={() => setUpdateState(emptyUpdateState)}
        title="Confirmar atualizacao"
      >
        <div className="space-y-5">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--color-text-soft)]">
              Atualizacao OTA
            </div>
            <h2 className="mt-2 text-3xl font-extrabold text-[var(--color-text)]">
              {updateState.machine?.nome || updateState.machine?.id_hardware}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-soft)]">
              Escolha a versao cadastrada e confirme o envio para a placa
              online.
            </p>
          </div>

          <div className="grid gap-3 rounded-[22px] border border-[var(--color-border)] bg-[var(--color-bg-muted)] p-4 text-sm">
            <InfoLine
              label="Maquina"
              value={updateState.machine?.id_hardware || "--"}
            />
            <InfoLine
              label="Versao atual"
              value={
                updateState.machine?.firmware_version ||
                "Aguardando sinal da placa"
              }
            />
            <InfoLine
              label="Ultimo sinal"
              value={
                updateState.machine?.ultimo_sinal
                  ? brasiliaDate(updateState.machine.ultimo_sinal).format(
                      "DD/MM/YYYY HH:mm:ss",
                    )
                  : "Sem sinal"
              }
            />
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[var(--color-text)]">
              Versao para enviar
            </span>
            <select
              className="w-full rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-4 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
              value={updateState.firmwareId}
              onChange={(event) =>
                setUpdateState((current) => ({
                  ...current,
                  firmwareId: event.target.value,
                }))
              }
              required
            >
              <option value="">Selecione a versao</option>
              {firmwareVersions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nome}
                </option>
              ))}
            </select>
          </label>

          {updateState.firmwareId ? (
            <div className="rounded-[18px] border border-[var(--color-border)] bg-white p-4 text-sm">
              <div className="font-semibold text-[var(--color-text)]">
                URL do firmware
              </div>
              <a
                className="mt-2 block break-all text-[var(--color-primary-strong)] hover:underline"
                href={
                  firmwareVersions.find(
                    (item) =>
                      String(item.id) === String(updateState.firmwareId),
                  )?.url_bin
                }
                target="_blank"
                rel="noreferrer"
              >
                {
                  firmwareVersions.find(
                    (item) =>
                      String(item.id) === String(updateState.firmwareId),
                  )?.url_bin
                }
              </a>
            </div>
          ) : null}

          <div className="flex gap-3 rounded-[18px] border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            Nao desligue a placa durante a atualizacao. Ela pode reiniciar
            sozinha e voltar informando a nova versao.
          </div>

          <Button
            type="button"
            className="w-full justify-center"
            onClick={sendFirmwareUpdate}
            disabled={
              sendingUpdateId === updateState.machine?.id_hardware ||
              !updateState.firmwareId
            }
          >
            <UploadCloud size={18} />
            {sendingUpdateId === updateState.machine?.id_hardware
              ? "Enviando..."
              : "Enviar atualizacao"}
          </Button>
        </div>
      </Modal>

      <Modal
        open={creditState.open}
        onClose={() => {
          if (!sendingCreditId) setCreditState(emptyCreditState);
        }}
      >
        <div className="mx-auto max-w-xl space-y-5">
          <div className="text-center">
            <div className="mx-auto flex h-24 w-52 items-center justify-center overflow-hidden rounded-2xl bg-white">
              <img
                src="/logoCompactpay.jpeg"
                alt="CompactPay"
                className="h-full w-full object-contain"
              />
            </div>
            <h2 className="mt-3 text-3xl font-extrabold text-[var(--color-text)]">
              Enviar crédito
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-soft)]">
              Escolha ou digite o valor para enviar à máquina{" "}
              <strong>{creditState.machine?.nome || creditState.machine?.id_hardware}</strong>.
              O envio será registrado como pagamento de teste.
            </p>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[var(--color-text)]">
              Valor do crédito
            </span>
            <div className="flex items-center rounded-[18px] border border-[var(--color-border)] bg-white px-4 focus-within:border-[var(--color-primary)]">
              <span className="font-extrabold text-[var(--color-primary)]">R$</span>
              <input
                type="text"
                inputMode="decimal"
                autoFocus
                className="min-w-0 flex-1 bg-transparent px-3 py-4 text-xl font-extrabold text-[var(--color-text)] outline-none"
                placeholder="Ex.: 10,00"
                value={creditState.value}
                onChange={(event) =>
                  setCreditState((current) => ({
                    ...current,
                    value: event.target.value.replace(/[^\d.,]/g, ""),
                  }))
                }
              />
            </div>
          </label>

          <div>
            <div className="mb-2 text-sm font-semibold text-[var(--color-text)]">
              Valores rápidos
            </div>
            <div className="grid grid-cols-3 gap-2">
              {quickCreditValues.map((value) => {
                const selected =
                  Number(String(creditState.value).replace(",", ".")) === value;
                return (
                  <button
                    key={value}
                    type="button"
                    className={`rounded-[14px] border px-3 py-3 text-sm font-extrabold transition ${
                      selected
                        ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                        : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                    }`}
                    onClick={() =>
                      setCreditState((current) => ({
                        ...current,
                        value: value.toFixed(2).replace(".", ","),
                      }))
                    }
                  >
                    {formatCurrency(value)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              className="pill-button inline-flex items-center justify-center px-5 py-3 font-semibold"
              onClick={() => setCreditState(emptyCreditState)}
              disabled={Boolean(sendingCreditId)}
            >
              Fechar
            </button>
            <Button
              type="button"
              className="justify-center"
              onClick={sendTestCredit}
              disabled={Boolean(sendingCreditId) || !creditState.value}
            >
              <Rocket size={17} />
              {sendingCreditId ? "Enviando..." : "Enviar crédito"}
            </Button>
          </div>
        </div>
      </Modal>

      <CardSectionHeader
        title="Maquinas"
        description="Cadastre novas unidades, gere IDs para o ESP e crie automaticamente o caixa no Mercado Pago do cliente."
        actions={
          user?.role === "admin" ? (
            <Button className="justify-center" onClick={openCreateMachineModal}>
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
          helper="Ultimo sinal recebido nos ultimos 90 segundos"
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
                      {(item.nome || item.email) +
                        (item.cliente_id ? ` - ${item.cliente_id}` : "")}
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
                A listagem fica filtrada por cliente para manter a tela rapida e
                organizada mesmo com muitas maquinas cadastradas.
              </div>
            </div>
          ) : loading ? (
            <LoadingSpinner className="h-40" />
          ) : maquinas.length === 0 ? (
            <div className="flex h-40 items-center justify-center px-6 text-center text-sm text-[var(--color-text-soft)]">
              Nenhuma maquina cadastrada ainda. Gere um ID, configure o ESP e
              crie a unidade por aqui.
            </div>
          ) : (
            <>
              <div className="grid gap-3 p-3 md:hidden">
                {maquinas.map((m) => (
                  <MachineMobileCard
                    key={m.id_hardware}
                    machine={m}
                    user={user}
                    sendingCreditId={sendingCreditId}
                    sendingUpdateId={sendingUpdateId}
                    verifyingMachineId={verifyingMachineId}
                    canUpdateFirmware={Boolean(
                      m.status_online && firmwareVersions.length > 0,
                    )}
                    onOpen={() => navigate(`/maquinas/${m.id_hardware}`)}
                    onSendCredit={() => openCreditModal(m)}
                    onVerify={() => verifyMachineOnline(m)}
                    onSendUpdate={() => requestFirmwareUpdate(m)}
                    onEdit={() => handleEditMachine(m)}
                    onDelete={() => requestDeleteMachine(m.id_hardware)}
                  />
                ))}
              </div>
              <div className="hidden overflow-x-auto md:block">
                <table className="min-w-full">
                  <thead className="bg-[var(--color-bg-muted)] text-left text-xs uppercase tracking-[0.18em] text-[var(--color-text-soft)]">
                    <tr>
                      <th className="px-5 py-4 whitespace-nowrap">
                        ID da maquina
                      </th>
                      <th className="px-5 py-4 whitespace-nowrap">Nome</th>
                      <th className="px-5 py-4 whitespace-nowrap">Status</th>
                      <th className="px-5 py-4 whitespace-nowrap">
                        Ultima atividade
                      </th>
                      <th className="px-5 py-4 whitespace-nowrap">
                        Localizacao
                      </th>
                      <th className="px-5 py-4 whitespace-nowrap">Banco</th>
                      <th className="px-5 py-4 whitespace-nowrap">Caixa MP</th>
                      <th className="px-5 py-4 whitespace-nowrap">Firmware</th>
                      <th className="px-5 py-4 whitespace-nowrap">
                        Faturamento
                      </th>
                      <th className="px-5 py-4 whitespace-nowrap">Teste</th>
                      {user?.role === "admin" ? (
                        <th className="px-5 py-4 whitespace-nowrap">
                          Gerenciar
                        </th>
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
                            onClick={() =>
                              navigate(`/maquinas/${m.id_hardware}`)
                            }
                          >
                            <div className="font-semibold text-[var(--color-primary-strong)] hover:underline">
                              {m.id_hardware}
                            </div>
                          </button>
                          <div className="mt-1 text-xs text-[var(--color-text-soft)]">
                            Clique para abrir pagamentos e testes da maquina
                          </div>
                        </td>
                        <td className="px-5 py-4 min-w-[180px] font-medium">
                          {m.nome || "--"}
                        </td>
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
                            {m.status_online ? (
                              <CheckCircle2 size={15} />
                            ) : (
                              <XCircle size={15} />
                            )}
                            {m.status_online
                              ? "Online"
                              : m.status_operacional === "operando"
                                ? "Operando"
                                : "Offline"}
                          </span>
                          <button
                            type="button"
                            className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-text)] transition hover:border-[var(--color-primary)] disabled:cursor-wait disabled:opacity-60"
                            onClick={() => verifyMachineOnline(m)}
                            disabled={verifyingMachineId === m.id_hardware}
                          >
                            <RefreshCcw
                              size={13}
                              className={
                                verifyingMachineId === m.id_hardware
                                  ? "animate-spin"
                                  : ""
                              }
                            />
                            {verifyingMachineId === m.id_hardware
                              ? "Verificando"
                              : "Verificar placa"}
                          </button>
                        </td>
                        <td className="px-5 py-4 min-w-[180px] text-[var(--color-text-soft)]">
                          {m.ultima_atividade_em
                            ? brasiliaDate(m.ultima_atividade_em).format(
                                "DD/MM/YYYY HH:mm:ss",
                              )
                            : "Sem atividade"}
                          <div className="mt-1 text-xs">
                            {m.ultimo_pagamento_em
                              ? `Pag.: ${brasiliaDate(m.ultimo_pagamento_em).format("DD/MM HH:mm")}`
                              : m.ultimo_teste_em
                                ? `Teste: ${brasiliaDate(m.ultimo_teste_em).format("DD/MM HH:mm")}`
                                : m.ultima_saida_em
                                  ? `Saida: ${brasiliaDate(m.ultima_saida_em).format("DD/MM HH:mm")}`
                                  : "Sem eventos recentes"}
                          </div>
                        </td>
                        <td className="px-5 py-4 min-w-[180px] text-[var(--color-text-soft)]">
                          {m.localizacao || "--"}
                        </td>
                        <td className="px-5 py-4 min-w-[150px] font-semibold text-[var(--color-text)]">
                          {paymentProviderLabels[
                            m.banco_pagamento || "mercado_pago"
                          ] ||
                            m.banco_pagamento ||
                            "--"}
                        </td>
                        <td className="px-5 py-4 min-w-[170px]">
                          <div className="font-semibold text-[var(--color-text)]">
                            {m.mp_pos_external_id || "--"}
                          </div>
                          <div className="mt-1 text-xs text-[var(--color-text-soft)]">
                            {m.mp_pos_id
                              ? `POS ${m.mp_pos_id}`
                              : "Ainda nao criado"}
                          </div>
                        </td>
                        <td className="px-5 py-4 min-w-[230px]">
                          <FirmwareBadge machine={m} />
                        </td>
                        <td className="px-5 py-4 min-w-[140px] font-semibold">
                          {m.faturamento?.toFixed
                            ? `R$ ${m.faturamento.toFixed(2)}`
                            : "--"}
                        </td>
                        <td className="px-5 py-4 min-w-[170px]">
                          <button
                            type="button"
                            className="pill-button pill-button--primary inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold"
                            onClick={() => openCreditModal(m)}
                            disabled={Boolean(sendingCreditId)}
                          >
                            <Rocket size={15} />
                            {sendingCreditId === m.id_hardware
                              ? "Enviando..."
                              : "Enviar credito"}
                          </button>
                        </td>
                        {user?.role === "admin" ? (
                          <td className="px-5 py-4 min-w-[220px]">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                className="pill-button inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold"
                                onClick={() => requestFirmwareUpdate(m)}
                                disabled={
                                  sendingUpdateId === m.id_hardware ||
                                  !m.status_online ||
                                  firmwareVersions.length === 0
                                }
                                title={
                                  !m.status_online
                                    ? "Maquina offline"
                                    : firmwareVersions.length === 0
                                      ? "Cadastre uma versao em Firmwares"
                                      : "Atualizar firmware"
                                }
                              >
                                <UploadCloud size={15} />
                                {sendingUpdateId === m.id_hardware
                                  ? "Enviando"
                                  : "Atualizar"}
                              </button>
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
                                onClick={() =>
                                  requestDeleteMachine(m.id_hardware)
                                }
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
            </>
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
              {editingMachineId
                ? "Editar maquina"
                : "Cadastrar e vincular ao ESP"}
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
                    setForm((current) => ({
                      ...current,
                      id_hardware: e.target.value.toUpperCase(),
                    }))
                  }
                  disabled={Boolean(editingMachineId)}
                />
                <button
                  type="button"
                  className="pill-button inline-flex items-center justify-center gap-2 px-5 py-3 font-semibold"
                  onClick={generateId}
                  disabled={generatingId || Boolean(editingMachineId)}
                >
                  <RefreshCcw
                    size={16}
                    className={generatingId ? "animate-spin" : ""}
                  />
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
                O ID e gerado automaticamente a partir de{" "}
                <span className="font-semibold text-[var(--color-text)]">
                  1000
                </span>
                , mas voce pode alterar antes de cadastrar.
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
                        const cliente = usuarios.find(
                          (item) => String(item.cliente_id) === e.target.value,
                        );
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
                        {(item.nome || item.email) +
                          (item.cliente_id
                            ? ` - cliente ${item.cliente_id}`
                            : "")}
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
                      setForm((current) => ({
                        ...current,
                        banco_pagamento: e.target.value,
                      }))
                    }
                    required
                    disabled={
                      !form.cliente_id ||
                      paymentProviders.length === 0 ||
                      Boolean(editingMachineId)
                    }
                  >
                    <option value="">
                      {form.cliente_id
                        ? "Selecione o banco da maquina"
                        : "Selecione um cliente primeiro"}
                    </option>
                    {paymentProviders.map((provider) => (
                      <option
                        key={provider}
                        value={provider}
                        disabled={provider !== "mercado_pago"}
                      >
                        {paymentProviderLabels[provider]}
                        {provider !== "mercado_pago" ? " - em breve" : ""}
                      </option>
                    ))}
                  </select>
                  {form.cliente_id && paymentProviders.length === 0 ? (
                    <span className="mt-2 block text-xs font-medium text-[var(--color-error)]">
                      Este cliente ainda nao tem banco de pagamento habilitado.
                    </span>
                  ) : null}
                  {form.cliente_id &&
                  form.banco_pagamento === "mercado_pago" &&
                  !selectedCliente?.mp_configurado ? (
                    <span className="mt-2 block rounded-[14px] bg-amber-50 px-3 py-2 text-xs font-medium leading-5 text-[var(--color-warning)]">
                      Antes de cadastrar, o sistema vai validar o Mercado Pago
                      deste cliente. Se faltar token ou conta valida, o cadastro
                      sera bloqueado.
                    </span>
                  ) : null}
                  {form.cliente_id &&
                  form.banco_pagamento === "mercado_pago" ? (
                    <button
                      type="button"
                      className="mt-3 inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--color-text)] transition hover:border-[var(--color-primary)]"
                      onClick={validateSelectedMercadoPago}
                      disabled={validatingMp}
                    >
                      <RefreshCcw
                        size={15}
                        className={validatingMp ? "animate-spin" : ""}
                      />
                      {validatingMp
                        ? "Validando MP..."
                        : "Validar MP deste cliente"}
                    </button>
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
                    setForm((current) => ({
                      ...current,
                      localizacao: e.target.value,
                    }))
                  }
                />
              </label>
            </div>

            <Button
              type="submit"
              className="w-full justify-center"
              disabled={saving}
            >
              {saving
                ? "Salvando maquina..."
                : editingMachineId
                  ? "Salvar alteracoes"
                  : "Cadastrar maquina"}
            </Button>
          </form>
        </div>
      </Modal>

      <ConfirmModal
        open={deleteState.open}
        title="Excluir maquina"
        description={`Esta acao remove a maquina ${deleteState.machineId} e seus vinculos operacionais. Digite confirmar para continuar.`}
        confirmLabel="Excluir maquina"
        requireText="confirmar"
        inputValue={deleteState.confirmationText}
        inputPlaceholder='Digite "confirmar"'
        onInputChange={(value) =>
          setDeleteState((current) => ({ ...current, confirmationText: value }))
        }
        onCancel={() => setDeleteState(emptyDeleteState)}
        onConfirm={handleDeleteMachine}
      />
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
        {actions ? (
          <div className="flex flex-wrap items-center gap-3">{actions}</div>
        ) : null}
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
          <div
            className={`text-sm font-semibold ${featured ? "text-white/72" : "text-[var(--color-text-soft)]"}`}
          >
            {label}
          </div>
          <div className="mt-4 text-4xl font-extrabold tracking-[-0.05em]">
            {value}
          </div>
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
      <div
        className={`mt-4 text-sm ${featured ? "text-white/74" : "text-[var(--color-text-soft)]"}`}
      >
        {helper}
      </div>
    </section>
  );
}

function MachineMobileCard({
  machine,
  user,
  sendingCreditId,
  sendingUpdateId,
  verifyingMachineId,
  canUpdateFirmware,
  onOpen,
  onSendCredit,
  onVerify,
  onSendUpdate,
  onEdit,
  onDelete,
}) {
  return (
    <article className="rounded-[18px] border border-[var(--color-border)] bg-white p-4 shadow-[0_8px_20px_rgba(34,61,43,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <button type="button" className="min-w-0 text-left" onClick={onOpen}>
          <div className="truncate text-base font-extrabold text-[var(--color-primary-strong)]">
            {machine.nome || machine.id_hardware}
          </div>
          <div className="mt-1 text-xs font-semibold text-[var(--color-text-soft)]">
            ID {machine.id_hardware}
          </div>
        </button>
        <MachineStatusBadge status={machine.status_operacional} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <InfoPill
          label="Faturamento"
          value={
            machine.faturamento?.toFixed
              ? `R$ ${machine.faturamento.toFixed(2)}`
              : "--"
          }
        />
        <InfoPill
          label="Banco"
          value={
            paymentProviderLabels[machine.banco_pagamento || "mercado_pago"] ||
            machine.banco_pagamento ||
            "--"
          }
        />
        <InfoPill label="Local" value={machine.localizacao || "--"} wide />
        <InfoPill
          label="Ultima atividade"
          value={
            machine.ultima_atividade_em
              ? brasiliaDate(machine.ultima_atividade_em).format("DD/MM HH:mm")
              : "Sem atividade"
          }
          wide
        />
      </div>

      <div className="mt-3">
        <FirmwareBadge machine={machine} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          className="col-span-2 pill-button inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold"
          onClick={onVerify}
          disabled={verifyingMachineId === machine.id_hardware}
        >
          <RefreshCcw
            size={15}
            className={
              verifyingMachineId === machine.id_hardware ? "animate-spin" : ""
            }
          />
          {verifyingMachineId === machine.id_hardware
            ? "Verificando placa..."
            : "Verificar se a placa esta online"}
        </button>
        <button
          type="button"
          className="pill-button pill-button--primary inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold"
          onClick={onSendCredit}
          disabled={sendingCreditId === machine.id_hardware}
        >
          <Rocket size={15} />
          {sendingCreditId === machine.id_hardware ? "Enviando" : "Credito"}
        </button>
        <button
          type="button"
          className="pill-button inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold"
          onClick={onOpen}
        >
          <Server size={15} />
          Abrir
        </button>
        {user?.role === "admin" ? (
          <>
            <button
              type="button"
              className="pill-button inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold"
              onClick={onSendUpdate}
              disabled={
                sendingUpdateId === machine.id_hardware || !canUpdateFirmware
              }
              title={
                !machine.status_online
                  ? "Maquina offline"
                  : !canUpdateFirmware
                    ? "Cadastre uma versao em Firmwares"
                    : "Atualizar firmware"
              }
            >
              <UploadCloud size={15} />
              {sendingUpdateId === machine.id_hardware
                ? "Enviando"
                : "Atualizar"}
            </button>
            <button
              type="button"
              className="pill-button inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold"
              onClick={onEdit}
            >
              <Pencil size={15} />
              Editar
            </button>
            <button
              type="button"
              className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-[var(--color-error)]"
              onClick={onDelete}
            >
              <Trash2 size={15} />
              Excluir
            </button>
          </>
        ) : null}
      </div>
    </article>
  );
}

function FirmwareBadge({ machine }) {
  const currentVersion = machine.firmware_version || "";
  const targetVersion = machine.firmware_target_version || "";
  const updateStatus = machine.firmware_update_status || "";
  const hasCurrent = Boolean(currentVersion);
  const hasTarget = Boolean(targetVersion);
  const isUpdated = hasCurrent && hasTarget && currentVersion === targetVersion;
  const needsUpdate =
    hasCurrent && hasTarget && currentVersion !== targetVersion;
  const updateLabel = formatFirmwareUpdateStatus(updateStatus);
  const isUpdating = ["sent", "downloading", "restarting"].includes(
    updateStatus,
  );
  const isFailed = updateStatus === "failed";

  const tone = !hasCurrent
    ? "border-slate-200 bg-slate-50 text-slate-600"
    : isFailed
      ? "border-rose-200 bg-rose-50 text-rose-800"
      : needsUpdate || isUpdating
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-emerald-200 bg-emerald-50 text-emerald-800";

  return (
    <div
      className={`inline-flex max-w-full items-start gap-2 rounded-xl border px-3 py-2 text-xs ${tone}`}
    >
      <Cpu size={15} className="mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="font-bold">
          {updateLabel ||
            (!hasCurrent
              ? "Sem versao"
              : isUpdated
                ? "Atualizado"
                : needsUpdate
                  ? "Atualizacao pendente"
                  : "Instalado")}
        </div>
        <div
          className="mt-1 max-w-[190px] truncate font-semibold"
          title={currentVersion || "Aguardando sinal da placa"}
        >
          {currentVersion || "Aguardando sinal da placa"}
        </div>
        {hasTarget && !isUpdated ? (
          <div
            className="mt-1 max-w-[190px] truncate text-[11px]"
            title={targetVersion}
          >
            Alvo: {targetVersion}
          </div>
        ) : null}
        {machine.firmware_updated_at ? (
          <div className="mt-1 text-[11px] opacity-80">
            {brasiliaDate(machine.firmware_updated_at).format("DD/MM HH:mm")}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function formatFirmwareUpdateStatus(status) {
  const labels = {
    sent: "Atualizacao enviada",
    downloading: "Baixando firmware",
    restarting: "Reiniciando",
    updated: "Atualizado",
    failed: "Atualizacao falhou",
    no_update: "Sem novidade",
  };
  return labels[status] || "";
}

function MachineStatusBadge({ status }) {
  const tone =
    status === "operando"
      ? "bg-[var(--color-primary-soft)] text-[var(--color-success)]"
      : status === "atencao"
        ? "bg-amber-50 text-[var(--color-warning)]"
        : "bg-rose-50 text-[var(--color-error)]";
  const label =
    status === "offline"
      ? "Offline"
      : status === "operando"
        ? "Operando"
        : "Online";
  const Icon = status === "offline" ? XCircle : CheckCircle2;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-bold ${tone}`}
    >
      <Icon size={14} />
      {label}
    </span>
  );
}

function InfoPill({ label, value, wide = false }) {
  return (
    <div
      className={`rounded-[14px] bg-[var(--color-bg-muted)] px-3 py-2 ${wide ? "col-span-2" : ""}`}
    >
      <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-text-soft)]">
        {label}
      </div>
      <div className="mt-1 truncate font-semibold text-[var(--color-text)]">
        {value}
      </div>
    </div>
  );
}

function InfoLine({ label, value }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <span className="shrink-0 font-semibold text-[var(--color-text-soft)]">
        {label}
      </span>
      <span className="min-w-0 truncate text-right font-bold text-[var(--color-text)]">
        {value}
      </span>
    </div>
  );
}
