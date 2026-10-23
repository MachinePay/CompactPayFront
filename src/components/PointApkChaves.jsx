import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Copy, KeyRound, RefreshCcw, Trash2 } from "lucide-react";

import api, { getApiErrorMessage } from "../api/axios";

// Banco "mercado_pago_apk": chaves das maquininhas Point que rodam o app
// CompactPay (android-point/). A chave e' do cliente; a Point escolhe a placa
// nas proprias configuracoes. A chave so aparece uma vez, logo apos gerar.
export default function PointApkChaves({ clienteId, maquinaId, maquinaNome }) {
  const [terminais, setTerminais] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [novaChave, setNovaChave] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    if (!clienteId) return;
    setCarregando(true);
    try {
      const { data } = await api.get("/smartapp/terminais");
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
      const nome = `Point ${maquinaNome || maquinaId || ""}`.trim();
      const { data } = await api.post("/smartapp/terminais", {
        nome,
        cliente_id: Number(clienteId),
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
      await api.delete(`/smartapp/terminais/${terminal.id}`);
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
        Maquininha Point (app CompactPay)
      </span>
      <p className="mb-3 text-xs leading-5 text-[var(--color-text-soft)]">
        Gere a chave e coloque no app da Point (compactpay.terminalKey). Na Point, segure o logo
        por 5 segundos, digite o PIN e informe o ID da placa
        {maquinaId ? (
          <>
            {" "}
            <strong className="font-mono text-[var(--color-text)]">{maquinaId}</strong>
          </>
        ) : null}
        . A mesma chave serve para qualquer maquina deste cliente com banco Mercado Pago APK.
      </p>

      {novaChave ? (
        <div className="mb-3 rounded-[14px] border border-emerald-300 bg-emerald-50 p-3">
          <span className="block text-xs font-semibold text-emerald-800">
            Chave de "{novaChave.nome}" - copie agora, ela nao aparece de novo:
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
                  {terminal.chave_prefixo}… ·{" "}
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
