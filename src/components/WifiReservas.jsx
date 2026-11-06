import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, CheckCircle2, Clock, Eye, EyeOff, Loader2, Plus, Save, Shuffle, Trash2, Wifi, XCircle } from "lucide-react";

import api, { getApiErrorMessage } from "../api/axios";
import { brasiliaDate } from "../utils/dateTime";

// Redes reserva do rodizio de Wi-Fi (firmware 2.9.0+). A placa tenta cada
// rede 3 vezes e passa para a proxima: principal -> reserva 1 -> ... -> volta
// para a principal. A lista fica gravada na placa (o reset do Wi-Fi pelo
// botao nao apaga). Da para salvar com a maquina offline ou com firmware
// antigo: o servidor manda quando ela ligar com o firmware 2.9.0+.

const inputClassName =
  "min-w-0 rounded-[14px] border border-[var(--color-border)] bg-white px-3 py-3 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]";

const LIMITE_ACOMPANHAMENTO_MS = 60 * 1000;
// O teste na placa leva no maximo ~2 min (igual ao "Testar e trocar").
const LIMITE_TESTE_MS = 3 * 60 * 1000;

function linhaVazia() {
  return { chave: Math.random().toString(36).slice(2), ssid: "", senha: "", temSenhaSalva: false, mostrar: false, teste: null };
}

