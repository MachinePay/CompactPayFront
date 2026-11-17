import { useCallback, useEffect, useRef, useState } from "react";
import { Film, Trash2, Upload } from "lucide-react";

import api, { getApiErrorMessage } from "../api/axios";

// Video em loop da tela touch (banco "mercado_pago_point"). O backend converte o
// arquivo para o formato da tela; a tela baixa sozinha pelo Wi-Fi em ate 10 min.
export default function VideoTela({ maquinaId, maquinaSalva }) {
  const [video, setVideo] = useState(undefined); // undefined = carregando, null = sem video
  const [progresso, setProgresso] = useState(null); // 0..100 no envio; "convertendo" depois
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const entrada = useRef(null);

  const carregar = useCallback(async () => {
    if (!maquinaSalva || !maquinaId) return;
    try {
      const { data } = await api.get(`/tela/maquinas/${encodeURIComponent(maquinaId)}/video`);
      setVideo(data.video);
      setErro("");
    } catch (error) {
      setVideo(null);
      setErro(getApiErrorMessage(error, "Nao foi possivel ver o video da maquina"));
    }
  }, [maquinaId, maquinaSalva]);

  useEffect(() => {
    setAviso("");
    carregar();
  }, [carregar]);

  const enviar = async (arquivo) => {
    if (!arquivo) return;
    const dados = new FormData();
    dados.append("arquivo", arquivo);
    setErro("");
    setAviso("");
    setProgresso(0);
    try {
      const { data } = await api.post(`/tela/maquinas/${encodeURIComponent(maquinaId)}/video`, dados, {
        timeout: 10 * 60 * 1000,
        onUploadProgress: (e) => {
          if (!e.total) return;
          const pct = Math.round((e.loaded * 100) / e.total);
          setProgresso(pct >= 100 ? "convertendo" : pct);
        },
      });
      setVideo(data.video);
      setAviso("Video enviado. A tela baixa sozinha em ate 10 minutos (ou na hora, se for reiniciada).");
    } catch (error) {
      setErro(getApiErrorMessage(error, "Nao foi possivel enviar o video"));
    } finally {
      setProgresso(null);
      if (entrada.current) entrada.current.value = "";
    }
  };

  const remover = async () => {
    if (!window.confirm("Remover o video desta tela? Ela passa a mostrar so \"Toque na tela\".")) return;
    try {
      await api.delete(`/tela/maquinas/${encodeURIComponent(maquinaId)}/video`);
      setVideo(null);
      setAviso("Video removido. A tela apaga o dela na proxima verificacao.");
    } catch (error) {
      setErro(getApiErrorMessage(error, "Nao foi possivel remover o video"));
    }
  };

  if (!maquinaSalva) return null;

  const ocupado = progresso !== null;

  return (
    <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg-muted)] p-4">
      <span className="mb-1 flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
        <Film size={16} />
        Video da tela
      </span>
      <p className="mb-3 text-xs leading-5 text-[var(--color-text-soft)]">
        Envie o video em MP4 (ou outro formato comum). Ele e' ajustado para a tela (1024x600, 20 quadros por
        segundo) e precisa caber na memoria dela: em geral 15 a 20 segundos de video. Se passar, a qualidade
        diminui um pouco e, se ainda passar, o fim e' cortado.
      </p>

      {video === undefined ? (
        <p className="mb-3 text-xs text-[var(--color-text-soft)]">Carregando...</p>
      ) : video ? (
        <div className="mb-3 flex items-center justify-between gap-2 rounded-[10px] bg-white px-3 py-2 text-xs">
          <span className="min-w-0">
            <span className="block truncate font-semibold text-[var(--color-text)]">
              {video.nome_original || "video"}
            </span>
            <span className="block text-[var(--color-text-soft)]">
              {video.duracao_s} s · {(video.tamanho / (1024 * 1024)).toFixed(1)} MB · versao {video.versao.slice(0, 8)}
            </span>
          </span>
          <button
            type="button"
            onClick={remover}
            disabled={ocupado}
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-rose-200 px-3 py-1 font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-60"
          >
            <Trash2 size={13} />
            Remover
          </button>
        </div>
      ) : (
        <p className="mb-3 text-xs text-[var(--color-text-soft)]">Nenhum video. A tela mostra "Toque na tela".</p>
      )}

      <input
        ref={entrada}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => enviar(e.target.files?.[0])}
      />
      <button
        type="button"
        onClick={() => entrada.current?.click()}
        disabled={ocupado}
        className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--color-text)] transition hover:border-[var(--color-primary)] disabled:opacity-60"
      >
        <Upload size={15} />
        {progresso === "convertendo"
          ? "Convertendo para a tela..."
          : ocupado
            ? `Enviando... ${progresso}%`
            : video
              ? "Trocar video"
              : "Enviar video"}
      </button>

      {aviso ? <p className="mt-2 text-xs font-medium text-emerald-700">{aviso}</p> : null}
      {erro ? <p className="mt-2 text-xs font-medium text-rose-600">{erro}</p> : null}
    </div>
  );
}
