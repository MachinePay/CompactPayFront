import { useEffect, useState } from "react";
import api from "../api/axios";
import { CheckCircle, XCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import LoadingSpinner from "../components/LoadingSpinner";
import DateRangePicker from "../components/DateRangePicker";
import Modal from "../components/Modal";
import dayjs from "dayjs";

export default function Maquinas() {
  const { user } = useAuth();
  const [maquinas, setMaquinas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [periodo, setPeriodo] = useState("mes");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    id_hardware: "",
    nome: "",
    localizacao: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const params = [];
    if (user.cliente_id != null) params.push(`cliente_id=${user.cliente_id}`);
    if (periodo) params.push(`periodo=${periodo}`);
    if (dateRange.start) params.push(`data_inicio=${dateRange.start}`);
    if (dateRange.end) params.push(`data_fim=${dateRange.end}`);
    const paramStr = params.length ? `?${params.join("&")}` : "";
    api
      .get(`/maquinas${paramStr}`)
      .then((res) => setMaquinas(res.data))
      .finally(() => setLoading(false));
  }, [user, periodo, dateRange]);

  return (
    <div className="p-8 bg-bgmain min-h-screen">
      <h1 className="text-2xl text-white mb-6 flex items-center gap-4">
        Lista de Máquinas
        {user?.role === "admin" && (
          <button
            className="bg-primary text-white px-4 py-2 rounded hover:bg-blue-600 transition text-base"
            onClick={() => setShowModal(true)}
          >
            Cadastrar Máquina
          </button>
        )}
      </h1>
      <div className="flex flex-col md:flex-row md:items-center md:gap-4 gap-2 mb-4">
        <label className="text-white flex items-center gap-2">
          Período:
          <select
            className="bg-bgcard text-white rounded p-2 border border-slate-700"
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
          >
            <option value="dia">Dia</option>
            <option value="mes">Mês</option>
          </select>
        </label>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>
      <Modal open={showModal} onClose={() => setShowModal(false)}>
        <h2 className="text-xl text-white mb-4">Cadastrar Máquina</h2>
        <form
          className="flex flex-col gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            try {
              await api.post("/maquinas", {
                ...form,
                cliente_id: user.cliente_id,
              });
              setShowModal(false);
              setForm({ id_hardware: "", nome: "", localizacao: "" });
              // Recarregar lista
              setLoading(true);
              const params = [];
              if (user.cliente_id != null) {
                params.push(`cliente_id=${user.cliente_id}`);
              }
              if (periodo) params.push(`periodo=${periodo}`);
              if (dateRange.start)
                params.push(`data_inicio=${dateRange.start}`);
              if (dateRange.end) params.push(`data_fim=${dateRange.end}`);
              const paramStr = params.length ? `?${params.join("&")}` : "";
              const res = await api.get(`/maquinas${paramStr}`);
              setMaquinas(res.data);
            } finally {
              setSaving(false);
            }
          }}
        >
          <input
            className="p-2 rounded bg-bgmain text-white border border-slate-700 focus:outline-primary"
            placeholder="ID Hardware"
            value={form.id_hardware}
            onChange={(e) =>
              setForm((f) => ({ ...f, id_hardware: e.target.value }))
            }
            required
          />
          <input
            className="p-2 rounded bg-bgmain text-white border border-slate-700 focus:outline-primary"
            placeholder="Nome"
            value={form.nome}
            onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
            required
          />
          <input
            className="p-2 rounded bg-bgmain text-white border border-slate-700 focus:outline-primary"
            placeholder="Localização"
            value={form.localizacao}
            onChange={(e) =>
              setForm((f) => ({ ...f, localizacao: e.target.value }))
            }
          />
          <button
            type="submit"
            className="bg-primary text-white px-4 py-2 rounded hover:bg-blue-600 transition"
            disabled={saving}
          >
            {saving ? "Salvando..." : "Cadastrar"}
          </button>
        </form>
      </Modal>
      <div className="overflow-x-auto">
        {loading ? (
          <LoadingSpinner className="h-32" />
        ) : (
          <table className="min-w-full bg-bgdark rounded-lg">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left text-white">ID</th>
                <th className="px-4 py-2 text-left text-white">Hardware</th>
                <th className="px-4 py-2 text-left text-white">Nome</th>
                <th className="px-4 py-2 text-left text-white">Status</th>
                <th className="px-4 py-2 text-left text-white">Localização</th>
                <th className="px-4 py-2 text-left text-white">Faturamento</th>
              </tr>
            </thead>
            <tbody>
              {maquinas.map((m) => {
                // Lógica de status real-time: se ultimo_sinal há menos de 3 minutos, está online
                let online = false;
                if (m.ultimo_sinal) {
                  const diff = dayjs().diff(dayjs(m.ultimo_sinal), "minute");
                  online = diff < 3;
                }
                return (
                  <tr
                    key={m.id_hardware}
                    className="border-b border-bgdarker hover:bg-bgdarker/50"
                  >
                    <td className="px-4 py-2 text-white">{m.id_hardware}</td>
                    <td className="px-4 py-2 text-white">
                      {m.id_hardware || "--"}
                    </td>
                    <td className="px-4 py-2 text-white">{m.nome}</td>
                    <td className="px-4 py-2">
                      {online ? (
                        <span className="flex items-center text-success gap-1">
                          <CheckCircle size={18} /> Online
                        </span>
                      ) : (
                        <span className="flex items-center text-error gap-1">
                          <XCircle size={18} /> Offline
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-white">
                      {m.localizacao || "--"}
                    </td>
                    <td className="px-4 py-2 text-white">
                      R${" "}
                      {m.faturamento?.toFixed ? m.faturamento.toFixed(2) : "--"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
