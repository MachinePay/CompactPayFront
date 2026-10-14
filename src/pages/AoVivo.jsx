import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Coins, Expand, Gift, Minimize, Trophy, Wifi } from "lucide-react";

import api from "../api/axios";
import { useAuth } from "../context/useAuth";
import { brasiliaDate } from "../utils/dateTime";

const INTERVALO_MS = 5000;

const brl = (valor) => Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const FORMA_TEXTO = {
  fisico: "dinheiro",
  pix: "PIX",
  credit_card: "credito",
  debit_card: "debito",
  credito: "credito",
  debito: "debito",
};

function tempoAtras(quando, agora) {
  const segundos = Math.max(0, Math.round((agora - brasiliaDate(quando).valueOf()) / 1000));
  if (segundos < 60) return "agora";
  if (segundos < 3600) return `ha ${Math.floor(segundos / 60)} min`;
  return brasiliaDate(quando).format("HH:mm");
}

export default function AoVivo() {
  const { user } = useAuth();
  const [dados, setDados] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [clienteId, setClienteId] = useState("");
  const [novos, setNovos] = useState(() => new Set());
  const [agora, setAgora] = useState(() => Date.now());
  const [telaCheia, setTelaCheia] = useState(false);
  const vistosRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (user?.role !== "admin") return;
    api
      .get("/clientes")
      .then(({ data }) => setClientes(data || []))
      .catch(() => setClientes([]));
  }, [user?.role]);

  const carregar = useCallback(async () => {
    try {
      const params = clienteId ? `&cliente_id=${clienteId}` : "";
      const { data } = await api.get(`/ao-vivo?limit=40${params}`);
      const ids = data.eventos.map((evento) => evento.id);
      // Na primeira carga nada pisca; depois, so o que chegou agora.
      if (vistosRef.current) {
        setNovos(new Set(ids.filter((id) => !vistosRef.current.has(id))));
      }
      vistosRef.current = new Set(ids);
      setDados(data);
    } catch {
      // Mantem a ultima tela se uma consulta falhar (TV ligada o dia todo).
    }
  }, [clienteId]);

  useEffect(() => {
    vistosRef.current = null;
    const primeiro = window.setTimeout(carregar, 0);
    const timer = window.setInterval(() => {
      carregar();
      setAgora(Date.now());
    }, INTERVALO_MS);
    return () => {
      window.clearTimeout(primeiro);
      window.clearInterval(timer);
    };
  }, [carregar]);

  useEffect(() => {
    const aoMudar = () => setTelaCheia(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", aoMudar);
    return () => document.removeEventListener("fullscreenchange", aoMudar);
  }, []);

  const alternarTelaCheia = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else containerRef.current?.requestFullscreen?.();
  };

  const hoje = dados?.hoje;

  return (
    <div
      ref={containerRef}
      className={`flex min-h-full flex-col gap-4 ${telaCheia ? "overflow-y-auto bg-[#0f1f16] p-8 text-white" : ""}`}
    >
      <section
        className={`flex flex-wrap items-center justify-between gap-4 rounded-[30px] p-5 md:p-6 ${
          telaCheia ? "bg-white/5" : "app-panel"
        }`}
      >
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.24em] opacity-70">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
            </span>
            Ao vivo
          </div>
          <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">{brasiliaDate(agora).format("HH:mm")}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {user?.role === "admin" ? (
            <select
              className="rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-3 text-sm text-[var(--color-text)]"
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
          <button
            type="button"
            className="pill-button pill-button--primary inline-flex items-center gap-2 px-5 py-3 font-semibold"
            onClick={alternarTelaCheia}
          >
            {telaCheia ? <Minimize size={16} /> : <Expand size={16} />}
            {telaCheia ? "Sair da tela cheia" : "Tela cheia (TV)"}
          </button>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador escuro={telaCheia} icone={<Coins size={22} />} rotulo="Faturamento hoje" valor={hoje ? brl(hoje.faturamento) : "--"} destaque />
        <Indicador escuro={telaCheia} icone={<Coins size={22} />} rotulo="Vendas hoje" valor={hoje ? String(hoje.vendas) : "--"} />
        <Indicador escuro={telaCheia} icone={<Gift size={22} />} rotulo="Pelucias hoje" valor={hoje ? String(hoje.pelucias) : "--"} />
        <Indicador
          escuro={telaCheia}
          icone={<Wifi size={22} />}
          rotulo="Maquinas online"
          valor={hoje ? `${hoje.maquinas_online}/${hoje.maquinas_total}` : "--"}
        />
      </div>

      {hoje?.destaque ? (
        <div
          className={`flex items-center gap-3 rounded-[22px] px-5 py-4 text-lg font-bold ${
            telaCheia ? "bg-amber-400/15 text-amber-200" : "bg-amber-50 text-amber-800"
          }`}
        >
          <Trophy size={22} /> Maquina do dia: {hoje.destaque.maquina_nome} - {brl(hoje.destaque.faturamento)}
        </div>
      ) : null}

      <section className={`flex-1 rounded-[30px] p-4 md:p-6 ${telaCheia ? "bg-white/5" : "app-panel"}`}>
        {!dados ? (
          <div className="py-16 text-center opacity-70">Carregando...</div>
        ) : dados.eventos.length === 0 ? (
          <div className="py-16 text-center opacity-70">Nenhum movimento nas ultimas 24 horas.</div>
        ) : (
          <ul className="space-y-2">
            {dados.eventos.map((evento) => (
              <Evento key={evento.id} evento={evento} novo={novos.has(evento.id)} escuro={telaCheia} agora={agora} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Indicador({ icone, rotulo, valor, destaque = false, escuro }) {
  return (
    <div
      className={`rounded-[24px] p-5 ${
        escuro ? (destaque ? "bg-emerald-500/20" : "bg-white/5") : destaque ? "bg-[var(--color-primary-soft)]" : "app-panel"
      }`}
    >
      <div className="flex items-center gap-2 text-sm font-semibold opacity-70">
        {icone}
        {rotulo}
      </div>
      <div className="mt-2 text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">{valor}</div>
    </div>
  );
}

function Evento({ evento, novo, escuro, agora }) {
  let icone;
  let texto;
  let cor;
  if (evento.tipo === "pagamento") {
    icone = <Coins size={22} />;
    cor = escuro ? "bg-emerald-500/15 text-emerald-300" : "bg-emerald-50 text-emerald-700";
    const jogadas = evento.jogadas ? ` - ${evento.jogadas} jogada${evento.jogadas === 1 ? "" : "s"}` : "";
    const forma = FORMA_TEXTO[evento.forma] || evento.forma;
    texto = (
      <>
        <strong>{brl(evento.valor)}</strong> na {evento.maquina_nome}
        {jogadas}
        <span className="opacity-60"> ({forma}{evento.estornado ? ", estornado" : ""})</span>
      </>
    );
  } else if (evento.tipo === "pelucia") {
    icone = <Gift size={22} />;
    cor = escuro ? "bg-sky-500/15 text-sky-300" : "bg-sky-50 text-sky-700";
    texto = (
      <>
        <strong>Pelucia entregue</strong> na {evento.maquina_nome}
      </>
    );
  } else {
    icone = <AlertTriangle size={22} />;
    cor = escuro ? "bg-rose-500/15 text-rose-300" : "bg-rose-50 text-rose-700";
    texto = (
      <>
        <strong>{evento.maquina_nome}</strong> caiu (ficou sem conexao)
      </>
    );
  }
  return (
    <li
      className={`flex items-center gap-4 rounded-[18px] px-4 py-3 text-base transition-all duration-700 sm:text-lg ${
        novo ? (escuro ? "bg-amber-300/20" : "bg-amber-100") : escuro ? "bg-white/[0.03]" : "bg-white"
      }`}
    >
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${cor}`}>{icone}</span>
      <span className="min-w-0 flex-1">{texto}</span>
      <span className="shrink-0 text-sm opacity-60">{tempoAtras(evento.quando, agora)}</span>
    </li>
  );
}
