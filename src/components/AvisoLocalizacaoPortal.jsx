import { useCallback, useEffect, useState } from "react";
import { Loader2, MapPin, X } from "lucide-react";

import api, { getApiErrorMessage } from "../api/axios";
import { useAuth } from "../context/useAuth";
import { GPS_PRECISAO_MAXIMA_M, ehCelular, obterGps, salvarGpsDaMaquina } from "../utils/localizacaoCelular";

const INTERVALO_MS = 30000;
const CHAVE_DISPENSADOS = "compactpay.aviso_local.dispensados";

function lerDispensados() {
  try {
    return new Set(JSON.parse(window.sessionStorage.getItem(CHAVE_DISPENSADOS) || "[]"));
  } catch {
    return new Set();
  }
}

/**
 * Depois que alguem configura a placa pelo portal dos 5 cliques, por 15 min o
 * painel aberto no CELULAR (admin) oferece salvar a localizacao da maquina com
 * o GPS do aparelho - quem configurou estava do lado dela. No computador nao
 * aparece. Configurar pelo painel nao mexe na localizacao.
 */
export default function AvisoLocalizacaoPortal() {
  const { user } = useAuth();
  const ativo = user?.role === "admin" && ehCelular();
  const [pendentes, setPendentes] = useState([]);
  const [dispensados, setDispensados] = useState(lerDispensados);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState(null);

  const carregar = useCallback(() => {
    api
      .get("/mapa/configuradas-agora")
      .then(({ data }) => setPendentes(data || []))
      .catch(() => setPendentes([]));
  }, []);

  useEffect(() => {
    if (!ativo) return undefined;
    const primeiro = window.setTimeout(carregar, 0);
    const timer = window.setInterval(carregar, INTERVALO_MS);
    window.addEventListener("focus", carregar);
    return () => {
      window.clearTimeout(primeiro);
      window.clearInterval(timer);
      window.removeEventListener("focus", carregar);
    };
  }, [ativo, carregar]);

  if (!ativo) return null;
  const chave = (item) => `${item.maquina_id}|${item.configurada_em}`;
  const atual = pendentes.find((item) => !dispensados.has(chave(item)));
  if (!atual && !mensagem) return null;

  const dispensar = (item) => {
    const novo = new Set(dispensados).add(chave(item));
    setDispensados(novo);
    try {
      window.sessionStorage.setItem(CHAVE_DISPENSADOS, JSON.stringify([...novo]));
    } catch {
      // sem armazenamento: so esconde ate recarregar a pagina
    }
  };

  const salvar = async () => {
    setSalvando(true);
    try {
      const gps = await obterGps();
      if (gps.precisao_m > GPS_PRECISAO_MAXIMA_M) {
        throw new Error(`GPS impreciso (+-${gps.precisao_m} m). Va para perto de uma janela e tente de novo.`);
      }
      await salvarGpsDaMaquina(atual.maquina_id, gps);
      setMensagem({ tipo: "ok", texto: `Localizacao da ${atual.maquina_nome} salva (+-${gps.precisao_m} m).` });
      dispensar(atual);
      carregar();
    } catch (error) {
      setMensagem({ tipo: "erro", texto: getApiErrorMessage(error, error.message || "Nao foi possivel salvar.") });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-x-3 bottom-3 z-[1100] mx-auto max-w-md rounded-[22px] border border-[var(--color-border)] bg-white p-4 shadow-[0_18px_40px_rgba(20,40,28,0.25)]">
      {mensagem && !atual ? (
        <div className="flex items-start justify-between gap-3 text-sm">
          <span className={mensagem.tipo === "ok" ? "text-emerald-700" : "text-rose-700"}>{mensagem.texto}</span>
          <button type="button" aria-label="Fechar" onClick={() => setMensagem(null)}>
            <X size={18} />
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
              <MapPin size={18} />
            </span>
            <div className="min-w-0 text-sm">
              <div className="font-extrabold text-[var(--color-text)]">
                {atual.maquina_nome} acabou de ser configurada
              </div>
              <div className="mt-1 text-[var(--color-text-soft)]">
                Voce esta do lado dela? Salve a localizacao com o GPS do celular
                {atual.ja_tem_localizacao ? " (substitui a posicao atual no mapa)" : ""}.
              </div>
              {mensagem?.tipo === "erro" ? <div className="mt-2 text-rose-700">{mensagem.texto}</div> : null}
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="pill-button pill-button--primary inline-flex flex-1 items-center justify-center gap-2 px-4 py-3 font-semibold"
              onClick={salvar}
              disabled={salvando}
            >
              {salvando ? <Loader2 size={16} className="animate-spin" /> : <MapPin size={16} />}
              Salvar localizacao
            </button>
            <button
              type="button"
              className="pill-button px-4 py-3 font-semibold"
              onClick={() => {
                setMensagem(null);
                dispensar(atual);
              }}
              disabled={salvando}
            >
              Agora nao
            </button>
          </div>
        </>
      )}
    </div>
  );
}
