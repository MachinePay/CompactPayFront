import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock, RefreshCcw } from "lucide-react";

import api, { getApiErrorMessage } from "../api/axios";
import LoadingSpinner from "../components/LoadingSpinner";
import Toast from "../components/Toast";
import { useAuth } from "../context/useAuth";

// Backend: grade[dia][hora], dia 0 = segunda ... 6 = domingo (horario de Brasilia).
const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"];
const DIAS_NOME = ["segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo"];
const PERIODOS = [
  ["semana", "7 dias"],
  ["mes", "30 dias"],
  ["trimestre", "90 dias"],
];
const METRICAS = {
  faturamento: { rotulo: "Faturamento", formatar: (v) => brl(v) },
  vendas: { rotulo: "Vendas", formatar: (v) => `${formatarNumero(v)} venda(s)` },
  pelucias: { rotulo: "Pelucias", formatar: (v) => `${formatarNumero(v)} pelucia(s)` },
};

// Escala sequencial de uma cor so (verde da marca), do claro ao escuro.
const ESCALA = ["#e3f1e8", "#bfe0cb", "#8fc8a6", "#5aab7f", "#2f8a5a", "#1f7a4c", "#145233"];
const VAZIO = "#f2f4f1";

const brl = (valor) => Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
function formatarNumero(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

function corDaEscala(valor, maximo) {
  if (!valor || !maximo) return VAZIO;
  const indice = Math.min(ESCALA.length - 1, Math.floor((valor / maximo) * (ESCALA.length - 1) + 0.5));
  return ESCALA[Math.max(0, indice)];
}

export default function HorariosPico() {
  const { user } = useAuth();
  const [periodo, setPeriodo] = useState("mes");
  const [metrica, setMetrica] = useState("faturamento");
  const [clientes, setClientes] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [clienteId, setClienteId] = useState("");
  const [maquinaId, setMaquinaId] = useState("");
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dica, setDica] = useState(null);
  const [toast, setToast] = useState({ message: "", type: "success" });

  useEffect(() => {
    api
      .get("/maquinas")
      .then(({ data }) => setMaquinas(data || []))
      .catch(() => setMaquinas([]));
    if (user?.role !== "admin") return;
    api
      .get("/clientes")
      .then(({ data }) => setClientes(data || []))
      .catch(() => setClientes([]));
  }, [user?.role]);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ periodo });
      if (clienteId) params.set("cliente_id", clienteId);
      if (maquinaId) params.set("machine_id", maquinaId);
      const { data } = await api.get(`/horarios-pico?${params.toString()}`);
      setDados(data);
    } catch (error) {
      setToast({ message: getApiErrorMessage(error, "Nao foi possivel carregar os horarios."), type: "error" });
    } finally {
      setLoading(false);
    }
  }, [periodo, clienteId, maquinaId]);

  useEffect(() => {
    const timer = window.setTimeout(carregar, 0);
    return () => window.clearTimeout(timer);
  }, [carregar]);

  const maquinasDoCliente = useMemo(
    () => (clienteId ? maquinas.filter((m) => String(m.cliente_id || "") === clienteId) : maquinas),
    [maquinas, clienteId],
  );

  // Tudo em media por dia: um periodo com mais sabados nao distorce o sabado.
  const calculo = useMemo(() => {
    if (!dados) return null;
    const dias = dados.dias_por_dia_da_semana.map((n) => n || 1);
    const totalDias = dias.reduce((a, b) => a + b, 0);
    const media = dados.grade.map((linha, dia) => linha.map((celula) => celula[metrica] / dias[dia]));
    const maximo = Math.max(0, ...media.flat());
    const porHora = Array.from({ length: 24 }, (_, hora) =>
      dados.grade.reduce((soma, linha) => soma + linha[hora][metrica], 0) / totalDias,
    );
    const porDia = dados.grade.map((linha, dia) => linha.reduce((soma, celula) => soma + celula[metrica], 0) / dias[dia]);
    const picos = media
      .flatMap((linha, dia) => linha.map((valor, hora) => ({ dia, hora, valor })))
      .filter((item) => item.valor > 0)
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 3);
    return { media, maximo, porHora, porDia, picos };
  }, [dados, metrica]);

  const formatar = METRICAS[metrica].formatar;
  const vazio = calculo && calculo.maximo === 0;

  return (
    <div className="flex min-h-full flex-col gap-4">
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: "", type: toast.type })} />

      <section className="app-panel rounded-[22px] p-4 sm:rounded-[30px] sm:p-6 md:p-7">
        <div className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--color-text-soft)]">Movimento</div>
        <h1 className="mt-3 text-3xl font-extrabold text-[var(--color-text)] sm:text-4xl">Horarios de pico</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--color-text-soft)]">
          Em que dias e horarios as maquinas mais vendem - para decidir horario de funcionamento e quando repor
          pelucias. Os valores sao a media por dia no periodo, em horario de Brasilia.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Segmentado opcoes={PERIODOS} valor={periodo} onChange={setPeriodo} />
          <Segmentado
            opcoes={Object.entries(METRICAS).map(([chave, item]) => [chave, item.rotulo])}
            valor={metrica}
            onChange={setMetrica}
          />
          {user?.role === "admin" ? (
            <select
              className="rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-3 text-sm text-[var(--color-text)]"
              value={clienteId}
              onChange={(event) => {
                setClienteId(event.target.value);
                setMaquinaId("");
              }}
            >
              <option value="">Todos os clientes</option>
              {clientes.map((item) => (
                <option key={item.id} value={String(item.id)}>
                  {item.nome_empresa || item.email_contato}
                </option>
              ))}
            </select>
          ) : null}
          <select
            className="rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-3 text-sm text-[var(--color-text)]"
            value={maquinaId}
            onChange={(event) => setMaquinaId(event.target.value)}
          >
            <option value="">Todas as maquinas</option>
            {maquinasDoCliente.map((item) => (
              <option key={item.id_hardware} value={item.id_hardware}>
                {(item.nome || item.id_hardware) + ` - ${item.id_hardware}`}
              </option>
            ))}
          </select>
          <button type="button" className="pill-button inline-flex items-center gap-2 px-4 py-3 font-semibold" onClick={carregar} disabled={loading}>
            <RefreshCcw size={16} className={loading ? "animate-spin" : ""} /> Atualizar
          </button>
        </div>
      </section>

      {!calculo ? (
        <LoadingSpinner className="h-40" />
      ) : vazio ? (
        <section className="app-panel rounded-[30px] p-10 text-center text-sm text-[var(--color-text-soft)]">
          Nenhum movimento no periodo para esses filtros.
        </section>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            {calculo.picos.map((pico, indice) => (
              <section key={`${pico.dia}-${pico.hora}`} className={`rounded-[24px] p-5 ${indice === 0 ? "bg-[var(--color-primary-soft)]" : "app-panel"}`}>
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-soft)]">
                  <Clock size={16} /> {indice + 1}º horario mais forte
                </div>
                <div className="mt-2 text-2xl font-extrabold text-[var(--color-text)]">
                  {DIAS_NOME[pico.dia]}, {String(pico.hora).padStart(2, "0")}h-{String(pico.hora + 1).padStart(2, "0")}h
                </div>
                <div className="mt-1 text-sm text-[var(--color-text-soft)]">{formatar(pico.valor)} em media</div>
              </section>
            ))}
          </div>

          <section className="app-panel relative rounded-[30px] p-5 md:p-6">
            <h2 className="text-lg font-extrabold text-[var(--color-text)]">
              {METRICAS[metrica].rotulo} medio por dia da semana e hora
            </h2>
            <div className="mt-4 overflow-x-auto">
              <div className="min-w-[720px]" onMouseLeave={() => setDica(null)}>
                <div className="grid grid-cols-[44px_repeat(24,minmax(0,1fr))] gap-[2px]">
                  <div />
                  {Array.from({ length: 24 }, (_, hora) => (
                    <div key={hora} className="pb-1 text-center text-[10px] text-[var(--color-text-soft)]">
                      {hora % 3 === 0 ? `${hora}h` : ""}
                    </div>
                  ))}
                  {calculo.media.map((linha, dia) => (
                    <Linha
                      key={dia}
                      dia={dia}
                      linha={linha}
                      maximo={calculo.maximo}
                      onDica={(hora, evento) =>
                        setDica({
                          x: evento.clientX,
                          y: evento.clientY,
                          texto: `${DIAS_NOME[dia]}, ${hora}h-${hora + 1}h: ${formatar(linha[hora])} em media`,
                        })
                      }
                    />
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-[var(--color-text-soft)]">
                  <span>Menos</span>
                  {[VAZIO, ...ESCALA].map((cor) => (
                    <span key={cor} className="h-3 w-6 rounded-[3px]" style={{ background: cor }} />
                  ))}
                  <span>Mais</span>
                </div>
              </div>
            </div>
          </section>

          <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
            <Barras
              titulo={`${METRICAS[metrica].rotulo} medio por hora do dia`}
              valores={calculo.porHora}
              rotulos={calculo.porHora.map((_, hora) => (hora % 3 === 0 ? `${hora}h` : ""))}
              descricao={(indice) => `${indice}h-${indice + 1}h: ${formatar(calculo.porHora[indice])} em media por dia`}
              onDica={setDica}
            />
            <Barras
              titulo={`${METRICAS[metrica].rotulo} medio por dia da semana`}
              valores={calculo.porDia}
              rotulos={DIAS}
              descricao={(indice) => `${DIAS_NOME[indice]}: ${formatar(calculo.porDia[indice])} em media`}
              onDica={setDica}
            />
          </div>
        </>
      )}

      {dica ? (
        <div
          className="pointer-events-none fixed z-50 rounded-[10px] bg-[#13231a] px-3 py-2 text-xs font-semibold text-white shadow-lg"
          style={{ left: dica.x + 12, top: dica.y + 12 }}
        >
          {dica.texto}
        </div>
      ) : null}
    </div>
  );
}