export default function WifiReservas({ maquina, onToast }) {
  const machineId = maquina?.id_hardware;
  const [dados, setDados] = useState(null);
  const [linhas, setLinhas] = useState([]);
  const [alterado, setAlterado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const timerRef = useRef(null);
  const testeTimerRef = useRef(null);
  const linhasRef = useRef(linhas);

  useEffect(() => {
    linhasRef.current = linhas;
  }, [linhas]);

  useEffect(
    () => () => {
      window.clearTimeout(timerRef.current);
      window.clearTimeout(testeTimerRef.current);
    },
    [],
  );

  const carregar = useCallback(() => {
    if (!machineId) return Promise.resolve(null);
    return api.get(`/maquinas/${machineId}/wifi/reservas`).then(({ data }) => {
      setDados(data);
      return data;
    });
  }, [machineId]);

  useEffect(() => {
    window.clearTimeout(timerRef.current);
    window.clearTimeout(testeTimerRef.current);
    setDados(null);
    setLinhas([]);
    setAlterado(false);
    if (!machineId) return;
    carregar()
      .then((data) => {
        if (!data) return;
        setLinhas(
          data.redes.map((rede) => ({ ...linhaVazia(), ssid: rede.ssid, senha: "", temSenhaSalva: rede.tem_senha })),
        );
      })
      .catch(() => setDados({ erro: true }));
  }, [machineId, carregar]);

  const acompanhar = (inicio) => {
    carregar()
      .then((data) => {
        if (data?.na_placa?.situacao === "enviando" && Date.now() - inicio < LIMITE_ACOMPANHAMENTO_MS) {
          timerRef.current = window.setTimeout(() => acompanhar(inicio), 3000);
        }
      })
      .catch(() => {});
  };

  const mudarLinha = (indice, campos) => {
    setLinhas((atual) => atual.map((linha, i) => (i === indice ? { ...linha, ...campos } : linha)));
    setAlterado(true);
  };

  const mover = (indice, direcao) => {
    setLinhas((atual) => {
      const nova = [...atual];
      const destino = indice + direcao;
      if (destino < 0 || destino >= nova.length) return atual;
      [nova[indice], nova[destino]] = [nova[destino], nova[indice]];
      return nova;
    });
    setAlterado(true);
  };

  const remover = (indice) => {
    setLinhas((atual) => atual.filter((_, i) => i !== indice));
    setAlterado(true);
  };

  const salvarLista = async (lista) => {
    setSalvando(true);
    try {
      const redes = lista.map((linha) => ({
        ssid: linha.ssid.trim(),
        // Senha em branco numa rede que ja tinha senha = mantem a salva.
        senha: linha.temSenhaSalva && !linha.senha ? null : linha.senha,
      }));
      const { data } = await api.put(`/maquinas/${machineId}/wifi/reservas`, { redes });
      setAlterado(false);
      setLinhas((atual) =>
        atual.map((linha) => ({ ...linha, ssid: linha.ssid.trim(), senha: "", temSenhaSalva: linha.temSenhaSalva || Boolean(linha.senha) })),
      );
      if (data.enviado_agora) {
        onToast({ message: "Redes reserva enviadas para a placa.", type: "success" });
        acompanhar(Date.now());
      } else {
        onToast({ message: "Redes reserva salvas. Vao para a placa assim que ela ficar online.", type: "success" });
        carregar().catch(() => {});
      }
    } catch (error) {
      onToast({ message: getApiErrorMessage(error, "Nao foi possivel salvar as redes reserva."), type: "error" });
    } finally {
      setSalvando(false);
    }
  };

  const handleSalvar = () => salvarLista(linhas);

  const mudarTeste = (chave, teste) =>
    setLinhas((atual) => atual.map((linha) => (linha.chave === chave ? { ...linha, teste } : linha)));

  // Testar e salvar: a placa testa a rede (Wi-Fi + servidor) e volta para a
  // rede atual; so salva a lista se o teste passou.
  const acompanharTeste = (chave, commandId, inicio) => {
    api
      .get(`/maquinas/${machineId}/wifi/troca/${commandId}`)
      .then(({ data }) => {
        if (data.resultado === "testado") {
          mudarTeste(chave, { estado: "ok" });
          salvarLista(linhasRef.current.map((linha) => (linha.chave === chave ? { ...linha, teste: { estado: "ok" } } : linha)));
          return;
        }
        if (data.resultado !== "testando") {
          mudarTeste(chave, { estado: "falhou", motivo: data.motivo_texto || "A placa nao conseguiu usar esta rede." });
          return;
        }
        if (Date.now() - inicio > LIMITE_TESTE_MS) {
          mudarTeste(chave, { estado: "falhou", motivo: "A placa nao respondeu o resultado do teste." });
          return;
        }
        testeTimerRef.current = window.setTimeout(() => acompanharTeste(chave, commandId, inicio), 3000);
      })
      .catch(() => {
        testeTimerRef.current = window.setTimeout(() => acompanharTeste(chave, commandId, inicio), 5000);
      });
  };

  const handleTestar = async (linha) => {
    mudarTeste(linha.chave, { estado: "testando" });
    try {
      const { data } = await api.post(`/maquinas/${machineId}/wifi/reservas/testar`, {
        ssid: linha.ssid.trim(),
        senha: linha.temSenhaSalva && !linha.senha ? null : linha.senha,
      });
      acompanharTeste(linha.chave, data.command_id, Date.now());
    } catch (error) {
      mudarTeste(linha.chave, { estado: "falhou", motivo: getApiErrorMessage(error, "Nao foi possivel testar a rede.") });
    }
  };

  if (!maquina) return null;

  const max = dados?.max || 4;
  const online = Boolean(maquina.status_online);
  const suporta = Boolean(dados?.suporta);
  const testando = linhas.some((linha) => linha.teste?.estado === "testando");
  const podeSalvar = alterado && !salvando && !testando && linhas.every((linha) => linha.ssid.trim());
  const suportaTeste = Boolean(dados?.suporta_teste);
  const motivoSemTeste = !suportaTeste
    ? `Para testar, a placa precisa do firmware 2.9.2 ou mais novo`
    : !online
      ? "A maquina precisa estar online para testar"
      : "";

  return (
    <div className="mt-6 rounded-[22px] border border-[var(--color-border)] bg-white p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
            <Shuffle size={17} />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-[var(--color-text)]">Redes reserva desta maquina</h3>
            <p className="mt-1 max-w-3xl text-sm text-[var(--color-text-soft)]">
              Se a rede principal ({maquina.wifi_ssid || "atual"}) cair, a placa tenta cada rede 3 vezes (cerca de 1
              minuto) e passa para a proxima da lista, voltando para a principal no fim. Rede conectada sem internet por
              3 minutos tambem conta como falha. A lista fica gravada na placa e nao se perde no reset do Wi-Fi.
            </p>
          </div>
        </div>
        <NaPlaca situacao={dados?.na_placa} />
      </div>

      {dados?.erro ? (
        <div className="mt-4 text-sm text-rose-700">Nao foi possivel carregar as redes reserva.</div>
      ) : !dados ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-[var(--color-text-soft)]">
          <Loader2 size={16} className="animate-spin" /> Carregando...
        </div>
      ) : (
        <>
          {!suporta ? (
            <div className="mt-4 rounded-[14px] bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
              Firmware {maquina.firmware_version || "desconhecido"}: as redes ficam salvas aqui e vao para a placa
              quando ela estiver com o firmware {dados.versao_minima} ou mais novo.
            </div>
          ) : null}

          <div className="mt-4 grid gap-2">
            <div className="flex items-center gap-2 rounded-[14px] bg-[var(--color-bg-muted)] px-3 py-3 text-sm">
              <span className="w-6 text-center font-extrabold text-[var(--color-text-soft)]">P</span>
              <span className="font-semibold text-[var(--color-text)]">{maquina.wifi_ssid || "Rede principal"}</span>
              <span className="text-xs text-[var(--color-text-soft)]">principal - troque pelo formulario acima</span>
            </div>
            {linhas.map((linha, indice) => (
              <div key={linha.chave} className="grid items-center gap-2 md:grid-cols-[24px_1fr_1fr_auto_auto]">
                <span className="text-center text-sm font-extrabold text-[var(--color-text-soft)]">{indice + 1}</span>
                <input
                  className={inputClassName}
                  placeholder="Nome da rede"
                  autoComplete="off"
                  data-lpignore="true"
                  maxLength={32}
                  value={linha.ssid}
                  onChange={(event) => mudarLinha(indice, { ssid: event.target.value })}
                />
                <div className="relative">
                  <input
                    className={`${inputClassName} w-full pr-11`}
                    placeholder={linha.temSenhaSalva ? "Senha salva (deixe vazio para manter)" : "Senha (vazia se for aberta)"}
                    type={linha.mostrar ? "text" : "password"}
                    autoComplete="new-password"
                    data-lpignore="true"
                    maxLength={63}
                    value={linha.senha}
                    onChange={(event) => mudarLinha(indice, { senha: event.target.value })}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-soft)]"
                    onClick={() => mudarLinha(indice, { mostrar: !linha.mostrar })}
                    aria-label={linha.mostrar ? "Esconder senha" : "Mostrar senha"}
                  >
                    {linha.mostrar ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  <BotaoIcone titulo="Subir" onClick={() => mover(indice, -1)} disabled={indice === 0}>
                    <ArrowUp size={16} />
                  </BotaoIcone>
                  <BotaoIcone titulo="Descer" onClick={() => mover(indice, 1)} disabled={indice === linhas.length - 1}>
                    <ArrowDown size={16} />
                  </BotaoIcone>
                  <BotaoIcone titulo="Remover" onClick={() => remover(indice)} disabled={linha.teste?.estado === "testando"}>
                    <Trash2 size={16} />
                  </BotaoIcone>
                </div>
                <button
                  type="button"
                  title={motivoSemTeste || "A placa testa a rede e volta para a atual; se funcionar, salva a lista"}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-primary)] disabled:opacity-40"
                  onClick={() => handleTestar(linha)}
                  disabled={Boolean(motivoSemTeste) || testando || salvando || !linha.ssid.trim()}
                >
                  {linha.teste?.estado === "testando" ? <Loader2 size={15} className="animate-spin" /> : <Wifi size={15} />}
                  Testar e salvar
                </button>
                {linha.teste ? <ResultadoTeste teste={linha.teste} /> : null}
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-text)] disabled:opacity-50"
              onClick={() => {
                setLinhas((atual) => [...atual, linhaVazia()]);
                setAlterado(true);
              }}
              disabled={linhas.length >= max}
            >
              <Plus size={15} /> Adicionar rede ({linhas.length}/{max})
            </button>
            <button
              type="button"
              className="pill-button pill-button--primary inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold disabled:opacity-50"
              onClick={handleSalvar}
              disabled={!podeSalvar}
            >
              {salvando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              Salvar na placa
            </button>
            {!online ? (
              <span className="text-xs text-[var(--color-text-soft)]">Maquina offline: salva aqui e vai para a placa quando ela ligar.</span>
            ) : null}
            {dados.atualizado_em ? (
              <span className="text-xs text-[var(--color-text-soft)]">
                Ultima alteracao {brasiliaDate(dados.atualizado_em).format("DD/MM/YYYY HH:mm")}
                {dados.atualizado_por ? ` por ${dados.atualizado_por}` : ""}
              </span>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

function ResultadoTeste({ teste }) {
  const estilos = {
    testando: ["bg-sky-50 text-sky-800", "Testando... a maquina fica offline por ate 2 minutos e volta sozinha para a rede atual."],
    ok: ["bg-emerald-50 text-emerald-800", "Teste ok: a placa conectou e chegou no servidor. Lista salva."],
    falhou: ["bg-rose-50 text-rose-800", `Teste falhou: ${String(teste.motivo).replace(/\.$/, "")}. A rede nao foi salva.`],
  };
  const [estilo, texto] = estilos[teste.estado] || estilos.falhou;
  return <div className={`rounded-[12px] px-3 py-2 text-xs font-semibold md:col-span-5 md:ml-8 ${estilo}`}>{texto}</div>;
}

function BotaoIcone({ titulo, onClick, disabled, children }) {
  return (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      onClick={onClick}
      disabled={disabled}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-text-soft)] hover:text-[var(--color-text)] disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function NaPlaca({ situacao }) {
  if (!situacao) return null;
  if (situacao.situacao === "gravado") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
        <CheckCircle2 size={13} /> Gravado na placa
      </span>
    );
  }
  if (situacao.situacao === "pendente") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
        <Clock size={13} /> Salvo - vai para a placa quando ela ligar
      </span>
    );
  }
  if (situacao.situacao === "falhou") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700"
        title={situacao.detalhe || ""}
      >
        <XCircle size={13} /> Placa nao gravou - salve de novo
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700">
      <Loader2 size={13} className="animate-spin" /> Enviando para a placa
    </span>
  );
}
