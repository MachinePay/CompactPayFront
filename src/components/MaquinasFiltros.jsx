import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { COLUNAS_ORDENACAO, FILTROS_STATUS, proximaOrdem } from "../utils/maquinasLista";

const TOM_STATUS = {
  online: "text-[var(--color-success)]",
  sem_movimento: "text-[var(--color-warning)]",
  offline: "text-[var(--color-error)]",
  fechado: "text-slate-600",
};

/** Botoes de status com a contagem de cada um. */
export function FiltroStatus({ maquinas, valor, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {FILTROS_STATUS.map((filtro) => {
        const quantidade = maquinas.filter(filtro.testa).length;
        const ativo = valor === filtro.id;
        if (!quantidade && !ativo && filtro.id !== "todos") return null;
        return (
          <button
            key={filtro.id}
            type="button"
            title={filtro.ajuda}
            onClick={() => onChange(ativo && filtro.id !== "todos" ? "todos" : filtro.id)}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-bold transition ${
              ativo
                ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                : `border-[var(--color-border)] bg-white hover:border-[var(--color-primary)] ${TOM_STATUS[filtro.id] || "text-[var(--color-text)]"}`
            }`}
          >
            {filtro.nome} ({quantidade})
          </button>
        );
      })}
    </div>
  );
}

/** Cabecalho de coluna que ordena ao clicar. */
export function CabecalhoOrdenavel({ coluna, ordem, onChange, className = "", children }) {
  const ativa = ordem?.coluna === coluna;
  const Icone = !ativa ? ArrowUpDown : ordem.direcao === "asc" ? ArrowUp : ArrowDown;
  return (
    <th className={className} aria-sort={ativa ? (ordem.direcao === "asc" ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        className={`inline-flex items-center gap-1 uppercase tracking-[0.14em] hover:text-[var(--color-primary)] ${
          ativa ? "text-[var(--color-primary)]" : ""
        }`}
        onClick={() => onChange(proximaOrdem(ordem, coluna))}
        title={`Ordenar por ${COLUNAS_ORDENACAO[coluna].nome.toLowerCase()}`}
      >
        {children}
        <Icone size={12} className={ativa ? "" : "opacity-40"} />
      </button>
    </th>
  );
}

/** No celular nao ha cabecalho de tabela: escolhe a ordem num select. */
export function OrdenacaoMobile({ ordem, onChange }) {
  const valor = ordem ? `${ordem.coluna}:${ordem.direcao}` : "";
  return (
    <label className="flex items-center gap-2 text-xs font-semibold text-[var(--color-text-soft)] md:hidden">
      Ordenar
      <select
        className="rounded-full border border-[var(--color-border)] bg-white px-3 py-1.5 text-[var(--color-text)]"
        value={valor}
        onChange={(e) => {
          const [coluna, direcao] = e.target.value.split(":");
          onChange(coluna ? { coluna, direcao } : null);
        }}
      >
        <option value="">Padrao</option>
        <option value="status:asc">Status (problemas primeiro)</option>
        <option value="resultados:desc">Maior faturamento</option>
        <option value="resultados:asc">Menor faturamento</option>
        <option value="atividade:desc">Atividade mais recente</option>
        <option value="atividade:asc">Mais tempo sem atividade</option>
        <option value="maquina:asc">Nome (A-Z)</option>
        <option value="sinal:asc">Pior sinal Wi-Fi</option>
      </select>
    </label>
  );
}
