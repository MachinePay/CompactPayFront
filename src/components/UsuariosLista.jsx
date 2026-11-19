import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";

import { OPCOES_FILTROS, casaBusca, formatarUltimaVenda } from "../utils/usuariosLista";

/**
 * Campo de busca com lista de sugestoes: conforme digita, aparecem os
 * usuarios que casam (de todas as paginas). Clicar numa sugestao mostra so ele.
 */
export function BuscaUsuarios({ usuarios, valor, onChange, onSelecionar }) {
  const [aberto, setAberto] = useState(false);
  const [destaque, setDestaque] = useState(0);
  const caixaRef = useRef(null);

  const sugestoes = valor.trim() ? usuarios.filter((item) => casaBusca(item, valor)).slice(0, 8) : [];

  useEffect(() => {
    const fechar = (event) => {
      if (caixaRef.current && !caixaRef.current.contains(event.target)) setAberto(false);
    };
    document.addEventListener("mousedown", fechar);
    return () => document.removeEventListener("mousedown", fechar);
  }, []);

  const escolher = (item) => {
    onSelecionar(item);
    setAberto(false);
  };

  return (
    <div ref={caixaRef} className="relative w-full md:max-w-md">
      <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-soft)]" />
      <input
        className="w-full rounded-[18px] border border-[var(--color-border)] bg-white py-3 pl-10 pr-10 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
        placeholder="Nome, email, ID ou numero do cliente..."
        value={valor}
        onChange={(event) => {
          onChange(event.target.value);
          setAberto(true);
          setDestaque(0);
        }}
        onFocus={() => setAberto(true)}
        onKeyDown={(event) => {
          if (!aberto || !sugestoes.length) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setDestaque((atual) => Math.min(atual + 1, sugestoes.length - 1));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setDestaque((atual) => Math.max(atual - 1, 0));
          } else if (event.key === "Enter") {
            event.preventDefault();
            escolher(sugestoes[destaque] || sugestoes[0]);
          } else if (event.key === "Escape") {
            setAberto(false);
          }
        }}
      />
      {valor ? (
        <button
          type="button"
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-[var(--color-text-soft)] hover:bg-[var(--color-bg-muted)]"
          onClick={() => onChange("")}
          title="Limpar busca"
        >
          <X size={15} />
        </button>
      ) : null}
      {aberto && sugestoes.length ? (
        <ul className="absolute left-0 right-0 z-30 mt-1 max-h-80 overflow-y-auto rounded-[14px] border border-[var(--color-border)] bg-white py-1 shadow-[0_14px_30px_rgba(34,61,43,0.14)]">
          {sugestoes.map((item, index) => (
            <li key={item.id}>
              <button
                type="button"
                className={`flex w-full flex-col items-start px-4 py-2 text-left text-sm ${
                  index === destaque ? "bg-[var(--color-bg-muted)]" : "hover:bg-[var(--color-bg-muted)]"
                }`}
                onMouseEnter={() => setDestaque(index)}
                onClick={() => escolher(item)}
              >
                <span className="font-semibold text-[var(--color-text)]">{item.nome || "Sem nome"}</span>
                <span className="text-xs text-[var(--color-text-soft)]">
                  {item.email} · ID #{item.id}
                  {item.cliente_id != null ? ` · Cliente ${item.cliente_id}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Selects de perfil, Mercado Pago, SumUp e vendas. */
export function FiltrosUsuarios({ filtros, onChange }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {OPCOES_FILTROS.map((filtro) => (
        <label
          key={filtro.chave}
          className="flex items-center gap-2 text-xs font-semibold text-[var(--color-text-soft)]"
        >
          {filtro.nome}
          <select
            className={`rounded-full border bg-white px-3 py-1.5 text-[var(--color-text)] ${
              filtros[filtro.chave] !== "todos"
                ? "border-[var(--color-primary)]"
                : "border-[var(--color-border)]"
            }`}
            value={filtros[filtro.chave]}
            onChange={(event) => onChange({ ...filtros, [filtro.chave]: event.target.value })}
          >
            {filtro.opcoes.map(([valor, nome]) => (
              <option key={valor} value={valor}>
                {nome}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
}

/** Abas de pagina (1, 2, 3...) com setas. */
export function PaginacaoUsuarios({ pagina, totalPaginas, total, porPagina, onChange }) {
  if (totalPaginas <= 1) {
    return total ? (
      <div className="px-1 pt-3 text-xs text-[var(--color-text-soft)]">
        {total} usuario{total === 1 ? "" : "s"}
      </div>
    ) : null;
  }
  const inicio = (pagina - 1) * porPagina + 1;
  const fim = Math.min(pagina * porPagina, total);
  const paginas = Array.from({ length: totalPaginas }, (_, i) => i + 1);
  const botao = "flex h-9 min-w-9 items-center justify-center rounded-full border px-3 text-sm font-semibold transition";
  return (
    <div className="flex flex-col items-center justify-between gap-3 pt-4 md:flex-row">
      <div className="text-xs text-[var(--color-text-soft)]">
        {inicio}-{fim} de {total} usuarios
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          className={`${botao} border-[var(--color-border)] bg-white disabled:opacity-40`}
          disabled={pagina === 1}
          onClick={() => onChange(pagina - 1)}
          title="Pagina anterior"
        >
          <ChevronLeft size={15} />
        </button>
        {paginas.map((numero) => (
          <button
            key={numero}
            type="button"
            className={`${botao} ${
              numero === pagina
                ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                : "border-[var(--color-border)] bg-white text-[var(--color-text)] hover:border-[var(--color-primary)]"
            }`}
            onClick={() => onChange(numero)}
          >
            {numero}
          </button>
        ))}
        <button
          type="button"
          className={`${botao} border-[var(--color-border)] bg-white disabled:opacity-40`}
          disabled={pagina === totalPaginas}
          onClick={() => onChange(pagina + 1)}
          title="Proxima pagina"
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}

export function BadgeStatus({ ok, okLabel = "Configurado", pendenteLabel = "Pendente" }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-3 py-2 text-xs font-semibold ${
        ok ? "bg-[var(--color-primary-soft)] text-[var(--color-success)]" : "bg-amber-50 text-[var(--color-warning)]"
      }`}
    >
      {ok ? okLabel : pendenteLabel}
    </span>
  );
}

/** Coluna "Vendas": sim/nao + data da ultima venda. */
export function UltimaVenda({ item }) {
  if (item.role !== "cliente" || item.cliente_id == null) {
    return <span className="text-[var(--color-text-soft)]">--</span>;
  }
  return (
    <div>
      <BadgeStatus ok={item.tem_venda} okLabel="Sim" pendenteLabel="Nao" />
      <div className="mt-1 whitespace-nowrap text-xs text-[var(--color-text-soft)]">
        {item.tem_venda ? formatarUltimaVenda(item.ultima_venda) : "Nenhuma venda"}
      </div>
    </div>
  );
}
