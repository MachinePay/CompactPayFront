import { useCallback, useEffect, useMemo, useState } from "react";
import { brasiliaDate } from "../utils/dateTime";
import { ClipboardList, Filter, RefreshCcw, ShieldCheck } from "lucide-react";

import api from "../api/axios";
import DateRangePicker from "../components/DateRangePicker";
import LoadingSpinner from "../components/LoadingSpinner";
import { useAuth } from "../context/useAuth";

const emptyFilters = {
  maquina_id: "",
  usuario: "",
  acao: "",
  periodo: "",
  limite: "100",
};

const emptyDateRange = { start: "", end: "" };

export default function AuditoriaSistema() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [dateRange, setDateRange] = useState(emptyDateRange);
  const [maquinas, setMaquinas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (user?.role !== "admin") return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.maquina_id.trim()) params.set("maquina_id", filters.maquina_id.trim());
      if (filters.usuario.trim()) params.set("usuario", filters.usuario.trim());
      if (filters.acao.trim()) params.set("acao", filters.acao.trim());
      if (dateRange.start && dateRange.end) {
        params.set("data_inicio", dateRange.start);
        params.set("data_fim", dateRange.end);
      } else if (filters.periodo) {
        params.set("periodo", filters.periodo);
      }
      params.set("limite", filters.limite || "100");
      const { data } = await api.get(`/auditoria-sistema?${params.toString()}`);
      setItems(data);
    } finally {
      setLoading(false);
    }
  }, [filters, dateRange, user?.role]);

  useEffect(() => {
    if (user?.role !== "admin") return;
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ limite: "100" });
      api.get(`/auditoria-sistema?${params.toString()}`).then(({ data }) => {
        setItems(data);
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [user?.role]);

  useEffect(() => {
    if (user?.role !== "admin") return;
    api.get("/maquinas").then(({ data }) => setMaquinas(data || [])).catch(() => setMaquinas([]));
    api.get("/usuarios").then(({ data }) => setUsuarios(data || [])).catch(() => setUsuarios([]));
  }, [user?.role]);

  const stats = useMemo(() => {
    const uniqueEntities = new Set(items.map((item) => `${item.entidade_tipo}:${item.entidade_id || ""}`));
    const destructiveActions = items.filter((item) =>
      ["excluir", "apagar", "extorno"].some((term) => String(item.acao).toLowerCase().includes(term)),
    ).length;
    return {
      total: items.length,
      entities: uniqueEntities.size,
      destructive: destructiveActions,
    };
  }, [items]);

  if (user?.role !== "admin") {
    return <div className="p-8 text-[var(--color-text)]">Acesso restrito.</div>;
  }

  return (
    <div className="flex min-h-full flex-col gap-4">
      <SectionHeader
        title="Auditoria"
        description="Consulte acoes sensiveis registradas no sistema, como criacoes, edicoes, exclusoes, testes e extornos."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          icon={<ClipboardList size={18} />}
          label="Registros listados"
          value={String(stats.total)}
          helper="Total carregado no filtro atual"
        />
        <SummaryCard
          icon={<ShieldCheck size={18} />}
          label="Entidades afetadas"
          value={String(stats.entities)}
          helper="Maquinas, usuarios, produtos ou historicos"
          featured
        />
        <SummaryCard
          icon={<Filter size={18} />}
          label="Acoes criticas"
          value={String(stats.destructive)}
          helper="Exclusoes, apagamentos e extornos"
        />
      </div>

      <section className="app-panel rounded-[30px] p-5 md:p-6">
        <div className="grid gap-3 md:grid-cols-3">
          <select
            className="rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-4 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
            value={filters.maquina_id}
            onChange={(event) => setFilters((current) => ({ ...current, maquina_id: event.target.value }))}
          >
            <option value="">Todas as maquinas</option>
            {maquinas.map((item) => (
              <option key={item.id_hardware} value={item.id_hardware}>
                {(item.nome || item.id_hardware) + ` - ${item.id_hardware}`}
              </option>
            ))}
          </select>
          <select
            className="rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-4 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
            value={filters.usuario}
            onChange={(event) => setFilters((current) => ({ ...current, usuario: event.target.value }))}
          >
            <option value="">Todos os usuarios</option>
            {usuarios.map((item) => (
              <option key={item.id} value={item.email}>
                {item.nome ? `${item.nome} - ${item.email}` : item.email}
              </option>
            ))}
          </select>
          <input
            className="rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-4 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
            placeholder="Acao: criar, editar, excluir..."
            value={filters.acao}
            onChange={(event) => setFilters((current) => ({ ...current, acao: event.target.value }))}
          />
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-[160px_1fr_140px_auto]">
          <select
            className="rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-4 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
            value={filters.periodo}
            onChange={(event) => {
              setFilters((current) => ({ ...current, periodo: event.target.value }));
              setDateRange(emptyDateRange);
            }}
          >
            <option value="">Todo o periodo</option>
            <option value="hoje">Hoje</option>
            <option value="semana">Ultimos 7 dias</option>
            <option value="mes">Mes atual</option>
          </select>
          <DateRangePicker
            value={dateRange}
            onChange={(range) => {
              setDateRange(range);
              setFilters((current) => ({ ...current, periodo: "" }));
            }}
          />
          <select
            className="rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-4 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
            value={filters.limite}
            onChange={(event) => setFilters((current) => ({ ...current, limite: event.target.value }))}
          >
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="200">200</option>
            <option value="500">500</option>
          </select>
          <button
            className="pill-button pill-button--primary inline-flex items-center justify-center gap-2 px-5 py-3 font-semibold"
            type="button"
            onClick={loadData}
          >
            <RefreshCcw size={16} />
            Filtrar
          </button>
        </div>

        <div className="mt-6 overflow-hidden rounded-[26px] border border-[var(--color-border)] bg-white">
          {loading ? (
            <LoadingSpinner className="h-40" />
          ) : items.length === 0 ? (
            <div className="flex h-40 items-center justify-center px-6 text-center text-sm text-[var(--color-text-soft)]">
              Nenhum registro de auditoria encontrado para os filtros selecionados.
            </div>
          ) : (
            <>
            <div className="grid gap-3 p-3 md:hidden">
              {items.map((item) => (
                <AuditMobileCard key={item.id} item={item} />
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full">
                <thead className="bg-[var(--color-bg-muted)] text-left text-xs uppercase tracking-[0.18em] text-[var(--color-text-soft)]">
                  <tr>
                    <th className="px-5 py-4 whitespace-nowrap">Data</th>
                    <th className="px-5 py-4 whitespace-nowrap">Entidade</th>
                    <th className="px-5 py-4 whitespace-nowrap">Acao</th>
                    <th className="px-5 py-4 whitespace-nowrap">Executado por</th>
                    <th className="px-5 py-4 whitespace-nowrap">Descricao</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      className="border-t border-[var(--color-border)] text-sm text-[var(--color-text)]"
                    >
                      <td className="px-5 py-4 min-w-[180px]">
                        <div className="font-semibold">
                          {brasiliaDate(item.created_at).format("DD/MM/YYYY")}
                        </div>
                        <div className="mt-1 text-xs text-[var(--color-text-soft)]">
                          {brasiliaDate(item.created_at).format("HH:mm:ss")}
                        </div>
                      </td>
                      <td className="px-5 py-4 min-w-[170px]">
                        <div className="font-semibold">{item.entidade_tipo}</div>
                        <div className="mt-1 text-xs text-[var(--color-text-soft)]">
                          {item.entidade_id || "--"}
                        </div>
                      </td>
                      <td className="px-5 py-4 min-w-[150px]">
                        <span className="inline-flex items-center rounded-full bg-[var(--color-primary-soft)] px-3 py-2 text-xs font-semibold text-[var(--color-success)]">
                          {item.acao}
                        </span>
                      </td>
                      <td className="px-5 py-4 min-w-[220px] text-[var(--color-text-soft)]">
                        {item.executado_por_email}
                      </td>
                      <td className="px-5 py-4 min-w-[360px] leading-6 text-[var(--color-text-soft)]">
                        {item.descricao}
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

function AuditMobileCard({ item }) {
  return (
    <article className="rounded-[18px] border border-[var(--color-border)] bg-white p-4 shadow-[0_8px_20px_rgba(34,61,43,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-extrabold text-[var(--color-text)]">
            {brasiliaDate(item.created_at).format("DD/MM/YYYY")}
          </div>
          <div className="mt-1 text-xs font-semibold text-[var(--color-text-soft)]">
            {brasiliaDate(item.created_at).format("HH:mm:ss")}
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-[var(--color-primary-soft)] px-3 py-1.5 text-xs font-bold text-[var(--color-success)]">
          {item.acao}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-[16px] border border-[var(--color-border)] bg-[var(--color-bg-muted)] px-3 py-3">
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-soft)]">
            Entidade
          </div>
          <div className="mt-1 break-words text-sm font-bold text-[var(--color-text)]">
            {item.entidade_tipo}
          </div>
          <div className="mt-1 text-xs text-[var(--color-text-soft)]">{item.entidade_id || "--"}</div>
        </div>
        <div className="rounded-[16px] border border-[var(--color-border)] bg-[var(--color-bg-muted)] px-3 py-3">
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-soft)]">
            Usuario
          </div>
          <div className="mt-1 break-words text-sm font-bold text-[var(--color-text)]">
            {item.executado_por_email || "--"}
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-[16px] border border-[var(--color-border)] bg-white px-3 py-3 text-sm leading-6 text-[var(--color-text-soft)]">
        {item.descricao}
      </div>
    </article>
  );
}
