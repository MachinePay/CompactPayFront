import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Eye, EyeOff, Loader2, Lock, RefreshCcw, Search, Send, Unlock, Wifi, XCircle } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import api, { getApiErrorMessage } from "../api/axios";
import DateRangePicker from "../components/DateRangePicker";
import LoadingSpinner from "../components/LoadingSpinner";
import Toast from "../components/Toast";
import { confirmar } from "../utils/confirmar";
import { brasiliaDate } from "../utils/dateTime";

// Firmware que aceita troca de Wi-Fi pelo painel (backend: MIN_FIRMWARE_VERSION_FOR_WIFI).
const VERSAO_MINIMA_WIFI = [2, 8, 0];
const LIMITE_ACOMPANHAMENTO_MS = 3 * 60 * 1000;
const LIMITE_PROCURA_MS = 30 * 1000;

function qualidadeSinal(rssi) {
  return Math.max(0, Math.min(100, 2 * (Number(rssi) + 100)));
}

function suportaWifiRemoto(versao) {
  const numeros = String(versao || "").match(/(\d+)\.(\d+)\.(\d+)/);
  if (!numeros) return false;
  const atual = numeros.slice(1).map(Number);
  for (let i = 0; i < 3; i += 1) {
    if (atual[i] !== VERSAO_MINIMA_WIFI[i]) return atual[i] > VERSAO_MINIMA_WIFI[i];
  }
  return true;
}

const RESULTADO_ESTILO = {
  trocado: ["Trocou", "bg-emerald-50 text-emerald-700"],
  falhou: ["Falhou", "bg-rose-50 text-rose-700"],
  recusado: ["Recusada", "bg-amber-50 text-amber-700"],
  testando: ["Testando", "bg-sky-50 text-sky-700"],
  sem_confirmacao: ["Sem confirmacao", "bg-amber-50 text-amber-700"],
};

const ETAPA_TEXTO = {
  enviando: "Enviando para a placa...",
  testando:
    "A placa achou a rede e esta testando. Ela fica offline por ate 2 minutos e volta sozinha para a rede antiga se nao der certo.",
};

const TODOS = "__todos__";
const emptyDateRange = { start: "", end: "" };

const inputClassName =
  "min-w-0 rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-4 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]";

