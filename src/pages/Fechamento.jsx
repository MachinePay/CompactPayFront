import { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import {
  Calculator,
  CheckCircle2,
  ClipboardCheck,
  Filter,
  LockKeyhole,
  RefreshCcw,
  RotateCcw,
} from "lucide-react";

import api, { getApiErrorMessage } from "../api/axios";
import DateRangePicker from "../components/DateRangePicker";
import LoadingSpinner from "../components/LoadingSpinner";
import Toast from "../components/Toast";
import { brasiliaDate } from "../utils/dateTime";

const DEFAULT_RANGE = {
  start: dayjs().subtract(30, "day").format("YYYY-MM-DD"),
  end: dayjs().format("YYYY-MM-DD"),
};

export default function Fechamento() {
  const [transacoes, setTransacoes] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [fechamentos, setFechamentos] = useState([]);
  const [selectedMachineId, setSelectedMachineId] = useState("");
  const [dateRange, setDateRange] = useState(DEFAULT_RANGE);
  const [loading, setLoading] = useState(false);
  const [closing, setClosing] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "success" });

  const buildQuery = useCallback(
    (machineId = selectedMachineId) => {
      const params = [];
      if (dateRange.start) params.push(`data_inicio=${dateRange.start}`);
      if (dateRange.end) params.push(`data_fim=${dateRange.end}`);
      if (machineId) params.push(`id_hardware=${encodeURIComponent(machineId)}`);
      params.push("limit=500");
      return params.length ? `?${params.join("&")}` : "";
    },
    [dateRange, selectedMachineId],
  );

  const loadMachineHistory = useCallback(
    async (machineIds) => {
      const histories = await Promise.all(
        machineIds.map(async (machineId) => {
          try {
            const { data } = await api.get(
              `/maquinas/${machineId}/historico${buildQuery(machineId)}`,
            );
            return data.fechamentos || [];
          } catch {
            return [];
          }
        }),
      );
      setFechamentos(histories.flat());
    },
    [buildQuery],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [transacoesRes, maquinasRes] = await Promise.all([
        api.get(`/transacoes${buildQuery()}`),
        api.get("/maquinas?periodo=mes"),
      ]);
      const nextTransacoes = transacoesRes.data || [];
      const nextMaquinas = maquinasRes.data || [];
      setTransacoes(nextTransacoes);
      setMaquinas(nextMaquinas);

      const ids = selectedMachineId
        ? [selectedMachineId]
        : [...new Set(nextTransacoes.map((item) => item.maquina_id))];
      await loadMachineHistory(ids);
    } catch (error) {
      setToast({
        message: getApiErrorMessage(
          error,
          "Nao foi possivel carregar os dados do fechamento.",
        ),
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [buildQuery, loadMachineHistory, selectedMachineId]);

  useEffect(() => {
    const timer = window.setTimeout(loadData, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const fechamentoPorId = useMemo(
    () => new Map(fechamentos.map((item) => [item.id, item])),
    [fechamentos],
  );

  const rows = useMemo(
    () =>
      transacoes.map((transacao) => ({
        ...transacao,
        fechamentoId: findFechamentoId(transacao, fechamentos),
      })),
    [fechamentos, transacoes],
  );

  const abertas = rows.filter((item) => !item.fechamentoId);
  const fechadas = rows.length - abertas.length;
  const entradasAbertas = abertas.filter((item) => item.tipo === "IN");
  const saidasAbertas = abertas.filter((item) => item.tipo === "OUT");
  const totalAberto = entradasAbertas.reduce(
    (sum, item) => sum + Number(item.valor || 0),
    0,
  );
  const totalFisico = entradasAbertas
    .filter((item) => item.metodo === "FISICO")
    .reduce((sum, item) => sum + Number(item.valor || 0), 0);
  const totalDigital = entradasAbertas
    .filter((item) => item.metodo === "DIGITAL")
    .reduce((sum, item) => sum + Number(item.valor || 0), 0);
  const fechamentosVisiveis = useMemo(() => {
    const ids = [...new Set(rows.map((item) => item.fechamentoId).filter(Boolean))];
    return ids
      .map((id) => fechamentoPorId.get(id))
      .filter(Boolean);
  }, [fechamentoPorId, rows]);

  const handleFechar = async () => {
    const machineIds = [
      ...new Set(abertas.filter((item) => item.tipo === "IN").map((item) => item.maquina_id)),
    ];
    if (machineIds.length === 0) {
      setToast({
        message: "Nao ha transacoes abertas para fechar neste periodo.",
        type: "error",
      });
      return;
    }

    setClosing(true);
    try {
      const results = await Promise.allSettled(
        machineIds.map((machineId) =>
          api.post(`/maquinas/${machineId}/fechamentos${buildQuery(machineId)}`),
        ),
      );
      const rejected = results.filter((item) => item.status === "rejected");
      if (rejected.length) {
        setToast({
          message: getApiErrorMessage(
            rejected[0].reason,
            "Algumas maquinas nao puderam ser fechadas.",
          ),
          type: "error",
        });
      } else {
        setToast({
          message: "Fechamento realizado. As transacoes fechadas ficaram fora do total aberto.",
          type: "success",
        });
      }
      await loadData();
    } finally {
      setClosing(false);
    }
  };

  const handleDesfazerFechamento = async () => {
    if (fechamentosVisiveis.length === 0) {
      setToast({
        message: "Nao ha fechamento para desfazer neste filtro.",
        type: "error",
      });
      return;
    }

    setUndoing(true);
    try {
      const results = await Promise.allSettled(
        fechamentosVisiveis.map((fechamento) =>
          api.delete(
            `/maquinas/${fechamento.maquina_id}/fechamentos/${fechamento.id}`,
          ),
        ),
      );
      const rejected = results.filter((item) => item.status === "rejected");
      if (rejected.length) {
        setToast({
          message: getApiErrorMessage(
            rejected[0].reason,
            "Alguns fechamentos nao puderam ser desfeitos.",
          ),
          type: "error",
        });
      } else {
        setToast({
          message: "Fechamento desfeito. As transacoes voltaram a contabilizar no total aberto.",
          type: "success",
        });
      }
      await loadData();
    } finally {
      setUndoing(false);
    }
  };

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
              Fechamento
            </div>
            <h1 className="mt-3 text-4xl font-extrabold tracking-[-0.05em] text-[var(--color-text)] md:text-5xl">
              Fechamento facil
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--color-text-soft)] md:text-base">
              Filtre o periodo, confira as transacoes abertas e salve o fechamento das maquinas selecionadas.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              className="pill-button inline-flex items-center justify-center gap-2 px-5 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              onClick={handleDesfazerFechamento}
              disabled={undoing || closing || loading || fechamentosVisiveis.length === 0}
            >
              <RotateCcw size={17} />
              {undoing ? "Desfazendo..." : "Desfazer fechamento"}
            </button>
            <button
              className="pill-button pill-button--primary inline-flex items-center justify-center gap-2 px-5 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              onClick={handleFechar}
              disabled={closing || undoing || loading || abertas.length === 0}
            >
              <ClipboardCheck size={17} />
              {closing ? "Fechando..." : "Fazer fechamento"}
            </button>
          </div>
        </div>
      </section>

      <section className="app-panel rounded-[28px] p-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_auto_auto] lg:items-center">
          <label className="flex flex-col gap-2 text-sm font-semibold text-[var(--color-text)]">
            Maquina
            <select
              className="rounded-full border border-[var(--color-border)] bg-white px-4 py-3 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
              value={selectedMachineId}
              onChange={(event) => setSelectedMachineId(event.target.value)}
            >
              <option value="">Todas as maquinas</option>
              {maquinas.map((maquina) => (
                <option key={maquina.id_hardware} value={maquina.id_hardware}>
                  {(maquina.nome || maquina.id_hardware) + ` - ${maquina.id_hardware}`}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-2 text-sm font-semibold text-[var(--color-text)]">
            Periodo
            <DateRangePicker value={dateRange} onChange={setDateRange} />
          </div>

          <button
            className="pill-button inline-flex items-center justify-center gap-2 self-end px-5 py-3 font-semibold"
            type="button"
            onClick={loadData}
          >
            <RefreshCcw size={16} />
            Recarregar
          </button>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard
          icon={<Calculator size={18} />}
          label="Total aberto"
          value={formatMoney(totalAberto)}
          helper="Somente entradas ainda nao fechadas"
          featured
        />
        <SummaryCard
          icon={<CheckCircle2 size={18} />}
          label="Entradas abertas"
          value={String(entradasAbertas.length)}
          helper={`${formatMoney(totalDigital)} digital`}
        />
        <SummaryCard
          icon={<Filter size={18} />}
          label="Fisico aberto"
          value={formatMoney(totalFisico)}
          helper={`${saidasAbertas.length} saida(s) no periodo`}
        />
        <SummaryCard
          icon={<LockKeyhole size={18} />}
          label="Ja fechadas"
          value={String(fechadas)}
          helper="Ficam em preto e branco e nao somam"
        />
      </div>

      <section className="app-panel rounded-[28px] p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-extrabold tracking-[-0.04em] text-[var(--color-text)]">
              Transacoes do periodo
            </h2>
            <p className="mt-1 text-sm text-[var(--color-text-soft)]">
              O resumo final considera apenas as linhas coloridas.
            </p>
          </div>
          <span className="rounded-full bg-[var(--color-primary-soft)] px-4 py-2 text-sm font-semibold text-[var(--color-primary)]">
            {rows.length} registro(s)
          </span>
        </div>

        <div className="overflow-hidden rounded-[24px] border border-[var(--color-border)] bg-white">
          {loading ? (
            <LoadingSpinner className="h-48" />
          ) : rows.length === 0 ? (
            <div className="flex h-44 items-center justify-center px-6 text-center text-sm text-[var(--color-text-soft)]">
              Nenhuma transacao encontrada para o periodo selecionado.
            </div>
          ) : (
            <>
              <div className="grid gap-3 p-3 md:hidden">
                {rows.map((transacao) => (
                  <TransactionCard
                    key={transacao.id}
                    transacao={transacao}
                    fechamento={fechamentoPorId.get(transacao.fechamentoId)}
                  />
                ))}
              </div>
              <div className="hidden overflow-x-auto md:block">
                <table className="min-w-[940px]">
                  <thead className="bg-[var(--color-bg-muted)] text-left text-xs uppercase tracking-[0.16em] text-[var(--color-text-soft)]">
                    <tr>
                      <th className="px-5 py-4">Status</th>
                      <th className="px-5 py-4">Data</th>
                      <th className="px-5 py-4">Maquina</th>
                      <th className="px-5 py-4">Tipo</th>
                      <th className="px-5 py-4">Metodo</th>
                      <th className="px-5 py-4">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((transacao) => (
                      <TransactionRow
                        key={transacao.id}
                        transacao={transacao}
                        fechamento={fechamentoPorId.get(transacao.fechamentoId)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="app-panel rounded-[28px] bg-[linear-gradient(135deg,#263328_0%,#121a14_100%)] p-6 text-white">
        <div className="text-sm font-bold uppercase tracking-[0.22em] text-white/58">
          Resumo final aberto
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-4">
          <FinalMetric label="Quantidade de vendas" value={String(entradasAbertas.length)} />
          <FinalMetric label="PIX / Digital" value={formatMoney(totalDigital)} />
          <FinalMetric label="Fisico" value={formatMoney(totalFisico)} />
          <FinalMetric label="Liquido aberto" value={formatMoney(totalAberto)} strong />
        </div>
      </section>
    </div>
  );
}

function findFechamentoId(transacao, fechamentos) {
  const date = brasiliaDate(transacao.data_hora).valueOf();
  const match = fechamentos.find((fechamento) => {
    if (fechamento.maquina_id !== transacao.maquina_id) return false;
    const start = brasiliaDate(fechamento.periodo_inicio).valueOf();
    const end = brasiliaDate(fechamento.periodo_fim).valueOf();
    return date >= start && date <= end;
  });
  return match?.id || null;
}

function TransactionRow({ transacao, fechamento }) {
  const closed = Boolean(fechamento);
  return (
    <tr
      className={`border-t border-[var(--color-border)] align-top text-sm ${
        closed
          ? "bg-slate-100 text-slate-500 grayscale"
          : transacao.tipo === "IN"
            ? "bg-white text-[var(--color-text)]"
            : "bg-amber-50/70 text-[var(--color-text)]"
      }`}
    >
      <td className="px-5 py-4">
        <StatusPill closed={closed} fechamento={fechamento} />
      </td>
      <td className="px-5 py-4 min-w-[150px]">
        <div className="font-semibold">
          {brasiliaDate(transacao.data_hora).format("DD/MM/YYYY")}
        </div>
        <div className="mt-1 text-xs text-[var(--color-text-soft)]">
          {brasiliaDate(transacao.data_hora).format("HH:mm:ss")}
        </div>
      </td>
      <td className="px-5 py-4 min-w-[220px]">
        <div className="font-semibold">
          {transacao.maquina_nome || transacao.maquina_id}
        </div>
        <div className="mt-1 break-all text-xs text-[var(--color-text-soft)]">
          {transacao.maquina_id}
        </div>
      </td>
      <td className="px-5 py-4">
        <TypePill type={transacao.tipo} />
      </td>
      <td className="px-5 py-4 font-semibold text-[var(--color-text-soft)]">
        {formatMetodo(transacao.metodo)}
      </td>
      <td className="px-5 py-4 text-lg font-extrabold">
        {formatMoney(transacao.valor)}
      </td>
    </tr>
  );
}

function TransactionCard({ transacao, fechamento }) {
  const closed = Boolean(fechamento);
  return (
    <article
      className={`rounded-[18px] border border-[var(--color-border)] p-4 ${
        closed ? "bg-slate-100 text-slate-500 grayscale" : "bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-[var(--color-text-soft)]">
            {brasiliaDate(transacao.data_hora).format("DD/MM/YYYY HH:mm:ss")}
          </div>
          <div className="mt-1 text-base font-extrabold">
            {transacao.maquina_nome || transacao.maquina_id}
          </div>
          <div className="mt-1 break-all text-xs font-semibold text-[var(--color-text-soft)]">
            {transacao.maquina_id}
          </div>
        </div>
        <TypePill type={transacao.tipo} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-[14px] bg-[var(--color-bg-muted)] px-3 py-2">
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-text-soft)]">
            Metodo
          </div>
          <div className="mt-1 font-semibold">{formatMetodo(transacao.metodo)}</div>
        </div>
        <div className="rounded-[14px] bg-[var(--color-bg-muted)] px-3 py-2">
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-text-soft)]">
            Valor
          </div>
          <div className="mt-1 font-extrabold">{formatMoney(transacao.valor)}</div>
        </div>
      </div>
      <div className="mt-3">
        <StatusPill closed={closed} fechamento={fechamento} />
      </div>
    </article>
  );
}

function SummaryCard({ icon, label, value, helper, featured = false }) {
  return (
    <section
      className={`app-panel rounded-[24px] p-5 ${
        featured
          ? "bg-[linear-gradient(135deg,var(--color-primary)_0%,var(--color-primary-strong)_100%)] text-white"
          : ""
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className={`text-sm font-semibold ${featured ? "text-white/72" : "text-[var(--color-text-soft)]"}`}>
            {label}
          </div>
          <div className="mt-3 text-3xl font-extrabold tracking-[-0.04em]">
            {value}
          </div>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-full ${featured ? "bg-white/16" : "bg-[var(--color-primary-soft)] text-[var(--color-primary)]"}`}>
          {icon}
        </div>
      </div>
      <div className={`mt-3 text-sm ${featured ? "text-white/74" : "text-[var(--color-text-soft)]"}`}>
        {helper}
      </div>
    </section>
  );
}

function StatusPill({ closed, fechamento }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold ${
        closed
          ? "bg-slate-200 text-slate-700"
          : "bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
      }`}
    >
      {closed ? <LockKeyhole size={14} /> : <CheckCircle2 size={14} />}
      {closed
        ? `Fechada ${brasiliaDate(fechamento.created_at).format("DD/MM")}`
        : "Aberta"}
    </span>
  );
}

function TypePill({ type }) {
  const entrada = type === "IN";
  return (
    <span
      className={`inline-flex rounded-full px-3 py-2 text-xs font-bold ${
        entrada
          ? "bg-emerald-100 text-[var(--color-success)]"
          : "bg-amber-100 text-amber-800"
      }`}
    >
      {entrada ? "Entrada" : "Saida"}
    </span>
  );
}

function FinalMetric({ label, value, strong = false }) {
  return (
    <div>
      <div className="text-sm font-semibold text-white/58">{label}</div>
      <div className={`mt-2 tracking-[-0.04em] ${strong ? "text-4xl font-extrabold text-emerald-300" : "text-3xl font-extrabold"}`}>
        {value}
      </div>
    </div>
  );
}

function formatMoney(value) {
  return `R$ ${Number(value || 0).toFixed(2)}`;
}

function formatMetodo(value) {
  if (value === "FISICO") return "Fisico";
  if (value === "DIGITAL") return "Digital";
  return value || "Nao informado";
}
