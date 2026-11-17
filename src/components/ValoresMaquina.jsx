import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Tags, Trash2, X } from "lucide-react";

import api, { getApiErrorMessage } from "../api/axios";

// Valores (produtos) que a tela touch / o app da maquininha mostram como botoes.
// Usa as rotas /produtos que ja existem; aparece nos bancos de tela e de SDK.
const formatar = (valor) =>
  Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const lerValor = (texto) => {
  const limpo = String(texto || "").replace(/[^\d,.-]/g, "");
  // "1.234,56" ou "1234,56" -> 1234.56; "12.5" continua 12.5
  const normalizado = limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo;
  return Number(normalizado);
};

const vazio = { id: null, nome: "", valor: "" };

export default function ValoresMaquina({ maquinaId, maquinaSalva }) {
  const [produtos, setProdutos] = useState([]);
  const [form, setForm] = useState(vazio);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    if (!maquinaSalva || !maquinaId) return;
    try {
      const { data } = await api.get("/produtos", { params: { maquina_id: maquinaId } });
      setProdutos([...data].sort((a, b) => a.valor - b.valor));
      setErro("");
    } catch (error) {
      setErro(getApiErrorMessage(error, "Nao foi possivel carregar os valores"));
    }
  }, [maquinaId, maquinaSalva]);

  useEffect(() => {
    setForm(vazio);
    carregar();
  }, [carregar]);

  const salvar = async () => {
    const valor = lerValor(form.valor);
    if (!form.nome.trim()) {
      setErro("Informe o nome, ex.: 1 jogada");
      return;
    }
    if (!(valor > 0)) {
      setErro("Informe um valor maior que zero, ex.: 5,00");
      return;
    }
    setSalvando(true);
    try {
      const corpo = { nome: form.nome.trim(), valor, maquina_id: maquinaId };
      if (form.id) {
        await api.put(`/produtos/${form.id}`, corpo);
      } else {
        await api.post("/produtos", corpo);
      }
      setForm(vazio);
      await carregar();
    } catch (error) {
      setErro(getApiErrorMessage(error, "Nao foi possivel salvar o valor"));
    } finally {
      setSalvando(false);
    }
  };

  const remover = async (produto) => {
    if (!window.confirm(`Remover "${produto.nome}" (${formatar(produto.valor)})?`)) return;
    try {
      await api.delete(`/produtos/${produto.id}`);
      if (form.id === produto.id) setForm(vazio);
      await carregar();
    } catch (error) {
      setErro(getApiErrorMessage(error, "Nao foi possivel remover o valor"));
    }
  };

  // Enter dentro destes campos nao pode enviar o formulario da maquina.
  const aoTeclar = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      salvar();
    }
  };

  if (!maquinaSalva) {
    return (
      <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg-muted)] p-4 text-xs text-[var(--color-text-soft)]">
        Salve a maquina e abra de novo para cadastrar os valores que aparecem na tela.
      </div>
    );
  }

  return (
    <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg-muted)] p-4">
      <span className="mb-1 flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
        <Tags size={16} />
        Valores da maquina
      </span>
      <p className="mb-3 text-xs leading-5 text-[var(--color-text-soft)]">
        Cada valor vira um botao na tela (ate 8, do menor para o maior). A tela busca de novo a cada toque,
        entao nao precisa regravar nada. Evite acentos no nome.
      </p>

      {produtos.length > 0 ? (
        <ul className="mb-3 space-y-2">
          {produtos.map((produto) => (
            <li
              key={produto.id}
              className="flex items-center justify-between gap-2 rounded-[10px] bg-white px-3 py-2 text-sm"
            >
              <span className="min-w-0">
                <span className="font-semibold text-[var(--color-text)]">{formatar(produto.valor)}</span>
                <span className="ml-2 text-[var(--color-text-soft)]">{produto.nome}</span>
              </span>
              <span className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() =>
                    setForm({ id: produto.id, nome: produto.nome, valor: String(produto.valor).replace(".", ",") })
                  }
                  className="rounded-full border border-[var(--color-border)] p-2 text-[var(--color-text)] hover:border-[var(--color-primary)]"
                  title="Editar"
                >
                  <Pencil size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => remover(produto)}
                  className="rounded-full border border-rose-200 p-2 text-rose-600 hover:bg-rose-50"
                  title="Remover"
                >
                  <Trash2 size={13} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-3 text-xs text-[var(--color-text-soft)]">Nenhum valor cadastrado ainda.</p>
      )}

      <input
        className="mb-2 w-full rounded-[10px] border border-[var(--color-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
        placeholder="Nome, ex.: 1 jogada"
        value={form.nome}
        maxLength={39}
        onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
        onKeyDown={aoTeclar}
      />
      <div className="flex flex-wrap gap-2">
        <input
          className="min-w-[110px] flex-1 rounded-[10px] border border-[var(--color-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
          placeholder="Valor, ex.: 5,00"
          inputMode="decimal"
          value={form.valor}
          onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))}
          onKeyDown={aoTeclar}
        />
        <button
          type="button"
          onClick={salvar}
          disabled={salvando}
          className="inline-flex items-center justify-center gap-1 rounded-full bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          <Plus size={15} />
          {form.id ? "Salvar" : "Adicionar"}
        </button>
        {form.id ? (
          <button
            type="button"
            onClick={() => setForm(vazio)}
            className="inline-flex items-center justify-center gap-1 rounded-full border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
          >
            <X size={15} />
            Cancelar
          </button>
        ) : null}
      </div>

      {erro ? <p className="mt-2 text-xs font-medium text-rose-600">{erro}</p> : null}
    </div>
  );
}