export default function HistoricoWifi() {
  const [searchParams] = useSearchParams();
  const [maquinas, setMaquinas] = useState([]);
  const [clientes, setClientes] = useState([]);
  // Os dois filtros comecam vazios (nada carregado) para nao puxar o
  // historico de todas as maquinas sem querer; "Todos/Todas" e' escolha explicita.
  const [filtroCliente, setFiltroCliente] = useState("");
  const [filtroMaquina, setFiltroMaquina] = useState(searchParams.get("maquina_id") || "");
  const [dateRange, setDateRange] = useState(emptyDateRange);
  const [sincronizarFiltro, setSincronizarFiltro] = useState(true);
  const [redes, setRedes] = useState([]);
  const [tentativas, setTentativas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "success" });

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
  }, [carregarMaquinas]);

  const clienteEscolhido = Boolean(filtroCliente) && filtroCliente !== TODOS;
  const maquinasDoCliente = useMemo(
    () => (clienteEscolhido ? maquinas.filter((item) => String(item.cliente_id || "") === filtroCliente) : maquinas),
    [maquinas, filtroCliente, clienteEscolhido],
  );

  const handleClienteChange = (valor) => {
    setFiltroCliente(valor);
    const continuaNaLista =
      filtroMaquina === TODOS ||
      !valor ||
      valor === TODOS ||
      maquinas.some((item) => item.id_hardware === filtroMaquina && String(item.cliente_id || "") === valor);
    if (!continuaNaLista) setFiltroMaquina("");
  };

  const carregarHistorico = useCallback(async () => {
    if (!filtroMaquina) {
      setRedes([]);
      setTentativas([]);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filtroMaquina !== TODOS) params.set("machine_id", filtroMaquina);
      else if (clienteEscolhido) params.set("cliente_id", filtroCliente);
      else params.set("todas", "true");
      if (dateRange.start) params.set("data_inicio", `${dateRange.start}T00:00:00`);
      if (dateRange.end) params.set("data_fim", `${dateRange.end}T23:59:59`);
      const { data } = await api.get(`/wifi/historico?${params.toString()}`);
      setRedes(data.redes || []);
      setTentativas(data.tentativas || []);
    } catch (error) {
      setToast({ message: getApiErrorMessage(error, "Nao foi possivel carregar o historico de Wi-Fi."), type: "error" });
    } finally {
      setLoading(false);
    }
  }, [filtroMaquina, filtroCliente, clienteEscolhido, dateRange]);

  useEffect(() => {
    const timer = window.setTimeout(carregarHistorico, 0);
    return () => window.clearTimeout(timer);
  }, [carregarHistorico]);

  return (
    <div className="flex min-h-full flex-col gap-4">
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: "", type: toast.type })} />

      <section className="app-panel rounded-[22px] p-4 sm:rounded-[30px] sm:p-6 md:p-7">
        <div className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--color-text-soft)]">Rede das maquinas</div>
        <h1 className="mt-3 text-3xl font-extrabold text-[var(--color-text)] sm:text-4xl">Wi-Fi das maquinas</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--color-text-soft)]">
          Troque o Wi-Fi de uma maquina sem ir ao local e veja todas as redes e senhas que cada placa ja usou, alem das
          trocas pedidas pelo painel - inclusive as que deram errado. Somente administradores veem esta tela, e cada
          acesso fica registrado na auditoria.
        </p>
      </section>

      <TrocarWifi
        maquinas={maquinas}
        clientes={clientes}
        maquinaInicial={filtroMaquina === TODOS ? "" : filtroMaquina}
        sincronizarFiltro={sincronizarFiltro}
        onSincronizarFiltroChange={setSincronizarFiltro}
        onSelecao={(cliente, maquinaEscolhida) => {
          if (!sincronizarFiltro) return;
          setFiltroCliente(cliente || "");
          setFiltroMaquina(maquinaEscolhida || (cliente ? TODOS : ""));
        }}
        onConcluido={() => {
          carregarHistorico();
          carregarMaquinas();
        }}
        onToast={setToast}
      />

      <section className="app-panel rounded-[30px] p-5 md:p-6">
        <div className="grid gap-3 md:grid-cols-[220px_1fr_auto_auto]">
          <select className={inputClassName} value={filtroCliente} onChange={(event) => handleClienteChange(event.target.value)}>
            <option value="">Escolha o cliente</option>
            <option value={TODOS}>Todos os clientes</option>
            {clientes.map((item) => (
              <option key={item.id} value={String(item.id)}>
                {item.nome_empresa || item.email_contato}
              </option>
            ))}
          </select>
          <select className={inputClassName} value={filtroMaquina} onChange={(event) => setFiltroMaquina(event.target.value)}>
            <option value="">Escolha a maquina</option>
            <option value={TODOS}>{clienteEscolhido ? "Todas as maquinas deste cliente" : "Todas as maquinas"}</option>
            {maquinasDoCliente.map((item) => (
              <option key={item.id_hardware} value={item.id_hardware}>
                {(item.nome || item.id_hardware) + ` - ${item.id_hardware}`}
              </option>
            ))}
          </select>
          <DateRangePicker value={dateRange} onChange={setDateRange} />
          <button
            type="button"
            className="pill-button pill-button--primary inline-flex items-center justify-center gap-2 px-5 py-3 font-semibold"
            onClick={carregarHistorico}
            disabled={loading || !filtroMaquina}
          >
            <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
            Atualizar
          </button>
        </div>

        <h2 className="mt-6 text-lg font-extrabold text-[var(--color-text)]">Redes usadas pelas placas</h2>
        <p className="mt-1 text-sm text-[var(--color-text-soft)]">
          Cada combinacao de rede e senha aparece uma vez; a data mostra a ultima vez que a placa informou estar nela.
        </p>
        <Tabela
          loading={loading}
          vazio={
            filtroMaquina
              ? "Nenhuma rede registrada para esses filtros. As placas com firmware 2.8.0 ou mais novo informam a rede quando ela muda - para as que ja estavam configuradas, use 'Pedir rede atual'."
              : "Escolha um cliente e uma maquina (ou 'Todas') para ver o historico."
          }
          colunas={["Maquina", "Rede", "Senha", "Primeira vez", "Ultima vez"]}
          linhas={redes.map((item) => ({
            key: `r-${item.id}`,
            celulas: [
              <MaquinaCelula key="m" item={item} />,
              <div key="s" className="font-semibold">
                {item.ssid}
                {item.atual ? (
                  <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">atual</span>
                ) : null}
              </div>,
              <Senha key="p" valor={item.senha} />,
              <Data key="d1" valor={item.primeiro_visto_em} />,
              <Data key="d2" valor={item.ultimo_visto_em} />,
            ],
          }))}
        />

        <h2 className="mt-8 text-lg font-extrabold text-[var(--color-text)]">Tentativas de troca de Wi-Fi</h2>
        <p className="mt-1 text-sm text-[var(--color-text-soft)]">Pedidas pelo painel e digitadas no portal do celular - inclusive as com senha errada ou rede que nao funcionou. As do portal chegam quando a placa consegue conectar.</p>
        <Tabela
          loading={loading}
          vazio={
            filtroMaquina
              ? "Nenhuma troca de Wi-Fi pedida pelo painel nesse periodo."
              : "Escolha um cliente e uma maquina (ou 'Todas') para ver as trocas."
          }
          colunas={["Quando", "Maquina", "Rede", "Senha", "Resultado", "Origem"]}
          linhas={tentativas.map((item) => {
            const [rotuloBase, estilo] = RESULTADO_ESTILO[item.resultado] || [item.resultado, "bg-slate-100 text-slate-600"];
            const rotulo = item.origem === "portal" && item.resultado === "trocado" ? "Conectou" : rotuloBase;
            return {
              key: `t-${item.id}`,
              celulas: [
                <Data key="d" valor={item.created_at} />,
                <MaquinaCelula key="m" item={item} />,
                <div key="s" className="font-semibold">{item.ssid}</div>,
                <Senha key="p" valor={item.senha} />,
                <div key="r">
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${estilo}`}>{rotulo}</span>
                  {item.motivo_texto ? <div className="mt-1 text-xs text-[var(--color-text-soft)]">{item.motivo_texto}</div> : null}
                </div>,
                <div key="q" className="text-xs text-[var(--color-text-soft)]">
                  <div className="font-semibold text-[var(--color-text)]">{item.origem === "portal" ? "Portal (celular)" : "Painel"}</div>
                  {item.origem === "portal" ? null : <div>{item.solicitado_por || "--"}</div>}
                </div>,
              ],
            };
          })}
        />
      </section>
    </div>
  );
}

function TrocarWifi({
  maquinas,
  clientes,
  maquinaInicial,
  sincronizarFiltro,
  onSincronizarFiltroChange,
  onSelecao,
  onConcluido,
  onToast,
}) {
  const [clienteId, setClienteId] = useState("");
  const [maquinaId, setMaquinaId] = useState(maquinaInicial || "");
  const [ssid, setSsid] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [acompanhamento, setAcompanhamento] = useState(null);
  const [procura, setProcura] = useState(null);
  const timerRef = useRef(null);
  const procuraTimerRef = useRef(null);

  useEffect(
    () => () => {
      window.clearTimeout(timerRef.current);
      window.clearTimeout(procuraTimerRef.current);
    },
    [],
  );

  const maquina = useMemo(() => maquinas.find((item) => item.id_hardware === maquinaId), [maquinas, maquinaId]);
  // Veio com ?maquina_id= na URL: o cliente ja aparece escolhido (o dessa maquina).
  const clienteEfetivo = clienteId || (maquina ? String(maquina.cliente_id || "") : "");
  const maquinasDoCliente = useMemo(
    () => (clienteEfetivo ? maquinas.filter((item) => String(item.cliente_id || "") === clienteEfetivo) : []),
    [maquinas, clienteEfetivo],
  );

  const handleClienteChange = (valor) => {
    setClienteId(valor);
    let maquinaMantida = maquinaId;
    if (!maquinas.some((item) => item.id_hardware === maquinaId && String(item.cliente_id || "") === valor)) {
      maquinaMantida = "";
      setMaquinaId("");
    }
    setProcura(null);
    onSelecao(valor, maquinaMantida);
  };

  const handleMaquinaChange = (valor) => {
    setMaquinaId(valor);
    setProcura(null);
    onSelecao(clienteEfetivo, valor);
  };

  const acompanharProcura = (machineId, pedidoEm, inicio) => {
    api
      .get(`/maquinas/${machineId}/wifi/redes`)
      .then(({ data }) => {
        const chegou = data.atualizado_em && new Date(data.atualizado_em) >= new Date(pedidoEm);
        if (chegou) {
          setProcura({ estado: "pronto", ...data });
          return;
        }
        if (Date.now() - inicio > LIMITE_PROCURA_MS) {
          setProcura({ estado: "sem_resposta" });
          return;
        }
        procuraTimerRef.current = window.setTimeout(() => acompanharProcura(machineId, pedidoEm, inicio), 2000);
      })
      .catch(() => setProcura({ estado: "sem_resposta" }));
  };

  const handleProcurar = async () => {
    if (!maquina) return;
    window.clearTimeout(procuraTimerRef.current);
    setProcura({ estado: "procurando" });
    try {
      const { data } = await api.post(`/maquinas/${maquina.id_hardware}/wifi/procurar`);
      // pedido_em e atualizado_em vem do servidor no mesmo formato (UTC sem
      // fuso), entao a comparacao entre os dois e' consistente.
      acompanharProcura(maquina.id_hardware, data.pedido_em, Date.now());
    } catch (error) {
      setProcura(null);
      onToast({ message: getApiErrorMessage(error, "Nao foi possivel procurar as redes."), type: "error" });
    }
  };

  const escolherRede = (rede) => {
    setSsid(rede.ssid);
    if (rede.aberta) setSenha("");
  };
  const suporta = maquina ? suportaWifiRemoto(maquina.firmware_version) : false;
  const online = Boolean(maquina?.status_online);

  const acompanhar = useCallback(
    (machineId, commandId, inicio) => {
      api
        .get(`/maquinas/${machineId}/wifi/troca/${commandId}`)
        .then(({ data }) => {
          setAcompanhamento(data);
          if (data.resultado !== "testando") {
            onConcluido();
            return;
          }
          if (Date.now() - inicio > LIMITE_ACOMPANHAMENTO_MS) {
            setAcompanhamento({
              ...data,
              etapa: "demorando",
            });
            return;
          }
          timerRef.current = window.setTimeout(() => acompanhar(machineId, commandId, inicio), 3000);
        })
        .catch(() => {
          timerRef.current = window.setTimeout(() => acompanhar(machineId, commandId, inicio), 5000);
        });
    },
    [onConcluido],
  );

  const handleTrocar = async () => {
    if (!maquina) return;
    const confirmado = await confirmar({
      titulo: `Trocar o Wi-Fi da maquina ${maquina.id_hardware}?`,
      texto:
        `Nova rede: "${ssid}". A placa confere se a rede esta perto, testa a conexao e, se nao funcionar, ` +
        "volta sozinha para a rede atual. Durante o teste ela fica offline por ate 2 minutos.",
      confirmarTexto: "Testar e trocar",
    });
    if (!confirmado) return;
    setEnviando(true);
    window.clearTimeout(timerRef.current);
    try {
      const { data } = await api.post(`/maquinas/${maquina.id_hardware}/wifi`, { ssid, senha });
      setAcompanhamento({ resultado: "testando", etapa: "enviando", ssid });
      acompanhar(maquina.id_hardware, data.command_id, Date.now());
    } catch (error) {
      onToast({ message: getApiErrorMessage(error, "Nao foi possivel pedir a troca de Wi-Fi."), type: "error" });
    } finally {
      setEnviando(false);
    }
  };

  const handlePedirAtual = async () => {
    if (!maquina) return;
    try {
      await api.post(`/maquinas/${maquina.id_hardware}/wifi/solicitar`);
      onToast({ message: "Pedido enviado. Em alguns segundos a rede atual aparece na lista.", type: "success" });
      window.setTimeout(onConcluido, 4000);
    } catch (error) {
      onToast({ message: getApiErrorMessage(error, "Nao foi possivel pedir a rede atual."), type: "error" });
    }
  };

  const emAndamento = acompanhamento?.resultado === "testando" && acompanhamento?.etapa !== "demorando";
  const podeEnviar = maquina && suporta && online && ssid.trim() && !enviando && !emAndamento;

  return (
    <section className="app-panel rounded-[30px] p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
            <Wifi size={18} />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-[var(--color-text)]">Trocar o Wi-Fi de uma maquina</h2>
            <p className="text-sm text-[var(--color-text-soft)]">
              A placa so troca se conseguir conectar na rede nova e chegar no servidor. Se a senha estiver errada ou a
              rede nao tiver internet, ela continua na rede atual.
            </p>
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[var(--color-primary)]"
            checked={sincronizarFiltro}
            onChange={(event) => onSincronizarFiltroChange(event.target.checked)}
          />
          Usar este cliente/maquina no historico abaixo
        </label>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-[200px_1fr_1fr_1fr_auto]">
        <select className={inputClassName} value={clienteEfetivo} onChange={(event) => handleClienteChange(event.target.value)}>
          <option value="">Escolha o cliente</option>
          {clientes.map((item) => (
            <option key={item.id} value={String(item.id)}>
              {item.nome_empresa || item.email_contato}
            </option>
          ))}
        </select>
        <select
          className={`${inputClassName} disabled:opacity-60`}
          value={maquinaId}
          onChange={(event) => handleMaquinaChange(event.target.value)}
          disabled={!clienteEfetivo}
        >
          <option value="">{clienteEfetivo ? "Escolha a maquina" : "Escolha o cliente primeiro"}</option>
          {maquinasDoCliente.map((item) => (
            <option key={item.id_hardware} value={item.id_hardware}>
              {(item.nome || item.id_hardware) + ` - ${item.id_hardware}`}
            </option>
          ))}
        </select>
        <input
          className={inputClassName}
          placeholder="Nome da rede (exatamente como aparece)"
          name="wifi-rede"
          autoComplete="off"
          data-lpignore="true"
          value={ssid}
          maxLength={32}
          onChange={(event) => setSsid(event.target.value)}
        />
        <div className="relative">
          <input
            className={`${inputClassName} w-full pr-12`}
            placeholder="Senha (vazia se a rede for aberta)"
            type={mostrarSenha ? "text" : "password"}
            name="wifi-senha"
            autoComplete="new-password"
            data-lpignore="true"
            value={senha}
            maxLength={63}
            onChange={(event) => setSenha(event.target.value)}
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-soft)]"
            onClick={() => setMostrarSenha((valor) => !valor)}
            aria-label={mostrarSenha ? "Esconder senha" : "Mostrar senha"}
          >
            {mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        <button
          type="button"
          className="pill-button pill-button--primary inline-flex items-center justify-center gap-2 px-5 py-3 font-semibold disabled:opacity-50"
          onClick={handleTrocar}
          disabled={!podeEnviar}
        >
          {enviando ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          Testar e trocar
        </button>
      </div>

      {maquina ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[var(--color-text-soft)]">
          <span>
            Rede atual: <strong className="text-[var(--color-text)]">{maquina.wifi_ssid || "ainda nao informada"}</strong>
          </span>
          <span>{online ? "Online" : "Offline - precisa estar online"}</span>
          {!suporta ? (
            <span className="font-semibold text-amber-700">
              Firmware {maquina.firmware_version || "desconhecido"}: atualize para 2.8.0 ou mais novo para usar esta funcao.
            </span>
          ) : (
            <>
              <button
                type="button"
                className="inline-flex items-center gap-1 font-semibold text-[var(--color-primary)] underline disabled:opacity-50"
                onClick={handleProcurar}
                disabled={!online || procura?.estado === "procurando"}
              >
                <Search size={13} /> Procurar redes perto da maquina
              </button>
              <button type="button" className="font-semibold text-[var(--color-primary)] underline" onClick={handlePedirAtual} disabled={!online}>
                Pedir rede atual
              </button>
            </>
          )}
        </div>
      ) : null}

      {procura ? <RedesProximas procura={procura} redeEscolhida={ssid} onEscolher={escolherRede} /> : null}

      {acompanhamento ? <ResultadoTroca acompanhamento={acompanhamento} /> : null}
    </section>
  );
}

function RedesProximas({ procura, redeEscolhida, onEscolher }) {
  if (procura.estado === "procurando") {
    return (
      <div className="mt-4 flex items-center gap-3 rounded-[18px] bg-sky-50 px-4 py-3 text-sm text-sky-800">
        <Loader2 size={18} className="animate-spin" /> Procurando redes perto da maquina (ela continua conectada)...
      </div>
    );
  }
  if (procura.estado === "sem_resposta" || procura.erro) {
    return (
      <div className="mt-4 rounded-[18px] bg-amber-50 px-4 py-3 text-sm text-amber-800">
        A placa nao mandou a lista de redes. Confira se ela esta online e tente de novo.
      </div>
    );
  }
  const redes = procura.redes || [];
  return (
    <div className="mt-4 rounded-[18px] border border-[var(--color-border)] bg-white p-4">
      <div className="text-sm font-extrabold text-[var(--color-text)]">
        {redes.length} rede(s) perto da maquina
        {procura.total > redes.length ? ` (mostrando as ${redes.length} com sinal mais forte de ${procura.total})` : ""}
      </div>
      <div className="mt-1 text-xs text-[var(--color-text-soft)]">Clique numa rede para preencher o nome.</div>
      {redes.length === 0 ? (
        <div className="mt-3 text-sm text-[var(--color-text-soft)]">Nenhuma rede encontrada.</div>
      ) : (
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {redes.map((rede) => {
            const qualidade = qualidadeSinal(rede.rssi);
            const escolhida = rede.ssid === redeEscolhida;
            const atual = rede.ssid === procura.rede_atual;
            return (
              <button
                key={rede.ssid}
                type="button"
                onClick={() => onEscolher(rede)}
                disabled={rede.wep}
                className={`flex items-center justify-between gap-3 rounded-[14px] border px-3 py-2 text-left text-sm transition disabled:opacity-50 ${
                  escolhida
                    ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)]"
                    : "border-[var(--color-border)] hover:border-[var(--color-primary)]"
                }`}
                title={rede.wep ? "Seguranca WEP (antiga) nao e suportada" : `${rede.rssi} dBm`}
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-[var(--color-text)]">{rede.ssid}</span>
                  <span className="text-xs text-[var(--color-text-soft)]">
                    {atual ? "rede atual - " : ""}
                    {rede.aberta ? "aberta" : rede.wep ? "WEP (nao suportada)" : "com senha"}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2 text-xs font-bold">
                  {rede.aberta ? <Unlock size={14} /> : <Lock size={14} />}
                  <span className={qualidade >= 60 ? "text-emerald-700" : qualidade >= 35 ? "text-amber-700" : "text-rose-700"}>
                    {qualidade}%
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ResultadoTroca({ acompanhamento }) {
  const { resultado, etapa, motivo_texto: motivo, ssid } = acompanhamento;
  if (resultado === "trocado") {
    return (
      <div className="mt-4 flex items-start gap-3 rounded-[18px] bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
        <div>
          <strong>Wi-Fi trocado.</strong> A maquina conectou na rede "{ssid}" e ja esta online nela.
        </div>
      </div>
    );
  }
  if (resultado === "falhou" || resultado === "recusado") {
    return (
      <div className="mt-4 flex items-start gap-3 rounded-[18px] bg-rose-50 px-4 py-3 text-sm text-rose-800">
        <XCircle size={18} className="mt-0.5 shrink-0" />
        <div>
          <strong>Nao trocou.</strong> {motivo || "A placa nao conseguiu usar a rede nova."}{" "}
          {resultado === "falhou" && motivo !== "A placa nao respondeu"
            ? "A maquina voltou para a rede anterior."
            : "A maquina continuou na rede anterior."}
        </div>
      </div>
    );
  }
  if (etapa === "demorando" || resultado === "sem_confirmacao") {
    return (
      <div className="mt-4 rounded-[18px] bg-amber-50 px-4 py-3 text-sm text-amber-800">
        A placa ainda nao respondeu o resultado. Ela pode estar reconectando - confira se ficou online na lista de
        maquinas e veja o resultado nesta pagina em alguns minutos.
      </div>
    );
  }
  return (
    <div className="mt-4 flex items-start gap-3 rounded-[18px] bg-sky-50 px-4 py-3 text-sm text-sky-800">
      <Loader2 size={18} className="mt-0.5 shrink-0 animate-spin" />
      <div>{ETAPA_TEXTO[etapa] || ETAPA_TEXTO.testando}</div>
    </div>
  );
}

function Tabela({ loading, vazio, colunas, linhas }) {
  return (
    <div className="mt-4 overflow-hidden rounded-[26px] border border-[var(--color-border)] bg-white">
      {loading ? (
        <LoadingSpinner className="h-32" />
      ) : linhas.length === 0 ? (
        <div className="flex min-h-[120px] items-center justify-center px-6 py-6 text-center text-sm text-[var(--color-text-soft)]">
          {vazio}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-[var(--color-bg-muted)] text-left text-xs uppercase tracking-[0.16em] text-[var(--color-text-soft)]">
              <tr>
                {colunas.map((coluna) => (
                  <th key={coluna} className="whitespace-nowrap px-5 py-4">
                    {coluna}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((linha) => (
                <tr key={linha.key} className="border-t border-[var(--color-border)] align-top text-sm text-[var(--color-text)]">
                  {linha.celulas.map((celula, indice) => (
                    <td key={indice} className="px-5 py-4">
                      {celula}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function MaquinaCelula({ item }) {
  return (
    <div className="min-w-[150px]">
      <div className="font-extrabold">{item.maquina_nome || item.maquina_id}</div>
      <div className="mt-1 text-xs font-semibold text-[var(--color-primary)]">{item.maquina_id}</div>
    </div>
  );
}

function Senha({ valor }) {
  const [visivel, setVisivel] = useState(false);
  if (!valor) return <span className="text-xs text-[var(--color-text-soft)]">(rede aberta)</span>;
  return (
    <div className="flex min-w-[140px] items-center gap-2">
      <span className="font-mono text-sm">{visivel ? valor : "••••••••"}</span>
      <button
        type="button"
        className="text-[var(--color-text-soft)] hover:text-[var(--color-text)]"
        onClick={() => setVisivel((atual) => !atual)}
        aria-label={visivel ? "Esconder senha" : "Mostrar senha"}
      >
        {visivel ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

function Data({ valor }) {
  if (!valor) return <span className="text-[var(--color-text-soft)]">--</span>;
  return <span className="whitespace-nowrap">{brasiliaDate(valor).format("DD/MM/YYYY HH:mm")}</span>;
}
