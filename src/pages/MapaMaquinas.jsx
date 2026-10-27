import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, RefreshCcw, Save, Search, Wifi } from "lucide-react";

import api, { getApiErrorMessage } from "../api/axios";
import Toast from "../components/Toast";
import { useAuth } from "../context/useAuth";
import { confirmar } from "../utils/confirmar";
import { brasiliaDate } from "../utils/dateTime";
import { GPS_PRECISAO_MAXIMA_M, obterGps, salvarGpsDaMaquina } from "../utils/localizacaoCelular";

const COR_ONLINE = "#1f7a4c";
const COR_OFFLINE = "#b64545";
// Sem sinal dentro do horario em que o ponto fica fechado.
const COR_FECHADO = "#64748b";
const COR_MISTO = "#b7791f";
const ATUALIZAR_MS = 30000;
const CHAVE_ESTILO = "compactpay.mapa.estilo";

// Estilos de mapa gratuitos (sem chave de API), cada um com a atribuicao exigida.
// "Claro" (CARTO) ficou para o futuro: o servico passou a exigir chave de API.
const ESTILOS = {
  ruas: {
    rotulo: "Ruas",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    opcoes: { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' },
  },
  satelite: {
    rotulo: "Satelite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    opcoes: { maxZoom: 19, attribution: "Imagens &copy; Esri" },
  },
};

function lerEstiloSalvo() {
  try {
    const salvo = window.localStorage.getItem(CHAVE_ESTILO);
    return ESTILOS[salvo] ? salvo : "ruas";
  } catch {
    return "ruas";
  }
}

// Maquinas a ~10 m uma da outra (mesmo ponto/loja) viram uma etiqueta so.
function agruparPorLocal(maquinas) {
  const grupos = new Map();
  maquinas.forEach((m) => {
    const chave = `${m.latitude.toFixed(4)},${m.longitude.toFixed(4)}`;
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(m);
  });
  return [...grupos.values()];
}

function etiquetaIcone(grupo) {
  const online = grupo.filter((m) => m.online).length;
  const fechadas = grupo.filter((m) => m.fechado).length;
  const cor =
    online === grupo.length
      ? COR_ONLINE
      : fechadas === grupo.length
        ? COR_FECHADO
        : online + fechadas === grupo.length
          ? COR_ONLINE
          : online === 0
            ? COR_OFFLINE
            : COR_MISTO;
  const total = grupo.reduce((soma, m) => soma + Number(m.faturamento_hoje || 0), 0);
  const nome = grupo.length === 1 ? escaparHtml(grupo[0].maquina_id) : `${grupo.length} maquinas`;
  const html = `
    <div style="display:inline-flex;align-items:center;gap:6px;white-space:nowrap;transform:translate(-50%,-100%);
      background:#fff;border:2px solid ${cor};border-radius:999px;padding:3px 10px 3px 6px;
      box-shadow:0 4px 12px rgba(20,40,28,.25);font:700 12px/1.2 system-ui,sans-serif;color:#13231a">
      <span style="width:10px;height:10px;border-radius:50%;background:${cor};flex:none"></span>
      ${nome} <span style="font-weight:600;color:#4b5d52">· ${brl(total)}</span>
    </div>
    <div style="position:absolute;left:-5px;top:-2px;width:10px;height:10px;background:${cor};
      transform:rotate(45deg);border-radius:2px"></div>`;
  return L.divIcon({ className: "", html, iconSize: [0, 0], iconAnchor: [0, 6] });
}

const brl = (valor) => Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function escaparHtml(texto) {
  return String(texto ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function popupHtml(m, admin = false) {
  const status = m.online
    ? `<span style="color:${COR_ONLINE};font-weight:700">● Online</span>`
    : m.fechado
      ? `<span style="color:${COR_FECHADO};font-weight:700">● Fechado</span>`
      : `<span style="color:${COR_OFFLINE};font-weight:700">● Offline</span>`;
  const ultima = m.ultima_venda_em ? brasiliaDate(m.ultima_venda_em).format("DD/MM HH:mm") : "sem vendas";
  return `
    <div style="min-width:180px;font-family:inherit">
      <div style="font-weight:800;font-size:14px">${escaparHtml(m.maquina_nome)}</div>
      <div style="color:#6b7c72;font-size:12px">${escaparHtml(m.maquina_id)}${m.cliente_nome ? " - " + escaparHtml(m.cliente_nome) : ""}</div>
      ${m.local ? `<div style="font-size:12px;margin-top:2px">${escaparHtml(m.local)}</div>` : ""}
      <div style="margin-top:6px;font-size:13px">${status}${m.wifi_quality != null ? ` · Wi-Fi ${m.wifi_quality}%` : ""}</div>
      <div style="margin-top:4px;font-size:13px">Hoje: <b>${brl(m.faturamento_hoje)}</b></div>
      <div style="font-size:12px;color:#6b7c72">Ultima venda: ${ultima}</div>
      ${
        admin
          ? `<button type="button" class="cp-remover-local" data-maquina="${escaparHtml(m.maquina_id)}"
              style="margin-top:8px;padding:4px 10px;border:1px solid ${COR_OFFLINE};border-radius:999px;
              background:#fff;color:${COR_OFFLINE};font-size:12px;font-weight:700;cursor:pointer">Remover localizacao</button>`
          : ""
      }
    </div>`;
}

export default function MapaMaquinas() {
  const { user } = useAuth();
  const admin = user?.role === "admin";
  const [clientes, setClientes] = useState([]);
  const [clienteId, setClienteId] = useState("");
  const [dados, setDados] = useState({ maquinas: [], sem_localizacao: [] });
  const [carregando, setCarregando] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "success" });
  const mapaDivRef = useRef(null);
  const mapaRef = useRef(null);
  const camadaRef = useRef(null);
  const enquadradoRef = useRef("");
  const fundoRef = useRef(null);
  const marcadoresRef = useRef(new Map());
  const [estilo, setEstilo] = useState(lerEstiloSalvo);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const params = clienteId ? `?cliente_id=${clienteId}` : "";
      const { data } = await api.get(`/mapa/maquinas${params}`);
      setDados(data);
    } catch (error) {
      setToast({ message: getApiErrorMessage(error, "Nao foi possivel carregar o mapa."), type: "error" });
    } finally {
      setCarregando(false);
    }
  }, [clienteId]);

  useEffect(() => {
    const primeiro = window.setTimeout(carregar, 0);
    const timer = window.setInterval(carregar, ATUALIZAR_MS);
    return () => {
      window.clearTimeout(primeiro);
      window.clearInterval(timer);
    };
  }, [carregar]);

  useEffect(() => {
    if (!admin) return;
    api
      .get("/clientes")
      .then(({ data }) => setClientes(data || []))
      .catch(() => setClientes([]));
  }, [admin]);

  // Cria o mapa uma vez.
  useEffect(() => {
    if (!mapaDivRef.current || mapaRef.current) return undefined;
    const mapa = L.map(mapaDivRef.current, { zoomControl: true }).setView([-15.78, -47.93], 4);
    camadaRef.current = L.layerGroup().addTo(mapa);
    mapaRef.current = mapa;
    return () => {
      mapa.remove();
      mapaRef.current = null;
    };
  }, []);

  // Troca o estilo do mapa (e lembra a escolha neste navegador).
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa) return;
    if (fundoRef.current) fundoRef.current.remove();
    const config = ESTILOS[estilo];
    fundoRef.current = L.tileLayer(config.url, config.opcoes).addTo(mapa);
    fundoRef.current.bringToBack();
    try {
      window.localStorage.setItem(CHAVE_ESTILO, estilo);
    } catch {
      // sem armazenamento local: so nao lembra a escolha
    }
  }, [estilo]);

  // Redesenha os pontos; so reenquadra quando muda o conjunto de maquinas.
  useEffect(() => {
    const mapa = mapaRef.current;
    const camada = camadaRef.current;
    if (!mapa || !camada) return;
    camada.clearLayers();
    marcadoresRef.current = new Map();
    const pontos = agruparPorLocal(dados.maquinas).map((grupo) => {
      const posicao = [grupo[0].latitude, grupo[0].longitude];
      const marcador = L.marker(posicao, { icon: etiquetaIcone(grupo), riseOnHover: true })
        .bindPopup(grupo.map((m) => popupHtml(m, admin)).join('<hr style="margin:8px 0;border:0;border-top:1px solid #e3e8e4">'), {
          offset: [0, -24],
          maxHeight: 320,
        })
        .addTo(camada);
      grupo.forEach((m) => marcadoresRef.current.set(m.maquina_id, marcador));
      return posicao;
    });
    const chave = dados.maquinas.map((m) => m.maquina_id).sort().join(",");
    if (pontos.length && chave !== enquadradoRef.current) {
      enquadradoRef.current = chave;
      if (pontos.length === 1) mapa.setView(pontos[0], 16);
      else mapa.fitBounds(pontos, { padding: [40, 40], maxZoom: 16 });
    }
  }, [dados, admin]);

  // Botao "Remover localizacao" do balao (so admin): tira a maquina do mapa.
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || !admin) return undefined;
    const aoAbrir = (evento) => {
      evento.popup
        .getElement()
        ?.querySelectorAll(".cp-remover-local")
        .forEach((botao) => {
          botao.onclick = async () => {
            const machineId = botao.dataset.maquina;
            const ok = await confirmar({
              titulo: `Remover a localizacao da maquina ${machineId}?`,
              texto: "Ela sai do mapa ate cadastrar a localizacao de novo.",
              confirmarTexto: "Remover",
              perigoso: true,
            });
            if (!ok) return;
            try {
              await api.put(`/mapa/maquinas/${machineId}/localizacao`, { limpar: true });
              mapa.closePopup();
              setToast({ message: `Localizacao da maquina ${machineId} removida.`, type: "success" });
              carregar();
            } catch (error) {
              setToast({ message: getApiErrorMessage(error, "Nao foi possivel remover a localizacao."), type: "error" });
            }
          };
        });
    };
    mapa.on("popupopen", aoAbrir);
    return () => mapa.off("popupopen", aoAbrir);
  }, [admin, carregar]);

  const online = dados.maquinas.filter((m) => m.online).length;
  const fechadas = dados.maquinas.filter((m) => m.fechado).length;

  const irParaMaquina = (maquina) => {
    const mapa = mapaRef.current;
    const marcador = marcadoresRef.current.get(maquina.maquina_id);
    if (!mapa || !marcador) return;
    mapa.flyTo([maquina.latitude, maquina.longitude], Math.max(mapa.getZoom(), 17), { duration: 0.8 });
    mapa.once("moveend", () => marcador.openPopup());
    mapaDivRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="flex min-h-full flex-col gap-4">
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: "", type: toast.type })} />

      <section className="app-panel rounded-[22px] p-4 sm:rounded-[30px] sm:p-6 md:p-7">
        <div className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--color-text-soft)]">Onde estao</div>
        <h1 className="mt-3 text-3xl font-extrabold text-[var(--color-text)] sm:text-4xl">Mapa das maquinas</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--color-text-soft)]">
          Cada etiqueta mostra a maquina e o faturamento de hoje (verde online, vermelho offline, amarelo quando um
          ponto tem maquinas online e offline). Clique para ver os detalhes. Atualiza sozinho a cada 30 segundos.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
          {admin ? (
            <select
              className="rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-3 text-[var(--color-text)]"
              value={clienteId}
              onChange={(event) => setClienteId(event.target.value)}
            >
              <option value="">Todos os clientes</option>
              {clientes.map((item) => (
                <option key={item.id} value={String(item.id)}>
                  {item.nome_empresa || item.email_contato}
                </option>
              ))}
            </select>
          ) : null}
          <span className="inline-flex items-center gap-2 font-semibold text-[var(--color-text)]">
            <span className="h-3 w-3 rounded-full" style={{ background: COR_ONLINE }} /> Online ({online})
          </span>
          <span className="inline-flex items-center gap-2 font-semibold text-[var(--color-text)]">
            <span className="h-3 w-3 rounded-full" style={{ background: COR_OFFLINE }} /> Offline ({dados.maquinas.length - online - fechadas})
          </span>
          {fechadas ? (
            <span className="inline-flex items-center gap-2 font-semibold text-[var(--color-text)]">
              <span className="h-3 w-3 rounded-full" style={{ background: COR_FECHADO }} /> Fechado ({fechadas})
            </span>
          ) : null}
          <BuscaMaquina maquinas={dados.maquinas} onEscolher={irParaMaquina} />
          <div className="inline-flex rounded-full border border-[var(--color-border)] bg-white p-1">
            {Object.entries(ESTILOS).map(([chave, item]) => (
              <button
                key={chave}
                type="button"
                onClick={() => setEstilo(chave)}
                className={`rounded-full px-4 py-2 font-semibold transition ${
                  estilo === chave ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-text-soft)]"
                }`}
              >
                {item.rotulo}
              </button>
            ))}
          </div>
          <button type="button" className="pill-button inline-flex items-center gap-2 px-4 py-3 font-semibold" onClick={carregar} disabled={carregando}>
            <RefreshCcw size={16} className={carregando ? "animate-spin" : ""} /> Atualizar
          </button>
        </div>
      </section>

      <section className="app-panel overflow-hidden rounded-[30px] p-2">
        <div ref={mapaDivRef} className="h-[60vh] min-h-[380px] w-full rounded-[24px]" style={{ zIndex: 0 }} />
        {dados.maquinas.length === 0 && !carregando ? (
          <div className="px-4 py-3 text-center text-sm text-[var(--color-text-soft)]">
            Nenhuma maquina com localizacao cadastrada{admin ? " - cadastre abaixo." : "."}
          </div>
        ) : null}
      </section>

      {admin ? (
        <>
          <Localizacoes onSalvo={carregar} onToast={setToast} />
        </>
      ) : null}
    </div>
  );
}

function BuscaMaquina({ maquinas, onEscolher }) {
  const [texto, setTexto] = useState("");
  const [aberto, setAberto] = useState(false);
  const termo = texto.trim().toLowerCase();
  const sugestoes = termo
    ? maquinas
        .filter((m) => `${m.maquina_nome} ${m.maquina_id} ${m.cliente_nome || ""} ${m.local || ""}`.toLowerCase().includes(termo))
        .slice(0, 8)
    : [];

  return (
    <div className="relative w-full sm:w-72">
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-soft)]" />
      <input
        className="w-full rounded-[18px] border border-[var(--color-border)] bg-white py-3 pl-9 pr-4 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
        placeholder="Buscar maquina no mapa"
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setAberto(true);
        }}
        onFocus={() => setAberto(true)}
        onBlur={() => window.setTimeout(() => setAberto(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && sugestoes[0]) {
            onEscolher(sugestoes[0]);
            setAberto(false);
          }
        }}
      />
      {aberto && termo ? (
        <div className="absolute left-0 right-0 top-full z-[1000] mt-1 overflow-hidden rounded-[16px] border border-[var(--color-border)] bg-white shadow-lg">
          {sugestoes.length === 0 ? (
            <div className="px-4 py-3 text-sm text-[var(--color-text-soft)]">Nenhuma maquina no mapa com esse nome.</div>
          ) : (
            sugestoes.map((m) => (
              <button
                key={m.maquina_id}
                type="button"
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-[var(--color-bg-muted)]"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onEscolher(m);
                  setTexto(m.maquina_nome);
                  setAberto(false);
                }}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: m.online ? COR_ONLINE : m.fechado ? COR_FECHADO : COR_OFFLINE }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-[var(--color-text)]">{m.maquina_nome}</span>
                  <span className="block truncate text-xs text-[var(--color-text-soft)]">
                    {m.maquina_id}
                    {m.cliente_nome ? ` - ${m.cliente_nome}` : ""}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

const WIFI_STATUS_TEXTO = {
  ok: "Localizacao encontrada pela Wi-Fi.",
  mantida: "A posicao atual ja e' igual ou mais precisa - foi mantida.",
  sem_chave: "Falta configurar a chave do Google (GOOGLE_GEOLOCATION_API_KEY) no servidor.",
  sem_redes: "A placa viu poucas redes Wi-Fi em volta para calcular a posicao.",
  nao_encontrada: "O Google nao conhece esses roteadores - use o GPS do celular ou cole o link.",
  erro: "O servico do Google nao respondeu agora. Tente de novo em alguns minutos.",
  limite: "Ja foi feita uma busca ha pouco. Aguarde 10 minutos.",
};
const ESPERA_WIFI_MS = 40000;

function Localizacoes({ onSalvo, onToast }) {
  const [clientes, setClientes] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [clienteId, setClienteId] = useState("");
  const [maquinaId, setMaquinaId] = useState("");
  const [texto, setTexto] = useState("");
  const [salvando, setSalvando] = useState(false);

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

  const doCliente = useMemo(
    () => (clienteId ? maquinas.filter((m) => String(m.cliente_id || "") === clienteId) : []),
    [maquinas, clienteId],
  );
  const maquina = maquinas.find((m) => m.id_hardware === maquinaId);
  const temLocal = maquina?.latitude != null && maquina?.longitude != null;

  const localizarPelaWifi = async () => {
    if (!maquina) return;
    setSalvando(true);
    try {
      const { data } = await api.post(`/mapa/maquinas/${maquina.id_hardware}/localizar-wifi`);
      const inicio = Date.now();
      const pedido = new Date(data.pedido_em).getTime();
      onToast({ message: "Procurando os roteadores em volta da maquina...", type: "success" });
      // A placa varre e o servidor consulta o Google: espera o resultado.
      for (;;) {
        await new Promise((r) => window.setTimeout(r, 3000));
        const { data: local } = await api.get(`/mapa/maquinas/${maquina.id_hardware}/localizacao`);
        if (local.wifi_em && new Date(local.wifi_em).getTime() >= pedido) {
          const texto = WIFI_STATUS_TEXTO[local.wifi_status] || "Busca concluida.";
          const precisao = local.wifi_status === "ok" && local.precisao_m ? ` (+-${Math.round(local.precisao_m)} m)` : "";
          onToast({ message: texto + precisao, type: ["ok", "mantida"].includes(local.wifi_status) ? "success" : "error" });
          break;
        }
        if (Date.now() - inicio > ESPERA_WIFI_MS) {
          onToast({ message: "A placa nao respondeu a tempo. Confira se ela esta online.", type: "error" });
          break;
        }
      }
      carregarMaquinas();
      onSalvo();
    } catch (error) {
      onToast({ message: getApiErrorMessage(error, "Nao foi possivel localizar pela Wi-Fi."), type: "error" });
    } finally {
      setSalvando(false);
    }
  };

  const usarGps = async () => {
    if (!maquina) return;
    setSalvando(true);
    try {
      const gps = await obterGps();
      if (gps.precisao_m > GPS_PRECISAO_MAXIMA_M) {
        throw new Error(`GPS impreciso (+-${gps.precisao_m} m). Tente ao ar livre ou perto de uma janela.`);
      }
      await salvarGpsDaMaquina(maquina.id_hardware, gps);
      onToast({ message: `Localizacao salva pelo GPS (+-${gps.precisao_m} m).`, type: "success" });
      carregarMaquinas();
      onSalvo();
    } catch (error) {
      onToast({ message: getApiErrorMessage(error, error.message || "Nao foi possivel usar o GPS."), type: "error" });
    } finally {
      setSalvando(false);
    }
  };

  const salvar = async (limpar = false) => {
    if (!maquina) return;
    setSalvando(true);
    try {
      await api.put(`/mapa/maquinas/${maquina.id_hardware}/localizacao`, limpar ? { limpar: true } : { texto });
      setTexto("");
      onToast({ message: limpar ? "Maquina tirada do mapa." : "Localizacao salva.", type: "success" });
      carregarMaquinas();
      onSalvo();
    } catch (error) {
      onToast({ message: getApiErrorMessage(error, "Nao foi possivel salvar a localizacao."), type: "error" });
    } finally {
      setSalvando(false);
    }
  };

  const campo = "min-w-0 rounded-[16px] border border-[var(--color-border)] bg-white px-4 py-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]";

  return (
    <section className="app-panel rounded-[30px] p-5 md:p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
          <MapPin size={18} />
        </div>
        <div>
          <h2 className="text-lg font-extrabold text-[var(--color-text)]">Localizacao das maquinas</h2>
          <p className="text-sm text-[var(--color-text-soft)]">
            Escolha o cliente e a maquina. No Google Maps, abra o ponto, toque em Compartilhar e cole o link (ou as
            coordenadas, ex.: -23.5505, -46.6333). So admin ve esta parte.
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-[220px_1fr]">
        <select
          className={campo}
          value={clienteId}
          onChange={(e) => {
            setClienteId(e.target.value);
            setMaquinaId("");
          }}
        >
          <option value="">Escolha o cliente</option>
          {clientes.map((c) => (
            <option key={c.id} value={String(c.id)}>
              {c.nome_empresa || c.email_contato}
            </option>
          ))}
        </select>
        <select className={`${campo} disabled:opacity-60`} value={maquinaId} onChange={(e) => setMaquinaId(e.target.value)} disabled={!clienteId}>
          <option value="">{clienteId ? "Escolha a maquina" : "Escolha o cliente primeiro"}</option>
          {doCliente.map((m) => (
            <option key={m.id_hardware} value={m.id_hardware}>
              {`${m.nome || m.id_hardware} - ${m.id_hardware}${m.latitude != null ? " (no mapa)" : " (sem localizacao)"}`}
            </option>
          ))}
        </select>
      </div>
      {maquina ? (
        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
          <input
            className={campo}
            placeholder={temLocal ? "Cole um novo link ou coordenadas para mudar o lugar" : "Link do Google Maps ou coordenadas"}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              type="button"
              className="pill-button pill-button--primary inline-flex items-center gap-2 px-5 py-3 font-semibold disabled:opacity-50"
              onClick={() => salvar(false)}
              disabled={!texto.trim() || salvando}
            >
              <Save size={15} /> Salvar
            </button>
            <button type="button" className="pill-button inline-flex items-center gap-2 px-5 py-3 font-semibold" onClick={usarGps} disabled={salvando}>
              <MapPin size={15} /> Usar minha localizacao atual
            </button>
            <button type="button" className="pill-button inline-flex items-center gap-2 px-5 py-3 font-semibold" onClick={localizarPelaWifi} disabled={salvando}>
              <Wifi size={15} /> Localizar pela Wi-Fi
            </button>
            {temLocal ? (
              <button type="button" className="pill-button px-5 py-3 font-semibold" onClick={() => salvar(true)} disabled={salvando}>
                Tirar do mapa
              </button>
            ) : null}
          </div>
          <div className="text-xs text-[var(--color-text-soft)] md:col-span-2">
            {temLocal
              ? `Hoje no mapa em ${maquina.latitude.toFixed(5)}, ${maquina.longitude.toFixed(5)}` +
                ({ celular: " (GPS do celular)", manual: " (cadastrada a mao)", wifi: " (pela Wi-Fi)" }[maquina.localizacao_origem] || "") +
                (maquina.localizacao_atualizada_em ? ` em ${brasiliaDate(maquina.localizacao_atualizada_em).format("DD/MM/YYYY HH:mm")}.` : ".")
              : "Esta maquina ainda nao aparece no mapa."}
          </div>
        </div>
      ) : null}
    </section>
  );
}
