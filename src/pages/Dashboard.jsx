import Card from "../components/Card";
import { useEffect, useState } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import DateRangePicker from "../components/DateRangePicker";
import LoadingSpinner from "../components/LoadingSpinner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export default function Dashboard() {
  const { user } = useAuth();

  const [stats, setStats] = useState({
    faturamento_total_dia: 0,
    premios_entregues: 0,
  });
  const [chartData, setChartData] = useState([]);
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const params = [];
    if (dateRange.start) params.push(`data_inicio=${dateRange.start}`);
    if (dateRange.end) params.push(`data_fim=${dateRange.end}`);
    if (user.cliente_id != null) params.push(`cliente_id=${user.cliente_id}`);
    const paramStr = params.length ? `?${params.join("&")}` : "";
    Promise.all([
      api.get(`/dashboard/stats${paramStr}`),
      api.get(`/faturamento${paramStr}`),
    ])
      .then(([statsRes, faturamentoRes]) => {
        setStats(statsRes.data);
        setChartData([
          { dia: "Seg", fisico: 120, digital: 80 },
          { dia: "Ter", fisico: 90, digital: 60 },
          { dia: "Qua", fisico: 150, digital: 100 },
          { dia: "Qui", fisico: 80, digital: 120 },
          { dia: "Sex", fisico: 200, digital: 140 },
        ]);
      })
      .finally(() => setLoading(false));
  }, [user, dateRange]);

  return (
    <div className="flex flex-col gap-6 p-8 bg-bgmain min-h-screen">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <div className="text-white text-lg">Faturamento Hoje</div>
          <div className="text-2xl text-success font-bold">
            R$ {stats.faturamento_total_dia?.toFixed(2)}
          </div>
        </Card>
        <Card>
          <div className="text-white text-lg">Prêmios Entregues</div>
          <div className="text-2xl text-primary font-bold">
            {stats.premios_entregues}
          </div>
        </Card>
        <Card>
          <div className="text-white text-lg">Máquinas Online</div>
          <div className="text-2xl text-success font-bold">
            {/* Adapte para mostrar máquinas online */}--
          </div>
        </Card>
      </div>
      <Card className="mt-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-4">
          <span className="text-white">Faturamento da Semana</span>
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </div>
        {loading ? (
          <LoadingSpinner className="h-32" />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <XAxis dataKey="dia" stroke="#fff" />
              <YAxis stroke="#fff" />
              <Tooltip />
              <Legend />
              <Bar dataKey="fisico" fill="#f59e42" name="Físico (Moeda)" />
              <Bar
                dataKey="digital"
                fill="#3B82F6"
                name="Digital (Pix/Cartão)"
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
}
