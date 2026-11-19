import { useEffect, useState } from "react";
import { Plus, Trash2, Wallet } from "lucide-react";

import api from "../api/axios";
import Modal from "./Modal";
import Button from "./Button";

// Mensalidade por cliente: valor padrao por maquina (R$ 40 se nunca editado)
// + faixas com outro valor para N maquinas. As maquinas fora das faixas
// pagam o padrao. O GrupoGK puxa esses mesmos dados pelo backend.

function formatarReais(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Coluna "Mensalidade": total do mes; clicar abre o cadastro. */
export function MensalidadeCelula({ item, mensalidade, onAbrir }) {
  if (item.role !== "cliente" || item.cliente_id == null || !mensalidade) {
    return <span className="text-[var(--color-text-soft)]">--</span>;
  }
  const temFaixas = mensalidade.faixas.length > 0;
  return (
    <button
      type="button"
      onClick={onAbrir}
      title="Cadastrar mensalidade"
      className="flex flex-col items-start rounded-[12px] px-2 py-1 text-left transition hover:bg-[var(--color-bg-muted)]"
    >
      <span className="text-sm font-semibold text-[var(--color-text)]">{formatarReais(mensalidade.total_mensal)}</span>
      <span className="text-[11px] leading-4 text-[var(--color-text-soft)]">
        {temFaixas
          ? `${mensalidade.faixas.length + (mensalidade.maquinas_padrao ? 1 : 0)} valores`
          : `${formatarReais(mensalidade.valor_padrao)}/maq.`}
      </span>
    </button>
  );
}

function calcular(valorPadrao, faixas, maquinasTotal) {
  const emFaixas = faixas.reduce((soma, f) => soma + (Number(f.quantidade_maquinas) || 0), 0);
  const noPadrao = Math.max(0, maquinasTotal - emFaixas);
  const total =
    faixas.reduce((soma, f) => soma + (Number(f.valor) || 0) * (Number(f.quantidade_maquinas) || 0), 0) +
    (Number(valorPadrao) || 0) * noPadrao;
  return { emFaixas, noPadrao, total, excedentes: Math.max(0, emFaixas - maquinasTotal) };
}

const campo =
  "w-full rounded-[14px] border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]";

/** Modal de cadastro da mensalidade de um cliente. */
export function MensalidadeModal({ usuario, mensalidade, onClose, onSalvo }) {
  const [valorPadrao, setValorPadrao] = useState("40");
  const [faixas, setFaixas] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!mensalidade) return;
    setValorPadrao(String(mensalidade.valor_padrao));
    setFaixas(
      mensalidade.faixas.map((f) => ({
        valor: String(f.valor),
        quantidade_maquinas: String(f.quantidade_maquinas),
        descricao: f.descricao || "",
      })),
    );
    setErro("");
  }, [mensalidade]);

  const aberto = Boolean(usuario && mensalidade);
  const maquinasTotal = mensalidade?.maquinas_total || 0;
  const conta = calcular(valorPadrao, faixas, maquinasTotal);

  const mudarFaixa = (indice, chave, valor) =>
    setFaixas((atual) => atual.map((f, i) => (i === indice ? { ...f, [chave]: valor } : f)));

  const salvar = async () => {
    const padrao = Number(String(valorPadrao).replace(",", "."));
    if (!Number.isFinite(padrao) || padrao < 0) {
      setErro("Valor padrao invalido.");
      return;
    }
    const payloadFaixas = [];
    for (const f of faixas) {
      const valor = Number(String(f.valor).replace(",", "."));
      const qtd = Number.parseInt(f.quantidade_maquinas, 10);
      if (!Number.isFinite(valor) || valor < 0 || !Number.isInteger(qtd) || qtd < 1) {
        setErro("Cada valor precisa de um preco e de pelo menos 1 maquina.");
        return;
      }
      payloadFaixas.push({ valor, quantidade_maquinas: qtd, descricao: f.descricao || null });
    }
    setSalvando(true);
    setErro("");
    try {
      const { data } = await api.put(`/mensalidades/${mensalidade.cliente_id}`, {
        valor_padrao: padrao,
        faixas: payloadFaixas,
      });
      onSalvo(data);
      onClose();
    } catch (e) {
      setErro(e?.response?.data?.detail ? String(e.response.data.detail) : "Nao foi possivel salvar.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal open={aberto} onClose={onClose}>
      {aberto ? (
        <div className="space-y-5">
          <div className="flex items-center gap-3 pr-12">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
              <Wallet size={20} />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-[var(--color-text)]">Mensalidade</h2>
              <p className="text-sm text-[var(--color-text-soft)]">
                {usuario.nome || mensalidade.nome_empresa} · Cliente {mensalidade.cliente_id} · {maquinasTotal}{" "}
                maquina{maquinasTotal === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          <div className="rounded-[18px] border border-[var(--color-border)] bg-white p-4">
            <div className="mb-1 text-sm font-semibold text-[var(--color-text)]">Valor padrao por maquina</div>
            <p className="mb-3 text-xs text-[var(--color-text-soft)]">
              Vale para as maquinas que nao estao em nenhum valor abaixo.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <div className="w-40">
                <input
                  className={campo}
                  inputMode="decimal"
                  value={valorPadrao}
                  onChange={(e) => setValorPadrao(e.target.value)}
                />
              </div>
              <span className="text-sm text-[var(--color-text-soft)]">
                × {conta.noPadrao} maquina{conta.noPadrao === 1 ? "" : "s"} ={" "}
                <b className="text-[var(--color-text)]">
                  {formatarReais((Number(String(valorPadrao).replace(",", ".")) || 0) * conta.noPadrao)}
                </b>
              </span>
            </div>
          </div>

          <div className="rounded-[18px] border border-[var(--color-border)] bg-white p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-[var(--color-text)]">Outros valores</div>
                <p className="text-xs text-[var(--color-text-soft)]">Quantas maquinas pagam cada valor.</p>
              </div>
              <button
                type="button"
                className="pill-button inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold"
                onClick={() => setFaixas((atual) => [...atual, { valor: "", quantidade_maquinas: "1", descricao: "" }])}
              >
                <Plus size={14} />
                Novo valor
              </button>
            </div>
            {faixas.length ? (
              <div className="space-y-2">
                <div className="hidden grid-cols-[120px_110px_1fr_110px_36px] gap-2 px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-soft)] md:grid">
                  <span>Valor (R$)</span>
                  <span>Maquinas</span>
                  <span>Descricao</span>
                  <span className="text-right">Subtotal</span>
                  <span />
                </div>
                {faixas.map((f, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-2 gap-2 md:grid-cols-[120px_110px_1fr_110px_36px] md:items-center"
                  >
                    <input
                      className={campo}
                      inputMode="decimal"
                      placeholder="Valor"
                      value={f.valor}
                      onChange={(e) => mudarFaixa(i, "valor", e.target.value)}
                    />
                    <input
                      className={campo}
                      inputMode="numeric"
                      placeholder="Maquinas"
                      value={f.quantidade_maquinas}
                      onChange={(e) => mudarFaixa(i, "quantidade_maquinas", e.target.value.replace(/\D/g, ""))}
                    />
                    <input
                      className={`${campo} col-span-2 md:col-span-1`}
                      placeholder="Descricao (opcional)"
                      value={f.descricao}
                      onChange={(e) => mudarFaixa(i, "descricao", e.target.value)}
                    />
                    <span className="text-sm font-semibold text-[var(--color-text)] md:text-right">
                      {formatarReais(
                        (Number(String(f.valor).replace(",", ".")) || 0) * (Number(f.quantidade_maquinas) || 0),
                      )}
                    </span>
                    <button
                      type="button"
                      title="Remover valor"
                      className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-[var(--color-error)] hover:bg-rose-100"
                      onClick={() => setFaixas((atual) => atual.filter((_, j) => j !== i))}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--color-text-soft)]">Todas as maquinas pagam o valor padrao.</p>
            )}
          </div>

          {conta.excedentes ? (
            <p className="rounded-[14px] bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Os valores somam {conta.emFaixas} maquinas, mas o cliente tem {maquinasTotal}. Confira as quantidades.
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] bg-[var(--color-bg-muted)] px-4 py-3">
            <span className="text-sm text-[var(--color-text-soft)]">Total mensal</span>
            <span className="text-lg font-extrabold text-[var(--color-text)]">{formatarReais(conta.total)}</span>
          </div>

          {erro ? <p className="text-sm text-[var(--color-error)]">{erro}</p> : null}

          <div className="flex justify-end gap-2">
            <button type="button" className="pill-button px-4 py-2 text-sm font-semibold" onClick={onClose}>
              Cancelar
            </button>
            <Button onClick={salvar} disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
