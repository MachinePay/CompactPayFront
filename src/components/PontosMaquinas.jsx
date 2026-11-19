import { useEffect, useMemo, useState } from "react";
import { Check, FolderOpen, Pencil, Plus, Trash2, X } from "lucide-react";

import api, { getApiErrorMessage } from "../api/axios";
import { confirmar } from "../utils/confirmar";
import { SEM_PONTO, TODOS_PONTOS as TODOS } from "../utils/pontosMaquinas";
import Modal from "./Modal";

// UI dos pontos (agrupamento opcional, so visual). Estado e regras de lista
// em utils/pontosMaquinas.js.

const campo =
  "w-full rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-3 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]";

function TituloGrupo({ nome, total, semPonto }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-primary-strong)]">
      <FolderOpen size={14} className={semPonto ? "text-[var(--color-text-soft)]" : ""} />
      <span className={semPonto ? "text-[var(--color-text-soft)]" : ""}>{nome}</span>
      <span className="font-semibold text-[var(--color-text-soft)]">({total})</span>
    </span>
  );
}

/** Cabecalho de ponto na lista de cards (celular). */
export function CabecalhoPontoCard(props) {
  return (
    <div className="px-1 pt-2">
      <TituloGrupo {...props} />
    </div>
  );
}

/** Cabecalho de ponto na tabela (desktop, 8 colunas). */
export function CabecalhoPontoLinha(props) {
  return (
    <tr className="border-t border-[var(--color-border)] bg-[var(--color-bg-muted)]">
      <td colSpan={8} className="px-3 py-2">
        <TituloGrupo {...props} />
      </td>
    </tr>
  );
}

/** Botoes de filtro por ponto + "Pontos" (abre o gerenciador). */
export function FiltroPontos({ estado, maquinas }) {
  const [aberto, setAberto] = useState(false);
  if (!estado?.habilitado) return null;
  const { pontos, filtro, setFiltro, pontoDe } = estado;
  const semPonto = maquinas.filter((m) => pontoDe(m) == null).length;

  const botao = (id, nome, quantidade) => {
    const ativo = String(filtro) === String(id);
    return (
      <button
        key={id}
        type="button"
        onClick={() => setFiltro(ativo && id !== TODOS ? TODOS : id)}
        className={`rounded-full border px-3.5 py-1.5 text-xs font-bold transition ${
          ativo
            ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
            : "border-[var(--color-border)] bg-white text-[var(--color-text)] hover:border-[var(--color-primary)]"
        }`}
      >
        {nome}
        {quantidade != null ? ` (${quantidade})` : ""}
      </button>
    );
  };

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {pontos.length > 0 ? (
        <>
          {botao(TODOS, "Todos os pontos")}
          {pontos.map((p) =>
            botao(p.id, p.nome, maquinas.filter((m) => pontoDe(m) === p.id).length),
          )}
          {semPonto > 0 || filtro === SEM_PONTO ? botao(SEM_PONTO, "Sem ponto", semPonto) : null}
        </>
      ) : null}
      <button
        type="button"
        onClick={() => setAberto(true)}
        title="Agrupar as maquinas em pontos (opcional, so para organizar a lista)"
        className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-[var(--color-border)] bg-white px-3.5 py-1.5 text-xs font-bold text-[var(--color-text-soft)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary-strong)]"
      >
        <FolderOpen size={14} />
        {pontos.length > 0 ? "Gerenciar pontos" : "Agrupar em pontos"}
      </button>
      <GerenciarPontosModal open={aberto} onClose={() => setAberto(false)} estado={estado} maquinas={maquinas} />
    </div>
  );
}

