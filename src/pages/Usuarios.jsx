import { useEffect, useState } from "react";
import { CheckCircle2, Link, Plus, RefreshCcw, ShieldCheck, Trash2, UserRoundCog, Users, XCircle } from "lucide-react";

import api, { getApiErrorMessage } from "../api/axios";
import { useAuth } from "../context/useAuth";
import Modal from "../components/Modal";
import LoadingSpinner from "../components/LoadingSpinner";
import Button from "../components/Button";
import ConfirmModal from "../components/ConfirmModal";

const brazilStates = [
  "Acre",
  "Alagoas",
  "Amapá",
  "Amazonas",
  "Bahia",
  "Ceará",
  "Distrito Federal",
  "Espírito Santo",
  "Goiás",
  "Maranhão",
  "Mato Grosso",
  "Mato Grosso do Sul",
  "Minas Gerais",
  "Paraná",
  "Paraíba",
  "Pará",
  "Pernambuco",
  "Piauí",
  "Rio Grande do Norte",
  "Rio Grande do Sul",
  "Rio de Janeiro",
  "Rondônia",
  "Roraima",
  "Santa Catarina",
  "Sergipe",
  "São Paulo",
  "Tocantins",
];

export default function Usuarios() {
  const { user } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteUser, setDeleteUser] = useState(null);
  const [deletingUser, setDeletingUser] = useState(false);
  const [validatingClienteId, setValidatingClienteId] = useState(null);
  const [mpValidation, setMpValidation] = useState(null);
  const [form, setForm] = useState({
    email: "",
    nome: "",
    telefone: "",
    cpf: "",
    cnpj: "",
    endereco_rua: "",
    endereco_numero: "",
    endereco_cidade: "",
    endereco_estado: "São Paulo",
    endereco_latitude: "",
    endereco_longitude: "",
    password: "",
    role: "cliente",
    cliente_mercado_pago: false,
    cliente_pagbank: false,
    cliente_s6pay: false,
    mp_public_key: "",
    mp_access_token: "",
    mp_client_id: "",
    mp_client_secret: "",
    mp_user_id: "",
    mp_pos_category: "7994",
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
      telefone: "",
      cpf: "",
      cnpj: "",
      endereco_rua: "",
      endereco_numero: "",
      endereco_cidade: "",
      endereco_estado: "São Paulo",
      endereco_latitude: "",
      endereco_longitude: "",
      password: "",
      role: "cliente",
      cliente_mercado_pago: false,
      cliente_pagbank: false,
      cliente_s6pay: false,
      mp_public_key: "",
      mp_access_token: "",
      mp_client_id: "",
      mp_client_secret: "",
      mp_user_id: "",
      mp_pos_category: "7994",
    });
  };

  const handleEdit = (currentUser) => {
    setEditUser(currentUser);
    setForm({
      email: currentUser.email,
      nome: currentUser.nome || "",
      telefone: currentUser.telefone || "",
      cpf: currentUser.cpf || "",
      cnpj: currentUser.cnpj || "",
      endereco_rua: currentUser.endereco_rua || "",
      endereco_numero: currentUser.endereco_numero || "",
      endereco_cidade: currentUser.endereco_cidade || "",
      endereco_estado: currentUser.endereco_estado || "São Paulo",
      endereco_latitude: currentUser.endereco_latitude ?? "",
      endereco_longitude: currentUser.endereco_longitude ?? "",
      password: "",
      role: currentUser.role,
      cliente_mercado_pago: Boolean(
        currentUser.cliente_mercado_pago ||
        currentUser.mp_configurado ||
          currentUser.mp_public_key ||
          currentUser.mp_access_token ||
          currentUser.mp_client_id ||
          currentUser.mp_user_id,
      ),
      cliente_pagbank: Boolean(currentUser.cliente_pagbank),
      cliente_s6pay: Boolean(currentUser.cliente_s6pay),
      mp_public_key: currentUser.mp_public_key || "",
      mp_access_token: currentUser.mp_access_token || "",
      mp_client_id: currentUser.mp_client_id || "",
      mp_client_secret: currentUser.mp_client_secret || "",
      mp_user_id: currentUser.mp_user_id || "",
      mp_pos_category: currentUser.mp_pos_category ?? "7994",
    });
    setShowModal(true);
  };

  const handleDelete = async () => {
    if (!deleteUser) return;
    setDeletingUser(true);
    try {
      await api.delete(`/usuarios/${deleteUser.id}`);
      setDeleteUser(null);
      fetchUsuarios();
    } finally {
      setDeletingUser(false);
    }
  };

  const handleConnectMercadoPago = async (clienteId) => {
    if (!clienteId) return;
    const { data } = await api.get(`/mercado-pago/oauth/url?cliente_id=${clienteId}`);
    window.location.href = data.url;
  };

  const handleValidateMercadoPago = async (cliente) => {
    if (!cliente?.cliente_id) return;
    setValidatingClienteId(cliente.cliente_id);
    try {
      const { data } = await api.get(`/mercado-pago/clientes/${cliente.cliente_id}/validacao`);
      setMpValidation(data);
      await fetchUsuarios();
    } catch (error) {
      setMpValidation({
        ok: false,
        cliente_id: cliente.cliente_id,
        cliente_nome: cliente.nome || cliente.email,
        checks: [
          {
            key: "erro",
            label: "Validacao Mercado Pago",
            ok: false,
            message: getApiErrorMessage(error, "Nao foi possivel validar o Mercado Pago."),
          },
        ],
      });
    } finally {
      setValidatingClienteId(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      endereco_latitude: form.endereco_latitude === "" ? null : Number(form.endereco_latitude),
      endereco_longitude: form.endereco_longitude === "" ? null : Number(form.endereco_longitude),
      mp_public_key: form.cliente_mercado_pago ? form.mp_public_key : "",
      mp_access_token: form.cliente_mercado_pago ? form.mp_access_token : "",
      mp_client_id: form.cliente_mercado_pago ? form.mp_client_id : "",
      mp_client_secret: form.cliente_mercado_pago ? form.mp_client_secret : "",
      mp_user_id: form.cliente_mercado_pago ? form.mp_user_id : "",
      mp_pos_category: form.cliente_mercado_pago && form.mp_pos_category !== "" ? Number(form.mp_pos_category) : null,
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
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredUsuarios = usuarios.filter((item) => {
    if (!normalizedSearch) return true;
    return [
      item.nome,
      item.email,
      item.role,
      item.cliente_id,
      item.mp_configurado ? "configurado" : "pendente",
    ]
      .filter((value) => value !== null && value !== undefined)
      .some((value) => String(value).toLowerCase().includes(normalizedSearch));
  });

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
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-semibold text-[var(--color-text)]">Buscar usuario</div>
            <div className="mt-1 text-xs text-[var(--color-text-soft)]">
              Filtre por nome, email, perfil, cliente ou status Mercado Pago.
            </div>
          </div>
          <input
            className="w-full rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-3 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] md:max-w-md"
            placeholder="Digite para filtrar usuarios..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
        <div className="overflow-hidden rounded-[26px] border border-[var(--color-border)] bg-white">
          {loading ? (
            <LoadingSpinner className="h-40" />
          ) : usuarios.length === 0 ? (
            <div className="flex h-40 items-center justify-center px-6 text-center text-sm text-[var(--color-text-soft)]">
              Nenhum usuario cadastrado ainda. Crie um administrador ou operador para comecar.
            </div>
          ) : filteredUsuarios.length === 0 ? (
            <div className="flex h-40 items-center justify-center px-6 text-center text-sm text-[var(--color-text-soft)]">
              Nenhum usuario encontrado para "{searchTerm}".
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
                    <th className="px-5 py-4 whitespace-nowrap">Mercado Pago</th>
                    <th className="px-5 py-4 whitespace-nowrap">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsuarios.map((item) => (
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
                      <td className="px-5 py-4 min-w-[150px]">
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-2 text-xs font-semibold ${
                            item.mp_configurado
                              ? "bg-[var(--color-primary-soft)] text-[var(--color-success)]"
                              : "bg-amber-50 text-[var(--color-warning)]"
                          }`}
                        >
                          {item.mp_configurado ? "Configurado" : "Pendente"}
                        </span>
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
                          {item.role === "cliente" ? (
                            <>
                              <button
                                className="pill-button inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold"
                                onClick={() => handleConnectMercadoPago(item.cliente_id)}
                                type="button"
                                disabled={!item.cliente_id}
                              >
                                <Link size={15} />
                                Conectar MP
                              </button>
                              <button
                                className="pill-button inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold"
                                onClick={() => handleValidateMercadoPago(item)}
                                type="button"
                                disabled={!item.cliente_id || validatingClienteId === item.cliente_id}
                              >
                                <RefreshCcw
                                  size={15}
                                  className={validatingClienteId === item.cliente_id ? "animate-spin" : ""}
                                />
                                {validatingClienteId === item.cliente_id ? "Validando" : "Validar MP"}
                              </button>
                            </>
                          ) : null}
                          <button
                            className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-[var(--color-error)] transition hover:bg-rose-100"
                            onClick={() => setDeleteUser(item)}
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

      <ConfirmModal
        open={Boolean(deleteUser)}
        title="Excluir usuario"
        description={`Esta acao remove o usuario ${deleteUser?.nome || deleteUser?.email || ""}. A operacao sera registrada na auditoria do sistema.`}
        confirmLabel="Excluir usuario"
        loading={deletingUser}
        onCancel={() => setDeleteUser(null)}
        onConfirm={handleDelete}
      />

      <Modal
        open={Boolean(mpValidation)}
        onClose={() => setMpValidation(null)}
      >
        <div className="space-y-5">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--color-text-soft)]">
              Mercado Pago
            </div>
            <h2 className="mt-2 text-3xl font-extrabold tracking-[-0.04em] text-[var(--color-text)]">
              Validacao da integracao
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-soft)]">
              {mpValidation?.cliente_nome || "Cliente"} - cliente #{mpValidation?.cliente_id}
            </p>
          </div>

          <div
            className={`rounded-[24px] px-5 py-4 text-sm font-semibold ${
              mpValidation?.ok
                ? "bg-[var(--color-primary-soft)] text-[var(--color-success)]"
                : "bg-amber-50 text-[var(--color-warning)]"
            }`}
          >
            {mpValidation?.ok
              ? "Integracao pronta para criar maquinas com Mercado Pago."
              : "Revise os itens abaixo antes de criar maquinas com Mercado Pago."}
          </div>

          <div className="space-y-3">
            {(mpValidation?.checks || []).map((check) => (
              <div
                key={check.key}
                className="flex items-start gap-3 rounded-[20px] border border-[var(--color-border)] bg-white px-4 py-4"
              >
                <div
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    check.ok
                      ? "bg-[var(--color-primary-soft)] text-[var(--color-success)]"
                      : "bg-rose-50 text-[var(--color-error)]"
                  }`}
                >
                  {check.ok ? <CheckCircle2 size={17} /> : <XCircle size={17} />}
                </div>
                <div>
                  <div className="font-semibold text-[var(--color-text)]">{check.label}</div>
                  <div className="mt-1 text-sm leading-6 text-[var(--color-text-soft)]">
                    {check.message}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="pill-button pill-button--primary inline-flex w-full items-center justify-center px-5 py-3 font-semibold"
            onClick={() => setMpValidation(null)}
          >
            Fechar
          </button>
        </div>
      </Modal>

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
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Telefone">
                  <input
                    className="w-full rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-4 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
                    placeholder="(11) 99999-9999"
                    value={form.telefone}
                    onChange={(e) => setForm((current) => ({ ...current, telefone: e.target.value }))}
                  />
                </Field>

                <Field label="CPF">
                  <input
                    className="w-full rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-4 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
                    placeholder="000.000.000-00"
                    value={form.cpf}
                    onChange={(e) => setForm((current) => ({ ...current, cpf: e.target.value }))}
                  />
                </Field>

                <Field label="CNPJ">
                  <input
                    className="w-full rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-4 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
                    placeholder="00.000.000/0000-00"
                    value={form.cnpj}
                    onChange={(e) => setForm((current) => ({ ...current, cnpj: e.target.value }))}
                  />
                </Field>

                <Field label="Rua">
                  <input
                    className="w-full rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-4 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
                    placeholder="Rua do ponto/cliente"
                    value={form.endereco_rua}
                    onChange={(e) => setForm((current) => ({ ...current, endereco_rua: e.target.value }))}
                  />
                </Field>

                <Field label="Numero">
                  <input
                    className="w-full rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-4 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
                    placeholder="123"
                    value={form.endereco_numero}
                    onChange={(e) => setForm((current) => ({ ...current, endereco_numero: e.target.value }))}
                  />
                </Field>

                <Field label="Cidade">
                  <input
                    className="w-full rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-4 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
                    placeholder="São Paulo"
                    value={form.endereco_cidade}
                    onChange={(e) => setForm((current) => ({ ...current, endereco_cidade: e.target.value }))}
                  />
                </Field>

                <Field label="Estado">
                  <select
                    className="w-full rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-4 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
                    value={form.endereco_estado}
                    onChange={(e) => setForm((current) => ({ ...current, endereco_estado: e.target.value }))}
                  >
                    {brazilStates.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                </Field>

                <div className="grid gap-3 md:col-span-2 md:grid-cols-3">
                  <ProviderCheckbox
                    label="Cliente Mercado Pago"
                    checked={form.cliente_mercado_pago}
                    onChange={(checked) =>
                      setForm((current) => ({ ...current, cliente_mercado_pago: checked }))
                    }
                  />
                  <ProviderCheckbox
                    label="Cliente PagBank"
                    checked={form.cliente_pagbank}
                    onChange={(checked) =>
                      setForm((current) => ({ ...current, cliente_pagbank: checked }))
                    }
                  />
                  <ProviderCheckbox
                    label="Cliente S6Pay"
                    checked={form.cliente_s6pay}
                    onChange={(checked) =>
                      setForm((current) => ({ ...current, cliente_s6pay: checked }))
                    }
                  />
                </div>

                {form.cliente_mercado_pago ? (
                  <>
                    <div className="rounded-[22px] bg-[var(--color-bg-muted)] px-4 py-4 text-sm leading-6 text-[var(--color-text-soft)] md:col-span-2">
                      Preferencialmente use o botao Conectar MP na tabela depois de criar o usuario. O Mercado Pago devolve o token de producao pela aplicacao vinculada e o sistema salva automaticamente.
                    </div>

                    <Field label="MP Public Key (fallback)">
                      <input
                        className="w-full rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-4 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
                        placeholder="APP_USR..."
                        value={form.mp_public_key}
                        onChange={(e) => setForm((current) => ({ ...current, mp_public_key: e.target.value }))}
                      />
                    </Field>

                    <Field label="MP Access Token (fallback)">
                      <input
                        className="w-full rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-4 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
                        placeholder="APP_USR..."
                        value={form.mp_access_token}
                        onChange={(e) => setForm((current) => ({ ...current, mp_access_token: e.target.value }))}
                      />
                    </Field>

                    <Field label="MP Client ID">
                      <input
                        className="w-full rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-4 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
                        value={form.mp_client_id}
                        onChange={(e) => setForm((current) => ({ ...current, mp_client_id: e.target.value }))}
                      />
                    </Field>

                    <Field label="MP Client Secret">
                      <input
                        className="w-full rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-4 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
                        placeholder={editUser ? "Preencha somente para trocar" : ""}
                        value={form.mp_client_secret}
                        onChange={(e) => setForm((current) => ({ ...current, mp_client_secret: e.target.value }))}
                      />
                    </Field>

                    <Field label="MP User ID">
                      <input
                        className="w-full rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-4 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
                        placeholder="Opcional, o sistema busca pelo token"
                        value={form.mp_user_id}
                        onChange={(e) => setForm((current) => ({ ...current, mp_user_id: e.target.value }))}
                      />
                    </Field>

                    <Field label="Categoria/MCC do caixa MP">
                      <input
                        className="w-full rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-4 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
                        type="number"
                        value={form.mp_pos_category}
                        onChange={(e) => setForm((current) => ({ ...current, mp_pos_category: e.target.value }))}
                      />
                    </Field>

                    <div className="rounded-[22px] bg-[var(--color-bg-muted)] px-4 py-4 text-sm leading-6 text-[var(--color-text-soft)] md:col-span-2">
                      Ao salvar este usuario cliente, o endereco fica vinculado ao cliente. Ao criar uma maquina para ele, o sistema cria uma nova loja no Mercado Pago e o caixa dessa maquina dentro dela.
                    </div>
                  </>
                ) : null}
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

function ProviderCheckbox({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-3 rounded-[22px] border border-[var(--color-border)] bg-[var(--color-bg-muted)] px-4 py-4 text-sm font-semibold text-[var(--color-text)]">
      <input
        type="checkbox"
        className="h-5 w-5 accent-[var(--color-primary)]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}
