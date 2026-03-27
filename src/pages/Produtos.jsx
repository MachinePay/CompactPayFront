import { useEffect, useState } from "react";
import { CreditCard, Package, Pencil, Plus, Trash2 } from "lucide-react";

import api from "../api/axios";
import Button from "../components/Button";
import LoadingSpinner from "../components/LoadingSpinner";
import Modal from "../components/Modal";
import Toast from "../components/Toast";
import { useAuth } from "../context/AuthContext";

const emptyForm = {
  id: null,
  nome: "",
  valor: "",
  maquina_id: "",
};

export default function Produtos() {
  const { user } = useAuth();
  const [produtos, setProdutos] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [sendingProductId, setSendingProductId] = useState(null);
  const [toast, setToast] = useState({ message: "", type: "success" });

  const loadData = async () => {
    setLoading(true);
    try {
      const [produtosRes, maquinasRes] = await Promise.all([
        api.get("/produtos"),
        api.get("/maquinas?periodo=mes"),
      ]);
      setProdutos(produtosRes.data);
      setMaquinas(maquinasRes.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  const resetForm = () => {
    setForm(emptyForm);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      nome: form.nome,
      valor: Number(form.valor),
      maquina_id: form.maquina_id,
    };

    try {
      if (form.id) {
        await api.put(`/produtos/${form.id}`, payload);
        setToast({ message: "Produto atualizado com sucesso.", type: "success" });
      } else {
        await api.post("/produtos", payload);
        setToast({ message: "Produto cadastrado com sucesso.", type: "success" });
      }
      setShowModal(false);
      resetForm();
      await loadData();
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (produto) => {
    setForm({
      id: produto.id,
      nome: produto.nome,
      valor: String(produto.valor),
      maquina_id: produto.maquina_id,
    });
    setShowModal(true);
  };

  const handleDelete = async (produtoId) => {
    if (!window.confirm("Tem certeza que deseja excluir este produto?")) return;
    await api.delete(`/produtos/${produtoId}`);
    setToast({ message: "Produto removido com sucesso.", type: "success" });
    await loadData();
  };

  const handleLancarPagamento = async (produto) => {
    setSendingProductId(produto.id);
    try {
      await api.post("/pagamentos/lancar", {
        maquina_id: produto.maquina_id,
        valor: produto.valor,
        produto_id: produto.id,
        descricao: produto.nome,
      });
      setToast({
        message: `Pagamento lancado e credito enviado para ${produto.maquina_nome || produto.maquina_id}.`,
        type: "success",
      });
    } finally {
      setSendingProductId(null);
    }
  };

  return (
    <div className="flex min-h-full flex-col gap-4">
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ message: "", type: toast.type })}
      />

      <SectionHeader
        title="Produtos"
        description="Cadastre os itens por maquina e lance pagamentos digitais com o envio imediato do credito."
        actions={
          <Button
            className="justify-center"
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
          >
            <Plus size={18} />
            Novo produto
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          icon={<Package size={18} />}
          label="Produtos cadastrados"
          value={String(produtos.length)}
          helper="Catalogo ativo por maquina"
        />
        <SummaryCard
          icon={<CreditCard size={18} />}
          label="Maquinas com produto"
          value={String(new Set(produtos.map((item) => item.maquina_id)).size)}
          helper="Cobertura comercial no painel"
          featured
        />
        <SummaryCard
          icon={<Plus size={18} />}
          label="Maquinas disponiveis"
          value={String(maquinas.length)}
          helper="Bases prontas para receber produtos"
        />
      </div>

      <section className="app-panel rounded-[30px] p-5 md:p-6">
        <div className="overflow-hidden rounded-[26px] border border-[var(--color-border)] bg-white">
          {loading ? (
            <LoadingSpinner className="h-40" />
          ) : produtos.length === 0 ? (
            <div className="flex h-40 items-center justify-center px-6 text-center text-sm text-[var(--color-text-soft)]">
              Nenhum produto cadastrado ainda. Crie o primeiro item e vincule a uma maquina para liberar o fluxo digital.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-[var(--color-bg-muted)] text-left text-xs uppercase tracking-[0.18em] text-[var(--color-text-soft)]">
                  <tr>
                    <th className="px-5 py-4 whitespace-nowrap">Produto</th>
                    <th className="px-5 py-4 whitespace-nowrap">Valor</th>
                    <th className="px-5 py-4 whitespace-nowrap">Maquina</th>
                    <th className="px-5 py-4 whitespace-nowrap">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {produtos.map((produto) => (
                    <tr
                      key={produto.id}
                      className="border-t border-[var(--color-border)] text-sm text-[var(--color-text)]"
                    >
                      <td className="px-5 py-4 min-w-[220px]">
                        <div className="font-semibold">{produto.nome}</div>
                        <div className="mt-1 text-xs text-[var(--color-text-soft)]">
                          ID #{produto.id}
                        </div>
                      </td>
                      <td className="px-5 py-4 min-w-[120px] font-semibold">
                        R$ {Number(produto.valor).toFixed(2)}
                      </td>
                      <td className="px-5 py-4 min-w-[220px] text-[var(--color-text-soft)]">
                        {produto.maquina_nome || produto.maquina_id}
                      </td>
                      <td className="px-5 py-4 min-w-[260px]">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="pill-button inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold"
                            onClick={() => handleEdit(produto)}
                          >
                            <Pencil size={15} />
                            Editar
                          </button>
                          <button
                            type="button"
                            className="pill-button pill-button--primary inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold"
                            onClick={() => handleLancarPagamento(produto)}
                            disabled={sendingProductId === produto.id}
                          >
                            <CreditCard size={15} />
                            {sendingProductId === produto.id ? "Enviando..." : "Lancar pagamento"}
                          </button>
                          <button
                            type="button"
                            className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-[var(--color-error)] transition hover:bg-rose-100"
                            onClick={() => handleDelete(produto.id)}
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
          resetForm();
        }}
      >
        <div className="space-y-5">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--color-text-soft)]">
              Catalogo operacional
            </div>
            <h2 className="mt-2 text-3xl font-extrabold tracking-[-0.04em] text-[var(--color-text)]">
              {form.id ? "Editar produto" : "Novo produto"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-soft)]">
              Defina o valor e vincule o produto a maquina correta para usar o fluxo de pagamento digital.
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <Field label="Nome do produto">
              <input
                className="w-full rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-4 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
                placeholder="Ex.: 1 credito premium"
                value={form.nome}
                onChange={(e) => setForm((current) => ({ ...current, nome: e.target.value }))}
                required
              />
            </Field>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Valor">
                <input
                  className="w-full rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-4 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0,00"
                  value={form.valor}
                  onChange={(e) => setForm((current) => ({ ...current, valor: e.target.value }))}
                  required
                />
              </Field>

              <Field label="Maquina">
                <select
                  className="w-full rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-4 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
                  value={form.maquina_id}
                  onChange={(e) => setForm((current) => ({ ...current, maquina_id: e.target.value }))}
                  required
                >
                  <option value="">Selecione uma maquina</option>
                  {maquinas.map((maquina) => (
                    <option key={maquina.id_hardware} value={maquina.id_hardware}>
                      {(maquina.nome || maquina.id_hardware) + ` - ${maquina.id_hardware}`}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Button type="submit" className="w-full justify-center" disabled={saving}>
              {saving ? "Salvando produto..." : form.id ? "Salvar alteracoes" : "Cadastrar produto"}
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
