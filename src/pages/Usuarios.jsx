import { useEffect, useState } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import Modal from "../components/Modal";
import LoadingSpinner from "../components/LoadingSpinner";

export default function Usuarios() {
  const { user } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState({
    email: "",
    nome: "",
    role: "cliente",
    cliente_id: "",
  });
  const [saving, setSaving] = useState(false);

  const fetchUsuarios = async () => {
    setLoading(true);
    const res = await api.get("/usuarios");
    setUsuarios(res.data);
    setLoading(false);
  };

  useEffect(() => {
    if (user?.role !== "admin") return;
    fetchUsuarios();
  }, [user]);

  const handleEdit = (u) => {
    setEditUser(u);
    setForm({
      email: u.email,
      nome: u.nome,
      role: u.role,
      cliente_id: u.cliente_id,
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Tem certeza que deseja excluir este usuário?")) return;
    await api.delete(`/usuarios/${id}`);
    fetchUsuarios();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    if (editUser) {
      await api.put(`/usuarios/${editUser.id}`, form);
    } else {
      await api.post("/usuarios", form);
    }
    setShowModal(false);
    setForm({ email: "", nome: "", role: "cliente", cliente_id: "" });
    setEditUser(null);
    fetchUsuarios();
    setSaving(false);
  };

  if (user?.role !== "admin")
    return <div className="p-8 text-white">Acesso restrito.</div>;

  return (
    <div className="p-8 bg-bgmain min-h-screen">
      <h1 className="text-2xl text-white mb-6 flex items-center gap-4">
        Usuários
        <button
          className="bg-primary text-white px-4 py-2 rounded hover:bg-blue-600 transition text-base"
          onClick={() => {
            setShowModal(true);
            setEditUser(null);
            setForm({ email: "", nome: "", role: "cliente", cliente_id: "" });
          }}
        >
          Novo Usuário
        </button>
      </h1>
      <div className="overflow-x-auto">
        {loading ? (
          <LoadingSpinner className="h-32" />
        ) : (
          <table className="min-w-full bg-bgdark rounded-lg">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left text-white">ID</th>
                <th className="px-4 py-2 text-left text-white">Nome</th>
                <th className="px-4 py-2 text-left text-white">E-mail</th>
                <th className="px-4 py-2 text-left text-white">Perfil</th>
                <th className="px-4 py-2 text-left text-white">Cliente</th>
                <th className="px-4 py-2 text-left text-white">Ações</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr
                  key={u.id}
                  className="border-b border-bgdarker hover:bg-bgdarker/50"
                >
                  <td className="px-4 py-2 text-white">{u.id}</td>
                  <td className="px-4 py-2 text-white">{u.nome}</td>
                  <td className="px-4 py-2 text-white">{u.email}</td>
                  <td className="px-4 py-2 text-white">{u.role}</td>
                  <td className="px-4 py-2 text-white">{u.cliente_id}</td>
                  <td className="px-4 py-2 text-white flex gap-2">
                    {user?.role === "admin" && (
                      <>
                        <button
                          className="bg-primary px-2 py-1 rounded text-white"
                          onClick={() => handleEdit(u)}
                        >
                          Editar
                        </button>
                        <button
                          className="bg-error px-2 py-1 rounded text-white"
                          onClick={() => handleDelete(u.id)}
                        >
                          Excluir
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Modal
        open={showModal}
        onClose={() => {
          setShowModal(false);
          setEditUser(null);
        }}
      >
        <h2 className="text-xl text-white mb-4">
          {editUser ? "Editar Usuário" : "Novo Usuário"}
        </h2>
        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          <input
            className="p-2 rounded bg-bgmain text-white border border-slate-700 focus:outline-primary"
            placeholder="Nome"
            value={form.nome}
            onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
            required
          />
          <input
            className="p-2 rounded bg-bgmain text-white border border-slate-700 focus:outline-primary"
            placeholder="E-mail"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            required
          />
          <select
            className="p-2 rounded bg-bgmain text-white border border-slate-700 focus:outline-primary"
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
          >
            <option value="cliente">Cliente</option>
            <option value="admin">Admin</option>
          </select>
          <input
            className="p-2 rounded bg-bgmain text-white border border-slate-700 focus:outline-primary"
            placeholder="Cliente ID"
            value={form.cliente_id}
            onChange={(e) =>
              setForm((f) => ({ ...f, cliente_id: e.target.value }))
            }
            required={form.role === "cliente"}
          />
          <button
            type="submit"
            className="bg-primary text-white px-4 py-2 rounded hover:bg-blue-600 transition"
            disabled={saving}
          >
            {saving ? "Salvando..." : editUser ? "Salvar" : "Criar"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
