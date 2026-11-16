import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Copy, KeyRound, RefreshCcw, Trash2 } from "lucide-react";

import api, { getApiErrorMessage } from "../api/axios";

// Banco "confrapag_sdk": chaves das maquininhas PAX que rodam o app CompactPay
// com o SDK ConfraPag (android-confrapag/). Cada chave leva o CNPJ do
// estabelecimento cadastrado na ConfraPag (o SDK nao tem token: o CNPJ e' a
// identificacao). A chave so aparece uma vez, logo apos gerar.
export default function ConfrapagChaves({ clienteId, maquinaId, maquinaNome }) {
  const [terminais, setTerminais] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [novaChave, setNovaChave] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const [cnpj, setCnpj] = useState("");
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    if (!clienteId) return;
    setCarregando(true);
    try {
      const { data } = await api.get("/confrapag/terminais");
      setTerminais(data.filter((t) => String(t.cliente_id) === String(clienteId)));
      setErro("");
    } catch (error) {
      setErro(getApiErrorMessage(error, "Nao foi possivel carregar as maquininhas"));
    } finally {
      setCarregando(false);
    }
  }, [clienteId]);

  useEffect(() => {
    setNovaChave(null);
    carregar();
  }, [carregar]);

  const gerar = async () => {
    setGerando(true);
    setCopiado(false);
    try {
      const nome = `PAX ${maquinaNome || maquinaId || ""}`.trim();
      const { data } = await api.post("/confrapag/terminais", {
        nome,
        cliente_id: Number(clienteId),
        cnpj: cnpj.trim() || null,
      });
      setNovaChave(data);
      setErro("");
      await carregar();
    } catch (error) {
      setErro(getApiErrorMessage(error, "Nao foi possivel gerar a chave"));
    } finally {
      setGerando(false);
    }
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(novaChave.chave);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  };

  const revogar = async (terminal) => {
    if (!window.confirm(`Revogar a chave de "${terminal.nome}"? Essa maquininha para de funcionar.`)) return;
    try {
      await api.delete(`/confrapag/terminais/${terminal.id}`);
      if (novaChave?.id === terminal.id) setNovaChave(null);
      await carregar();
    } catch (error) {
      setErro(getApiErrorMessage(error, "Nao foi possivel revogar a chave"));
    }
  };

  const ativos = terminais.filter((t) => t.ativo);

  return (
    <div className="mt-3 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg-muted)] p-4">
      <span className="mb-1 flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
        <KeyRound size={16} />
        Maquininha ConfraPag (app CompactPay + SDK)
      </span>
      <p className="mb-3 text-xs leading-5 text-[var(--color-text-soft)]">
        Gere a chave e coloque no app da maquininha PAX (confrapag.terminalKey). Na maquininha, segure o
        logo por 5 segundos, digite o PIN, ative o terminal e informe o ID da placa
        {maquinaId ? (
          <>
            {" "}
            <strong className="font-mono text-[var(--color-text)]">{maquinaId}</strong>
          </>
        ) : null}
        . Cobra so cartao (credito e debito) pelo SDK; so libera os valores cadastrados como produto
        desta maquina (ou R$ 2, 5, 10 e 20 se nao houver). Estorno e' feito na propria maquininha.
      </p>

      {novaChave ? (
        <div className="mb-3 rounded-[14px] border border-emerald-300 bg-emerald-50 p-3">
          <span className="block text-xs font-semibold text-emerald-800">
            Chave de "{novaChave.nome}" (CNPJ {novaChave.cnpj}) - copie agora, ela nao aparece de novo:
          </span>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-[10px] bg-white px-3 py-2 text-xs text-[var(--color-text)]">
              {novaChave.chave}
            </code>
            <button
              type="button"
              onClick={copiar}
              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--color-primary)] px-3 py-2 text-xs font-semibold text-white"
            >
              {copiado ? <CheckCircle2 size={14} /> : <Copy size={14} />}
              {copiado ? "Copiada" : "Copiar"}
            </button>
          </div>
        </div>
      ) : null}

      {ativos.length > 0 ? (
        <ul className="mb-3 space-y-2">
          {ativos.map((terminal) => (
            <li
              key={terminal.id}
              className="flex items-center justify-between gap-2 rounded-[10px] bg-white px-3 py-2 text-xs"
            >
              <span className="min-w-0">
                <span className="block font-semibold text-[var(--color-text)]">{terminal.nome}</span>
                <span className="block text-[var(--color-text-soft)]">
                  CNPJ {terminal.cnpj} · {terminal.chave_prefixo}… ·{" "}
                  {terminal.ultimo_uso_em
                    ? `usada em ${new Date(terminal.ultimo_uso_em + "Z").toLocaleString("pt-BR")}`
                    : "ainda nao usada"}
                </span>
              </span>
              <button
                type="button"
                onClick={() => revogar(terminal)}
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-rose-200 px-3 py-1 font-semibold text-rose-600 hover:bg-rose-50"
              >
                <Trash2 size={13} />
                Revogar
              </button>
            </li>
          ))}
        </ul>
      ) : !carregando ? (
        <p className="mb-3 text-xs text-[var(--color-text-soft)]">Nenhuma maquininha com chave ativa ainda.</p>
      ) : null}

      <input
        type="text"
        inputMode="numeric"
        value={cnpj}
        onChange={(event) => setCnpj(event.target.value)}
        placeholder="CNPJ do estabelecimento na ConfraPag (vazio = CNPJ do cliente)"
        className="mb-2 w-full rounded-[12px] border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
      />
      <button
        type="button"
        onClick={gerar}
        disabled={gerando || !clienteId}
        className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--color-text)] transition hover:border-[var(--color-primary)] disabled:opacity-60"
      >
        <RefreshCcw size={15} className={gerando ? "animate-spin" : ""} />
        {gerando ? "Gerando..." : "Gerar chave da maquininha"}
      </button>

      {erro ? <p className="mt-2 text-xs font-medium text-rose-600">{erro}</p> : null}
    </div>
  );
}
