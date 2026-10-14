import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, RefreshCcw, Save, Users } from "lucide-react";

import api, { getApiErrorMessage } from "../api/axios";
import Toast from "../components/Toast";
import { useAuth } from "../context/useAuth";
import { brasiliaDate } from "../utils/dateTime";

const COR_ONLINE = "#1f7a4c";
const COR_OFFLINE = "#b64545";
const COR_MISTO = "#b7791f";
const ATUALIZAR_MS = 30000;
const CHAVE_ESTILO = "compactpay.mapa.estilo";

// Estilos de mapa gratuitos (sem chave de API), cada um com a atribuicao exigida.
const ESTILOS = {
  claro: {
    rotulo: "Claro",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    opcoes: {
      maxZoom: 20,
      subdomains: "abcd",
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
  },
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
    return ESTILOS[salvo] ? salvo : "claro";
  } catch {
    return "claro";
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
  const cor = online === grupo.length ? COR_ONLINE : online === 0 ? COR_OFFLINE : COR_MISTO;
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

function popupHtml(m) {
  const status = m.online
    ? `<span style="color:${COR_ONLINE};font-weight:700">● Online</span>`
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
    const pontos = agruparPorLocal(dados.maquinas).map((grupo) => {
      const posicao = [grupo[0].latitude, grupo[0].longitude];
      L.marker(posicao, { icon: etiquetaIcone(grupo), riseOnHover: true })
        .bindPopup(grupo.map(popupHtml).join('<hr style="margin:8px 0;border:0;border-top:1px solid #e3e8e4">'), {
          offset: [0, -24],
          maxHeight: 320,
        })
        .addTo(camada);
      return posicao;
    });
    const chave = dados.maquinas.map((m) => m.maquina_id).sort().join(",");
    if (pontos.length && chave !== enquadradoRef.current) {
      enquadradoRef.current = chave;
      if (pontos.length === 1) mapa.setView(pontos[0], 16);
      else mapa.fitBounds(pontos, { padding: [40, 40], maxZoom: 16 });
    }
  }, [dados]);

  const online = dados.maquinas.filter((m) => m.online).length;

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
            <span className="h-3 w-3 rounded-full" style={{ background: COR_OFFLINE }} /> Offline ({dados.maquinas.length - online})
          </span>
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
          <Localizacoes semLocalizacao={dados.sem_localizacao} comLocalizacao={dados.maquinas} onSalvo={carregar} onToast={setToast} />
          <AcessoClientes onToast={setToast} />
        </>
      ) : null}
    </div>
  );
}

function Localizacoes({ semLocalizacao, comLocalizacao, onSalvo, onToast }) {
  const [textos, setTextos] = useState({});
  const [salvando, setSalvando] = useState("");
  const [mostrarTodas, setMostrarTodas] = useState(false);
  const lista = useMemo(
    () => (mostrarTodas ? [...semLocalizacao, ...comLocalizacao] : semLocalizacao),
    [mostrarTodas, semLocalizacao, comLocalizacao],
  );

  const salvar = async (machineId, limpar = false) => {
    setSalvando(machineId);
    try {
      await api.put(`/mapa/maquinas/${machineId}/localizacao`, limpar ? { limpar: true } : { texto: textos[machineId] || "" });
      setTextos((atual) => ({ ...atual, [machineId]: "" }));
      onToast({ message: limpar ? "Maquina tirada do mapa." : "Localizacao salva.", type: "success" });
      onSalvo();
    } catch (error) {
      onToast({ message: getApiErrorMessage(error, "Nao foi possivel salvar a localizacao."), type: "error" });
    } finally {
      setSalvando("");
    }
  };

  return (
    <section className="app-panel rounded-[30px] p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
            <MapPin size={18} />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-[var(--color-text)]">Localizacao das maquinas</h2>
            <p className="text-sm text-[var(--color-text-soft)]">
              No Google Maps, abra o ponto da maquina, toque em Compartilhar e cole o link aqui (ou cole as coordenadas,
              ex.: -23.5505, -46.6333). So admin ve esta parte.
            </p>
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
          <input type="checkbox" className="h-4 w-4 accent-[var(--color-primary)]" checked={mostrarTodas} onChange={(e) => setMostrarTodas(e.target.checked)} />
          Mostrar tambem as que ja estao no mapa
        </label>
      </div>
      <div className="mt-4 space-y-2">
        {lista.length === 0 ? (
          <div className="rounded-[18px] bg-white px-4 py-6 text-center text-sm text-[var(--color-text-soft)]">
            Todas as maquinas ja tem localizacao.
          </div>
        ) : (
          lista.map((m) => (
            <div key={m.maquina_id} className="grid items-center gap-2 rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-3 text-sm md:grid-cols-[220px_1fr_auto]">
              <div className="min-w-0">
                <div className="truncate font-bold text-[var(--color-text)]">{m.maquina_nome}</div>
                <div className="truncate text-xs text-[var(--color-text-soft)]">
                  {m.maquina_id}
                  {m.cliente_nome ? ` - ${m.cliente_nome}` : ""}
                  {m.latitude != null ? " - no mapa" : " - sem localizacao"}
                </div>
              </div>
              <input
                className="min-w-0 rounded-[14px] border border-[var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
                placeholder="Link do Google Maps ou coordenadas"
                value={textos[m.maquina_id] || ""}
                onChange={(e) => setTextos((atual) => ({ ...atual, [m.maquina_id]: e.target.value }))}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  className="pill-button pill-button--primary inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold disabled:opacity-50"
                  onClick={() => salvar(m.maquina_id)}
                  disabled={!textos[m.maquina_id] || salvando === m.maquina_id}
                >
                  <Save size={14} /> Salvar
                </button>
                {m.latitude != null ? (
                  <button type="button" className="pill-button px-4 py-2 text-sm font-semibold" onClick={() => salvar(m.maquina_id, true)} disabled={salvando === m.maquina_id}>
                    Tirar do mapa
                  </button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function AcessoClientes({ onToast }) {
  const [clientes, setClientes] = useState([]);

  useEffect(() => {
    api
      .get("/mapa/clientes")
      .then(({ data }) => setClientes(data || []))
      .catch(() => setClientes([]));
  }, []);

  const alternar = async (cliente) => {
    try {
      const { data } = await api.put(`/mapa/clientes/${cliente.id}`, { habilitado: !cliente.mapa_habilitado });
      setClientes((atual) => atual.map((c) => (c.id === cliente.id ? { ...c, mapa_habilitado: data.mapa_habilitado } : c)));
    } catch (error) {
      onToast({ message: getApiErrorMessage(error, "Nao foi possivel alterar o acesso."), type: "error" });
    }
  };

  return (
    <section className="app-panel rounded-[30px] p-5 md:p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
          <Users size={18} />
        </div>
        <div>
          <h2 className="text-lg font-extrabold text-[var(--color-text)]">Clientes que podem ver o mapa</h2>
          <p className="text-sm text-[var(--color-text-soft)]">Desligado por padrao. O cliente liberado ve so as proprias maquinas.</p>
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {clientes.map((cliente) => (
          <label key={cliente.id} className="flex cursor-pointer items-center justify-between gap-3 rounded-[16px] border border-[var(--color-border)] bg-white px-4 py-3 text-sm">
            <span className="truncate font-semibold text-[var(--color-text)]">{cliente.nome}</span>
            <input type="checkbox" className="h-4 w-4 accent-[var(--color-primary)]" checked={cliente.mapa_habilitado} onChange={() => alternar(cliente)} />
          </label>
        ))}
      </div>
    </section>
  );
}
