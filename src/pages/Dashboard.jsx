import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Bell,
  CreditCard,
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

import Card from "../components/Card";
import DateRangePicker from "../components/DateRangePicker";
import LoadingSpinner from "../components/LoadingSpinner";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

export default function Dashboard() {
  const { user } = useAuth();
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
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const params = [];
    if (dateRange.start) params.push(`data_inicio=${dateRange.start}`);
    if (dateRange.end) params.push(`data_fim=${dateRange.end}`);
    if (!dateRange.start || !dateRange.end) params.push("periodo=mes");
    const paramStr = params.length ? `?${params.join("&")}` : "";

    api
      .get(`/dashboard/overview${paramStr}`)
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
        setChartData(data?.chart_data ?? []);
        setAlerts(data?.alerts ?? []);
      })
      .finally(() => setLoading(false));
  }, [user, dateRange]);

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
      caption: "Saidas registradas hoje",
      icon: Sparkles,
    },
    {
      label: "Maquinas Ativas",
      value: String(stats.maquinas_ativas),
      caption: `${stats.total_maquinas} maquinas cadastradas no painel`,
      icon: MonitorSmartphone,
    },
    {
      label: "Ticket Medio",
      value: `R$ ${stats.ticket_medio.toFixed(2)}`,
      caption: "Media por evento monitorado",
      icon: CreditCard,
    },
  ];

  return (
    <div className="flex min-h-full flex-col gap-4">
      <section className="app-panel flex flex-col gap-4 rounded-[30px] p-5 md:p-6 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-1 items-center gap-3 rounded-full border border-[var(--color-border)] bg-white px-4 py-3">
          <Search size={18} className="text-[var(--color-text-soft)]" />
          <input
            readOnly
            value="Pesquisar tarefa, cliente ou maquina"
            className="w-full bg-transparent text-sm text-[var(--color-text-soft)] outline-none"
          />
          <span className="rounded-full bg-[var(--color-bg-muted)] px-3 py-1 text-xs font-semibold text-[var(--color-text-soft)]">
            Ctrl F
          </span>
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
                {user?.role === "admin" ? "Administrador" : "Operador"}
              </div>
              <div className="text-xs text-[var(--color-text-soft)]">{user?.email}</div>
            </div>
          </div>
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
                  Acompanhe receita, volume de premios e ritmo da operacao em um
                  painel unico, com leitura mais limpa e decisao mais rapida.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <DateRangePicker value={dateRange} onChange={setDateRange} />
                <button className="pill-button pill-button--primary px-5 py-3 font-semibold">
                  Atualizar resumo
                </button>
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
                      <div
                        className={`text-sm font-semibold ${
                          featured ? "text-white/70" : "text-[var(--color-text-soft)]"
                        }`}
                      >
                        {item.label}
                      </div>
                      <div className="mt-5 text-4xl font-extrabold tracking-[-0.05em]">
                        {item.value}
                      </div>
                    </div>
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-full ${
                        featured
                          ? "bg-white/16 text-white"
                          : "bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
                      }`}
                    >
                      <Icon size={18} />
                    </div>
                  </div>
                  <div
                    className={`mt-4 text-sm ${
                      featured ? "text-white/75" : "text-[var(--color-text-soft)]"
                    }`}
                  >
                    {item.caption}
                  </div>
                  <div
                    className={`mt-6 h-1 rounded-full ${
                      featured ? "bg-white/18" : "bg-[var(--color-bg-muted)]"
                    }`}
                  >
                    <div
                      className={`h-1 rounded-full ${
                        featured ? "bg-white" : "bg-[var(--color-primary)]"
                      }`}
                      style={{ width: `${58 + index * 9}%` }}
                    />
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
                  <div className="mt-1 text-sm text-[var(--color-text-soft)]">
                    Leitura compacta do movimento operacional.
                  </div>
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
                      <XAxis
                        dataKey="dia"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#6d7b6f", fontSize: 12, fontWeight: 600 }}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#6d7b6f", fontSize: 12 }}
                      />
                      <Tooltip
                        cursor={{ fill: "rgba(31,122,76,0.06)" }}
                        contentStyle={{
                          borderRadius: "18px",
                          border: "1px solid rgba(31,122,76,0.08)",
                          boxShadow: "0 18px 40px rgba(22,44,28,0.12)",
                        }}
                      />
                      <Bar dataKey="valor" radius={[18, 18, 18, 18]}>
                        {chartData.map((entry, index) => (
                          <Cell
                            key={`${entry.dia}-${index}`}
                            fill={index === 3 ? "#165636" : index === 2 ? "#5eb888" : "#d7dfd2"}
                          />
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
                  <div className="mt-1 text-sm text-[var(--color-text-soft)]">
                    Indicadores sinteticos para a operacao.
                  </div>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                  <Sparkles size={18} />
                </div>
              </div>

              <div className="mt-8 grid gap-4">
                <div className="rounded-[24px] bg-[var(--color-bg-muted)] p-5">
                  <div className="text-sm font-semibold text-[var(--color-text-soft)]">
                    Receita consolidada
                  </div>
                  <div className="mt-3 text-3xl font-extrabold tracking-[-0.05em] text-[var(--color-text)]">
                    R$ {stats.faturamento_total.toFixed(2)}
                  </div>
                </div>
                <div className="rounded-[24px] border border-[var(--color-border)] p-5">
                  <div className="text-sm font-semibold text-[var(--color-text-soft)]">
                    Maquinas online
                  </div>
                  <div className="mt-4 h-3 rounded-full bg-[var(--color-bg-muted)]">
                    <div
                      className="h-3 rounded-full bg-[linear-gradient(135deg,var(--color-primary),var(--color-primary-strong))]"
                      style={{
                        width: `${Math.min(100, Math.max(6, stats.percentual_ativas))}%`,
                      }}
                    />
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
          <Card className="rounded-[30px] bg-[linear-gradient(150deg,#0a2314_0%,#114228_55%,#165d38_100%)] p-6 text-white shadow-[0_26px_50px_rgba(17,66,40,0.30)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.24em] text-white/55">
                  Painel rapido
                </div>
                <div className="mt-3 text-3xl font-extrabold tracking-[-0.05em]">
                  {stats.percentual_ativas.toFixed(0)}%
                </div>
                <div className="mt-2 max-w-xs text-sm leading-6 text-white/72">
                  Percentual atual de maquinas online no parque monitorado.
                </div>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/12 text-white">
                <ArrowUpRight size={18} />
              </div>
            </div>

            <div className="mt-8 grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-[22px] bg-white/8 p-4">
                <div className="text-white/58">Faturamento</div>
                <div className="mt-3 text-xl font-bold">R$ {stats.faturamento_total.toFixed(0)}</div>
              </div>
              <div className="rounded-[22px] bg-white/8 p-4">
                <div className="text-white/58">Ativas</div>
                <div className="mt-3 text-xl font-bold">{stats.maquinas_ativas}</div>
              </div>
              <div className="rounded-[22px] bg-white/8 p-4">
                <div className="text-white/58">Alertas</div>
                <div className="mt-3 text-xl font-bold">{stats.alertas}</div>
              </div>
            </div>
          </Card>

          <Card className="rounded-[30px]">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xl font-bold text-[var(--color-text)]">Fila operacional</div>
                <div className="mt-1 text-sm text-[var(--color-text-soft)]">
                  Tarefas sugeridas para a proxima rodada.
                </div>
              </div>
              <span className="rounded-full border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-text-soft)]">
                {alerts.length} itens
              </span>
            </div>

            <div className="mt-5 space-y-3">
              {alerts.map((task) => (
                <div
                  key={task.title}
                  className="flex items-center justify-between gap-3 rounded-[22px] border border-[var(--color-border)] bg-white px-4 py-4"
                >
                  <div>
                    <div className="font-semibold text-[var(--color-text)]">{task.title}</div>
                    <div className="mt-1 text-sm text-[var(--color-text-soft)]">
                      Acao recomendada para manter o painel limpo e responsivo.
                    </div>
                  </div>
                  <span
                    className={`text-sm font-semibold ${
                      task.tone === "error"
                        ? "text-[var(--color-error)]"
                        : task.tone === "warning"
                          ? "text-[var(--color-warning)]"
                          : "text-[var(--color-success)]"
                    }`}
                  >
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