function GerenciarPontosModal({ open, onClose, estado, maquinas }) {
  const { pontos, recarregar, pontoDe, setMapa, ehAdmin, clienteId } = estado;
  const [novoNome, setNovoNome] = useState("");
  const [editando, setEditando] = useState(null); // {id, nome}
  const [ocupado, setOcupado] = useState(false);
  const [salvandoMaquina, setSalvandoMaquina] = useState("");
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!open) return;
    setNovoNome("");
    setEditando(null);
    setErro("");
  }, [open]);

  const maquinasOrdenadas = useMemo(
    () =>
      [...maquinas].sort((a, b) =>
        String(a.nome || a.id_hardware).localeCompare(String(b.nome || b.id_hardware), "pt-BR"),
      ),
    [maquinas],
  );

  const executar = async (acao, mensagemErro) => {
    setOcupado(true);
    setErro("");
    try {
      await acao();
      await recarregar();
      return true;
    } catch (error) {
      setErro(getApiErrorMessage(error, mensagemErro));
      return false;
    } finally {
      setOcupado(false);
    }
  };

  const criar = async (e) => {
    e.preventDefault();
    const nome = novoNome.trim();
    if (!nome) return;
    const ok = await executar(
      () => api.post("/pontos", { nome, ...(ehAdmin ? { cliente_id: Number(clienteId) } : {}) }),
      "Nao foi possivel criar o ponto.",
    );
    if (ok) setNovoNome("");
  };

  const renomear = async () => {
    const nome = (editando?.nome || "").trim();
    if (!nome) return;
    const ok = await executar(
      () => api.patch(`/pontos/${editando.id}`, { nome }),
      "Nao foi possivel renomear o ponto.",
    );
    if (ok) setEditando(null);
  };

  const excluir = async (ponto) => {
    const total = maquinas.filter((m) => pontoDe(m) === ponto.id).length;
    const ok = await confirmar({
      titulo: `Excluir o ponto "${ponto.nome}"?`,
      texto: total
        ? `As ${total} maquina(s) dele voltam para "Sem ponto". Nenhuma maquina e' apagada.`
        : "Nenhuma maquina e' apagada.",
      confirmarTexto: "Excluir ponto",
      perigoso: true,
    });
    if (!ok) return;
    await executar(() => api.delete(`/pontos/${ponto.id}`), "Nao foi possivel excluir o ponto.");
  };

  const moverMaquina = async (machine, valor) => {
    const pontoId = valor === "" ? null : Number(valor);
    setSalvandoMaquina(machine.id_hardware);
    setErro("");
    try {
      await api.put(`/pontos/maquinas/${encodeURIComponent(machine.id_hardware)}`, { ponto_id: pontoId });
      setMapa((atual) => {
        const novo = { ...atual };
        if (pontoId == null) delete novo[machine.id_hardware];
        else novo[machine.id_hardware] = pontoId;
        return novo;
      });
    } catch (error) {
      setErro(getApiErrorMessage(error, "Nao foi possivel mover a maquina."));
    } finally {
      setSalvandoMaquina("");
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <div className="flex flex-col gap-5">
        <div>
          <h2 className="text-xl font-bold text-[var(--color-text)]">Pontos</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--color-text-soft)]">
            Opcional: agrupe as maquinas por ponto so para organizar a lista. Nao muda nada no funcionamento
            nem no nome das maquinas.
          </p>
        </div>

        {erro ? (
          <div className="rounded-[18px] border border-[var(--color-error)] bg-white px-4 py-3 text-sm text-[var(--color-error)]">
            {erro}
          </div>
        ) : null}

        <form onSubmit={criar} className="flex flex-col gap-2 sm:flex-row">
          <input
            className={campo}
            placeholder="Nome do novo ponto (ex.: Shopping Centro)"
            value={novoNome}
            maxLength={80}
            onChange={(e) => setNovoNome(e.target.value)}
          />
          <button
            type="submit"
            disabled={ocupado || !novoNome.trim()}
            className="pill-button pill-button--primary inline-flex shrink-0 items-center justify-center gap-2 px-5 py-3 font-semibold disabled:opacity-50"
          >
            <Plus size={16} />
            Criar ponto
          </button>
        </form>

        {pontos.length > 0 ? (
          <div className="flex flex-col gap-2">
            {pontos.map((ponto) => {
              const total = maquinas.filter((m) => pontoDe(m) === ponto.id).length;
              const emEdicao = editando?.id === ponto.id;
              return (
                <div
                  key={ponto.id}
                  className="flex items-center gap-2 rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-2"
                >
                  {emEdicao ? (
                    <>
                      <input
                        className={`${campo} py-2`}
                        value={editando.nome}
                        maxLength={80}
                        autoFocus
                        onChange={(e) => setEditando({ ...editando, nome: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            renomear();
                          }
                          if (e.key === "Escape") {
                            e.stopPropagation();
                            setEditando(null);
                          }
                        }}
                      />
                      <button type="button" title="Salvar" disabled={ocupado} onClick={renomear} className="p-2 text-[var(--color-primary-strong)]">
                        <Check size={16} />
                      </button>
                      <button type="button" title="Cancelar" onClick={() => setEditando(null)} className="p-2 text-[var(--color-text-soft)]">
                        <X size={16} />
                      </button>
                    </>
                  ) : (
                    <>
                      <FolderOpen size={16} className="shrink-0 text-[var(--color-primary-strong)]" />
                      <span className="flex-1 truncate text-sm font-semibold text-[var(--color-text)]">{ponto.nome}</span>
                      <span className="text-xs text-[var(--color-text-soft)]">{total} maquina(s)</span>
                      <button
                        type="button"
                        title="Renomear"
                        disabled={ocupado}
                        onClick={() => setEditando({ id: ponto.id, nome: ponto.nome })}
                        className="p-2 text-[var(--color-text-soft)] hover:text-[var(--color-primary-strong)]"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        title="Excluir ponto"
                        disabled={ocupado}
                        onClick={() => excluir(ponto)}
                        className="p-2 text-[var(--color-text-soft)] hover:text-[var(--color-error)]"
                      >
                        <Trash2 size={15} />
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ) : null}

        {pontos.length > 0 && maquinasOrdenadas.length > 0 ? (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-[var(--color-text-soft)]">
              Maquinas
            </h3>
            {maquinasOrdenadas.map((m) => (
              <div
                key={m.id_hardware}
                className="flex flex-col gap-2 rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-2 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-[var(--color-text)]">{m.nome || m.id_hardware}</div>
                  <div className="truncate text-xs text-[var(--color-text-soft)]">{m.id_hardware}</div>
                </div>
                <select
                  className={`${campo} py-2 sm:w-56`}
                  value={pontoDe(m) ?? ""}
                  disabled={salvandoMaquina === m.id_hardware}
                  onChange={(e) => moverMaquina(m, e.target.value)}
                >
                  <option value="">Sem ponto</option>
                  {pontos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
