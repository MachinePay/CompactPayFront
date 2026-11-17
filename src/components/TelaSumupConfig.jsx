import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Copy, Link2, MonitorSmartphone, RefreshCcw, Trash2 } from "lucide-react";

import api, { getApiErrorMessage } from "../api/axios";

// Tela touch numa maquina SumUp: a cobranca vai para a maquininha SumUp pareada
// pela Cloud API (rotas /tela no backend, app/services/tela_sumup.py).
export default function TelaSumupConfig({ maquinaId, maquinaSalva }) {
  const [reader, setReader] = useState(undefined); // undefined = carregando
  const [codigo, setCodigo] = useState("");
  const [telas, setTelas] = useState([]);
  const [telefone, setTelefone] = useState("");
  const [telefoneSalvo, setTelefoneSalvo] = useState(false);
  const [novaChave, setNovaChave] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState("");
  const [erro, setErro] = useState("");

  const base = `/tela/maquinas/${encodeURIComponent(maquinaId)}`;

  const carregar = useCallback(async () => {
    if (!maquinaSalva || !maquinaId) return;
    const [readerResp, telasResp, manutResp] = await Promise.allSettled([
      api.get(`${base}/sumup`),
      api.get("/tela/telas"),
      api.get(`${base}/manutencao`),
    ]);
    if (readerResp.status === "fulfilled") {
      setReader(readerResp.value.data);
      setErro("");
    } else {
      setReader(null);
      setErro(getApiErrorMessage(readerResp.reason, "Nao foi possivel ver a maquininha SumUp"));
    }
    if (telasResp.status === "fulfilled") {
      setTelas(telasResp.value.data.filter((t) => t.maquina_id === maquinaId && t.ativo));
    }
    if (manutResp.status === "fulfilled") setTelefone(manutResp.value.data.telefone || "");
  }, [base, maquinaId, maquinaSalva]);

  useEffect(() => {
    setNovaChave(null);
    setAviso("");
    carregar();
  }, [carregar]);

  const parear = async () => {
    if (!codigo.trim()) return;
    setOcupado(true);
    try {
      await api.post(`${base}/sumup/parear`, { pairing_code: codigo.trim() });
      setCodigo("");
      setAviso("Maquininha pareada. Confirme na tela dela se aparecer pedido.");
      setErro("");
      await carregar();
    } catch (error) {
      setErro(getApiErrorMessage(error, "Nao foi possivel parear a maquininha"));
    } finally {
      setOcupado(false);
    }
  };

  const gerar = async () => {
    setOcupado(true);
    setCopiado(false);
    try {
      const { data } = await api.post("/tela/telas", { maquina_id: maquinaId, nome: `Tela ${maquinaId}` });
      setNovaChave(data);
      setErro("");
      await carregar();
    } catch (error) {
      setErro(getApiErrorMessage(error, "Nao foi possivel gerar a chave da tela"));
    } finally {
      setOcupado(false);
    }
  };

  const revogar = async (tela) => {
    if (!window.confirm(`Revogar a chave de "${tela.nome}"? A tela para de cobrar.`)) return;
    try {
      await api.delete(`/tela/telas/${tela.id}`);
      if (novaChave?.id === tela.id) setNovaChave(null);
      await carregar();
    } catch (error) {
      setErro(getApiErrorMessage(error, "Nao foi possivel revogar a chave"));
    }
  };

  const salvarTelefone = async () => {
    try {
      const { data } = await api.put(`${base}/manutencao`, { telefone: telefone.trim() || null });
      setTelefone(data.telefone || "");
      setTelefoneSalvo(true);
    } catch (error) {
      setErro(getApiErrorMessage(error, "Nao foi possivel salvar o numero de manutencao"));
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

  const semEnter = (acao) => (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      acao();
    }
  };

  if (!maquinaSalva) {
    return (
      <div className="mt-3 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg-muted)] p-4 text-xs text-[var(--color-text-soft)]">
        Salve a maquina e abra de novo para configurar a tela touch com a SumUp.
      </div>
    );
  }

  const campo =
    "min-w-0 flex-1 rounded-[10px] border border-[var(--color-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]";
  const botaoCheio = "shrink-0 rounded-full bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60";

  return (
    <div className="mt-3 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg-muted)] p-4">
      <span className="mb-1 flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
        <MonitorSmartphone size={16} />
        Tela touch + SumUp (Cloud API)
      </span>
      <p className="mb-3 text-xs leading-5 text-[var(--color-text-soft)]">
        Opcional: so para maquinas com a tela touch. 1) Pareie a maquininha SumUp. 2) Gere a chave da tela. A
        cobranca escolhida na tela aparece na maquininha e o credito sai quando ela aprovar.
      </p>

      <div className="mb-3 rounded-[10px] bg-white px-3 py-2 text-xs">
        <span className="mb-1 flex items-center gap-1 font-semibold text-[var(--color-text)]">
          <Link2 size={13} />
          Maquininha pareada
        </span>
        <span className="mb-2 block text-[var(--color-text-soft)]">
          {reader === undefined
            ? "Carregando..."
            : reader?.reader_id
              ? `Reader ${reader.reader_id}`
              : "Nenhuma maquininha pareada pela Cloud API."}
        </span>
        <span className="mb-2 block text-[var(--color-text-soft)]">
          Na maquininha: Conexoes &gt; API &gt; Conectar. Digite o codigo que aparece (vale 5 minutos).
        </span>
        <div className="flex gap-2">
          <input
            className={campo}
            placeholder="Codigo de pareamento"
            value={codigo}
            maxLength={20}
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            onKeyDown={semEnter(parear)}
          />
          <button type="button" onClick={parear} disabled={ocupado || !codigo.trim()} className={botaoCheio}>
            {reader?.reader_id ? "Parear outra" : "Parear"}
          </button>
        </div>
      </div>

      <div className="mb-3 rounded-[10px] bg-white px-3 py-2 text-xs">
        <span className="mb-1 block font-semibold text-[var(--color-text)]">Numero de manutencao</span>
        <span className="mb-2 block text-[var(--color-text-soft)]">
          Aparece em letra grande na tela vermelha quando a maquina fica offline. Vazio = telefone do cliente.
        </span>
        <div className="flex gap-2">
          <input
            className={campo}
            placeholder="Ex.: (11) 99999-0000"
            value={telefone}
            maxLength={40}
            onChange={(e) => {
              setTelefone(e.target.value);
              setTelefoneSalvo(false);
            }}
            onKeyDown={semEnter(salvarTelefone)}
          />
          <button type="button" onClick={salvarTelefone} className={botaoCheio}>
            {telefoneSalvo ? "Salvo" : "Salvar"}
          </button>
        </div>
      </div>

      {novaChave ? (
        <div className="mb-3 rounded-[14px] border border-emerald-300 bg-emerald-50 p-3">
          <span className="block text-xs font-semibold text-emerald-800">
            Chave da tela - copie agora, ela nao aparece de novo:
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

      {telas.length > 0 ? (
        <ul className="mb-3 space-y-2">
          {telas.map((tela) => (
            <li key={tela.id} className="flex items-center justify-between gap-2 rounded-[10px] bg-white px-3 py-2 text-xs">
              <span className="min-w-0">
                <span className="block font-semibold text-[var(--color-text)]">{tela.nome}</span>
                <span className="block text-[var(--color-text-soft)]">
                  {tela.chave_prefixo}… ·{" "}
                  {tela.ultimo_uso_em
                    ? `usada em ${new Date(tela.ultimo_uso_em + "Z").toLocaleString("pt-BR")}`
                    : "ainda nao usada"}
                </span>
              </span>
              <button
                type="button"
                onClick={() => revogar(tela)}
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-rose-200 px-3 py-1 font-semibold text-rose-600 hover:bg-rose-50"
              >
                <Trash2 size={13} />
                Revogar
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <button
        type="button"
        onClick={gerar}
        disabled={ocupado || !reader?.reader_id}
        className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--color-text)] transition hover:border-[var(--color-primary)] disabled:opacity-60"
      >
        <RefreshCcw size={15} className={ocupado ? "animate-spin" : ""} />
        {telas.length > 0 ? "Trocar chave da tela" : "Gerar chave da tela"}
      </button>

      {aviso ? <p className="mt-2 text-xs font-medium text-emerald-700">{aviso}</p> : null}
      {erro ? <p className="mt-2 text-xs font-medium text-rose-600">{erro}</p> : null}
    </div>
  );
}
