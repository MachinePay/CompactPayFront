import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Loader2, Send, XCircle } from "lucide-react";

import api, { getApiErrorMessage } from "../api/axios";
import Modal from "./Modal";
import { confirmar } from "../utils/confirmar";

const STATUS_ATUALIZACAO = {
  sent: ["Enviado", "bg-sky-50 text-sky-700"],
  downloading: ["Baixando", "bg-sky-50 text-sky-700"],
  restarting: ["Reiniciando", "bg-amber-50 text-amber-700"],
  updated: ["Atualizado", "bg-emerald-50 text-emerald-700"],
  failed: ["Falhou", "bg-rose-50 text-rose-700"],
  no_update: ["Sem novidade", "bg-slate-100 text-slate-600"],
};
const STATUS_EM_ANDAMENTO = new Set(["sent", "downloading", "restarting"]);

const inputClassName =
  "min-w-0 rounded-[16px] border border-[var(--color-border)] bg-white px-4 py-3 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]";

// "version_2.8.2-portal-tentativas-2026-10-14" -> "v2.8.2"
function versaoCurta(versao) {
  const numero = String(versao || "").match(/\d+\.\d+(\.\d+)?/);
  return numero ? `v${numero[0]}` : versao || "--";
}

export default function AtualizacaoLoteModal({ firmware, onClose, onToast }) {
  const [maquinas, setMaquinas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [clienteId, setClienteId] = useState("");
  const [busca, setBusca] = useState("");
  const [soOnline, setSoOnline] = useState(true);
  const [selecionadas, setSelecionadas] = useState(() => new Set());
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const timerRef = useRef(null);

  const carregarMaquinas = useCallback(() => {
    api
      .get("/maquinas")
      .then(({ data }) => setMaquinas(data || []))
      .catch(() => setMaquinas([]));
  }, []);

  useEffect(() => {
    carregarMaquinas();
    api
      .get("/clientes")
      .then(({ data }) => setClientes(data || []))
      .catch(() => setClientes([]));
    return () => window.clearTimeout(timerRef.current);
  }, [carregarMaquinas]);

  // Depois do envio, acompanha o status das maquinas a cada 5s ate todas
  // terminarem (atualizado / falhou / sem novidade).
  useEffect(() => {
    if (!resultado) return undefined;
    const enviadas = new Set(resultado.resultados.filter((item) => item.enviado).map((item) => item.machine_id));
    const pendente = maquinas.some(
      (item) => enviadas.has(item.id_hardware) && STATUS_EM_ANDAMENTO.has(item.firmware_update_status),
    );
    if (!pendente) return undefined;
    timerRef.current = window.setTimeout(carregarMaquinas, 5000);
    return () => window.clearTimeout(timerRef.current);
  }, [resultado, maquinas, carregarMaquinas]);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return maquinas.filter((item) => {
      if (clienteId && String(item.cliente_id || "") !== clienteId) return false;
      if (soOnline && !item.status_online) return false;
      if (!termo) return true;
      return `${item.nome || ""} ${item.id_hardware} ${item.cliente_nome || ""}`.toLowerCase().includes(termo);
    });
  }, [maquinas, clienteId, busca, soOnline]);

  const alternar = (machineId) => {
    setSelecionadas((atual) => {
      const nova = new Set(atual);
      if (nova.has(machineId)) nova.delete(machineId);
      else nova.add(machineId);
      return nova;
    });
  };

  const selecionarFiltradas = () => {
    setSelecionadas((atual) => {
      const nova = new Set(atual);
      filtradas.forEach((item) => {
        if (item.status_online) nova.add(item.id_hardware);
      });
      return nova;
    });
  };

  const handleEnviar = async () => {
    const ids = [...selecionadas];
    if (ids.length === 0) return;
    const ok = await confirmar({
      titulo: `Atualizar ${ids.length} maquina(s)?`,
      texto:
        `Firmware "${firmware.nome}" vai para todas as maquinas selecionadas agora. Cada uma reinicia ao terminar ` +
        "(fica fora do ar por alguns segundos). Maquinas offline ou ja atualizando sao puladas.",
      confirmarTexto: "Atualizar agora",
      perigoso: true,
    });
    if (!ok) return;
    setEnviando(true);
    try {
      const { data } = await api.post("/maquinas/atualizacao-lote", {
        firmware_version_id: firmware.id,
        machine_ids: ids,
      });
      setResultado(data);
      setSelecionadas(new Set());
      carregarMaquinas();
      onToast({
        message: `${data.enviados} enviada(s)${data.pulados ? `, ${data.pulados} pulada(s)` : ""}.`,
        type: data.enviados ? "success" : "error",
      });
    } catch (error) {
      onToast({ message: getApiErrorMessage(error, "Nao foi possivel enviar a atualizacao em lote."), type: "error" });
    } finally {
      setEnviando(false);
    }
  };

  const maquinaPorId = useMemo(() => Object.fromEntries(maquinas.map((item) => [item.id_hardware, item])), [maquinas]);

  return (
    <Modal open onClose={onClose}>
      <div className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--color-text-soft)]">Atualizacao em lote</div>
      <h2 className="mt-2 text-2xl font-extrabold text-[var(--color-text)]">{firmware.nome}</h2>
      <p className="mt-2 text-sm text-[var(--color-text-soft)]">
        Escolha as maquinas que vao receber esta versao. So maquinas online recebem; as demais sao puladas com o motivo.
      </p>

      {resultado ? (
        <div className="mt-5">
          <div className="text-sm font-extrabold text-[var(--color-text)]">
            {resultado.enviados} enviada(s), {resultado.pulados} pulada(s) - acompanhando ao vivo
          </div>
          <div className="mt-3 max-h-[360px] space-y-2 overflow-y-auto">
            {resultado.resultados.map((item) => {
              const maquina = maquinaPorId[item.machine_id];
              const [rotulo, estilo] = item.enviado
                ? STATUS_ATUALIZACAO[maquina?.firmware_update_status] || ["Enviado", "bg-sky-50 text-sky-700"]
                : ["Pulada", "bg-slate-100 text-slate-600"];
              const andamento = item.enviado && STATUS_EM_ANDAMENTO.has(maquina?.firmware_update_status);
              return (
                <div
                  key={item.machine_id}
                  className="flex items-center justify-between gap-3 rounded-[14px] border border-[var(--color-border)] bg-white px-4 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <div className="truncate font-bold text-[var(--color-text)]">{maquina?.nome || item.machine_id}</div>
                    <div className="text-xs text-[var(--color-text-soft)]">
                      {item.machine_id} - atual {versaoCurta(maquina?.firmware_version)}
                      {!item.enviado && item.motivo ? ` - ${item.motivo}` : ""}
                    </div>
                  </div>
                  <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${estilo}`}>
                    {andamento ? <Loader2 size={12} className="animate-spin" /> : null}
                    {rotulo === "Atualizado" ? <CheckCircle2 size={12} /> : null}
                    {rotulo === "Falhou" ? <XCircle size={12} /> : null}
                    {rotulo}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className="pill-button px-5 py-3 font-semibold" onClick={() => setResultado(null)}>
              Atualizar outras
            </button>
            <button type="button" className="pill-button pill-button--primary px-5 py-3 font-semibold" onClick={onClose}>
              Fechar
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-5 grid gap-3 md:grid-cols-[200px_1fr]">
            <select className={inputClassName} value={clienteId} onChange={(event) => setClienteId(event.target.value)}>
              <option value="">Todos os clientes</option>
              {clientes.map((item) => (
                <option key={item.id} value={String(item.id)}>
                  {item.nome_empresa || item.email_contato}
                </option>
              ))}
            </select>
            <input
              className={inputClassName}
              placeholder="Buscar por nome ou ID"
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
            <label className="flex cursor-pointer items-center gap-2 font-semibold text-[var(--color-text)]">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[var(--color-primary)]"
                checked={soOnline}
                onChange={(event) => setSoOnline(event.target.checked)}
              />
              Mostrar so maquinas online
            </label>
            <div className="flex gap-3">
              <button type="button" className="font-semibold text-[var(--color-primary)] underline" onClick={selecionarFiltradas}>
                Selecionar todas da lista
              </button>
              <button type="button" className="font-semibold text-[var(--color-text-soft)] underline" onClick={() => setSelecionadas(new Set())}>
                Limpar
              </button>
            </div>
          </div>

          <div className="mt-3 max-h-[340px] space-y-2 overflow-y-auto">
            {filtradas.length === 0 ? (
              <div className="rounded-[14px] border border-[var(--color-border)] bg-white px-4 py-6 text-center text-sm text-[var(--color-text-soft)]">
                Nenhuma maquina para esses filtros.
              </div>
            ) : (
              filtradas.map((item) => {
                const [rotulo, estilo] = STATUS_ATUALIZACAO[item.firmware_update_status] || [null, ""];
                return (
                  <label
                    key={item.id_hardware}
                    className="flex cursor-pointer items-center gap-3 rounded-[14px] border border-[var(--color-border)] bg-white px-4 py-3 text-sm hover:border-[var(--color-primary)]"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[var(--color-primary)]"
                      checked={selecionadas.has(item.id_hardware)}
                      onChange={() => alternar(item.id_hardware)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-bold text-[var(--color-text)]">{item.nome || item.id_hardware}</div>
                      <div className="text-xs text-[var(--color-text-soft)]">
                        {item.id_hardware}
                        {item.cliente_nome ? ` - ${item.cliente_nome}` : ""}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
                      <span className="font-semibold text-[var(--color-text)]" title={item.firmware_version || ""}>
                        {versaoCurta(item.firmware_version)}
                      </span>
                      <span className={item.status_online ? "text-emerald-700" : "text-rose-700"}>
                        {item.status_online ? "Online" : "Offline"}
                      </span>
                      {rotulo ? <span className={`rounded-full px-2 py-0.5 font-bold ${estilo}`}>{rotulo}</span> : null}
                    </div>
                  </label>
                );
              })
            )}
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <span className="text-sm text-[var(--color-text-soft)]">{selecionadas.size} selecionada(s)</span>
            <button
              type="button"
              className="pill-button pill-button--primary inline-flex items-center gap-2 px-5 py-3 font-semibold disabled:opacity-50"
              onClick={handleEnviar}
              disabled={enviando || selecionadas.size === 0}
            >
              {enviando ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              Atualizar {selecionadas.size || ""} maquina(s)
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