function Linha({ dia, linha, maximo, onDica }) {
  return (
    <>
      <div className="flex items-center text-xs font-semibold text-[var(--color-text-soft)]">{DIAS[dia]}</div>
      {linha.map((valor, hora) => (
        <div
          key={hora}
          className="h-7 rounded-[4px] transition hover:outline hover:outline-2 hover:outline-[var(--color-text)]"
          style={{ background: corDaEscala(valor, maximo) }}
          onMouseMove={(evento) => onDica(hora, evento)}
        />
      ))}
    </>
  );
}

function Barras({ titulo, valores, rotulos, descricao, onDica }) {
  const maximo = Math.max(0, ...valores) || 1;
  const maior = valores.indexOf(Math.max(...valores));
  return (
    <section className="app-panel rounded-[30px] p-5 md:p-6" onMouseLeave={() => onDica(null)}>
      <h2 className="text-lg font-extrabold text-[var(--color-text)]">{titulo}</h2>
      <div className="mt-4 flex h-44 items-end gap-[2px] border-b border-[var(--color-border)]">
        {valores.map((valor, indice) => (
          <div
            key={indice}
            className="flex h-full flex-1 items-end"
            onMouseMove={(evento) => onDica({ x: evento.clientX, y: evento.clientY, texto: descricao(indice) })}
          >
            <div
              className="w-full rounded-t-[4px] transition hover:opacity-80"
              style={{
                height: `${(valor / maximo) * 100}%`,
                minHeight: valor > 0 ? 2 : 0,
                background: indice === maior ? "#145233" : "#5aab7f",
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-[2px]">
        {rotulos.map((rotulo, indice) => (
          <div key={indice} className="flex-1 text-center text-[10px] text-[var(--color-text-soft)]">
            {rotulo}
          </div>
        ))}
      </div>
    </section>
  );
}

function Segmentado({ opcoes, valor, onChange }) {
  return (
    <div className="inline-flex rounded-full border border-[var(--color-border)] bg-white p-1">
      {opcoes.map(([chave, rotulo]) => (
        <button
          key={chave}
          type="button"
          onClick={() => onChange(chave)}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            valor === chave ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-text-soft)]"
          }`}
        >
          {rotulo}
        </button>
      ))}
    </div>
  );
}
