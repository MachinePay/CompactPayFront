import { useEffect, useState } from "react";
import dayjs from "dayjs";
import { Activity, BanknoteArrowDown, Filter, RefreshCcw } from "lucide-react";

import api from "../api/axios";
import DateRangePicker from "../components/DateRangePicker";
import LoadingSpinner from "../components/LoadingSpinner";
import { useAuth } from "../context/AuthContext";

export default function Transacoes() {
  const { user } = useAuth();
  const [transacoes, setTransacoes] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [periodo, setPeriodo] = useState("mes");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [filtros, setFiltros] = useState({
    maquina: "",
    tipo: "",
    metodo: "",
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const maquinaParams = "periodo=mes";
      const params = [];
      if (periodo) params.push(`periodo=${periodo}`);
      if (dateRange.start) params.push(`data_inicio=${dateRange.start}`);
      if (dateRange.end) params.push(`data_fim=${dateRange.end}`);
      if (filtros.maquina) params.push(`id_hardware=${encodeURIComponent(filtros.maquina)}`);
      if (filtros.tipo) params.push(`tipo=${encodeURIComponent(filtros.tipo)}`);
      if (filtros.metodo) params.push(`metodo=${encodeURIComponent(filtros.metodo)}`);
      params.push("limit=200");
      const query = params.length ? `?${params.join("&")}` : "";

      const [transacoesRes, maquinasRes] = await Promise.all([
        api.get(`/transacoes${query}`),
        api.get(`/maquinas?${maquinaParams}`),
      ]);
      setTransacoes(transacoesRes.data);
      setMaquinas(maquinasRes.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user, periodo, dateRange, filtros]);

  const entradas = transacoes.filter((item) => item.tipo === "IN").length;
  const saidas = transacoes.filter((item) => item.tipo === "OUT").length;
  const totalDigital = transacoes
    .filter((item) => item.metodo === "DIGITAL")
    .reduce((sum, item) => sum + Number(item.valor || 0), 0);

  return (
    <div className="flex min-h-full flex-col gap-4">
      <SectionHeader
        title="Transacoes"
        description="Consulte entradas, saidas e pagamentos digitais por maquina, periodo e metodo."
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
            onChange={(e) => setFiltros((current) => ({ ...current, maquina: e.target.value }))}
          >
            <option value="">Todas as maquinas</option>
            {maquinas.map((maquina) => (
              <option key={maquina.id_hardware} value={maquina.id_hardware}>
                {(maquina.nome || maquina.id_hardware) + ` - ${maquina.id_hardware}`}
              </option>
            ))}
          </select>

          <select
            className="rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-4 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
            value={filtros.tipo}
            onChange={(e) => setFiltros((current) => ({ ...current, tipo: e.target.value }))}
          >
            <option value="">Todos os tipos</option>
            <option value="IN">Entrada</option>
            <option value="OUT">Saida</option>
          </select>

          <select
            className="rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-4 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
            value={filtros.metodo}
            onChange={(e) => setFiltros((current) => ({ ...current, metodo: e.target.value }))}
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
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-[var(--color-bg-muted)] text-left text-xs uppercase tracking-[0.18em] text-[var(--color-text-soft)]">
                  <tr>
                    <th className="px-5 py-4 whitespace-nowrap">Data</th>
                    <th className="px-5 py-4 whitespace-nowrap">Maquina</th>
                    <th className="px-5 py-4 whitespace-nowrap">Tipo</th>
                    <th className="px-5 py-4 whitespace-nowrap">Metodo</th>
                    <th className="px-5 py-4 whitespace-nowrap">Valor</th>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function SectionHeader({ title, description }) {
  return (
    <section className="app-panel rounded-[30px] p-6 md:p-7">
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
