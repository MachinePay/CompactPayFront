import { useCallback, useEffect, useState } from "react";
import dayjs from "dayjs";
import { CreditCard, Download, FileDown, RefreshCcw, Search, ShieldCheck, Sparkles, Trash2, Wallet, Wifi, WifiOff, Wrench } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import api, { getApiErrorMessage } from "../api/axios";
import { useAuth } from "../context/useAuth";
import Button from "../components/Button";
import DateRangePicker from "../components/DateRangePicker";
import LoadingSpinner from "../components/LoadingSpinner";
import Toast from "../components/Toast";
import ConfirmModal from "../components/ConfirmModal";
import { brasiliaDate, nowInBrasilia } from "../utils/dateTime";

export default function MaquinaHistorico({ detailed = false, selectable = false }) {
  const { machineId: routeMachineId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [clientes, setClientes] = useState([]);
  const [selectedClienteId, setSelectedClienteId] = useState("");
  const [machineOptions, setMachineOptions] = useState([]);
  const [selectedMachineId, setSelectedMachineId] = useState(routeMachineId || "");
  const machineId = selectable ? selectedMachineId : routeMachineId;
  const [loading, setLoading] = useState(false);
  const [historico, setHistorico] = useState({
    maquina: null,
    resumo: {
      total_pagamentos: 0,
      total_digital: 0,
      total_fisico: 0,
      quantidade_pagamentos: 0,
      quantidade_testes: 0,
      quantidade_saidas: 0,
      ultimo_pagamento_em: null,
      ultimo_teste_em: null,
      ultima_saida_em: null,
    },
    pagamentos: [],
    saidas: [],
    testes: [],
    totais_por_dia: [],
    fechamentos: [],
    auditoria: [],
    observacoes: [],
    eventos_dispositivo: [],
    timeline: [],
    vendas: [],
  });
  const [periodo, setPeriodo] = useState("");
  const [dateRange, setDateRange] = useState({
    start: dayjs().subtract(30, "day").format("YYYY-MM-DD"),
    end: dayjs().format("YYYY-MM-DD"),
  });
  const [appliedPeriodo, setAppliedPeriodo] = useState("");
  const [appliedDateRange, setAppliedDateRange] = useState({
    start: dayjs().subtract(30, "day").format("YYYY-MM-DD"),
    end: dayjs().format("YYYY-MM-DD"),
  });
  const [toast, setToast] = useState({ message: "", type: "success" });
  const [observacao, setObservacao] = useState("");
  const [savingObservacao, setSavingObservacao] = useState(false);
  const [deleteState, setDeleteState] = useState({ open: false, confirmationText: "" });
  const [searchTerm, setSearchTerm] = useState("");
  const [saleFilters, setSaleFilters] = useState({
    registro: "todos",
    origem: "todos",
    forma: "todos",
    pulso: "todos",
  });
  const [appliedSearchTerm, setAppliedSearchTerm] = useState("");
  const [appliedSaleFilters, setAppliedSaleFilters] = useState({
    registro: "todos",
    origem: "todos",
    forma: "todos",
    pulso: "todos",
  });
  const [refundState, setRefundState] = useState({ open: false, venda: null, confirmationText: "" });
  const [refundingId, setRefundingId] = useState("");

  const buildQuery = useCallback((
    selectedPeriodo = appliedPeriodo,
    selectedRange = appliedDateRange,
    selectedSaleFilters = appliedSaleFilters,
    selectedSearchTerm = appliedSearchTerm,
  ) => {
    const params = [];
    const addParam = (key, value) => {
      if (value) params.push(`${key}=${encodeURIComponent(value)}`);
    };
    addParam("periodo", selectedPeriodo);
    addParam("data_inicio", selectedRange.start);
    addParam("data_fim", selectedRange.end);
    if (selectedSaleFilters.registro !== "todos") addParam("registro", selectedSaleFilters.registro);
    if (selectedSaleFilters.origem !== "todos") addParam("origem", selectedSaleFilters.origem);
    if (selectedSaleFilters.forma !== "todos") addParam("forma", selectedSaleFilters.forma);
    if (selectedSaleFilters.pulso !== "todos") addParam("pulso", selectedSaleFilters.pulso);
    addParam("busca", selectedSearchTerm.trim());
    return params.length ? `?${params.join("&")}` : "";
  }, [appliedDateRange, appliedPeriodo, appliedSaleFilters, appliedSearchTerm]);

  const fetchHistorico = useCallback(async (options = {}) => {
    if (!machineId) return null;
    const currentPeriodo = options.periodo ?? appliedPeriodo;
    const currentRange = options.dateRange ?? appliedDateRange;
    const currentSaleFilters = options.saleFilters ?? appliedSaleFilters;
    const currentSearchTerm = options.searchTerm ?? appliedSearchTerm;
    const query = buildQuery(currentPeriodo, currentRange, currentSaleFilters, currentSearchTerm);
    const { data } = await api.get(`/maquinas/${machineId}/historico${query}`);
    return data;
  }, [appliedDateRange, appliedPeriodo, appliedSaleFilters, appliedSearchTerm, buildQuery, machineId]);

  const loadHistorico = useCallback(async (options = {}) => {
    if (!machineId) return null;
    if (selectable && user?.role === "admin" && !selectedClienteId) return null;
    if (!options.silent) setLoading(true);
    try {
      const data = await fetchHistorico(options);
      setHistorico(data);
      return data;
    } catch (error) {
      setToast({
        message: getApiErrorMessage(error, "Nao foi possivel carregar o historico da maquina."),
        type: "error",
      });
      return null;
    } finally {
      if (!options.silent) setLoading(false);
    }
  }, [fetchHistorico, machineId, selectable, selectedClienteId, user?.role]);

  useEffect(() => {
    if (!machineId) return;
    if (selectable && user?.role === "admin" && !selectedClienteId) return;
    const timer = window.setTimeout(() => {
      loadHistorico();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadHistorico, machineId, selectable, selectedClienteId, user]);

  useEffect(() => {
    const status = historico.maquina?.firmware_update_status;
    if (!["sent", "downloading", "restarting"].includes(status)) return undefined;
    const timer = window.setInterval(() => loadHistorico({ silent: true }), 5000);
    return () => window.clearInterval(timer);
  }, [historico.maquina?.firmware_update_status, loadHistorico]);

  useEffect(() => {
    if (!machineId) return undefined;
    const timer = window.setInterval(() => loadHistorico({ silent: true }), 30000);
    return () => window.clearInterval(timer);
  }, [loadHistorico, machineId]);

  useEffect(() => {
    if (!selectable || !user) return;
    if (user.role !== "admin") return;
    const loadClientes = async () => {
      try {
        const { data } = await api.get("/clientes");
        setClientes(data);
      } catch {
        setClientes([]);
      }
    };
    loadClientes();
  }, [selectable, user]);

  useEffect(() => {
    if (!selectable || !user) return;
    const loadMachineOptions = async () => {
      if (user.role === "admin" && !selectedClienteId) {
        setMachineOptions([]);
        setSelectedMachineId("");
        return;
      }
      const params = ["periodo=mes"];
      if (user.role === "admin") {
        params.push(`cliente_id=${encodeURIComponent(selectedClienteId)}`);
      }
      try {
        const { data } = await api.get(`/maquinas?${params.join("&")}`);
        setMachineOptions(data);
        if (!data.some((item) => item.id_hardware === selectedMachineId)) {
          setSelectedMachineId("");
        }
        if (!selectedMachineId && data.length) {
          setSelectedMachineId(data[0].id_hardware);
        }
      } catch {
        setMachineOptions([]);
      }
    };
    loadMachineOptions();
  }, [selectable, user, selectedClienteId, selectedMachineId]);

  const handleExportPdf = (snapshot = historico, snapshotPeriodo = periodo, snapshotRange = dateRange) => {
    const maquina = snapshot.maquina;
    if (!maquina) return;
    const periodoLabel = formatPeriodoLabel(snapshotPeriodo, snapshotRange);

    const rowsVendas = (snapshot.vendas || [])
      .map(
        (item) => `
          <tr>
            <td>${brasiliaDate(item.data).format("DD/MM/YYYY HH:mm")}</td>
            <td>${item.is_test ? "Teste" : formatProvider(item.provider)}</td>
            <td>${formatPaymentMethod(item)}</td>
            <td>${formatPulseStatus(item.pulse_status)}</td>
            <td>R$ ${Number(item.valor).toFixed(2)}</td>
            <td>R$ ${Number(item.total).toFixed(2)}</td>
            <td>${item.provider_payment_id || "--"}</td>
          </tr>`,
      )
      .join("");
    const rowsResumoDiario = snapshot.totais_por_dia
      .map(
        (item) => `
          <tr>
            <td>${item.dia}</td>
            <td>R$ ${Number(item.total).toFixed(2)}</td>
          </tr>`,
      )
      .join("");

    const printWindow = window.open("", "_blank", "width=960,height=720");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Fechamento ${maquina.nome || maquina.id_hardware}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #222; }
            h1, h2 { margin-bottom: 8px; }
            .meta { margin-bottom: 24px; color: #555; }
            .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 18px 0 28px; }
            .card { border: 1px solid #ddd; border-radius: 12px; padding: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
            th { background: #f4f4f4; }
          </style>
        </head>
        <body>
          <h1>Fechamento da maquina</h1>
          <div class="meta">
            <div><strong>Maquina:</strong> ${maquina.nome || maquina.id_hardware}</div>
            <div><strong>ID:</strong> ${maquina.id_hardware}</div>
            <div><strong>Cliente:</strong> ${maquina.cliente_nome || "--"}</div>
            <div><strong>Operador:</strong> ${user?.email || "--"}</div>
            <div><strong>Localizacao:</strong> ${maquina.localizacao || "--"}</div>
            <div><strong>Periodo:</strong> ${periodoLabel}</div>
          </div>
          <div class="grid">
            <div class="card"><strong>Total pagamentos</strong><br />R$ ${Number(snapshot.resumo.total_pagamentos).toFixed(2)}</div>
            <div class="card"><strong>Total digital</strong><br />R$ ${Number(snapshot.resumo.total_digital).toFixed(2)}</div>
            <div class="card"><strong>Total fisico</strong><br />R$ ${Number(snapshot.resumo.total_fisico).toFixed(2)}</div>
            <div class="card"><strong>Qtde pagamentos</strong><br />${snapshot.resumo.quantidade_pagamentos}</div>
            <div class="card"><strong>Qtde testes</strong><br />${snapshot.resumo.quantidade_testes}</div>
            <div class="card"><strong>Qtde saidas</strong><br />${snapshot.resumo.quantidade_saidas}</div>
          </div>
          <h2>Resumo diario</h2>
          <table>
            <thead><tr><th>Dia</th><th>Total</th></tr></thead>
            <tbody>${rowsResumoDiario || "<tr><td colspan='2'>Sem pagamentos no periodo.</td></tr>"}</tbody>
          </table>
          <h2>Vendas filtradas</h2>
          <table>
            <thead><tr><th>Data</th><th>Origem</th><th>Forma</th><th>Pulso</th><th>Valor</th><th>Total</th><th>ID pagamento</th></tr></thead>
            <tbody>${rowsVendas || "<tr><td colspan='7'>Nenhuma venda ou teste no filtro aplicado.</td></tr>"}</tbody>
          </table>
          <h2 style="margin-top: 28px;">Saidas</h2>
          <table>
            <thead><tr><th>Data</th><th>Metodo</th><th>Valor</th></tr></thead>
            <tbody>${
              snapshot.saidas
                .map(
                  (item) => `
          <tr>
            <td>${brasiliaDate(item.data_hora).format("DD/MM/YYYY HH:mm")}</td>
            <td>${item.metodo}</td>
            <td>R$ ${Number(item.valor).toFixed(2)}</td>
          </tr>`,
                )
                .join("") || "<tr><td colspan='3'>Nenhuma saida no periodo.</td></tr>"
            }</tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const handleDeleteHistorico = async () => {
    if (deleteState.confirmationText.trim().toLowerCase() !== "confirmar") return;
    try {
      const query = buildQuery();
      await api.delete(`/maquinas/${machineId}/historico${query}`);
      setToast({ message: "Historico apagado com sucesso.", type: "success" });
      setDeleteState({ open: false, confirmationText: "" });
      await loadHistorico();
    } catch (error) {
      setToast({
        message: getApiErrorMessage(error, "Nao foi possivel apagar o historico."),
        type: "error",
      });
    }
  };

  const requestRefund = (venda) => {
    setRefundState({ open: true, venda, confirmationText: "" });
  };

  const handleRefund = async () => {
    const venda = refundState.venda;
    if (!venda || refundState.confirmationText.trim().toLowerCase() !== "estornar") return;
    setRefundingId(String(venda.id));
    try {
      await api.post(`/maquinas/${machineId}/pagamentos/${venda.id}/extorno`);
      setToast({ message: "Extorno solicitado no Mercado Pago com sucesso.", type: "success" });
      setRefundState({ open: false, venda: null, confirmationText: "" });
      await loadHistorico();
    } catch (error) {
      setToast({
        message: getApiErrorMessage(error, "Nao foi possivel solicitar o extorno."),
        type: "error",
      });
    } finally {
      setRefundingId("");
    }
  };

  const handleSalvarObservacao = async () => {
    if (!observacao.trim()) return;
    setSavingObservacao(true);
    try {
      await api.post(`/maquinas/${machineId}/observacoes`, { descricao: observacao.trim() });
      setObservacao("");
      setToast({ message: "Observacao registrada com sucesso.", type: "success" });
      await loadHistorico();
    } catch (error) {
      setToast({
        message: getApiErrorMessage(error, "Nao foi possivel registrar a observacao."),
        type: "error",
      });
    } finally {
      setSavingObservacao(false);
    }
  };

  const handleSalvarFechamento = async (
    selectedPeriodo = periodo,
    selectedRange = dateRange,
    options = {},
  ) => {
    const { silentSuccess = false, silentError = false } = options;
    try {
      const query = buildQuery(selectedPeriodo, selectedRange);
      await api.post(`/maquinas/${machineId}/fechamentos${query}`);
      if (!silentSuccess) {
        setToast({ message: "Fechamento salvo com sucesso.", type: "success" });
      }
      await loadHistorico();
    } catch (error) {
      if (!silentError) {
        setToast({
          message: getApiErrorMessage(error, "Nao foi possivel salvar o fechamento."),
          type: "error",
        });
      }
      throw error;
    }
  };

  const handleExportCsv = () => {
    const maquina = historico.maquina;
    if (!maquina) return;

    const periodoLabel = formatPeriodoLabel(periodo, dateRange);
    const rows = [
      ["relatorio", "Historico da Maquina CompactPay"],
      ["gerado_em", nowInBrasilia().format("YYYY-MM-DD HH:mm:ss")],
      ["periodo", periodoLabel],
      ["maquina_id", maquina.id_hardware],
      ["maquina_nome", maquina.nome || maquina.id_hardware],
      ["cliente", maquina.cliente_nome || ""],
      ["localizacao", maquina.localizacao || ""],
      ["operador", user?.email || ""],
      ["busca", appliedSearchTerm],
      ["filtro_registro", appliedSaleFilters.registro],
      ["filtro_origem", appliedSaleFilters.origem],
      ["filtro_forma", appliedSaleFilters.forma],
      ["filtro_pulso", appliedSaleFilters.pulso],
      [],
      ["resumo"],
      ["total_pagamentos", Number(historico.resumo.total_pagamentos || 0).toFixed(2)],
      ["total_digital", Number(historico.resumo.total_digital || 0).toFixed(2)],
      ["total_fisico", Number(historico.resumo.total_fisico || 0).toFixed(2)],
      ["quantidade_pagamentos", historico.resumo.quantidade_pagamentos || 0],
      ["quantidade_testes", historico.resumo.quantidade_testes || 0],
      ["quantidade_saidas", historico.resumo.quantidade_saidas || 0],
      [],
      ["resumo_diario"],
      ["dia", "total"],
      ...historico.totais_por_dia.map((item) => [
        item.dia,
        Number(item.total || 0).toFixed(2),
      ]),
      [],
      ["fechamentos_salvos"],
      [
        "periodo_inicio",
        "periodo_fim",
        "total_pagamentos",
        "total_digital",
        "total_fisico",
        "pagamentos",
        "testes",
        "saidas",
        "criado_por",
        "criado_em",
      ],
      ...historico.fechamentos.map((item) => [
        dayjs(item.periodo_inicio).format("YYYY-MM-DD"),
        dayjs(item.periodo_fim).format("YYYY-MM-DD"),
        Number(item.total_pagamentos || 0).toFixed(2),
        Number(item.total_digital || 0).toFixed(2),
        Number(item.total_fisico || 0).toFixed(2),
        item.quantidade_pagamentos || 0,
        item.quantidade_testes || 0,
        item.quantidade_saidas || 0,
        item.criado_por_email || "",
        brasiliaDate(item.created_at).format("YYYY-MM-DD HH:mm:ss"),
      ]),
      [],
      ["detalhes"],
      ["secao", "data", "origem", "forma", "pulso", "valor", "total", "provider_payment_id", "descricao"],
      ...(historico.vendas || []).map((item) => [
        item.is_test ? "teste" : "venda",
        brasiliaDate(item.data).format("YYYY-MM-DD HH:mm:ss"),
        item.is_test ? "teste" : formatProvider(item.provider),
        formatPaymentMethod(item),
        formatPulseStatus(item.pulse_status),
        Number(item.valor || 0).toFixed(2),
        Number(item.total || 0).toFixed(2),
        item.provider_payment_id || "",
        item.descricao || "",
      ]),
      ...historico.saidas.map((item) => [
        "saida",
        brasiliaDate(item.data_hora).format("YYYY-MM-DD HH:mm:ss"),
        "",
        item.metodo,
        "",
        Number(item.valor).toFixed(2),
        "",
        "",
        "",
      ]),
      ...(historico.observacoes || []).map((item) => [
        "observacao",
        brasiliaDate(item.created_at).format("YYYY-MM-DD HH:mm:ss"),
        "",
        "",
        "",
        "",
        "",
        "",
        item.descricao,
      ]),
    ];

    const csv = rows
      .map((row) =>
        row
          .map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const rangeSlug = dateRange.start && dateRange.end ? `${dateRange.start}_${dateRange.end}` : periodo || "periodo";
    link.href = url;
    link.download = `historico-${maquina.id_hardware}-${rangeSlug}-${dayjs().format("YYYYMMDD-HHmmss")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleFechamentoHoje = async () => {
    const hoje = dayjs().format("YYYY-MM-DD");
    const nextRange = { start: hoje, end: hoje };
    setPeriodo("dia");
    setDateRange(nextRange);
    setAppliedPeriodo("dia");
    setAppliedDateRange(nextRange);
    try {
      const data = await loadHistorico({ periodo: "dia", dateRange: nextRange });
      if (!data) return;
      setHistorico(data);
      try {
        await handleSalvarFechamento("dia", nextRange, { silentSuccess: true, silentError: true });
        setToast({ message: "Fechamento de hoje salvo e PDF gerado com sucesso.", type: "success" });
      } catch (error) {
        if (error?.response?.status !== 409) throw error;
        setToast({ message: "O fechamento de hoje ja estava salvo. PDF gerado com o mesmo recorte.", type: "success" });
      }
      handleExportPdf(data, "dia", nextRange);
    } catch (error) {
      setToast({
        message: getApiErrorMessage(error, "Nao foi possivel gerar o fechamento do dia."),
        type: "error",
      });
    }
  };

  const handlePeriodoChange = (value) => {
    setPeriodo(value);
    const hoje = dayjs();
    if (value === "dia") {
      const today = hoje.format("YYYY-MM-DD");
      setDateRange({ start: today, end: today });
      return;
    }
    if (value === "mes") {
      setDateRange({
        start: hoje.startOf("month").format("YYYY-MM-DD"),
        end: hoje.format("YYYY-MM-DD"),
      });
      return;
    }
    setDateRange({
      start: hoje.subtract(30, "day").format("YYYY-MM-DD"),
      end: hoje.format("YYYY-MM-DD"),
    });
  };

  const handleApplyFilters = async () => {
    const sameFilters =
      appliedPeriodo === periodo &&
      appliedDateRange.start === dateRange.start &&
      appliedDateRange.end === dateRange.end &&
      appliedSearchTerm === searchTerm &&
      appliedSaleFilters.registro === saleFilters.registro &&
      appliedSaleFilters.origem === saleFilters.origem &&
      appliedSaleFilters.forma === saleFilters.forma &&
      appliedSaleFilters.pulso === saleFilters.pulso;

    setAppliedPeriodo(periodo);
    setAppliedDateRange({ ...dateRange });
    setAppliedSearchTerm(searchTerm);
    setAppliedSaleFilters({ ...saleFilters });

    if (sameFilters) {
      await loadHistorico({ periodo, dateRange, saleFilters, searchTerm });
    }
  };

  const maquina = historico.maquina;

  return (
    <div className="flex min-h-full min-w-0 flex-col gap-4">
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ message: "", type: toast.type })}
      />
      <ConfirmModal
        open={deleteState.open}
        title="Apagar historico"
        description="Esta acao remove pagamentos, vendas oficiais e testes do periodo filtrado. Digite confirmar para continuar."
        confirmLabel="Apagar historico"
        requireText="confirmar"
        inputValue={deleteState.confirmationText}
        inputPlaceholder='Digite "confirmar"'
        onInputChange={(value) =>
          setDeleteState((current) => ({ ...current, confirmationText: value }))
        }
        onCancel={() => setDeleteState({ open: false, confirmationText: "" })}
        onConfirm={handleDeleteHistorico}
      />
      <ConfirmModal
        open={refundState.open}
        title="Devolver pagamento"
        description={`O sistema vai solicitar o extorno automatico no Mercado Pago para o pagamento ${refundState.venda?.provider_payment_id || refundState.venda?.id || ""}. Digite estornar para confirmar.`}
        confirmLabel="Confirmar extorno"
        loading={Boolean(refundingId)}
        requireText="estornar"
        inputValue={refundState.confirmationText}
        inputPlaceholder='Digite "estornar"'
        onInputChange={(value) =>
          setRefundState((current) => ({ ...current, confirmationText: value }))
        }
        onCancel={() => setRefundState({ open: false, venda: null, confirmationText: "" })}
        onConfirm={handleRefund}
      />

      <section className="app-panel min-w-0 rounded-[22px] p-3 sm:rounded-[30px] sm:p-6 md:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--color-text-soft)]">
              {detailed ? "Relatorio detalhado" : "Relatorio de vendas"}
            </div>
            <h1 className="mt-3 break-words text-3xl font-extrabold text-[var(--color-text)] sm:text-4xl md:text-5xl">
              {maquina?.nome || machineId}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--color-text-soft)] md:text-base">
              {detailed
                ? "Escolha a maquina e consulte vendas, historico, observacoes, fechamentos e auditoria."
                : "Pagamentos e testes dos ultimos 30 dias. Selecione uma data para consultar outro periodo."}
            </p>
            <div className="mt-3 text-sm text-[var(--color-text-soft)]">
              {maquina?.id_hardware || machineId} {maquina?.localizacao ? ` - ${maquina.localizacao}` : ""}
            </div>
          </div>

          <div className="flex w-full min-w-0 flex-wrap items-center gap-3 lg:w-auto lg:justify-end">
            {selectable && user?.role === "admin" ? (
              <label className="flex w-full min-w-0 items-center gap-3 rounded-[22px] border border-[var(--color-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--color-text)] sm:min-w-[260px] sm:w-auto sm:rounded-full">
                Cliente
                <select
                  className="min-w-0 flex-1 bg-transparent text-[var(--color-text-soft)] outline-none"
                  value={selectedClienteId}
                  onChange={(event) => setSelectedClienteId(event.target.value)}
                >
                  <option value="">Selecione um cliente</option>
                  {clientes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nome_empresa || item.email_contato}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {selectable ? (
              <label className="flex w-full min-w-0 items-center gap-3 rounded-[22px] border border-[var(--color-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--color-text)] sm:min-w-[260px] sm:w-auto sm:rounded-full">
                Maquina
                <select
                  className="min-w-0 flex-1 bg-transparent text-[var(--color-text-soft)] outline-none"
                  value={selectedMachineId}
                  onChange={(event) => setSelectedMachineId(event.target.value)}
                  disabled={user?.role === "admin" && !selectedClienteId}
                >
                  <option value="">
                    {user?.role === "admin" && !selectedClienteId ? "Selecione um cliente primeiro" : "Selecione uma maquina"}
                  </option>
                  {machineOptions.map((item) => (
                    <option key={item.id_hardware} value={item.id_hardware}>
                      {(item.nome || item.id_hardware) + ` - ${item.id_hardware}`}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="flex w-full min-w-0 items-center gap-3 rounded-[22px] border border-[var(--color-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--color-text)] sm:w-auto sm:rounded-full">
              Periodo
              <select
                className="min-w-0 flex-1 bg-transparent text-[var(--color-text-soft)] outline-none sm:flex-none"
                value={periodo}
                onChange={(e) => handlePeriodoChange(e.target.value)}
              >
                <option value="">Ultimos 30 dias</option>
                <option value="dia">Hoje</option>
                <option value="mes">Mes atual</option>
              </select>
            </label>
            <div className="w-full min-w-0 sm:w-auto">
              <DateRangePicker
                value={dateRange}
                onChange={(range) => {
                  setDateRange(range);
                  setPeriodo("");
                }}
              />
            </div>
            <label className="flex w-full min-w-0 items-center gap-2 rounded-[22px] border border-[var(--color-border)] bg-white px-4 py-3 text-sm text-[var(--color-text)] sm:min-w-[240px] sm:w-auto sm:rounded-full">
              <Search size={16} className="shrink-0 text-[var(--color-text-soft)]" />
              <input
                className="min-w-0 w-full bg-transparent outline-none"
                placeholder="Pesquisar venda"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </label>
            <FilterSelect
              label="Registro"
              value={saleFilters.registro}
              onChange={(value) =>
                setSaleFilters((current) => ({ ...current, registro: value }))
              }
              options={[
                ["todos", "Todos"],
                ["reais", "Pagamentos reais"],
                ["testes", "Testes"],
              ]}
            />
            <FilterSelect
              label="Origem"
              value={saleFilters.origem}
              onChange={(value) =>
                setSaleFilters((current) => ({ ...current, origem: value }))
              }
              options={[
                ["todos", "Fisico + digital"],
                ["fisico", "Fisico"],
                ["digital", "Digital"],
                ["app_agarra", "Aplicativo Agarra"],
              ]}
            />
            <FilterSelect
              label="Forma"
              value={saleFilters.forma}
              onChange={(value) =>
                setSaleFilters((current) => ({ ...current, forma: value }))
              }
              options={[
                ["todos", "Todas"],
                ["pix", "Pix"],
                ["cartao", "Cartao"],
                ["credito", "Credito"],
                ["debito", "Debito"],
              ]}
            />
            <FilterSelect
              label="Pulso"
              value={saleFilters.pulso}
              onChange={(value) =>
                setSaleFilters((current) => ({ ...current, pulso: value }))
              }
              options={[
                ["todos", "Todos"],
                ["confirmados", "Confirmados"],
                ["ausentes", "Ausentes"],
              ]}
            />
            <button
              type="button"
              className="pill-button pill-button--primary inline-flex w-full items-center justify-center gap-2 px-5 py-3 text-sm font-semibold sm:w-auto"
              onClick={handleApplyFilters}
              disabled={loading || !machineId}
            >
              <Search size={16} />
              {loading ? "Aplicando..." : "Aplicar filtros"}
            </button>
          </div>
        </div>
      </section>

      {detailed ? (
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          label="Total pagamentos"
          value={`R$ ${Number(historico.resumo.total_pagamentos).toFixed(2)}`}
          icon={<Wallet size={18} />}
        />
        <SummaryCard
          label="Qtde pagamentos"
          value={String(historico.resumo.quantidade_pagamentos)}
          helper={formatResumoData(historico.resumo.ultimo_pagamento_em, "Ultimo pagamento")}
        />
        <SummaryCard
          label="Qtde testes"
          value={String(historico.resumo.quantidade_testes)}
          helper={formatResumoData(historico.resumo.ultimo_teste_em, "Ultimo teste")}
          featured
        />
      </div>
      ) : null}

      {detailed ? (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Total digital"
          value={`R$ ${Number(historico.resumo.total_digital).toFixed(2)}`}
          helper="Pagamentos digitais no periodo"
        />
        <SummaryCard
          label="Total fisico"
          value={`R$ ${Number(historico.resumo.total_fisico).toFixed(2)}`}
          helper="Entradas fisicas detectadas no periodo"
        />
        <SummaryCard
          label="Premios entregues"
          value={String(historico.resumo.quantidade_saidas)}
          helper={formatResumoData(historico.resumo.ultima_saida_em, "Ultima saida")}
          icon={<Sparkles size={18} />}
        />
        <StatusCard
          maquina={maquina}
          eventos={historico.eventos_dispositivo || []}
          showFirmware={user?.role === "admin"}
        />
      </div>
      ) : null}

      <section className="app-panel rounded-[30px] p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-3">
            <Button type="button" className="justify-center" onClick={() => navigate("/maquinas")}>
              Voltar para maquinas
            </Button>
            {detailed ? (
            <button
              type="button"
              className="pill-button inline-flex items-center justify-center gap-2 px-5 py-3 font-semibold"
              onClick={handleSalvarFechamento}
            >
              <ShieldCheck size={16} />
              Salvar fechamento
            </button>
            ) : null}
            {detailed ? (
            <button
              type="button"
              className="pill-button pill-button--primary inline-flex items-center justify-center gap-2 px-5 py-3 font-semibold"
              onClick={handleFechamentoHoje}
            >
              <FileDown size={16} />
              Fechamento do dia
            </button>
            ) : null}
            <button
              type="button"
              className="pill-button inline-flex items-center justify-center gap-2 px-5 py-3 font-semibold"
              onClick={loadHistorico}
            >
              <RefreshCcw size={16} />
              Recarregar
            </button>
          </div>

          <div className="flex flex-wrap gap-3">
            {detailed ? (
            <button
              type="button"
              className="pill-button inline-flex items-center justify-center gap-2 px-5 py-3 font-semibold"
              onClick={handleExportCsv}
            >
              <Download size={16} />
              Exportar CSV
            </button>
            ) : null}
            {detailed ? (
            <button
              type="button"
              className="pill-button inline-flex items-center justify-center gap-2 px-5 py-3 font-semibold"
              onClick={handleExportPdf}
            >
              <FileDown size={16} />
              Fechamento PDF
            </button>
            ) : null}
            {detailed ? (
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-5 py-3 font-semibold text-[var(--color-error)] transition hover:bg-rose-100"
              onClick={() => setDeleteState({ open: true, confirmationText: "" })}
            >
              <Trash2 size={16} />
              Apagar historicos
            </button>
            ) : null}
          </div>
        </div>

        {loading ? (
          <LoadingSpinner className="h-56" />
        ) : (
          <div className="mt-6 space-y-4">
            <SalesReportTable
              vendas={historico.vendas || []}
              searchTerm={appliedSearchTerm}
              filters={appliedSaleFilters}
              maquina={maquina}
              onRefund={requestRefund}
              refundingId={refundingId}
            />

            {detailed ? (
            <>
            <HistoryTable
              title="Resumo diario"
              empty="Nenhum pagamento encontrado para compor o fechamento diario."
              columns={["Dia", "Total"]}
              rows={historico.totais_por_dia.map((item) => [
                item.dia,
                `R$ ${Number(item.total).toFixed(2)}`,
              ])}
            />

            <div className="grid gap-4 xl:grid-cols-2">
              <HistoryTable
                title="Linha do tempo"
                empty="Nenhum evento encontrado para essa maquina."
                columns={["Data", "Tipo", "Titulo", "Descricao"]}
                rows={(historico.timeline || []).map((item) => [
                  brasiliaDate(item.created_at).format("DD/MM/YYYY HH:mm:ss"),
                  item.tipo,
                  item.titulo,
                  item.descricao,
                ])}
              />
              <div className="overflow-hidden rounded-[26px] border border-[var(--color-border)] bg-white">
                <div className="border-b border-[var(--color-border)] bg-[var(--color-bg-muted)] px-5 py-4 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-text-soft)]">
                  Observacoes e manutencao
                </div>
                <div className="space-y-4 p-5">
                  <div className="rounded-[22px] border border-[var(--color-border)] bg-[var(--color-bg-muted)] p-4">
                    <div className="text-sm font-semibold text-[var(--color-text)]">Nova observacao</div>
                    <textarea
                      value={observacao}
                      onChange={(event) => setObservacao(event.target.value)}
                      rows={4}
                      placeholder="Ex.: noteiro com pulso curto, limpeza feita, troca de sensor..."
                      className="mt-3 w-full rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-4 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
                    />
                    <button
                      type="button"
                      className="pill-button mt-3 inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold"
                      onClick={handleSalvarObservacao}
                      disabled={savingObservacao || !observacao.trim()}
                    >
                      <Wrench size={16} />
                      {savingObservacao ? "Salvando..." : "Salvar observacao"}
                    </button>
                  </div>
                  <HistoryTable
                    title="Historico de observacoes"
                    empty="Nenhuma observacao registrada."
                    columns={["Data", "Descricao"]}
                    rows={(historico.observacoes || []).map((item) => [
                      brasiliaDate(item.created_at).format("DD/MM/YYYY HH:mm:ss"),
                      item.descricao,
                    ])}
                  />
                  <HistoryTable
                    title="Eventos do dispositivo"
                    empty="Nenhum evento tecnico recebido da placa."
                    columns={["Data", "Status", "Comando", "Descricao"]}
                    rows={(historico.eventos_dispositivo || []).map((item) => [
                      brasiliaDate(item.created_at).format("DD/MM/YYYY HH:mm:ss"),
                      formatPulseStatus(item.pulse_status),
                      item.command_id || "--",
                      item.descricao,
                    ])}
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <HistoryTable
                title="Fechamentos salvos"
                empty="Nenhum fechamento salvo para esta maquina ainda."
                columns={["Criado em", "Periodo", "Total", "Por"]}
                rows={historico.fechamentos.map((item) => [
                  brasiliaDate(item.created_at).format("DD/MM/YYYY HH:mm:ss"),
                  `${dayjs(item.periodo_inicio).format("DD/MM/YYYY HH:mm")} ate ${dayjs(item.periodo_fim).format("DD/MM/YYYY HH:mm")}`,
                  `R$ ${Number(item.total_pagamentos).toFixed(2)}`,
                  item.criado_por_email,
                ])}
              />
              <HistoryTable
                title="Auditoria"
                empty="Nenhum evento de auditoria encontrado."
                columns={["Data", "Acao", "Usuario", "Descricao"]}
                rows={historico.auditoria.map((item) => [
                  brasiliaDate(item.created_at).format("DD/MM/YYYY HH:mm:ss"),
                  item.acao,
                  item.executado_por_email,
                  item.descricao,
                ])}
              />
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <HistoryTable
                title="Pagamentos"
                empty="Nenhum pagamento encontrado no periodo."
                columns={["Data", "Metodo", "Valor"]}
                rows={historico.pagamentos.map((item) => [
                  brasiliaDate(item.data_hora).format("DD/MM/YYYY HH:mm:ss"),
                  item.metodo,
                  `R$ ${Number(item.valor).toFixed(2)}`,
                ])}
              />
              <HistoryTable
                title="Saidas"
                empty="Nenhuma saida encontrada no periodo."
                columns={["Data", "Metodo", "Valor"]}
                rows={historico.saidas.map((item) => [
                  brasiliaDate(item.data_hora).format("DD/MM/YYYY HH:mm:ss"),
                  item.metodo,
                  `R$ ${Number(item.valor).toFixed(2)}`,
                ])}
              />
              <HistoryTable
                title="Testes"
                empty="Nenhum teste encontrado no periodo."
                columns={["Data", "Descricao"]}
                rows={historico.testes.map((item) => [
                  brasiliaDate(item.created_at).format("DD/MM/YYYY HH:mm:ss"),
                  item.descricao,
                ])}
              />
            </div>
            </>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}

function SummaryCard({ label, value, helper, icon, featured = false }) {
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
        {icon ? (
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-full ${
              featured
                ? "bg-white/16 text-white"
                : "bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
            }`}
          >
            {icon}
          </div>
        ) : null}
      </div>
      {helper ? (
        <div className={`mt-4 text-sm ${featured ? "text-white/74" : "text-[var(--color-text-soft)]"}`}>
          {helper}
        </div>
      ) : null}
    </section>
  );
}

function StatusCard({ maquina, eventos = [], showFirmware = false }) {
  const online = Boolean(maquina?.status_online);
  const ultimoEvento = eventos[0];
  return (
    <section className="app-panel rounded-[28px] p-6">
      <div className="text-sm font-semibold text-[var(--color-text-soft)]">Status da maquina</div>
      <div className="mt-4 flex items-center gap-3">
        <span
          className={`inline-flex items-center rounded-full px-3 py-2 text-xs font-semibold ${
            online
              ? "bg-[var(--color-primary-soft)] text-[var(--color-success)]"
              : "bg-rose-50 text-[var(--color-error)]"
          }`}
        >
          {online ? "Online" : "Offline"}
        </span>
        <span className="text-sm text-[var(--color-text-soft)]">
          {maquina?.ultimo_sinal
            ? `Ultimo sinal em ${brasiliaDate(maquina.ultimo_sinal).format("DD/MM/YYYY HH:mm:ss")}`
            : "Sem sinal recebido ainda"}
        </span>
      </div>
      {ultimoEvento ? (
        <div className="mt-4 rounded-[16px] border border-[var(--color-border)] bg-[var(--color-bg-muted)] px-4 py-3 text-sm text-[var(--color-text)]">
          <div className="font-semibold">Ultimo evento da placa: {formatPulseStatus(ultimoEvento.pulse_status)}</div>
          <div className="mt-1 text-xs text-[var(--color-text-soft)]">
            {brasiliaDate(ultimoEvento.created_at).format("DD/MM/YYYY HH:mm:ss")} {ultimoEvento.command_id ? `cmd ${ultimoEvento.command_id}` : ""}
          </div>
        </div>
      ) : null}
      {showFirmware ? (
        <div className="mt-4 rounded-[16px] border border-[var(--color-border)] bg-white px-4 py-3 text-sm">
          <div className="font-semibold text-[var(--color-text)]">Firmware</div>
          <div className="mt-2 grid gap-2 text-xs text-[var(--color-text-soft)]">
            <InfoRow label="Instalado" value={maquina?.firmware_version || "Aguardando fw da placa"} />
            <InfoRow label="Alvo" value={maquina?.firmware_target_version || "--"} />
            <InfoRow label="Status OTA" value={formatFirmwareUpdateStatus(maquina?.firmware_update_status) || "--"} />
            <InfoRow
              label="Solicitado"
              value={maquina?.firmware_update_requested_at ? brasiliaDate(maquina.firmware_update_requested_at).format("DD/MM/YYYY HH:mm:ss") : "--"}
            />
            <InfoRow label="URL" value={maquina?.firmware_update_url || "--"} />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3">
      <span className="shrink-0 font-semibold">{label}</span>
      <span className="min-w-0 break-all text-right text-[var(--color-text)]">{value}</span>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="flex w-full min-w-0 items-center gap-3 rounded-[22px] border border-[var(--color-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--color-text)] sm:w-auto sm:rounded-full">
      {label}
      <select
        className="min-w-0 flex-1 bg-transparent text-[var(--color-text-soft)] outline-none sm:flex-none"
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

const PULSE_CONFIRMED_STATUSES = new Set([
  "pulso_confirmado",
  "pulsos_confirmados",
  "pulso_enviado",
  "pulso_unitario",
  "liberado",
  "fisico",
]);

const PULSE_ABSENT_STATUSES = new Set([
  "falha",
  "falha_timeout",
  "falha_sem_confirmacao",
  "falha_publicacao",
  "falha_cmd_ignorado",
  "falha_bloqueado",
  "pulso_sem_retorno",
]);

function getSaleSearchValues(item) {
  return [
    item.descricao,
    item.provider_payment_id,
    item.payment_type,
    item.card_brand,
    item.bank_name,
    item.situacao,
    item.ponto,
    item.provider,
    item.pulse_status,
  ].filter(Boolean);
}

function isPhysicalSale(item) {
  return (
    item.provider === "fisico" ||
    item.kind === "pagamento_fisico" ||
    String(item.payment_type || "").toLowerCase() === "fisico"
  );
}

function getPaymentMethodText(item) {
  return [item.payment_type, item.card_brand, item.bank_name, item.provider]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function matchesSaleFilters(item, filters) {
  if (filters.registro === "reais" && item.is_test) return false;
  if (filters.registro === "testes" && !item.is_test) return false;

  const physical = isPhysicalSale(item);
  const appAgarra =
    item.provider === "agarramais_app" ||
    item.payment_type === "pagamento_app_agarra" ||
    String(item.descricao || "").toLowerCase().includes("aplicativo agarra");
  if (filters.origem === "fisico" && !physical) return false;
  if (filters.origem === "digital" && (physical || item.is_test)) return false;
  if (filters.origem === "app_agarra" && !appAgarra) return false;

  const methodText = getPaymentMethodText(item);
  if (filters.forma === "pix" && !methodText.includes("pix")) return false;
  if (
    filters.forma === "cartao" &&
    !/(card|cartao|credito|credit|debito|debit|visa|master|elo|amex|hiper)/.test(methodText)
  ) {
    return false;
  }
  if (filters.forma === "credito" && !/(credit|credito)/.test(methodText)) return false;
  if (filters.forma === "debito" && !/(debit|debito)/.test(methodText)) return false;

  const pulseStatus = String(item.pulse_status || "").toLowerCase();
  if (filters.pulso === "confirmados" && !PULSE_CONFIRMED_STATUSES.has(pulseStatus)) {
    return false;
  }
  if (
    filters.pulso === "ausentes" &&
    !pulseStatus.startsWith("falha") &&
    !PULSE_ABSENT_STATUSES.has(pulseStatus)
  ) {
    return false;
  }

  return true;
}

function SalesReportTable({ vendas, searchTerm, filters, maquina, onRefund, refundingId }) {
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filtered = vendas.filter((item) => {
    if (!matchesSaleFilters(item, filters)) return false;
    if (!normalizedSearch) return true;
    return getSaleSearchValues(item).some((value) =>
      String(value).toLowerCase().includes(normalizedSearch),
    );
  });

  return (
    <div className="overflow-hidden rounded-[26px] border border-[var(--color-border)] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg-muted)] px-5 py-4">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-text-soft)]">
            Relatorio de vendas
          </div>
          <div className="mt-1 text-sm text-[var(--color-text-soft)]">
            Pagamentos, testes, pulso e situacao da maquina {maquina?.id_hardware || ""}
          </div>
        </div>
        <span className="rounded-full bg-[var(--color-primary-soft)] px-4 py-2 text-sm font-semibold text-[var(--color-primary)]">
          {filtered.length} registro(s)
        </span>
      </div>
      {filtered.length === 0 ? (
        <div className="flex h-40 items-center justify-center px-6 text-center text-sm text-[var(--color-text-soft)]">
          Nenhuma venda ou teste encontrado neste periodo.
        </div>
      ) : (
        <>
        <div className="grid gap-3 p-3 md:hidden">
          {filtered.map((item) => (
            <SaleMobileCard
              key={`${item.kind}-${item.id}`}
              item={item}
              maquina={maquina}
              onRefund={onRefund}
              refundingId={refundingId}
            />
          ))}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-[1180px]">
            <thead className="bg-white text-left text-xs uppercase tracking-[0.16em] text-[var(--color-text-soft)]">
              <tr>
                <th className="px-4 py-4">Opcoes</th>
                <th className="px-4 py-4">Data</th>
                <th className="px-4 py-4">Valor</th>
                <th className="px-4 py-4">Total</th>
                <th className="px-4 py-4">Ponto</th>
                <th className="px-4 py-4">Maquininha</th>
                <th className="px-4 py-4">Banco/Metodo</th>
                <th className="px-4 py-4">Pago/Devolver</th>
                <th className="px-4 py-4">Tipo de pagamento</th>
                <th className="px-4 py-4">Situacao</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr
                  key={`${item.kind}-${item.id}`}
                  className={`border-t border-[var(--color-border)] align-top text-sm text-[var(--color-text)] ${
                    item.is_test ? "bg-amber-50/80" : "bg-white"
                  }`}
                >
                  <td className="px-4 py-4">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-bg-muted)] text-[var(--color-text-soft)]">
                      <Search size={17} />
                    </span>
                  </td>
                  <td className="px-4 py-4 min-w-[150px]">
                    <div className="font-semibold">{brasiliaDate(item.data).format("DD/MM/YYYY")}</div>
                    <div className="text-xs text-[var(--color-text-soft)]">{brasiliaDate(item.data).format("HH:mm:ss")}</div>
                    {item.is_test ? (
                      <div className="mt-2 rounded-full bg-amber-200 px-3 py-1 text-center text-xs font-extrabold uppercase text-amber-900">
                        TESTE
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-4">
                    <MoneyBadge value={item.valor} tone="blue" />
                    <div className="mt-1 text-xs text-[var(--color-primary)]">Cliente pagou</div>
                  </td>
                  <td className="px-4 py-4">
                    <MoneyBadge value={item.total} tone="green" />
                    <div className="mt-1 text-xs text-[var(--color-success)]">Voce recebeu</div>
                  </td>
                  <td className="px-4 py-4 min-w-[190px]">
                    <div className="rounded-[14px] bg-[var(--color-primary-soft)] px-3 py-2 font-semibold text-[var(--color-primary)]">
                      {item.ponto || maquina?.nome || maquina?.id_hardware}
                    </div>
                    <div className="mt-2 rounded-[10px] bg-black px-3 py-1 text-xs font-semibold text-yellow-300">
                      Caixa: {maquina?.mp_pos_external_id || maquina?.id_hardware}
                    </div>
                  </td>
                  <td className="px-4 py-4 min-w-[165px]">
                    <TerminalBadge maquina={maquina} />
                  </td>
                  <td className="px-4 py-4 min-w-[220px]">
                    {item.is_test ? (
                      <div className="rounded-[16px] bg-amber-200 px-4 py-3 text-center text-lg font-extrabold uppercase text-amber-950">
                        Pagamento de teste
                      </div>
                    ) : (
                      <div className="rounded-[16px] bg-[var(--color-primary-soft)] px-4 py-3">
                        <div className="font-semibold text-[var(--color-primary)]">{formatProvider(item.provider)}</div>
                        <div className="mt-1 text-xs text-[var(--color-text-soft)]">
                          {formatPaymentMethod(item)}
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4 min-w-[135px]">
                    <div className="rounded-[12px] bg-sky-50 px-3 py-2 text-center text-xs font-bold text-sky-700">
                      {item.provider_payment_id ? "PGTO REAL" : item.is_test ? "TESTE" : "PGTO"}
                    </div>
                    <button
                      type="button"
                      className="mt-3 inline-flex w-full items-center justify-center rounded-[10px] bg-sky-500 px-3 py-2 text-xs font-bold text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-slate-300"
                      disabled={!item.can_refund || refundingId === String(item.id)}
                      onClick={() => onRefund(item)}
                    >
                      {refundingId === String(item.id) ? "Devolvendo" : "Devolver"}
                    </button>
                  </td>
                  <td className="px-4 py-4 min-w-[150px]">
                    <PulseBadge status={item.pulse_status} />
                  </td>
                  <td className="px-4 py-4 min-w-[170px]">
                    <StatusBadge item={item} />
                    {item.provider_payment_id ? (
                      <div className="mt-2 text-xs font-semibold text-[var(--color-primary)]">
                        {item.provider_payment_id}
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  );
}

function MoneyBadge({ value, tone }) {
  const toneClass = {
    blue: "bg-blue-500 text-white",
    orange: "bg-orange-400 text-white",
    green: "bg-emerald-600 text-white",
  }[tone];
  return (
    <span className={`inline-flex rounded-[8px] px-3 py-1 text-base font-extrabold ${toneClass}`}>
      R$ {Number(value || 0).toFixed(2)}
    </span>
  );
}

function SaleMobileCard({ item, maquina, onRefund, refundingId }) {
  return (
    <article className={`rounded-[18px] border border-[var(--color-border)] p-4 ${item.is_test ? "bg-amber-50" : "bg-white"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-[var(--color-text-soft)]">
            {brasiliaDate(item.data).format("DD/MM/YYYY HH:mm:ss")}
          </div>
          <div className="mt-1 text-base font-extrabold text-[var(--color-text)]">
            {item.is_test ? "Pagamento de teste" : formatProvider(item.provider)}
          </div>
        </div>
        <StatusBadge item={item} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-[14px] bg-[var(--color-bg-muted)] px-3 py-2">
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-text-soft)]">Valor</div>
          <div className="mt-1 font-extrabold text-[var(--color-text)]">R$ {Number(item.valor || 0).toFixed(2)}</div>
        </div>
        <div className="rounded-[14px] bg-[var(--color-bg-muted)] px-3 py-2">
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-text-soft)]">Total</div>
          <div className="mt-1 font-extrabold text-[var(--color-success)]">R$ {Number(item.total || 0).toFixed(2)}</div>
        </div>
        <div className="col-span-2 rounded-[14px] bg-[var(--color-bg-muted)] px-3 py-2">
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-text-soft)]">Ponto</div>
          <div className="mt-1 truncate font-semibold text-[var(--color-text)]">
            {item.ponto || maquina?.nome || maquina?.id_hardware}
          </div>
        </div>
        <div className="col-span-2 rounded-[14px] border border-[var(--color-border)] bg-white px-3 py-3">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-text-soft)]">
            Maquininha
          </div>
          <TerminalBadge maquina={maquina} compact />
        </div>
        <div className="col-span-2">
          <PulseBadge status={item.pulse_status} />
        </div>
      </div>

      {item.provider_payment_id ? (
        <div className="mt-3 rounded-[12px] bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700">
          {item.provider_payment_id}
        </div>
      ) : null}

      <button
        type="button"
        className="mt-3 inline-flex w-full items-center justify-center rounded-full bg-sky-500 px-4 py-2 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:bg-slate-300"
        disabled={!item.can_refund || refundingId === String(item.id)}
        onClick={() => onRefund(item)}
      >
        {refundingId === String(item.id) ? "Devolvendo" : "Devolver"}
      </button>
    </article>
  );
}

function TerminalBadge({ maquina, compact = false }) {
  const status = maquina?.terminal_status || "not_linked";
  const online = status === "online";
  const unavailable = status === "unavailable";
  const notLinked = status === "not_linked";
  const linked = status === "linked";
  const Icon = online ? Wifi : linked ? CreditCard : WifiOff;
  const label = online
    ? "Online"
    : linked
      ? "Vinculada"
    : unavailable
      ? "Indisponivel"
      : notLinked
        ? "Nao vinculada"
        : "Offline";
  const statusClass = online
    ? "bg-emerald-100 text-emerald-700"
    : linked
      ? "bg-sky-100 text-sky-700"
    : unavailable || notLinked
      ? "bg-slate-100 text-slate-600"
      : "bg-rose-100 text-rose-700";

  return (
    <div className={compact ? "flex items-center justify-between gap-3" : "text-center"}>
      <div className={`flex items-center gap-2 ${compact ? "" : "justify-center"}`}>
        <CreditCard size={compact ? 20 : 23} className="text-sky-600" />
        <Icon
          size={18}
          className={
            online
              ? "text-emerald-600"
              : linked
                ? "text-sky-600"
                : "text-slate-500"
          }
        />
        <span className={`rounded-full px-2 py-1 text-xs font-bold ${statusClass}`}>
          {label}
        </span>
      </div>
      <div className={`${compact ? "" : "mt-2"} break-all text-xs font-semibold text-[var(--color-text)]`}>
        {maquina?.terminal_id || "ID nao identificado"}
      </div>
      {online && maquina?.terminal_last_payment_at ? (
        <div className={`${compact ? "hidden" : "mt-1"} text-[10px] font-medium text-[var(--color-text-soft)]`}>
          Pagamento confirmado às{" "}
          {brasiliaDate(maquina.terminal_last_payment_at).format("HH:mm:ss")}
        </div>
      ) : null}
    </div>
  );
}

function PulseBadge({ status }) {
  const normalized = String(status || "").toLowerCase();
  const isFail = normalized.startsWith("falha");
  const isPending = ["pendente", "comando_enviado", "cmd_recebido", "cmd_duplicado", "pulso_iniciado", "pulso_enviado", "pulso_unitario", "pulso_sem_retorno"].includes(normalized);
  const isTest = normalized === "teste";
  return (
    <div className={`rounded-[14px] px-3 py-2 text-center text-xs font-bold ${
      isFail
        ? "bg-rose-50 text-[var(--color-error)]"
        : isPending
          ? "bg-sky-50 text-sky-700"
          : isTest
            ? "bg-amber-100 text-amber-800"
            : "bg-emerald-50 text-[var(--color-success)]"
    }`}>
      {formatPulseStatus(status)}
    </div>
  );
}

function formatPulseStatus(status) {
  const normalized = String(status || "").toLowerCase();
  const labels = {
    pendente: "Aguardando envio",
    comando_enviado: "Comando enviado",
    cmd_recebido: "Comando recebido",
    cmd_duplicado: "Comando duplicado",
    pulso_iniciado: "Pulso iniciado",
    pulso_enviado: "Pulso enviado",
    pulso_unitario: "Pulso unitario",
    pulso_sem_retorno: "Pulso sem retorno",
    pulso_confirmado: "Pulso confirmado",
    liberado: "Pulso enviado",
    falha: "Pulso nao liberado",
    falha_timeout: "Sem confirmacao",
    falha_sem_confirmacao: "Pulso nao confirmado",
    falha_publicacao: "Falha ao publicar",
    falha_cmd_ignorado: "Comando ignorado",
    falha_bloqueado: "Pulso bloqueado",
    update_enviado: "Atualizacao enviada",
    update_iniciado: "Baixando firmware",
    update_ok: "Reiniciando",
    update_sem_novidade: "Sem novidade",
    update_falhou: "Atualizacao falhou",
    teste: "Pulso de teste",
    fisico: "Pagamento fisico",
  };
  return labels[normalized] || status || "Sem status";
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

function StatusBadge({ item }) {
  if (item.is_test) {
    return <span className="rounded-full bg-amber-200 px-3 py-2 text-xs font-extrabold text-amber-900">TESTE</span>;
  }
  const refunded = Boolean(item.refunded_at);
  const pulseStatus = String(item.pulse_status || "").toLowerCase();
  const pulseFailed = pulseStatus.startsWith("falha");
  const pulsePending = ["pendente", "comando_enviado", "cmd_recebido", "cmd_duplicado", "pulso_iniciado", "pulso_enviado", "pulso_unitario", "pulso_sem_retorno"].includes(pulseStatus);
  return (
    <span className={`rounded-full px-3 py-2 text-xs font-bold ${
      refunded
        ? "bg-slate-100 text-slate-600"
        : pulseFailed
          ? "bg-rose-50 text-[var(--color-error)]"
          : pulsePending
            ? "bg-sky-50 text-sky-700"
            : "bg-emerald-100 text-[var(--color-success)]"
    }`}>
      {refunded ? "Extornado" : pulseFailed ? "Pago, pulso falhou" : pulsePending ? "Pago, aguardando pulso" : "Venda aprovada"}
    </span>
  );
}

function formatProvider(provider) {
  const labels = {
    agarramais_app: "Aplicativo Agarra",
    mercado_pago: "Mercado Pago",
    manual: "Lancamento manual",
    fisico: "Pagamento fisico",
    pagbank: "PagBank",
    s6pay: "S6Pay",
  };
  return labels[provider] || provider || "Nao informado";
}

function formatPaymentMethod(item) {
  if (item.payment_type === "pagamento_app_agarra") {
    return "Pagamento feito pelo aplicativo Agarra";
  }
  if (isPhysicalSale(item) && Number(item.pulse_count || 0) > 1) {
    return `FISICO - ${item.pulse_count} pulsos`;
  }
  const parts = [item.payment_type, item.card_brand, item.bank_name].filter(Boolean);
  return parts.length ? parts.join(" - ") : "Metodo nao informado";
}

function formatResumoData(value, label) {
  if (!value) return `${label}: nenhum registro no periodo`;
  return `${label}: ${brasiliaDate(value).format("DD/MM/YYYY HH:mm:ss")}`;
}

function formatPeriodoLabel(periodo, range) {
  if (range?.start && range?.end) {
    const startLabel = dayjs(range.start).format("DD/MM/YYYY");
    const endLabel = dayjs(range.end).format("DD/MM/YYYY");
    return range.start === range.end ? startLabel : `${startLabel} ate ${endLabel}`;
  }
  if (range?.start) return `A partir de ${dayjs(range.start).format("DD/MM/YYYY")}`;
  if (range?.end) return `Ate ${dayjs(range.end).format("DD/MM/YYYY")}`;
  return periodo === "dia" ? dayjs().format("DD/MM/YYYY") : "Mes atual";
}

function HistoryTable({ title, columns, rows, empty }) {
  return (
    <div className="overflow-hidden rounded-[26px] border border-[var(--color-border)] bg-white">
      <div className="border-b border-[var(--color-border)] bg-[var(--color-bg-muted)] px-5 py-4 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-text-soft)]">
        {title}
      </div>
      {rows.length === 0 ? (
        <div className="flex h-40 items-center justify-center px-6 text-center text-sm text-[var(--color-text-soft)]">
          {empty}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="text-left text-xs uppercase tracking-[0.18em] text-[var(--color-text-soft)]">
              <tr>
                {columns.map((column) => (
                  <th key={column} className="px-5 py-4 whitespace-nowrap">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index} className="border-t border-[var(--color-border)] text-sm text-[var(--color-text)]">
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="px-5 py-4">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
