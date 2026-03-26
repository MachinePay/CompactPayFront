import { useEffect, useState } from "react";
import { Plus, ShieldCheck, Trash2, UserRoundCog, Users } from "lucide-react";

import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import Modal from "../components/Modal";
import LoadingSpinner from "../components/LoadingSpinner";
import Button from "../components/Button";

export default function Usuarios() {
  const { user } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState({
    email: "",
    nome: "",
    password: "",
    role: "cliente",
  });
  const [saving, setSaving] = useState(false);

  const fetchUsuarios = async () => {
    setLoading(true);
    try {
      const res = await api.get("/usuarios");
      setUsuarios(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role !== "admin") return;
    fetchUsuarios();
  }, [user]);

  const resetForm = () => {
    setForm({
      email: "",
      nome: "",
      password: "",
      role: "cliente",
    });
  };

  const handleEdit = (currentUser) => {
    setEditUser(currentUser);
    setForm({
      email: currentUser.email,
      nome: currentUser.nome || "",
      password: "",
      role: currentUser.role,
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Tem certeza que deseja excluir este usuario?")) return;
    await api.delete(`/usuarios/${id}`);
    fetchUsuarios();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      cliente_id: null,
    };

    try {
      if (editUser) {
        await api.put(`/usuarios/${editUser.id}`, payload);
      } else {
        await api.post("/usuarios", payload);
      }
      setShowModal(false);
      resetForm();
      setEditUser(null);
      fetchUsuarios();
    } finally {
      setSaving(false);
    }
  };

  if (user?.role !== "admin") {
    return <div className="p-8 text-[var(--color-text)]">Acesso restrito.</div>;
  }

  const adminCount = usuarios.filter((item) => item.role === "admin").length;
  const clientCount = usuarios.filter((item) => item.role === "cliente").length;

  return (
    <div className="flex min-h-full flex-col gap-4">
      <SectionHeader
        title="Usuarios"
        description="Gerencie acessos administrativos e operadores clientes em um painel claro, rapido e organizado."
        actions={
          <Button
            className="justify-center"
            onClick={() => {
              setShowModal(true);
              setEditUser(null);
              resetForm();
            }}
          >
            <Plus size={18} />
            Novo usuario
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          icon={<Users size={18} />}
          label="Usuarios ativos"
          value={String(usuarios.length)}
          helper="Total de contas visiveis no painel"
        />
        <SummaryCard
          icon={<ShieldCheck size={18} />}
          label="Administradores"
          value={String(adminCount)}
          helper="Acesso total ao sistema"
          featured
        />
        <SummaryCard
          icon={<UserRoundCog size={18} />}
          label="Clientes"
          value={String(clientCount)}
          helper="Operadores vinculados a clientes"
        />
      </div>

      <section className="app-panel rounded-[30px] p-5 md:p-6">
        <div className="overflow-hidden rounded-[26px] border border-[var(--color-border)] bg-white">
          {loading ? (
            <LoadingSpinner className="h-40" />
          ) : usuarios.length === 0 ? (
            <div className="flex h-40 items-center justify-center px-6 text-center text-sm text-[var(--color-text-soft)]">
              Nenhum usuario cadastrado ainda. Crie um administrador ou operador para comecar.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-[var(--color-bg-muted)] text-left text-xs uppercase tracking-[0.18em] text-[var(--color-text-soft)]">
                  <tr>
                    <th className="px-5 py-4 whitespace-nowrap">Nome</th>
                    <th className="px-5 py-4 whitespace-nowrap">Email</th>
                    <th className="px-5 py-4 whitespace-nowrap">Perfil</th>
                    <th className="px-5 py-4 whitespace-nowrap">Cliente</th>
                    <th className="px-5 py-4 whitespace-nowrap">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((item) => (
                    <tr
                      key={item.id}
                      className="border-t border-[var(--color-border)] text-sm text-[var(--color-text)]"
                    >
                      <td className="px-5 py-4 min-w-[180px]">
                        <div className="font-semibold">{item.nome || "Sem nome"}</div>
                        <div className="mt-1 text-xs text-[var(--color-text-soft)]">
                          ID interno #{item.id}
                        </div>
                      </td>
                      <td className="px-5 py-4 min-w-[220px] text-[var(--color-text-soft)]">{item.email}</td>
                      <td className="px-5 py-4 min-w-[120px]">
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-2 text-xs font-semibold ${
                            item.role === "admin"
                              ? "bg-[var(--color-primary-soft)] text-[var(--color-success)]"
                              : "bg-[var(--color-bg-muted)] text-[var(--color-text)]"
                          }`}
                        >
                          {item.role}
                        </span>
                      </td>
                      <td className="px-5 py-4 min-w-[110px] text-[var(--color-text-soft)]">
                        {item.cliente_id ?? "--"}
                      </td>
                      <td className="px-5 py-4 min-w-[190px]">
                        <div className="flex flex-wrap gap-2">
                          <button
                            className="pill-button inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold"
                            onClick={() => handleEdit(item)}
                            type="button"
                          >
                            <UserRoundCog size={15} />
                            Editar
                          </button>
                          <button
                            className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-[var(--color-error)] transition hover:bg-rose-100"
                            onClick={() => handleDelete(item.id)}
                            type="button"
                          >
                            <Trash2 size={15} />
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <Modal
        open={showModal}
        onClose={() => {
          setShowModal(false);
          setEditUser(null);
        }}
      >
        <div className="space-y-5">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--color-text-soft)]">
              Controle de acesso
            </div>
            <h2 className="mt-2 text-3xl font-extrabold tracking-[-0.04em] text-[var(--color-text)]">
              {editUser ? "Editar usuario" : "Novo usuario"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-soft)]">
              Defina perfil, email e cliente vinculado para manter o acesso organizado.
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nome">
                <input
                  className="w-full rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-4 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
                  placeholder="Nome completo do usuario"
                  value={form.nome}
                  onChange={(e) => setForm((current) => ({ ...current, nome: e.target.value }))}
                />
              </Field>

              <Field label="E-mail">
                <input
                  className="w-full rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-4 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
                  placeholder="usuario@compactpay.com.br"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))}
                  required
                />
              </Field>

              <Field label={editUser ? "Nova senha (opcional)" : "Senha"}>
                <input
                  className="w-full rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-4 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
                  placeholder={editUser ? "Atualize somente se precisar" : "Digite a senha de acesso"}
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((current) => ({ ...current, password: e.target.value }))}
                  required={!editUser}
                />
              </Field>

              <Field label="Perfil">
                <select
                  className="w-full rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-4 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
                  value={form.role}
                  onChange={(e) => setForm((current) => ({ ...current, role: e.target.value }))}
                >
                  <option value="cliente">Cliente</option>
                  <option value="admin">Admin</option>
                </select>
              </Field>
            </div>

            {form.role === "cliente" ? (
              <div className="rounded-[22px] bg-[var(--color-bg-muted)] px-4 py-4 text-sm leading-6 text-[var(--color-text-soft)]">
                O cliente vinculado sera criado automaticamente pelo sistema ao salvar este usuario.
              </div>
            ) : null}

            <Button type="submit" className="w-full justify-center" disabled={saving}>
              {saving ? "Salvando usuario..." : editUser ? "Salvar alteracoes" : "Criar usuario"}
            </Button>
          </form>
        </div>
      </Modal>
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
        <div className="flex flex-wrap items-center gap-3">{actions}</div>
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

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-[var(--color-text)]">
        {label}
      </span>
      {children}
    </label>
  );
}
