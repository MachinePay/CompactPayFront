import { useCallback, useEffect, useState } from "react";
import dayjs from "dayjs";
import {
  Activity,
  BanknoteArrowDown,
  Download,
  Filter,
  RefreshCcw,
} from "lucide-react";

import api, { getApiErrorMessage } from "../api/axios";
import DateRangePicker from "../components/DateRangePicker";
import LoadingSpinner from "../components/LoadingSpinner";
import Toast from "../components/Toast";
import { useAuth } from "../context/useAuth";

export default function Transacoes() {
  const { user } = useAuth();
  const [transacoes, setTransacoes] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [periodo, setPeriodo] = useState("mes");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [toast, setToast] = useState({ message: "", type: "error" });
  const [filtros, setFiltros] = useState({
    maquina: "",
    tipo: "",
    metodo: "",
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const maquinaParams = "periodo=mes";
      const params = [];
      if (periodo) params.push(`periodo=${periodo}`);
      if (dateRange.start) params.push(`data_inicio=${dateRange.start}`);
      if (dateRange.end) params.push(`data_fim=${dateRange.end}`);
      if (filtros.maquina)
        params.push(`id_hardware=${encodeURIComponent(filtros.maquina)}`);
      if (filtros.tipo) params.push(`tipo=${encodeURIComponent(filtros.tipo)}`);
      if (filtros.metodo)
        params.push(`metodo=${encodeURIComponent(filtros.metodo)}`);
      params.push("limit=200");
      const query = params.length ? `?${params.join("&")}` : "";

      const [transacoesRes, maquinasRes] = await Promise.all([
        api.get(`/transacoes${query}`),
        api.get(`/maquinas?${maquinaParams}`),
      ]);
      setTransacoes(transacoesRes.data);
      setMaquinas(maquinasRes.data);
    } catch (error) {
      setToast({
        message: getApiErrorMessage(
          error,
          "Nao foi possivel carregar as transacoes.",
        ),
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [dateRange, filtros, periodo]);

  useEffect(() => {
    if (!user) return;
    const timer = window.setTimeout(loadData, 0);
    return () => window.clearTimeout(timer);
  }, [loadData, user]);

  const entradas = transacoes.filter((item) => item.tipo === "IN").length;
  const saidas = transacoes.filter((item) => item.tipo === "OUT").length;
  const totalDigital = transacoes
    .filter((item) => item.metodo === "DIGITAL")
    .reduce((sum, item) => sum + Number(item.valor || 0), 0);

  const handleExportCsv = () => {
    const maquinaSelecionada = maquinas.find(
      (item) => item.id_hardware === filtros.maquina,
    );
    const totalValor = transacoes.reduce(
      (sum, item) => sum + Number(item.valor || 0),
      0,
    );
    const rows = [
      ["relatorio", "Transacoes CompactPay"],
      ["gerado_em", dayjs().format("YYYY-MM-DD HH:mm:ss")],
      [
        "periodo",
        dateRange.start && dateRange.end
          ? `${dateRange.start} ate ${dateRange.end}`
          : periodo,
      ],
      [
        "maquina",
        maquinaSelecionada
          ? `${maquinaSelecionada.nome || maquinaSelecionada.id_hardware} (${maquinaSelecionada.id_hardware})`
          : "Todas",
      ],
      ["tipo", filtros.tipo || "Todos"],
      ["metodo", filtros.metodo || "Todos"],
      ["total_registros", transacoes.length],
      ["entradas", entradas],
      ["saidas", saidas],
      ["total_valor", totalValor.toFixed(2)],
      [],
      [
        "data",
        "hora",
        "maquina_id",
        "maquina_nome",
        "tipo",
        "metodo",
        "valor",
        "taxa",
      ],
      ...transacoes.map((item) => [
        dayjs(item.data_hora).format("YYYY-MM-DD"),
        dayjs(item.data_hora).format("HH:mm:ss"),
        item.maquina_id,
        item.maquina_nome || "",
        item.tipo,
        item.metodo,
        Number(item.valor || 0).toFixed(2),
        item.taxa ? Number(item.taxa).toFixed(2) : "",
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
    const machineSlug = filtros.maquina
      ? filtros.maquina.replaceAll("/", "-")
      : "todas";
    const rangeSlug =
      dateRange.start && dateRange.end
        ? `${dateRange.start}_${dateRange.end}`
        : periodo;
    link.href = url;
    link.download = `transacoes-${machineSlug}-${rangeSlug}-${dayjs().format("YYYYMMDD-HHmmss")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex min-h-full flex-col gap-4">
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ message: "", type: toast.type })}
      />

      <SectionHeader
        title="Transacoes"
        description="Consulte entradas, saidas e pagamentos digitais por maquina, periodo e metodo."
        actions={
          <button
            className="pill-button pill-button--primary inline-flex items-center justify-center gap-2 px-5 py-3 font-semibold"
            type="button"
            onClick={handleExportCsv}
            disabled={transacoes.length === 0}
          >
            <Download size={16} />
            Exportar CSV
          </button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          icon={<Activity size={18} />}
          label="Eventos listados"
          value={String(transacoes.length)}
          helper="Total carregado no filtro atual"
        />
        <SummaryCard
          icon={<BanknoteArrowDown size={18} />}
          label="Entradas digitais"
          value={`R$ ${totalDigital.toFixed(2)}`}
          helper="Receita digital filtrada"
          featured
        />
        <SummaryCard
          icon={<Filter size={18} />}
          label="Saidas registradas"
          value={String(saidas)}
          helper={`${entradas} entradas no mesmo recorte`}
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
            onClick={loadData}
            type="button"
          >
            <RefreshCcw size={16} />
            Recarregar
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <select
            className="rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-4 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
            value={filtros.maquina}
            onChange={(e) =>
              setFiltros((current) => ({ ...current, maquina: e.target.value }))
            }
          >
            <option value="">Todas as maquinas</option>
            {maquinas.map((maquina) => (
              <option key={maquina.id_hardware} value={maquina.id_hardware}>
                {(maquina.nome || maquina.id_hardware) +
                  ` - ${maquina.id_hardware}`}
              </option>
            ))}
          </select>

          <select
            className="rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-4 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
            value={filtros.tipo}
            onChange={(e) =>
              setFiltros((current) => ({ ...current, tipo: e.target.value }))
            }
          >
            <option value="">Todos os tipos</option>
            <option value="IN">Entrada</option>
            <option value="OUT">Saida</option>
          </select>

          <select
            className="rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-4 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
            value={filtros.metodo}
            onChange={(e) =>
              setFiltros((current) => ({ ...current, metodo: e.target.value }))
            }
          >
            <option value="">Todos os metodos</option>
            <option value="DIGITAL">Digital</option>
            <option value="FISICO">Fisico</option>
          </select>
        </div>

        <div className="mt-6 overflow-hidden rounded-[26px] border border-[var(--color-border)] bg-white">
          {loading ? (
            <LoadingSpinner className="h-40" />
          ) : transacoes.length === 0 ? (
            <div className="flex h-40 items-center justify-center px-6 text-center text-sm text-[var(--color-text-soft)]">
              Nenhuma transacao encontrada para os filtros selecionados.
            </div>
          ) : (
            <>
              <div className="grid gap-3 p-3 md:hidden">
                {transacoes.map((transacao) => (
                  <TransactionMobileCard
                    key={transacao.id}
                    transacao={transacao}
                  />
                ))}
              </div>
              <div className="hidden overflow-x-auto md:block">
                <table className="min-w-full">
                  <thead className="bg-[var(--color-bg-muted)] text-left text-xs uppercase tracking-[0.18em] text-[var(--color-text-soft)]">
                    <tr>
                      <th className="px-5 py-4 whitespace-nowrap">Data</th>
                      <th className="px-5 py-4 whitespace-nowrap">Maquina</th>
                      <th className="px-5 py-4 whitespace-nowrap">Tipo</th>
                      <th className="px-5 py-4 whitespace-nowrap">Metodo</th>
                      <th className="px-5 py-4 whitespace-nowrap">Valor</th>
                      <th className="px-5 py-4 whitespace-nowrap">Taxa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transacoes.map((transacao) => (
                      <tr
                        key={transacao.id}
                        className="border-t border-[var(--color-border)] text-sm text-[var(--color-text)]"
                      >
                        <td className="px-5 py-4 min-w-[180px]">
                          <div className="font-semibold">
                            {dayjs(transacao.data_hora).format("DD/MM/YYYY")}
                          </div>
                          <div className="mt-1 text-xs text-[var(--color-text-soft)]">
                            {dayjs(transacao.data_hora).format("HH:mm:ss")}
                          </div>
                        </td>
                        <td className="px-5 py-4 min-w-[220px]">
                          <div className="font-semibold">
                            {transacao.maquina_nome || transacao.maquina_id}
                          </div>
                          <div className="mt-1 text-xs text-[var(--color-text-soft)]">
                            {transacao.maquina_id}
                          </div>
                        </td>
                        <td className="px-5 py-4 min-w-[120px]">
                          <span
                            className={`inline-flex items-center rounded-full px-3 py-2 text-xs font-semibold ${
                              transacao.tipo === "IN"
                                ? "bg-[var(--color-primary-soft)] text-[var(--color-success)]"
                                : "bg-amber-50 text-[var(--color-warning)]"
                            }`}
                          >
                            {transacao.tipo}
                          </span>
                        </td>
                        <td className="px-5 py-4 min-w-[120px] text-[var(--color-text-soft)]">
                          {transacao.metodo}
                        </td>
                        <td className="px-5 py-4 min-w-[120px] font-semibold">
                          R$ {Number(transacao.valor).toFixed(2)}
                        </td>
                        <td className="px-5 py-4 min-w-[120px] font-semibold text-[var(--color-error)]">
                          {transacao.taxa
                            ? `R$ ${Number(transacao.taxa).toFixed(2)}`
                            : "--"}
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

function SectionHeader({ title, description, actions }) {
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

function TransactionMobileCard({ transacao }) {
  const entrada = transacao.tipo === "IN";
  return (
    <article className="rounded-[18px] border border-[var(--color-border)] bg-white p-4 shadow-[0_8px_20px_rgba(34,61,43,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-[var(--color-text-soft)]">
            {dayjs(transacao.data_hora).format("DD/MM/YYYY HH:mm:ss")}
          </div>
          <div className="mt-1 text-base font-extrabold text-[var(--color-text)]">
            {transacao.maquina_nome || transacao.maquina_id}
          </div>
          <div className="mt-1 text-xs font-semibold text-[var(--color-text-soft)]">
            {transacao.maquina_id}
          </div>
        </div>
        <span
          className={`inline-flex shrink-0 items-center rounded-full px-3 py-2 text-xs font-bold ${
            entrada
              ? "bg-[var(--color-primary-soft)] text-[var(--color-success)]"
              : "bg-amber-50 text-[var(--color-warning)]"
          }`}
        >
          {entrada ? "Entrada" : "Saida"}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-[14px] bg-[var(--color-bg-muted)] px-3 py-2">
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-text-soft)]">
            Metodo
          </div>
          <div className="mt-1 font-semibold text-[var(--color-text)]">
            {transacao.metodo}
          </div>
        </div>
        <div className="rounded-[14px] bg-[var(--color-bg-muted)] px-3 py-2">
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-text-soft)]">
            Valor
          </div>
          <div className="mt-1 font-extrabold text-[var(--color-text)]">
            R$ {Number(transacao.valor).toFixed(2)}
          </div>
        </div>
        <div className="rounded-[14px] bg-[var(--color-bg-muted)] px-3 py-2">
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-text-soft)]">
            Taxa
          </div>
          <div className="mt-1 font-extrabold text-[var(--color-error)]">
            {transacao.taxa ? `R$ ${Number(transacao.taxa).toFixed(2)}` : "--"}
          </div>
        </div>
      </div>
    </article>
  );
}
