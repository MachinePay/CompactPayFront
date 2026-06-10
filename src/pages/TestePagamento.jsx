import { useCallback, useEffect, useMemo, useState } from "react";
import { CreditCard, QrCode, Send } from "lucide-react";
import api from "../api/axios";

export default function TestePagamento() {
  const [maquinas, setMaquinas] = useState([]);
  const [machineId, setMachineId] = useState("");
  const [terminalId, setTerminalId] = useState("");
  const [mpAccessToken, setMpAccessToken] = useState("");
  const [mpPublicKey, setMpPublicKey] = useState("");
  const [mpWebhookSecret, setMpWebhookSecret] = useState("");
  const [valor, setValor] = useState("5.00");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [feedbackType, setFeedbackType] = useState("success");
  const [escutaAtiva, setEscutaAtiva] = useState(false);
  const [escutasAtivas, setEscutasAtivas] = useState([]);

  const machineOptions = useMemo(
    () => maquinas.map((item) => ({ id: item.id_hardware, nome: item.nome || item.id_hardware })),
    [maquinas],
  );

  useEffect(() => {
    const saved = localStorage.getItem("compactpay.teste-pagamento.config");
    if (saved) {
      try {
        const config = JSON.parse(saved);
        setMachineId(config.machineId || "");
        setTerminalId(config.terminalId || "");
        setMpAccessToken(config.mpAccessToken || "");
        setMpPublicKey(config.mpPublicKey || "");
        setMpWebhookSecret(config.mpWebhookSecret || "");
      } catch {
        // ignora erro de parse de config antiga
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "compactpay.teste-pagamento.config",
      JSON.stringify({
        machineId,
        terminalId,
        mpAccessToken,
        mpPublicKey,
        mpWebhookSecret,
      }),
    );
  }, [machineId, terminalId, mpAccessToken, mpPublicKey, mpWebhookSecret]);

  const loadMaquinas = useCallback(async () => {
    const { data } = await api.get("/maquinas");
    setMaquinas(data || []);
    if (!machineId && data?.length) {
      setMachineId(data[0].id_hardware);
    }
  }, [machineId]);

  useEffect(() => {
    const timer = window.setTimeout(loadMaquinas, 0);
    return () => window.clearTimeout(timer);
  }, [loadMaquinas]);

  const carregarEscutas = useCallback(async () => {
    try {
      const { data } = await api.get("/pagamentos/escuta");
      const ativos = data?.ativos || [];
      setEscutasAtivas(ativos);
      const existeEscutaAtual = ativos.some((item) => item.terminal_id === terminalId && item.machine_id === machineId);
      setEscutaAtiva(existeEscutaAtual);
    } catch {
      setEscutasAtivas([]);
    }
  }, [machineId, terminalId]);

  useEffect(() => {
    const timer = window.setTimeout(carregarEscutas, 0);
    return () => window.clearTimeout(timer);
  }, [carregarEscutas]);

  const lancarPagamento = async (canal) => {
    if (!machineId) return;
    setLoading(true);
    setFeedback("");
    try {
      const valorNumerico = Number(valor);
      await api.post("/pagamentos/lancar", {
        maquina_id: machineId,
        valor: Number.isFinite(valorNumerico) && valorNumerico > 0 ? valorNumerico : 1,
        descricao: `Teste temporario via ${canal}`,
      });
      setFeedbackType("success");
      setFeedback(`Pagamento ${canal} enviado e pulso disparado para ${machineId}.`);
    } catch {
      setFeedbackType("error");
      setFeedback(`Falha ao processar pagamento ${canal}.`);
    } finally {
      setLoading(false);
    }
  };

  const iniciarEscuta = async () => {
    if (!machineId || !terminalId) return;
    setLoading(true);
    setFeedback("");
    try {
      await api.post("/pagamentos/escuta/iniciar", {
        maquina_id: machineId,
        terminal_id: terminalId,
      });
      setEscutaAtiva(true);
      await carregarEscutas();
      setFeedbackType("success");
      setFeedback("Escuta ativada. Agora pague na maquininha vinculada: quando o pagamento aprovar, o pulso sera enviado automaticamente.");
    } catch {
      setFeedbackType("error");
      setFeedback("Falha ao iniciar escuta da maquininha.");
    } finally {
      setLoading(false);
    }
  };

  const pararEscuta = async () => {
    if (!terminalId) return;
    setLoading(true);
    setFeedback("");
    try {
      await api.post("/pagamentos/escuta/parar", {
        terminal_id: terminalId,
      });
      setEscutaAtiva(false);
      await carregarEscutas();
      setFeedbackType("success");
      setFeedback("Escuta parada para este terminal.");
    } catch {
      setFeedbackType("error");
      setFeedback("Falha ao parar escuta.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col gap-4">
      <section className="app-panel rounded-[30px] p-6 md:p-7">
        <div className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--color-text-soft)]">
          Ambiente Temporario
        </div>
        <h1 className="mt-3 text-4xl font-extrabold tracking-[-0.05em] text-[var(--color-text)] md:text-5xl">
          Teste de PIX e Maquininha
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--color-text-soft)] md:text-base">
          Informe o ID da maquina que deseja testar e os dados do Mercado Pago. Ao confirmar, o sistema registra
          pagamento digital e envia o mesmo pulso de credito usado no botao de teste.
        </p>
      </section>

      <section className="app-panel rounded-[30px] p-5 md:p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[var(--color-text)]">ID da maquina (manual)</span>
            <input
              className="w-full rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-4 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
              value={machineId}
              onChange={(e) => setMachineId(e.target.value.toUpperCase())}
              placeholder="Ex.: CPM-ABC123"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[var(--color-text)]">Preencher por lista (opcional)</span>
            <select
              className="w-full rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-4 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
              value={machineId}
              onChange={(e) => setMachineId(e.target.value)}
            >
              <option value="">Selecione uma maquina</option>
              {machineOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nome} ({item.id})
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[var(--color-text)]">Valor (R$)</span>
            <input
              className="w-full rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-4 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
              type="number"
              min="0.01"
              step="0.01"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[var(--color-text)]">Terminal ID (maquininha)</span>
            <input
              className="w-full rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-4 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
              value={terminalId}
              onChange={(e) => setTerminalId(e.target.value)}
              placeholder="Ex.: PAX_A910_123456"
            />
          </label>

          <label className="block md:col-span-2">
            <span className="mb-2 block text-sm font-semibold text-[var(--color-text)]">MP Access Token</span>
            <input
              className="w-full rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-4 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
              value={mpAccessToken}
              onChange={(e) => setMpAccessToken(e.target.value)}
              placeholder="APP_USR-..."
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[var(--color-text)]">MP Public Key</span>
            <input
              className="w-full rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-4 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
              value={mpPublicKey}
              onChange={(e) => setMpPublicKey(e.target.value)}
              placeholder="APP_USR-..."
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[var(--color-text)]">MP Webhook Secret</span>
            <input
              className="w-full rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-4 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
              value={mpWebhookSecret}
              onChange={(e) => setMpWebhookSecret(e.target.value)}
              placeholder="chave do webhook"
            />
          </label>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <button
            type="button"
            className="pill-button pill-button--primary inline-flex items-center justify-center gap-2 px-5 py-4 text-sm font-semibold"
            onClick={() => lancarPagamento("PIX")}
            disabled={loading || !machineId}
          >
            <QrCode size={16} />
            {loading ? "Processando..." : "Pagar com PIX"}
          </button>

          <button
            type="button"
            className="pill-button inline-flex items-center justify-center gap-2 px-5 py-4 text-sm font-semibold"
            onClick={iniciarEscuta}
            disabled={loading || !machineId || !terminalId}
          >
            <CreditCard size={16} />
            {loading ? "Ativando..." : "Iniciar Escuta Maquininha"}
          </button>

          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--color-border)] bg-white px-5 py-4 text-sm font-semibold text-[var(--color-text)] transition hover:border-[var(--color-primary)]"
            onClick={pararEscuta}
            disabled={loading || !terminalId || !escutaAtiva}
          >
            <Send size={16} />
            Parar Escuta
          </button>
        </div>

        {feedback ? (
          <div
            className={`mt-4 rounded-2xl px-4 py-3 text-sm font-semibold ${
              feedbackType === "success"
                ? "bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)]"
                : "bg-rose-50 text-[var(--color-error)]"
            }`}
          >
            {feedback}
          </div>
        ) : null}
      </section>

      <section className="app-panel rounded-[30px] p-5 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold tracking-[-0.03em] text-[var(--color-text)]">
              Escutas ativas
            </h2>
            <p className="mt-1 text-sm text-[var(--color-text-soft)]">
              Terminais vinculados no backend para liberar pulso apos pagamento aprovado.
            </p>
          </div>
          <button
            type="button"
            className="pill-button inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold"
            onClick={carregarEscutas}
          >
            Atualizar
          </button>
        </div>

        <div className="mt-4 overflow-hidden rounded-[20px] border border-[var(--color-border)] bg-white">
          {escutasAtivas.length === 0 ? (
            <div className="px-4 py-5 text-sm text-[var(--color-text-soft)]">
              Nenhuma escuta ativa no momento.
            </div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-[var(--color-bg-muted)] text-left text-xs uppercase tracking-[0.16em] text-[var(--color-text-soft)]">
                <tr>
                  <th className="px-4 py-3">Terminal</th>
                  <th className="px-4 py-3">Maquina</th>
                  <th className="px-4 py-3">Atualizado</th>
                </tr>
              </thead>
              <tbody>
                {escutasAtivas.map((item) => (
                  <tr key={`${item.terminal_id}-${item.machine_id}`} className="border-t border-[var(--color-border)] text-[var(--color-text)]">
                    <td className="px-4 py-3 font-semibold">{item.terminal_id}</td>
                    <td className="px-4 py-3">{item.machine_id}</td>
                    <td className="px-4 py-3 text-[var(--color-text-soft)]">
                      {item.updated_at ? new Date(item.updated_at).toLocaleString("pt-BR") : "--"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
