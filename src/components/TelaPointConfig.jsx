import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Copy, MonitorSmartphone, RefreshCcw, Store, Trash2, Zap } from "lucide-react";

import api, { getApiErrorMessage } from "../api/axios";

// Banco "mercado_pago_point": tela touch (ESP32) que mostra os valores e manda a
// cobranca para a Point em modo integrado (rotas /tela no backend). Cada maquina
// tem uma tela; a chave so aparece uma vez, logo apos gerar.
export default function TelaPointConfig({ clienteId, maquinaId, maquinaSalva }) {
  const [points, setPoints] = useState([]);
  const [caixa, setCaixa] = useState(undefined); // undefined = carregando, null = sem caixa
  const [telas, setTelas] = useState([]);
  const [pointEscolhida, setPointEscolhida] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [novaChave, setNovaChave] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const [aviso, setAviso] = useState("");
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    if (!clienteId || !maquinaSalva) return;
    setCarregando(true);
    // Cada parte carrega sozinha: um erro do Mercado Pago na lista de Points
    // nao esconde o caixa nem as telas.
    const [caixaResp, pointsResp, telasResp] = await Promise.allSettled([
      api.get(`/tela/maquinas/${encodeURIComponent(maquinaId)}/caixa`),
      api.get("/tela/point/terminais", { params: { cliente_id: Number(clienteId), maquina_id: maquinaId } }),
      api.get("/tela/telas"),
    ]);
    const erros = [];
    if (caixaResp.status === "fulfilled") {
      setCaixa(caixaResp.value.data.caixa);
    } else {
      setCaixa(null);
      erros.push(getApiErrorMessage(caixaResp.reason, "Nao foi possivel ver o caixa da maquina"));
    }
    if (pointsResp.status === "fulfilled") {
      setPoints(pointsResp.value.data);
      const doCaixa = pointsResp.value.data.find((p) => p.neste_caixa);
      if (doCaixa) setPointEscolhida((atual) => atual || doCaixa.id);
    } else {
      setPoints([]);
      erros.push(getApiErrorMessage(pointsResp.reason, "Nao foi possivel carregar as Points do Mercado Pago"));
    }
    if (telasResp.status === "fulfilled") {
      setTelas(telasResp.value.data.filter((t) => t.maquina_id === maquinaId && t.ativo));
    }
    setErro(erros.join(" "));
    setCarregando(false);
  }, [clienteId, maquinaId, maquinaSalva]);

  useEffect(() => {
    setNovaChave(null);
    setAviso("");
    carregar();
  }, [carregar]);

  const point = points.find((p) => p.id === pointEscolhida);

  const criarCaixa = async () => {
    setOcupado(true);
    try {
      const { data } = await api.post(`/tela/maquinas/${encodeURIComponent(maquinaId)}/caixa`);
      setCaixa(data.caixa);
      setAviso("Caixa criado. Agora vincule a Point a esse caixa no Mercado Pago.");
      setErro("");
      await carregar();
    } catch (error) {
      setErro(getApiErrorMessage(error, "Nao foi possivel criar o caixa no Mercado Pago"));
    } finally {
      setOcupado(false);
    }
  };

  const ativarIntegrado = async () => {
    if (!point) return;
    if (!window.confirm(`Colocar a Point ${point.id} em modo integrado? Ela passa a cobrar so o que vier da tela.`)) return;
    setOcupado(true);
    try {
      await api.post(`/tela/point/terminais/${encodeURIComponent(point.id)}/modo-integrado`, null, {
        params: { cliente_id: Number(clienteId) },
      });
      setAviso("Modo integrado ativado. Reinicie a Point para aplicar.");
      setErro("");
      await carregar();
    } catch (error) {
      setErro(getApiErrorMessage(error, "Nao foi possivel ativar o modo integrado"));
    } finally {
      setOcupado(false);
    }
  };

  const gerar = async () => {
    if (!point) return;
    setOcupado(true);
    setCopiado(false);
    try {
      const { data } = await api.post("/tela/telas", {
        maquina_id: maquinaId,
        nome: `Tela ${maquinaId}`,
        point_terminal_id: point.id,
      });
      setNovaChave(data);
      setErro("");
      await carregar();
    } catch (error) {
      setErro(getApiErrorMessage(error, "Nao foi possivel gerar a chave da tela"));
    } finally {
      setOcupado(false);
    }
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(novaChave.chave);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  };

  const revogar = async (tela) => {
    if (!window.confirm(`Revogar a chave de "${tela.nome}"? A tela para de cobrar.`)) return;
    try {
      await api.delete(`/tela/telas/${tela.id}`);
      if (novaChave?.id === tela.id) setNovaChave(null);
      await carregar();
    } catch (error) {
      setErro(getApiErrorMessage(error, "Nao foi possivel revogar a chave"));
    }
  };

  if (!maquinaSalva) {
    return (
      <div className="mt-3 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg-muted)] p-4 text-xs text-[var(--color-text-soft)]">
        Salve a maquina com o banco Mercado Pago Point (tela) e abra de novo para vincular a Point e gerar a chave da tela.
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg-muted)] p-4">
      <span className="mb-1 flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
        <MonitorSmartphone size={16} />
        Tela touch + Point (modo integrado)
      </span>
      <p className="mb-3 text-xs leading-5 text-[var(--color-text-soft)]">
        1) A maquina tem um caixa no Mercado Pago. 2) Vincule a Point a esse caixa. 3) Deixe a Point em modo
        integrado (frente de caixa). 4) Gere a chave da tela. Os valores que aparecem na tela sao os produtos
        cadastrados para{" "}
        <strong className="font-mono text-[var(--color-text)]">{maquinaId}</strong>.
      </p>

      <div className="mb-3 flex items-center justify-between gap-2 rounded-[10px] bg-white px-3 py-2 text-xs">
        <span className="flex min-w-0 items-center gap-2">
          <Store size={14} className="shrink-0" />
          {caixa === undefined ? (
            <span className="text-[var(--color-text-soft)]">Carregando caixa...</span>
          ) : caixa ? (
            <span>
              <span className="font-semibold text-[var(--color-text)]">Caixa Mercado Pago</span>{" "}
              <span className="font-mono text-[var(--color-text-soft)]">
                {caixa.pos_external_id || caixa.pos_id}
              </span>
            </span>
          ) : (
            <span className="text-[var(--color-text-soft)]">
              Esta maquina ainda nao tem caixa no Mercado Pago.
            </span>
          )}
        </span>
        {caixa === null ? (
          <button
            type="button"
            onClick={criarCaixa}
            disabled={ocupado}
            className="shrink-0 rounded-full bg-[var(--color-primary)] px-3 py-1 font-semibold text-white disabled:opacity-60"
          >
            Criar caixa
          </button>
        ) : null}
      </div>

      <label className="mb-3 block">
        <span className="mb-1 block text-xs font-semibold text-[var(--color-text)]">Point</span>
        <select
          value={pointEscolhida}
          onChange={(e) => setPointEscolhida(e.target.value)}
          className="w-full rounded-[10px] border border-[var(--color-border)] bg-white px-3 py-2 text-xs"
        >
          <option value="">{carregando ? "Carregando..." : "Selecione a Point"}</option>
          {points.map((p) => (
            <option key={p.id} value={p.id}>
              {p.id} {p.operating_mode === "PDV" ? "(integrada)" : "(nao integrada)"}
              {p.neste_caixa ? " - neste caixa" : ""}
            </option>
          ))}
        </select>
      </label>

      {point && caixa && !point.neste_caixa ? (
        <p className="mb-3 text-xs font-medium text-amber-700">
          Esta Point nao esta vinculada ao caixa desta maquina. No Mercado Pago, vincule a Point ao caixa{" "}
          <strong className="font-mono">{caixa.pos_external_id || caixa.pos_id}</strong> antes de usar a tela.
        </p>
      ) : null}

      {novaChave ? (
        <div className="mb-3 rounded-[14px] border border-emerald-300 bg-emerald-50 p-3">
          <span className="block text-xs font-semibold text-emerald-800">
            Chave da tela - copie agora, ela nao aparece de novo:
          </span>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-[10px] bg-white px-3 py-2 text-xs text-[var(--color-text)]">
              {novaChave.chave}
            </code>
            <button
              type="button"
              onClick={copiar}
              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--color-primary)] px-3 py-2 text-xs font-semibold text-white"
            >
              {copiado ? <CheckCircle2 size={14} /> : <Copy size={14} />}
              {copiado ? "Copiada" : "Copiar"}
            </button>
          </div>
        </div>
      ) : null}

      {telas.length > 0 ? (
        <ul className="mb-3 space-y-2">
          {telas.map((tela) => (
            <li
              key={tela.id}
              className="flex items-center justify-between gap-2 rounded-[10px] bg-white px-3 py-2 text-xs"
            >
              <span className="min-w-0">
                <span className="block font-semibold text-[var(--color-text)]">
                  {tela.nome} · {tela.point_terminal_id}
                </span>
                <span className="block text-[var(--color-text-soft)]">
                  {tela.chave_prefixo}… ·{" "}
                  {tela.ultimo_uso_em
                    ? `usada em ${new Date(tela.ultimo_uso_em + "Z").toLocaleString("pt-BR")}`
                    : "ainda nao usada"}
                </span>
              </span>
              <button
                type="button"
                onClick={() => revogar(tela)}
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-rose-200 px-3 py-1 font-semibold text-rose-600 hover:bg-rose-50"
              >
                <Trash2 size={13} />
                Revogar
              </button>
            </li>
          ))}
        </ul>
      ) : !carregando ? (
        <p className="mb-3 text-xs text-[var(--color-text-soft)]">Nenhuma tela ativa nesta maquina ainda.</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {point && point.operating_mode !== "PDV" ? (
          <button
            type="button"
            onClick={ativarIntegrado}
            disabled={ocupado}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--color-text)] transition hover:border-[var(--color-primary)] disabled:opacity-60"
          >
            <Zap size={15} />
            Ativar modo integrado
          </button>
        ) : null}
        <button
          type="button"
          onClick={gerar}
          disabled={ocupado || !point}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--color-text)] transition hover:border-[var(--color-primary)] disabled:opacity-60"
        >
          <RefreshCcw size={15} className={ocupado ? "animate-spin" : ""} />
          {telas.length > 0 ? "Trocar chave da tela" : "Gerar chave da tela"}
        </button>
      </div>

      {aviso ? <p className="mt-2 text-xs font-medium text-emerald-700">{aviso}</p> : null}
      {erro ? <p className="mt-2 text-xs font-medium text-rose-600">{erro}</p> : null}
    </div>
  );
}
