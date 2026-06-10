import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Bell,
  CreditCard,
  Download,
  Filter,
  MonitorSmartphone,
  Search,
  Sparkles,
  Wallet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import api from "../api/axios";
import Card from "../components/Card";
import DateRangePicker from "../components/DateRangePicker";
import LoadingSpinner from "../components/LoadingSpinner";
import { useAuth } from "../context/useAuth";

function buildDashboardParams({ dateRange, selectedClientId, selectedMachineId, userRole }) {
  const params = new URLSearchParams();
  if (dateRange.start) params.set("data_inicio", dateRange.start);
  if (dateRange.end) params.set("data_fim", dateRange.end);
  if (!dateRange.start || !dateRange.end) params.set("periodo", "mes");
  if (userRole === "admin" && selectedClientId) params.set("cliente_id", selectedClientId);
  if (selectedMachineId) params.set("id_hardware", selectedMachineId);
  return params.toString() ? `?${params.toString()}` : "";
}

export default function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const persistedFilters = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("compactpay.dashboard.filters") || "{}");
    } catch {
      return {};
    }
  }, []);

  const [stats, setStats] = useState({
    faturamento_total: 0,
    premios_entregues: 0,
    maquinas_ativas: 0,
    total_maquinas: 0,
    ticket_medio: 0,
    percentual_ativas: 0,
    alertas: 0,
  });
  const [chartData, setChartData] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [clientesResumo, setClientesResumo] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState(persistedFilters.selectedClientId || "");
  const [selectedMachineId, setSelectedMachineId] = useState(persistedFilters.selectedMachineId || "");
  const [filterSearch, setFilterSearch] = useState(persistedFilters.filterSearch || "");
  const [dateRange, setDateRange] = useState(persistedFilters.dateRange || { start: "", end: "" });
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    localStorage.setItem(
      "compactpay.dashboard.filters",
      JSON.stringify({ selectedClientId, selectedMachineId, filterSearch, dateRange }),
    );
  }, [dateRange, filterSearch, selectedClientId, selectedMachineId]);

  useEffect(() => {
    if (!user || !isAdmin) return;
    api.get("/clientes").then(({ data }) => {
      setClientes(Array.isArray(data) ? data : []);
    });
  }, [isAdmin, user]);

  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams();
    params.set("periodo", "mes");
    if (isAdmin && selectedClientId) params.set("cliente_id", selectedClientId);
    const query = params.toString() ? `?${params.toString()}` : "";

    api.get(`/maquinas${query}`).then(({ data }) => {
      const items = Array.isArray(data) ? data : [];
      setMaquinas(items);
      if (selectedMachineId && !items.some((item) => item.id_hardware === selectedMachineId)) {
        setSelectedMachineId("");
      }
    });
  }, [isAdmin, selectedClientId, selectedMachineId, user]);

  const loadOverview = useCallback(() => {
    if (!user) return;
    setLoading(true);
    const query = buildDashboardParams({
      dateRange,
      selectedClientId,
      selectedMachineId,
      userRole: user.role,
    });

    api
      .get(`/dashboard/overview${query}`)
      .then(({ data }) => {
        setStats({
          faturamento_total: data?.stats?.faturamento_total ?? 0,
          premios_entregues: data?.stats?.premios_entregues ?? 0,
          maquinas_ativas: data?.stats?.maquinas_ativas ?? 0,
          total_maquinas: data?.stats?.total_maquinas ?? 0,
          ticket_medio: data?.stats?.ticket_medio ?? 0,
          percentual_ativas: data?.stats?.percentual_ativas ?? 0,
          alertas: data?.stats?.alertas ?? 0,
        });
        setChartData(Array.isArray(data?.chart_data) ? data.chart_data : []);
        setAlerts(Array.isArray(data?.alerts) ? data.alerts : []);
        setClientesResumo(Array.isArray(data?.clientes_resumo) ? data.clientes_resumo : []);
      })
      .finally(() => setLoading(false));
  }, [dateRange, selectedClientId, selectedMachineId, user]);

  useEffect(() => {
    const timer = window.setTimeout(loadOverview, 0);
    return () => window.clearTimeout(timer);
  }, [loadOverview]);

  const filteredClientes = clientes.filter((cliente) => {
    const term = filterSearch.trim().toLowerCase();
    if (!term) return true;
    return (
      cliente.nome_empresa?.toLowerCase().includes(term) ||
      cliente.email_contato?.toLowerCase().includes(term)
    );
  });

  const filteredMaquinas = maquinas.filter((maquina) => {
    const term = filterSearch.trim().toLowerCase();
    if (!term) return true;
    return (
      maquina.nome?.toLowerCase().includes(term) ||
      maquina.id_hardware?.toLowerCase().includes(term) ||
      maquina.localizacao?.toLowerCase().includes(term)
    );
  });

  const searchTerm = filterSearch.trim().toLowerCase();
  const searchSuggestions = [
    ...filteredClientes.slice(0, 4).map((cliente) => ({
      key: `cliente-${cliente.id}`,
      label: cliente.nome_empresa,
      helper: "Abrir cliente no dashboard",
      action: () => {
        setSelectedClientId(String(cliente.id));
        setSelectedMachineId("");
        setShowSuggestions(false);
      },
    })),
    ...filteredMaquinas.slice(0, 5).map((maquina) => ({
      key: `maquina-${maquina.id_hardware}`,
      label: maquina.nome || maquina.id_hardware,
      helper: maquina.localizacao || maquina.id_hardware,
      action: () => {
        if (maquina.cliente_id) setSelectedClientId(String(maquina.cliente_id));
        setSelectedMachineId(maquina.id_hardware);
        setShowSuggestions(false);
      },
    })),
  ].filter((item, index, items) => searchTerm && items.findIndex((entry) => entry.key === item.key) === index);

  const selectedClient = clientes.find((cliente) => String(cliente.id) === String(selectedClientId));
  const selectedMachine = maquinas.find((maquina) => maquina.id_hardware === selectedMachineId);
  const machineStatusRows = (selectedMachine ? [selectedMachine] : maquinas)
    .slice()
    .sort((left, right) => Number(right.status_online) - Number(left.status_online))
    .slice(0, 6);

  const statCards = [
    {
      label: "Faturamento",
      value: `R$ ${stats.faturamento_total.toFixed(2)}`,
      caption: "Entrada consolidada do periodo selecionado",
      icon: Wallet,
      featured: true,
    },
    {
      label: "Premios Entregues",
      value: String(stats.premios_entregues),
      caption: "Saidas registradas no recorte atual",
      icon: Sparkles,
    },
    {
      label: "Maquinas Ativas",
      value: String(stats.maquinas_ativas),
      caption: `${stats.total_maquinas} maquinas dentro do filtro atual`,
      icon: MonitorSmartphone,
    },
    {
      label: "Ticket Medio",
      value: `R$ ${stats.ticket_medio.toFixed(2)}`,
      caption: "Media por venda real",
      icon: CreditCard,
    },
  ];

  const scopeLabel = selectedMachine
    ? `${selectedMachine.nome || selectedMachine.id_hardware}`
    : selectedClient
      ? selectedClient.nome_empresa
      : isAdmin
        ? "Todos os clientes"
        : "Minhas maquinas";

  const exportClientesCsv = () => {
    const rows = [
      ["cliente", "maquinas", "maquinas_online", "faturamento", "ultima_atividade"],
      ...clientesResumo.map((item) => [
        item.cliente_nome,
        item.maquinas,
        item.maquinas_online,
        Number(item.total_faturado || 0).toFixed(2),
        item.ultima_atividade_em || "",
      ]),
    ];
    const csv = rows
      .map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `consolidado-clientes-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex min-h-full flex-col gap-4">
      <section className="app-panel flex flex-col gap-4 rounded-[30px] p-5 md:p-6">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative flex flex-1 items-center gap-3 rounded-full border border-[var(--color-border)] bg-white px-4 py-3">
            <Search size={18} className="text-[var(--color-text-soft)]" />
            <input
              value={filterSearch}
              onChange={(event) => setFilterSearch(event.target.value)}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
              placeholder="Buscar cliente, maquina ou localizacao"
              className="w-full bg-transparent text-sm text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-soft)]"
            />
            <span className="rounded-full bg-[var(--color-bg-muted)] px-3 py-1 text-xs font-semibold text-[var(--color-text-soft)]">
              Busca
            </span>
            {showSuggestions && searchSuggestions.length > 0 ? (
              <div className="absolute left-0 right-0 top-[calc(100%+10px)] z-20 overflow-hidden rounded-[24px] border border-[var(--color-border)] bg-white shadow-[0_18px_40px_rgba(22,44,28,0.12)]">
                {searchSuggestions.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className="flex w-full items-start justify-between gap-3 border-t border-[var(--color-border)] px-4 py-3 text-left first:border-t-0 hover:bg-[var(--color-bg-muted)]"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={item.action}
                  >
                    <div>
                      <div className="font-semibold text-[var(--color-text)]">{item.label}</div>
                      <div className="mt-1 text-sm text-[var(--color-text-soft)]">{item.helper}</div>
                    </div>
                    <ArrowUpRight size={16} className="text-[var(--color-text-soft)]" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-3 xl:justify-end">
            <div className="flex items-center gap-2">
              <button className="pill-button flex h-12 w-12 items-center justify-center">
                <Bell size={18} />
              </button>
              <button className="pill-button flex h-12 w-12 items-center justify-center">
                <ArrowUpRight size={18} />
              </button>
            </div>

            <div className="flex items-center gap-3 rounded-full border border-[var(--color-border)] bg-white px-3 py-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-lg font-bold text-[var(--color-primary)]">
                {user?.email?.[0]?.toUpperCase() || "C"}
              </div>
              <div>
                <div className="text-sm font-semibold text-[var(--color-text)]">
                  {isAdmin ? "Administrador" : "Operador"}
                </div>
                <div className="text-xs text-[var(--color-text-soft)]">{user?.email}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1.1fr_1.1fr_1.4fr_auto]">
          {isAdmin ? (
            <label className="flex items-center gap-3 rounded-[24px] border border-[var(--color-border)] bg-white px-4 py-3">
              <Filter size={18} className="text-[var(--color-text-soft)]" />
              <select
                value={selectedClientId}
                onChange={(event) => {
                  setSelectedClientId(event.target.value);
                  setSelectedMachineId("");
                }}
                className="w-full bg-transparent text-sm text-[var(--color-text)] outline-none"
              >
                <option value="">Todos os clientes</option>
                {filteredClientes.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.nome_empresa}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="flex items-center gap-3 rounded-[24px] border border-[var(--color-border)] bg-white px-4 py-3">
            <MonitorSmartphone size={18} className="text-[var(--color-text-soft)]" />
            <select
              value={selectedMachineId}
              onChange={(event) => setSelectedMachineId(event.target.value)}
              className="w-full bg-transparent text-sm text-[var(--color-text)] outline-none"
            >
              <option value="">{isAdmin ? "Todas as maquinas" : "Todas as minhas maquinas"}</option>
              {filteredMaquinas.map((maquina) => (
                <option key={maquina.id_hardware} value={maquina.id_hardware}>
                  {maquina.nome || maquina.id_hardware}
                  {maquina.localizacao ? ` - ${maquina.localizacao}` : ""}
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-[24px] border border-[var(--color-border)] bg-white px-4 py-3">
            <DateRangePicker value={dateRange} onChange={setDateRange} />
          </div>

          <button type="button" className="pill-button pill-button--primary px-5 py-3 font-semibold">
            Atualizar resumo
          </button>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.65fr_0.9fr]">
        <section className="space-y-4">
          <Card className="rounded-[30px] p-6 md:p-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--color-text-soft)]">
                  Dashboard
                </div>
                <h1 className="mt-3 text-4xl font-extrabold tracking-[-0.05em] text-[var(--color-text)] md:text-5xl">
                  Operacao em foco.
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--color-text-soft)] md:text-base">
                  Acompanhe receita, volume de premios e ritmo da operacao em um painel unico, com leitura mais limpa e decisao mais rapida.
                </p>
              </div>

              <div className="rounded-[26px] border border-[var(--color-border)] bg-[var(--color-bg-muted)] px-5 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-soft)]">
                  Recorte atual
                </div>
                <div className="mt-2 text-lg font-bold text-[var(--color-text)]">{scopeLabel}</div>
                <div className="mt-1 text-sm text-[var(--color-text-soft)]">
                  {selectedMachine
                    ? "Resumo filtrado por maquina especifica."
                    : selectedClient
                      ? "Resumo consolidado do cliente selecionado."
                      : "Resumo consolidado do painel no periodo informado."}
                </div>
              </div>
            </div>
          </Card>
          
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
            {statCards.map((item, index) => {
              const Icon = item.icon;
              const featured = item.featured;
              return (
                <Card
                  key={item.label}
                  className={`rounded-[28px] p-6 ${
                    featured
                      ? "bg-[linear-gradient(135deg,var(--color-primary)_0%,var(--color-primary-strong)_100%)] text-white shadow-[0_22px_40px_rgba(31,122,76,0.28)]"
                      : "bg-[var(--color-bg-card)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className={`text-sm font-semibold ${featured ? "text-white/72" : "text-[var(--color-text-soft)]"}`}>
                        {item.label}
                      </div>
                      <div className="mt-5 text-4xl font-extrabold tracking-[-0.05em]">{item.value}</div>
                    </div>
                    <div className={`flex h-11 w-11 items-center justify-center rounded-full ${featured ? "bg-white/16 text-white" : "bg-[var(--color-primary-soft)] text-[var(--color-primary)]"}`}>
                      <Icon size={18} />
                    </div>
                  </div>
                  <div className={`mt-4 text-sm ${featured ? "text-white/74" : "text-[var(--color-text-soft)]"}`}>{item.caption}</div>
                  <div className={`mt-6 h-1 rounded-full ${featured ? "bg-white/18" : "bg-[var(--color-bg-muted)]"}`}>
                    <div className={`h-1 rounded-full ${featured ? "bg-white" : "bg-[var(--color-primary)]"}`} style={{ width: `${58 + index * 9}%` }} />
                  </div>
                </Card>
              );
            })}
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <Card className="rounded-[30px]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xl font-bold text-[var(--color-text)]">Analise semanal</div>
                  <div className="mt-1 text-sm text-[var(--color-text-soft)]">Leitura compacta do movimento operacional.</div>
                </div>
                <span className="rounded-full bg-[var(--color-primary-soft)] px-4 py-2 text-sm font-semibold text-[var(--color-primary)]">
                  {loading ? "Sincronizando" : "Atualizado"}
                </span>
              </div>

              <div className="mt-6 h-[270px]">
                {loading ? (
                  <LoadingSpinner className="h-full" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} barCategoryGap={22}>
                      <CartesianGrid vertical={false} stroke="rgba(35, 57, 38, 0.08)" />
                      <XAxis dataKey="dia" tickLine={false} axisLine={false} tick={{ fill: "#6d7b6f", fontSize: 12, fontWeight: 600 }} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fill: "#6d7b6f", fontSize: 12 }} />
                      <Tooltip
                        cursor={{ fill: "rgba(31,122,76,0.06)" }}
                        contentStyle={{ borderRadius: "18px", border: "1px solid rgba(31,122,76,0.08)", boxShadow: "0 18px 40px rgba(22,44,28,0.12)" }}
                      />
                      <Bar dataKey="valor" radius={[18, 18, 18, 18]}>
                        {chartData.map((entry, index) => (
                          <Cell key={`${entry.dia}-${index}`} fill={index === 3 ? "#165636" : index === 2 ? "#5eb888" : "#d7dfd2"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>

            <Card className="rounded-[30px] bg-[linear-gradient(180deg,#ffffff_0%,#f6faf6_100%)]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xl font-bold text-[var(--color-text)]">Resumo de hoje</div>
                  <div className="mt-1 text-sm text-[var(--color-text-soft)]">Indicadores sinteticos para a operacao.</div>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                  <Sparkles size={18} />
                </div>
              </div>

              <div className="mt-8 grid gap-4">
                <div className="rounded-[24px] bg-[var(--color-bg-muted)] p-5">
                  <div className="text-sm font-semibold text-[var(--color-text-soft)]">Receita consolidada</div>
                  <div className="mt-3 text-3xl font-extrabold tracking-[-0.05em] text-[var(--color-text)]">R$ {stats.faturamento_total.toFixed(2)}</div>
                </div>
                <div className="rounded-[24px] border border-[var(--color-border)] p-5">
                  <div className="text-sm font-semibold text-[var(--color-text-soft)]">Maquinas online</div>
                  <div className="mt-4 h-3 rounded-full bg-[var(--color-bg-muted)]">
                    <div className="h-3 rounded-full bg-[linear-gradient(135deg,var(--color-primary),var(--color-primary-strong))]" style={{ width: `${Math.min(100, Math.max(6, stats.percentual_ativas))}%` }} />
                  </div>
                  <div className="mt-4 text-sm text-[var(--color-text-soft)]">
                    {stats.maquinas_ativas} de {stats.total_maquinas} maquinas reportando nos ultimos 3 minutos.
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </section>

        <section className="space-y-4">
          <Card
            className="rounded-[30px] p-6 shadow-[0_26px_50px_rgba(17,66,40,0.30)]"
            style={{ background: "linear-gradient(150deg, #0a2314 0%, #114228 55%, #165d38 100%)", color: "#ffffff" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.24em]" style={{ color: "rgba(255,255,255,0.6)" }}>
                  Painel rapido
                </div>
                <div className="mt-3 text-3xl font-extrabold tracking-[-0.05em]">{stats.percentual_ativas.toFixed(0)}%</div>
                <div className="mt-2 max-w-xs text-sm leading-6" style={{ color: "rgba(255,255,255,0.78)" }}>
                  Percentual atual de maquinas online no parque monitorado.
                </div>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.14)", color: "#ffffff" }}>
                <ArrowUpRight size={18} />
              </div>
            </div>

            <div className="mt-8 grid grid-cols-3 gap-3 text-sm">
              {[
                ["Faturamento", `R$ ${stats.faturamento_total.toFixed(0)}`],
                ["Ativas", stats.maquinas_ativas],
                ["Alertas", stats.alertas],
              ].map(([label, value]) => (
                <div key={label} className="rounded-[22px] p-4" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>
                  <div style={{ color: "rgba(255,255,255,0.66)" }}>{label}</div>
                  <div className="mt-3 text-xl font-bold">{value}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="rounded-[30px]">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xl font-bold text-[var(--color-text)]">Maquinas e status</div>
                <div className="mt-1 text-sm text-[var(--color-text-soft)]">Semaforo operacional e ultima atividade do recorte atual.</div>
              </div>
              <span className="rounded-full border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-text-soft)]">
                {machineStatusRows.length} itens
              </span>
            </div>
            <div className="mt-5 overflow-hidden rounded-[24px] border border-[var(--color-border)]">
              {machineStatusRows.length === 0 ? (
                <div className="px-5 py-8 text-sm text-[var(--color-text-soft)]">Nenhuma maquina encontrada para esse recorte.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-white">
                    <thead className="bg-[var(--color-bg-muted)] text-left text-xs uppercase tracking-[0.18em] text-[var(--color-text-soft)]">
                      <tr>
                        <th className="px-5 py-4">Maquina</th>
                        <th className="px-5 py-4">Status</th>
                        <th className="px-5 py-4">Ultima atividade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {machineStatusRows.map((maquina) => (
                        <tr key={maquina.id_hardware} className="border-t border-[var(--color-border)] text-sm text-[var(--color-text)]">
                          <td className="px-5 py-4">
                            <div className="font-semibold">{maquina.nome || maquina.id_hardware}</div>
                            <div className="mt-1 text-xs text-[var(--color-text-soft)]">{maquina.localizacao || maquina.id_hardware}</div>
                          </td>
                          <td className="px-5 py-4">
                            <span
                              className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold"
                              style={{
                                backgroundColor:
                                  maquina.status_operacional === "operando"
                                    ? "var(--color-primary-soft)"
                                    : maquina.status_operacional === "atencao"
                                      ? "#fff2d8"
                                      : "#fee2e2",
                                color:
                                  maquina.status_operacional === "operando"
                                    ? "var(--color-success)"
                                    : maquina.status_operacional === "atencao"
                                      ? "var(--color-warning)"
                                      : "var(--color-error)",
                              }}
                            >
                              {maquina.status_operacional === "operando"
                                ? "Verde"
                                : maquina.status_operacional === "atencao"
                                  ? "Amarelo"
                                  : "Vermelho"}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-[var(--color-text-soft)]">
                            {maquina.ultima_atividade_em
                              ? new Date(maquina.ultima_atividade_em).toLocaleString("pt-BR")
                              : "Sem atividade no periodo"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Card>

          {isAdmin ? (
            <Card className="rounded-[30px]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xl font-bold text-[var(--color-text)]">Resumo por cliente</div>
                  <div className="mt-1 text-sm text-[var(--color-text-soft)]">Consolidado financeiro e operacional por cliente.</div>
                </div>
                <button type="button" className="pill-button inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold" onClick={exportClientesCsv}>
                  <Download size={16} />
                  Exportar CSV
                </button>
              </div>
              <div className="mt-5 overflow-hidden rounded-[24px] border border-[var(--color-border)]">
                {clientesResumo.length === 0 ? (
                  <div className="px-5 py-8 text-sm text-[var(--color-text-soft)]">Nenhum cliente encontrado para esse recorte.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full bg-white">
                      <thead className="bg-[var(--color-bg-muted)] text-left text-xs uppercase tracking-[0.18em] text-[var(--color-text-soft)]">
                        <tr>
                          <th className="px-5 py-4">Cliente</th>
                          <th className="px-5 py-4">Maquinas</th>
                          <th className="px-5 py-4">Online</th>
                          <th className="px-5 py-4">Faturamento</th>
                          <th className="px-5 py-4">Ultima atividade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clientesResumo.map((item) => (
                          <tr key={item.cliente_id || item.cliente_nome} className="border-t border-[var(--color-border)] text-sm text-[var(--color-text)]">
                            <td className="px-5 py-4 font-semibold">{item.cliente_nome}</td>
                            <td className="px-5 py-4">{item.maquinas}</td>
                            <td className="px-5 py-4">{item.maquinas_online}</td>
                            <td className="px-5 py-4 font-semibold">R$ {Number(item.total_faturado || 0).toFixed(2)}</td>
                            <td className="px-5 py-4 text-[var(--color-text-soft)]">
                              {item.ultima_atividade_em ? new Date(item.ultima_atividade_em).toLocaleString("pt-BR") : "Sem atividade"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </Card>
          ) : null}

          <Card className="rounded-[30px]">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xl font-bold text-[var(--color-text)]">Fila operacional</div>
                <div className="mt-1 text-sm text-[var(--color-text-soft)]">Tarefas sugeridas para a proxima rodada.</div>
              </div>
              <span className="rounded-full border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-text-soft)]">
                {alerts.length} itens
              </span>
            </div>

            <div className="mt-5 space-y-3">
              {alerts.map((task) => (
                <div key={task.title} className="flex items-center justify-between gap-3 rounded-[22px] border border-[var(--color-border)] bg-white px-4 py-4">
                  <div>
                    <div className="font-semibold text-[var(--color-text)]">{task.title}</div>
                    <div className="mt-1 text-sm text-[var(--color-text-soft)]">Acao recomendada para manter o painel limpo e responsivo.</div>
                  </div>
                  <span className={`text-sm font-semibold ${task.tone === "error" ? "text-[var(--color-error)]" : task.tone === "warning" ? "text-[var(--color-warning)]" : "text-[var(--color-success)]"}`}>
                    {task.status}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}
