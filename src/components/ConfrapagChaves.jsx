import { useCallback, useEffect, useState } from "react";
import { KeyRound, Link2, Trash2 } from "lucide-react";

import api, { getApiErrorMessage } from "../api/axios";

// Banco "confrapag_sdk": maquininhas PAX que rodam o app CompactPay com o SDK
// ConfraPag (android-confrapag/). O APK e' o mesmo para todos os clientes: aqui se
// gera um codigo curto que a maquininha digita (Configuracoes > Vincular) para ficar
// presa a esta maquina/cliente. O CNPJ (ou CPF) do cliente vai junto: e' a
// identificacao do estabelecimento na ConfraPag.
export default function ConfrapagChaves({ clienteId, maquinaId }) {
  const [terminais, setTerminais] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [codigo, setCodigo] = useState(null);
  const [restante, setRestante] = useState(0);
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
    setCodigo(null);
    carregar();
  }, [carregar]);

  // Contagem do codigo; ao expirar, some e a lista recarrega (a maquininha pode ter usado).
  useEffect(() => {
    if (!codigo) return undefined;
    const timer = setInterval(() => {
      const segundos = Math.max(0, Math.round((codigo.fimMs - Date.now()) / 1000));
      setRestante(segundos);
      if (segundos === 0) {
        setCodigo(null);
        carregar();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [codigo, carregar]);

  const gerarCodigo = async () => {
    setGerando(true);
    try {
      const { data } = await api.post("/confrapag/vinculos", {
        maquina_id: maquinaId,
        cliente_id: Number(clienteId),
        cnpj: cnpj.trim() || null,
      });
      setCodigo({ ...data, fimMs: Date.now() + data.validade_segundos * 1000 });
      setRestante(data.validade_segundos);
      setErro("");
    } catch (error) {
      setErro(getApiErrorMessage(error, "Nao foi possivel gerar o codigo"));
    } finally {
      setGerando(false);
    }
  };

  const revogar = async (terminal) => {
    if (!window.confirm(`Desvincular "${terminal.nome}"? Essa maquininha para de funcionar ate ser vinculada de novo.`)) return;
    try {
      await api.delete(`/confrapag/terminais/${terminal.id}`);
      await carregar();
    } catch (error) {
      setErro(getApiErrorMessage(error, "Nao foi possivel desvincular"));
    }
  };

  const alternarTeste = async (terminal) => {
    const ligar = !terminal.modo_teste;
    if (ligar && !window.confirm(`Ligar modo teste em "${terminal.nome}"? O app de teste libera pulso sem cobrar cartao (fica registrado como teste).`)) return;
    try {
      await api.patch(`/confrapag/terminais/${terminal.id}`, { modo_teste: ligar });
      await carregar();
    } catch (error) {
      setErro(getApiErrorMessage(error, "Nao foi possivel alterar o modo teste"));
    }
  };

  const ativos = terminais.filter((t) => t.ativo);
  const minutos = Math.floor(restante / 60);
  const segundos = String(restante % 60).padStart(2, "0");

  return (
    <div className="mt-3 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg-muted)] p-4">
      <span className="mb-1 flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
        <KeyRound size={16} />
        Maquininha ConfraPag (app CompactPay + SDK)
      </span>
      <p className="mb-3 text-xs leading-5 text-[var(--color-text-soft)]">
        Salve a maquina, clique em <strong>Vincular maquininha</strong> e digite o codigo na PAX: segure o logo por 5
        segundos, PIN, campo "Codigo de vinculacao" e Vincular. Ela fica presa a esta maquina
        {maquinaId ? (
          <>
            {" "}
            (<strong className="font-mono text-[var(--color-text)]">{maquinaId}</strong>)
          </>
        ) : null}{" "}
        e a este cliente. Depois e' so tocar em Ativar na maquininha.
      </p>

      {codigo ? (
        <div className="mb-3 rounded-[14px] border border-emerald-300 bg-emerald-50 p-4 text-center">
          <span className="block text-xs font-semibold text-emerald-800">Digite na maquininha:</span>
          <span className="my-1 block font-mono text-4xl font-bold tracking-widest text-emerald-900">{codigo.codigo}</span>
          <span className="block text-xs text-emerald-800">
            Vale por {minutos}:{segundos} · uso unico · maquina {codigo.maquina_id}
          </span>
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
                  Documento {terminal.cnpj} ·{" "}
                  {terminal.ultimo_uso_em
                    ? `usada em ${new Date(terminal.ultimo_uso_em + "Z").toLocaleString("pt-BR")}`
                    : "ainda nao usada"}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => alternarTeste(terminal)}
                  title="Modo teste: o app de teste libera pulso sem cartao"
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 font-semibold ${
                    terminal.modo_teste
                      ? "border-amber-300 bg-amber-50 text-amber-700"
                      : "border-[var(--color-border)] text-[var(--color-text-soft)] hover:border-[var(--color-primary)]"
                  }`}
                >
                  {terminal.modo_teste ? "Modo teste ligado" : "Modo teste"}
                </button>
                <button
                  type="button"
                  onClick={() => revogar(terminal)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full border border-rose-200 px-3 py-1 font-semibold text-rose-600 hover:bg-rose-50"
                >
                  <Trash2 size={13} />
                  Desvincular
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : !carregando ? (
        <p className="mb-3 text-xs text-[var(--color-text-soft)]">Nenhuma maquininha vinculada ainda.</p>
      ) : null}

      <input
        type="text"
        inputMode="numeric"
        value={cnpj}
        onChange={(event) => setCnpj(event.target.value)}
        placeholder="CNPJ ou CPF na ConfraPag (vazio = o do cadastro do cliente)"
        className="mb-2 w-full rounded-[12px] border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
      />
      <button
        type="button"
        onClick={gerarCodigo}
        disabled={gerando || !clienteId || !maquinaId}
        className="inline-flex items-center gap-2 rounded-full bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-60"
      >
        <Link2 size={15} />
        {gerando ? "Gerando..." : codigo ? "Gerar outro codigo" : "Vincular maquininha"}
      </button>

      {erro ? <p className="mt-2 text-xs font-medium text-rose-600">{erro}</p> : null}
    </div>
  );
}
