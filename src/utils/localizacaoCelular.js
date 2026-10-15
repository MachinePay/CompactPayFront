import api from "../api/axios";

// Mesmo limite do backend (mapa.GPS_PRECISAO_MAXIMA_M): GPS pior que isso
// (comum dentro de predio) nao muda a posicao da maquina.
export const GPS_PRECISAO_MAXIMA_M = 150;

// So celular/tablet: no computador a "localizacao" vem do IP (erra por km).
export function ehCelular() {
  try {
    const ua = navigator.userAgent || "";
    const toque = window.matchMedia?.("(pointer: coarse)")?.matches;
    return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) && Boolean(toque);
  } catch {
    return false;
  }
}

export function obterGps({ timeoutMs = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Este navegador nao informa a localizacao."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (posicao) =>
        resolve({
          latitude: posicao.coords.latitude,
          longitude: posicao.coords.longitude,
          precisao_m: Math.round(posicao.coords.accuracy || 0),
        }),
      (erro) =>
        reject(
          new Error(
            erro.code === 1
              ? "Permissao de localizacao negada. Libere a localizacao para o site nas configuracoes do navegador."
              : "Nao foi possivel pegar a localizacao do celular agora.",
          ),
        ),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
    );
  });
}

export async function salvarGpsDaMaquina(machineId, gps) {
  await api.put(`/mapa/maquinas/${machineId}/localizacao`, gps);
}
