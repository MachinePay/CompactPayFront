import { useCallback, useEffect, useMemo, useState } from "react";
import { MessageCircle, QrCode, RefreshCcw, Search, Send } from "lucide-react";

import api, { getApiErrorMessage } from "../api/axios";
import Button from "../components/Button";
import LoadingSpinner from "../components/LoadingSpinner";
import Toast from "../components/Toast";
import { brasiliaDate } from "../utils/dateTime";

const ESTADOS = {
  open: ["Conectado", "bg-emerald-100 text-emerald-700"],
  connecting: ["Aguardando leitura do QR code", "bg-amber-100 text-amber-800"],
  close: ["Desconectado", "bg-rose-100 text-rose-700"],
  inexistente: ["Instancia ainda nao criada", "bg-slate-100 text-slate-600"],
  erro: ["Erro ao consultar", "bg-rose-100 text-rose-700"],
};

const TIPOS = [
  { id: "offline", nome: "Offline", ajuda: "Maquinas do cliente que ficaram sem sinal alem do limite (juntas numa mensagem so)." },
  { id: "lembrete", nome: "Lembrete", ajuda: "Repetido a cada X horas enquanto a maquina continuar offline." },
  { id: "voltou", nome: "Voltou", ajuda: "Quando a maquina avisada volta a ficar online." },
  { id: "resumo", nome: "Resumo diario", ajuda: "Faturamento do dia por maquina, no horario escolhido." },
];

const TIPO_ENVIO = { offline: "Offline", lembrete: "Lembrete", voltou: "Voltou", resumo: "Resumo", teste: "Teste" };

const inputClass =
  "w-full rounded-[14px] border border-[var(--color-border)] bg-white px-4 py-3 text-sm text-[var(--color-text)]";

