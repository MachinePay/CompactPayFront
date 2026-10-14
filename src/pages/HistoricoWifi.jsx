import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Eye, EyeOff, Loader2, RefreshCcw, Send, Wifi, XCircle } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import api, { getApiErrorMessage } from "../api/axios";
import LoadingSpinner from "../components/LoadingSpinner";
import Toast from "../components/Toast";
import { brasiliaDate } from "../utils/dateTime";

// Firmware que aceita troca de Wi-Fi pelo painel (backend: MIN_FIRMWARE_VERSION_FOR_WIFI).
const VERSAO_MINIMA_WIFI = [2, 8, 0];
const LIMITE_ACOMPANHAMENTO_MS = 3 * 60 * 1000;

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
};

const ETAPA_TEXTO = {
  enviando: "Enviando para a placa...",
  testando:
    "A placa achou a rede e esta testando. Ela fica offline por ate 2 minutos e volta sozinha para a rede antiga se nao der certo.",
};

const inputClassName =
  "min-w-0 rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-4 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]";

export default function HistoricoWifi() {
  const [searchParams] = useSearchParams();
  const [maquinas, setMaquinas] = useState([]);
  const [filtroMaquina, setFiltroMaquina] = useState(searchParams.get("maquina_id") || "");
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
  }, [carregarMaquinas]);

  const carregarHistorico = useCallback(async () => {
    setLoading(true);
    try {
      const params = filtroMaquina ? `?machine_id=${encodeURIComponent(filtroMaquina)}` : "";
      const { data } = await api.get(`/wifi/historico${params}`);
      setRedes(data.redes || []);
      setTentativas(data.tentativas || []);
    } catch (error) {
      setToast({ message: getApiErrorMessage(error, "Nao foi possivel carregar o historico de Wi-Fi."), type: "error" });
    } finally {
      setLoading(false);
    }
  }, [filtroMaquina]);

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
        maquinaInicial={filtroMaquina}
        onConcluido={() => {
          carregarHistorico();
          carregarMaquinas();
        }}
        onToast={setToast}
      />

      <section className="app-panel rounded-[30px] p-5 md:p-6">
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <select className={inputClassName} value={filtroMaquina} onChange={(event) => setFiltroMaquina(event.target.value)}>
            <option value="">Todas as maquinas</option>
            {maquinas.map((item) => (
              <option key={item.id_hardware} value={item.id_hardware}>
                {(item.nome || item.id_hardware) + ` - ${item.id_hardware}`}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="pill-button pill-button--primary inline-flex items-center justify-center gap-2 px-5 py-3 font-semibold"
            onClick={carregarHistorico}
            disabled={loading}
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
          vazio="Nenhuma rede registrada ainda. As placas com firmware 2.8.0 ou mais novo informam a rede quando ela muda - para as que ja estavam configuradas, use 'Pedir rede atual'."
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

        <h2 className="mt-8 text-lg font-extrabold text-[var(--color-text)]">Trocas pedidas pelo painel</h2>
        <p className="mt-1 text-sm text-[var(--color-text-soft)]">Inclui as tentativas com senha errada ou rede que nao funcionou.</p>
        <Tabela
          loading={loading}
          vazio="Nenhuma troca de Wi-Fi pedida pelo painel."
          colunas={["Quando", "Maquina", "Rede", "Senha", "Resultado", "Quem pediu"]}
          linhas={tentativas.map((item) => {
            const [rotulo, estilo] = RESULTADO_ESTILO[item.resultado] || [item.resultado, "bg-slate-100 text-slate-600"];
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
                <div key="q" className="text-xs text-[var(--color-text-soft)]">{item.solicitado_por || "--"}</div>,
              ],
            };
          })}
        />
      </section>
    </div>
  );
}

function TrocarWifi({ maquinas, maquinaInicial, onConcluido, onToast }) {
  const [maquinaId, setMaquinaId] = useState(maquinaInicial || "");
  const [ssid, setSsid] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [acompanhamento, setAcompanhamento] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const maquina = useMemo(() => maquinas.find((item) => item.id_hardware === maquinaId), [maquinas, maquinaId]);
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
    const confirmar = window.confirm(
      `Trocar o Wi-Fi da maquina ${maquina.id_hardware} para a rede "${ssid}"?\n\n` +
        "A placa confere se a rede esta perto, testa a conexao e, se nao funcionar, volta sozinha para a rede atual. " +
        "Durante o teste ela fica offline por ate 2 minutos.",
    );
    if (!confirmar) return;
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

      <div className="mt-5 grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
        <select className={inputClassName} value={maquinaId} onChange={(event) => setMaquinaId(event.target.value)}>
          <option value="">Escolha a maquina</option>
          {maquinas.map((item) => (
            <option key={item.id_hardware} value={item.id_hardware}>
              {(item.nome || item.id_hardware) + ` - ${item.id_hardware}`}
            </option>
          ))}
        </select>
        <input
          className={inputClassName}
          placeholder="Nome da rede (exatamente como aparece)"
          value={ssid}
          maxLength={32}
          onChange={(event) => setSsid(event.target.value)}
        />
        <div className="relative">
          <input
            className={`${inputClassName} w-full pr-12`}
            placeholder="Senha (vazia se a rede for aberta)"
            type={mostrarSenha ? "text" : "password"}
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
            <button type="button" className="font-semibold text-[var(--color-primary)] underline" onClick={handlePedirAtual} disabled={!online}>
              Pedir rede atual
            </button>
          )}
        </div>
      ) : null}

      {acompanhamento ? <ResultadoTroca acompanhamento={acompanhamento} /> : null}
    </section>
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
  if (etapa === "demorando") {
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
