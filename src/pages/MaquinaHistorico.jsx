import { useEffect, useState } from "react";
import dayjs from "dayjs";
import { Download, FileDown, RefreshCcw, ShieldCheck, Sparkles, Trash2, Wallet } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import Button from "../components/Button";
import DateRangePicker from "../components/DateRangePicker";
import LoadingSpinner from "../components/LoadingSpinner";
import Toast from "../components/Toast";

export default function MaquinaHistorico() {
  const { machineId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
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
  });
  const [periodo, setPeriodo] = useState("mes");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [toast, setToast] = useState({ message: "", type: "success" });

  const fetchHistorico = async (options = {}) => {
    const currentPeriodo = options.periodo ?? periodo;
    const currentRange = options.dateRange ?? dateRange;
    const params = [];
    if (currentPeriodo) params.push(`periodo=${currentPeriodo}`);
    if (currentRange.start) params.push(`data_inicio=${currentRange.start}`);
    if (currentRange.end) params.push(`data_fim=${currentRange.end}`);
    const query = params.length ? `?${params.join("&")}` : "";
    const { data } = await api.get(`/maquinas/${machineId}/historico${query}`);
    return data;
  };

  const loadHistorico = async (options = {}) => {
    setLoading(true);
    try {
      const data = await fetchHistorico(options);
      setHistorico(data);
      return data;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!machineId) return;
    loadHistorico();
  }, [machineId, periodo, dateRange]);

  const handleExportPdf = (snapshot = historico, snapshotPeriodo = periodo, snapshotRange = dateRange) => {
    const maquina = snapshot.maquina;
    if (!maquina) return;
    const periodoLabel =
      snapshotRange.start || snapshotRange.end
        ? `${snapshotRange.start || "inicio do periodo"} ate ${snapshotRange.end || "hoje"}`
        : snapshotPeriodo === "dia"
          ? "Hoje"
          : "Mes atual";

    const rowsPagamentos = snapshot.pagamentos
      .map(
        (item) => `
          <tr>
            <td>${dayjs(item.data_hora).format("DD/MM/YYYY HH:mm")}</td>
            <td>${item.metodo}</td>
            <td>R$ ${Number(item.valor).toFixed(2)}</td>
          </tr>`,
      )
      .join("");

    const rowsTestes = snapshot.testes
      .map(
        (item) => `
          <tr>
            <td>${dayjs(item.created_at).format("DD/MM/YYYY HH:mm")}</td>
            <td>${item.descricao}</td>
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
          <h2>Pagamentos</h2>
          <table>
            <thead><tr><th>Data</th><th>Metodo</th><th>Valor</th></tr></thead>
            <tbody>${rowsPagamentos || "<tr><td colspan='3'>Nenhum pagamento no periodo.</td></tr>"}</tbody>
          </table>
          <h2 style="margin-top: 28px;">Saidas</h2>
          <table>
            <thead><tr><th>Data</th><th>Metodo</th><th>Valor</th></tr></thead>
            <tbody>${
              snapshot.saidas
                .map(
                  (item) => `
          <tr>
            <td>${dayjs(item.data_hora).format("DD/MM/YYYY HH:mm")}</td>
            <td>${item.metodo}</td>
            <td>R$ ${Number(item.valor).toFixed(2)}</td>
          </tr>`,
                )
                .join("") || "<tr><td colspan='3'>Nenhuma saida no periodo.</td></tr>"
            }</tbody>
          </table>
          <h2 style="margin-top: 28px;">Testes</h2>
          <table>
            <thead><tr><th>Data</th><th>Descricao</th></tr></thead>
            <tbody>${rowsTestes || "<tr><td colspan='2'>Nenhum teste no periodo.</td></tr>"}</tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const handleDeleteHistorico = async () => {
    if (!window.confirm("Deseja apagar todos os pagamentos e testes deste periodo para esta maquina?")) return;
    const params = [];
    if (periodo) params.push(`periodo=${periodo}`);
    if (dateRange.start) params.push(`data_inicio=${dateRange.start}`);
    if (dateRange.end) params.push(`data_fim=${dateRange.end}`);
    const query = params.length ? `?${params.join("&")}` : "";
    await api.delete(`/maquinas/${machineId}/historico${query}`);
    setToast({ message: "Historico apagado com sucesso.", type: "success" });
    await loadHistorico();
  };

  const handleSalvarFechamento = async () => {
    const params = [];
    if (periodo) params.push(`periodo=${periodo}`);
    if (dateRange.start) params.push(`data_inicio=${dateRange.start}`);
    if (dateRange.end) params.push(`data_fim=${dateRange.end}`);
    const query = params.length ? `?${params.join("&")}` : "";
    await api.post(`/maquinas/${machineId}/fechamentos${query}`);
    setToast({ message: "Fechamento salvo com sucesso.", type: "success" });
    await loadHistorico();
  };

  const handleExportCsv = () => {
    const maquina = historico.maquina;
    if (!maquina) return;

    const rows = [
      ["secao", "data", "metodo", "valor", "descricao"],
      ...historico.pagamentos.map((item) => [
        "pagamento",
        dayjs(item.data_hora).format("YYYY-MM-DD HH:mm:ss"),
        item.metodo,
        Number(item.valor).toFixed(2),
        "",
      ]),
      ...historico.saidas.map((item) => [
        "saida",
        dayjs(item.data_hora).format("YYYY-MM-DD HH:mm:ss"),
        item.metodo,
        Number(item.valor).toFixed(2),
        "",
      ]),
      ...historico.testes.map((item) => [
        "teste",
        dayjs(item.created_at).format("YYYY-MM-DD HH:mm:ss"),
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
    link.href = url;
    link.download = `historico-${maquina.id_hardware}-${dayjs().format("YYYYMMDD-HHmmss")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleFechamentoHoje = () => {
    const hoje = dayjs().format("YYYY-MM-DD");
    const nextRange = { start: hoje, end: hoje };
    setPeriodo("dia");
    setDateRange(nextRange);
    loadHistorico({ periodo: "dia", dateRange: nextRange }).then((data) => {
      if (data) {
        setHistorico(data);
        handleExportPdf(data, "dia", nextRange);
      }
    });
  };

  const maquina = historico.maquina;

  return (
    <div className="flex min-h-full flex-col gap-4">
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ message: "", type: toast.type })}
      />

      <section className="app-panel rounded-[30px] p-6 md:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--color-text-soft)]">
              Maquina
            </div>
            <h1 className="mt-3 text-4xl font-extrabold tracking-[-0.05em] text-[var(--color-text)] md:text-5xl">
              {maquina?.nome || machineId}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--color-text-soft)] md:text-base">
              Historico de pagamentos e testes da maquina, com fechamento por periodo.
            </p>
            <div className="mt-3 text-sm text-[var(--color-text-soft)]">
              {maquina?.id_hardware || machineId} {maquina?.localizacao ? ` - ${maquina.localizacao}` : ""}
            </div>
          </div>

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
        </div>
      </section>

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
        <StatusCard maquina={maquina} />
      </div>

      <section className="app-panel rounded-[30px] p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-3">
            <Button type="button" className="justify-center" onClick={() => navigate("/maquinas")}>
              Voltar para maquinas
            </Button>
            <button
              type="button"
              className="pill-button inline-flex items-center justify-center gap-2 px-5 py-3 font-semibold"
              onClick={handleSalvarFechamento}
            >
              <ShieldCheck size={16} />
              Salvar fechamento
            </button>
            <button
              type="button"
              className="pill-button pill-button--primary inline-flex items-center justify-center gap-2 px-5 py-3 font-semibold"
              onClick={handleFechamentoHoje}
            >
              <FileDown size={16} />
              Fechamento do dia
            </button>
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
            <button
              type="button"
              className="pill-button inline-flex items-center justify-center gap-2 px-5 py-3 font-semibold"
              onClick={handleExportCsv}
            >
              <Download size={16} />
              Exportar CSV
            </button>
            <button
              type="button"
              className="pill-button inline-flex items-center justify-center gap-2 px-5 py-3 font-semibold"
              onClick={handleExportPdf}
            >
              <FileDown size={16} />
              Fechamento PDF
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-5 py-3 font-semibold text-[var(--color-error)] transition hover:bg-rose-100"
              onClick={handleDeleteHistorico}
            >
              <Trash2 size={16} />
              Apagar historicos
            </button>
          </div>
        </div>

        {loading ? (
          <LoadingSpinner className="h-56" />
        ) : (
          <div className="mt-6 space-y-4">
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
                title="Fechamentos salvos"
                empty="Nenhum fechamento salvo para esta maquina ainda."
                columns={["Criado em", "Periodo", "Total", "Por"]}
                rows={historico.fechamentos.map((item) => [
                  dayjs(item.created_at).format("DD/MM/YYYY HH:mm:ss"),
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
                  dayjs(item.created_at).format("DD/MM/YYYY HH:mm:ss"),
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
                  dayjs(item.data_hora).format("DD/MM/YYYY HH:mm:ss"),
                  item.metodo,
                  `R$ ${Number(item.valor).toFixed(2)}`,
                ])}
              />
              <HistoryTable
                title="Saidas"
                empty="Nenhuma saida encontrada no periodo."
                columns={["Data", "Metodo", "Valor"]}
                rows={historico.saidas.map((item) => [
                  dayjs(item.data_hora).format("DD/MM/YYYY HH:mm:ss"),
                  item.metodo,
                  `R$ ${Number(item.valor).toFixed(2)}`,
                ])}
              />
              <HistoryTable
                title="Testes"
                empty="Nenhum teste encontrado no periodo."
                columns={["Data", "Descricao"]}
                rows={historico.testes.map((item) => [
                  dayjs(item.created_at).format("DD/MM/YYYY HH:mm:ss"),
                  item.descricao,
                ])}
              />
            </div>
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

function StatusCard({ maquina }) {
  const online = Boolean(maquina?.status_online);
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
            ? `Ultimo sinal em ${dayjs(maquina.ultimo_sinal).format("DD/MM/YYYY HH:mm:ss")}`
            : "Sem sinal recebido ainda"}
        </span>
      </div>
    </section>
  );
}

function formatResumoData(value, label) {
  if (!value) return `${label}: nenhum registro no periodo`;
  return `${label}: ${dayjs(value).format("DD/MM/YYYY HH:mm:ss")}`;
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