export default function AdminWhatsapp() {
  const [config, setConfig] = useState(null);
  const [form, setForm] = useState(null);
  const [tipoMensagem, setTipoMensagem] = useState("offline");
  const [conexao, setConexao] = useState(null);
  const [qr, setQr] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [envios, setEnvios] = useState([]);
  const [busca, setBusca] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [conectando, setConectando] = useState(false);
  const [salvandoCliente, setSalvandoCliente] = useState(null);
  const [teste, setTeste] = useState({ telefone: "", enviando: false });
  const [toast, setToast] = useState(null);
  const [erroCarga, setErroCarga] = useState("");
  const fecharToast = useCallback(() => setToast(null), []);

  const aplicarConfig = (data) => {
    setConfig(data);
    setForm({
      evolution_url: data.evolution_url || "",
      api_key: "",
      instancia: data.instancia || "",
      minutos_offline: data.minutos_offline,
      lembrete_horas: data.lembrete_horas,
      resumo_horario: data.resumo_horario,
      mensagens: { ...data.mensagens },
    });
  };

  const carregarConexao = useCallback(() => {
    api
      .get("/whatsapp/conexao")
      .then(({ data }) => {
        setConexao(data);
        if (data?.estado === "open") setQr(null);
      })
      .catch(() => setConexao(null));
  }, []);

  const carregarEnvios = useCallback(() => {
    api.get("/whatsapp/envios").then(({ data }) => setEnvios(data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    api
      .get("/whatsapp/config")
      .then(({ data }) => aplicarConfig(data))
      .catch((err) => setErroCarga(getApiErrorMessage(err, "Nao foi possivel carregar a configuracao do WhatsApp")));
    api.get("/whatsapp/clientes").then(({ data }) => setClientes(data || [])).catch(() => {});
    carregarConexao();
    carregarEnvios();
  }, [carregarConexao, carregarEnvios]);

  // Enquanto o QR code esta na tela, confere a cada 5 s se ja conectou.
  useEffect(() => {
    if (!qr) return undefined;
    const timer = window.setInterval(carregarConexao, 5000);
    return () => window.clearInterval(timer);
  }, [qr, carregarConexao]);

  const salvarConfig = async (extra = {}) => {
    setSalvando(true);
    try {
      const payload = { ...form, ...extra };
      if (!payload.api_key) delete payload.api_key;
      const { data } = await api.put("/whatsapp/config", payload);
      aplicarConfig(data);
      carregarConexao();
      setToast({ message: "Configuracao salva", type: "success" });
    } catch (err) {
      setToast({ message: getApiErrorMessage(err, "Nao foi possivel salvar"), type: "error" });
    } finally {
      setSalvando(false);
    }
  };

  const conectar = async () => {
    setConectando(true);
    try {
      const { data } = await api.post("/whatsapp/conectar");
      if (data.estado === "open") {
        setToast({ message: "O numero ja esta conectado", type: "success" });
        setQr(null);
      } else {
        setQr(data);
      }
      carregarConexao();
    } catch (err) {
      setToast({ message: getApiErrorMessage(err, "Nao foi possivel gerar o QR code"), type: "error" });
    } finally {
      setConectando(false);
    }
  };

  const salvarCliente = async (cliente, campos) => {
    const novo = { ...cliente, ...campos };
    setSalvandoCliente(cliente.cliente_id);
    try {
      const { data } = await api.put(`/whatsapp/clientes/${cliente.cliente_id}`, {
        ativo: novo.ativo,
        recebe_lembrete: novo.recebe_lembrete,
        recebe_voltou: novo.recebe_voltou,
        resumo_diario: novo.resumo_diario,
        resumo_horario: novo.resumo_horario || null,
      });
      setClientes((atual) => atual.map((item) => (item.cliente_id === cliente.cliente_id ? data : item)));
    } catch (err) {
      setToast({ message: getApiErrorMessage(err, "Nao foi possivel salvar o cliente"), type: "error" });
    } finally {
      setSalvandoCliente(null);
    }
  };

  const enviarTeste = async () => {
    setTeste((t) => ({ ...t, enviando: true }));
    try {
      await api.post("/whatsapp/teste", { telefone: teste.telefone, tipo: tipoMensagem });
      setToast({ message: "Mensagem de teste enviada", type: "success" });
    } catch (err) {
      setToast({ message: getApiErrorMessage(err, "Falha ao enviar o teste"), type: "error" });
    } finally {
      setTeste((t) => ({ ...t, enviando: false }));
      carregarEnvios();
    }
  };

  const clientesFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const lista = termo
      ? clientes.filter((c) => `${c.nome} ${(c.numeros_envio || []).join(" ")}`.toLowerCase().includes(termo))
      : clientes;
    const peso = (c) => Number(c.ativo) + Number(c.resumo_diario);
    return [...lista].sort((a, b) => peso(b) - peso(a));
  }, [clientes, busca]);

  if (erroCarga && !config) {
    return (
      <section className="app-panel rounded-[30px] p-8 text-center text-sm text-[var(--color-error)]">{erroCarga}</section>
    );
  }
  if (!config || !form) return <LoadingSpinner className="min-h-[60vh]" />;

  const estado = ESTADOS[conexao?.estado] || ["Nao configurado", "bg-slate-100 text-slate-600"];
  const comOffline = clientes.filter((c) => c.ativo).length;
  const comResumo = clientes.filter((c) => c.resumo_diario).length;
  const tipoAtual = TIPOS.find((t) => t.id === tipoMensagem);

  return (
    <div className="flex min-h-full flex-col gap-4">
      {toast ? <Toast message={toast.message} type={toast.type} onClose={fecharToast} /> : null}

      <section className="app-panel rounded-[30px] p-6 md:p-7">
        <div className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--color-text-soft)]">Admin</div>
        <h1 className="mt-3 text-4xl font-extrabold tracking-[-0.05em] text-[var(--color-text)] md:text-5xl">
          WhatsApp
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--color-text-soft)] md:text-base">
          Avisos automaticos para o telefone do perfil do cliente: maquina offline, lembrete enquanto continuar
          offline, aviso de que voltou e resumo diario do faturamento. Cada cliente escolhe o que recebe na lista
          abaixo. Maquina com o ponto fechado (horario ou fechamento pontual configurado na maquina) nao gera aviso.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <span
            className={`rounded-full px-3 py-1.5 font-bold ${config.ativo ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}
          >
            Envio {config.ativo ? "ativado" : "desativado"}
          </span>
          <span className={`rounded-full px-3 py-1.5 font-bold ${estado[1]}`}>{estado[0]}</span>
          <span className="text-[var(--color-text-soft)]">
            {comOffline} cliente(s) com aviso de offline · {comResumo} com resumo diario
          </span>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="app-panel space-y-4 rounded-[30px] p-6">
          <h2 className="text-xl font-extrabold text-[var(--color-text)]">Conexao (Evolution API)</h2>
          <Campo label="URL da Evolution API">
            <input
              className={inputClass}
              placeholder="https://evolution.seudominio.com"
              value={form.evolution_url}
              onChange={(e) => setForm({ ...form, evolution_url: e.target.value })}
            />
          </Campo>
          <Campo
            label="Chave (apikey)"
            ajuda={config.api_key_configurada ? `Atual: ${config.api_key_mascarada}. Deixe em branco para manter.` : null}
          >
            <input
              className={inputClass}
              type="password"
              autoComplete="new-password"
              value={form.api_key}
              onChange={(e) => setForm({ ...form, api_key: e.target.value })}
            />
          </Campo>
          <Campo label="Instancia" ajuda="Nome da instancia na Evolution. Se nao existir, e' criada ao conectar.">
            <input
              className={inputClass}
              placeholder="compactpay"
              value={form.instancia}
              onChange={(e) => setForm({ ...form, instancia: e.target.value })}
            />
          </Campo>
          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={() => salvarConfig()} disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
            </Button>
            <button
              type="button"
              className="pill-button inline-flex items-center gap-2 px-5 py-3 font-semibold"
              onClick={conectar}
              disabled={conectando || !conexao?.configurado}
            >
              <QrCode size={16} /> {conectando ? "Gerando..." : "Conectar numero"}
            </button>
            <button
              type="button"
              className="pill-button inline-flex items-center gap-2 px-5 py-3 font-semibold"
              onClick={carregarConexao}
            >
              <RefreshCcw size={16} /> Atualizar status
            </button>
          </div>
          {conexao?.erro ? <div className="text-sm text-[var(--color-error)]">{conexao.erro}</div> : null}
          {qr ? (
            <div className="rounded-[18px] border border-[var(--color-border)] bg-white p-4 text-center">
              <p className="text-sm text-[var(--color-text-soft)]">
                No celular: WhatsApp &gt; Aparelhos conectados &gt; Conectar aparelho, e leia o codigo.
              </p>
              {qr.qr_base64 ? <img src={qr.qr_base64} alt="QR code" className="mx-auto mt-3 h-64 w-64" /> : null}
              {qr.pairing_code ? (
                <div className="mt-2 text-sm">
                  Codigo de pareamento: <strong>{qr.pairing_code}</strong>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="border-t border-[var(--color-border)] pt-4">
            <label className="flex items-center gap-3 text-sm font-semibold">
              <input
                type="checkbox"
                checked={config.ativo}
                onChange={(e) => salvarConfig({ ativo: e.target.checked })}
                disabled={salvando}
              />
              Envio automatico ativado
            </label>
            <p className="mt-1 text-xs text-[var(--color-text-soft)]">
              Desligado, nenhuma mensagem automatica sai. Maquinas que ja estavam offline antes de ativar nao recebem aviso.
            </p>
          </div>
        </section>

        <section className="app-panel space-y-4 rounded-[30px] p-6">
          <h2 className="text-xl font-extrabold text-[var(--color-text)]">Tempos</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Campo label="Avisar apos (min offline)">
              <input
                className={inputClass}
                type="number"
                min={5}
                max={1440}
                value={form.minutos_offline}
                onChange={(e) => setForm({ ...form, minutos_offline: Number(e.target.value) })}
              />
            </Campo>
            <Campo label="Lembrete a cada (horas)" ajuda="0 desliga para todos">
              <input
                className={inputClass}
                type="number"
                min={0}
                max={168}
                value={form.lembrete_horas}
                onChange={(e) => setForm({ ...form, lembrete_horas: Number(e.target.value) })}
              />
            </Campo>
            <Campo label="Resumo diario as" ajuda="Padrao; cada cliente pode ter outro">
              <input
                className={inputClass}
                type="time"
                value={form.resumo_horario}
                onChange={(e) => setForm({ ...form, resumo_horario: e.target.value })}
              />
            </Campo>
          </div>

          <h2 className="pt-2 text-xl font-extrabold text-[var(--color-text)]">Mensagens</h2>
          <div className="flex flex-wrap gap-2">
            {TIPOS.map((tipo) => (
              <button
                key={tipo.id}
                type="button"
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  tipoMensagem === tipo.id
                    ? "bg-[var(--color-primary)] text-white"
                    : "border border-[var(--color-border)] bg-white text-[var(--color-text)]"
                }`}
                onClick={() => setTipoMensagem(tipo.id)}
              >
                {tipo.nome}
              </button>
            ))}
          </div>
          <p className="text-xs text-[var(--color-text-soft)]">{tipoAtual.ajuda}</p>
          <textarea
            className={`${inputClass} min-h-[200px] font-mono`}
            value={form.mensagens[tipoMensagem] || ""}
            onChange={(e) => setForm({ ...form, mensagens: { ...form.mensagens, [tipoMensagem]: e.target.value } })}
          />
          <div className="text-xs leading-6 text-[var(--color-text-soft)]">
            Variaveis: {(config.variaveis[tipoMensagem] || []).map((v) => `{${v}}`).join(" ")}.{" "}
            <code>{"{maquinas}"}</code> vira a lista das maquinas. Use *texto* para negrito.
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={() => salvarConfig()} disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar tempos e mensagens"}
            </Button>
            <button
              type="button"
              className="pill-button px-5 py-3 font-semibold"
              onClick={() =>
                setForm({
                  ...form,
                  mensagens: { ...form.mensagens, [tipoMensagem]: config.mensagens_padrao[tipoMensagem] },
                })
              }
            >
              Voltar ao texto padrao
            </button>
          </div>

          <div className="border-t border-[var(--color-border)] pt-4">
            <div className="text-sm font-semibold">Enviar teste da mensagem &quot;{tipoAtual.nome}&quot; (dados de exemplo)</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                className={`${inputClass} max-w-[220px]`}
                placeholder="(11) 99999-9999"
                value={teste.telefone}
                onChange={(e) => setTeste({ ...teste, telefone: e.target.value })}
              />
              <button
                type="button"
                className="pill-button inline-flex items-center gap-2 px-5 py-3 font-semibold"
                onClick={enviarTeste}
                disabled={teste.enviando || !teste.telefone}
              >
                <Send size={16} /> {teste.enviando ? "Enviando..." : "Enviar"}
              </button>
            </div>
            <p className="mt-1 text-xs text-[var(--color-text-soft)]">
              O teste usa o texto salvo. Salve antes de testar uma alteracao.
            </p>
          </div>
        </section>
      </div>

      <section className="app-panel rounded-[30px] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-extrabold text-[var(--color-text)]">O que cada cliente recebe</h2>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-soft)]" />
            <input
              className={`${inputClass} pl-9`}
              placeholder="Buscar cliente"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
        </div>
        <p className="mt-1 text-xs text-[var(--color-text-soft)]">
          Vai para o telefone cadastrado no perfil do cliente (tela Usuarios). Lembrete e &quot;voltou&quot; dependem do
          aviso de offline. Horario do resumo vazio = padrao ({config.resumo_horario}).
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-left text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-soft)]">
              <tr>
                <th className="px-3 py-2">Cliente</th>
                <th className="px-3 py-2 text-center">Offline</th>
                <th className="px-3 py-2 text-center">Lembrete</th>
                <th className="px-3 py-2 text-center">Voltou</th>
                <th className="px-3 py-2">Resumo diario</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)] bg-white">
              {clientesFiltrados.map((cliente) => {
                const semTelefone = !cliente.numeros_envio?.length;
                const ocupado = salvandoCliente === cliente.cliente_id;
                return (
                  <tr key={cliente.cliente_id}>
                    <td className="px-3 py-3">
                      <span className="block font-semibold text-[var(--color-text)]">{cliente.nome}</span>
                      <span className="block text-xs text-[var(--color-text-soft)]">
                        {cliente.maquinas} maquina(s) ·{" "}
                        {semTelefone ? (
                          <span className="text-[var(--color-error)]">sem telefone valido no perfil</span>
                        ) : (
                          cliente.numeros_envio.join(", ")
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={cliente.ativo}
                        disabled={ocupado || (semTelefone && !cliente.ativo)}
                        onChange={(e) => salvarCliente(cliente, { ativo: e.target.checked })}
                      />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={cliente.recebe_lembrete}
                        disabled={ocupado || !cliente.ativo}
                        onChange={(e) => salvarCliente(cliente, { recebe_lembrete: e.target.checked })}
                      />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={cliente.recebe_voltou}
                        disabled={ocupado || !cliente.ativo}
                        onChange={(e) => salvarCliente(cliente, { recebe_voltou: e.target.checked })}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={cliente.resumo_diario}
                          disabled={ocupado || (semTelefone && !cliente.resumo_diario)}
                          onChange={(e) => salvarCliente(cliente, { resumo_diario: e.target.checked })}
                        />
                        <input
                          type="time"
                          className="rounded-lg border border-[var(--color-border)] px-2 py-1 disabled:opacity-50"
                          value={cliente.resumo_horario || ""}
                          disabled={ocupado || !cliente.resumo_diario}
                          onChange={(e) => salvarCliente(cliente, { resumo_horario: e.target.value })}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!clientesFiltrados.length ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-[var(--color-text-soft)]">
                    Nenhum cliente encontrado
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="app-panel rounded-[30px] p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-extrabold text-[var(--color-text)]">Ultimos envios</h2>
          <button
            type="button"
            className="pill-button inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold"
            onClick={carregarEnvios}
          >
            <RefreshCcw size={14} /> Atualizar
          </button>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-soft)]">
              <tr>
                <th className="px-3 py-2">Quando</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Cliente / maquinas</th>
                <th className="px-3 py-2">Numero</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {envios.map((envio) => (
                <tr key={envio.id} title={envio.mensagem}>
                  <td className="whitespace-nowrap px-3 py-2">
                    {brasiliaDate(envio.created_at).format("DD/MM HH:mm")}
                  </td>
                  <td className="px-3 py-2">{TIPO_ENVIO[envio.tipo] || envio.tipo}</td>
                  <td className="px-3 py-2">
                    {envio.cliente_nome || "-"}
                    {envio.maquinas ? ` · ${envio.maquinas}` : ""}
                  </td>
                  <td className="px-3 py-2">{envio.telefone}</td>
                  <td className="px-3 py-2">
                    {envio.status === "enviado" ? (
                      <span className="font-semibold text-emerald-700">Enviado</span>
                    ) : (
                      <span className="font-semibold text-[var(--color-error)]" title={envio.erro}>
                        Erro: {envio.erro}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {!envios.length ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-[var(--color-text-soft)]">
                    <MessageCircle size={18} className="mx-auto mb-1" />
                    Nenhuma mensagem enviada ainda
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Campo({ label, ajuda, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-[var(--color-text)]">{label}</span>
      {children}
      {ajuda ? <span className="mt-1 block text-xs text-[var(--color-text-soft)]">{ajuda}</span> : null}
    </label>
  );
}
