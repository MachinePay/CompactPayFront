import api from "../api/axios";

const POLL_INTERVAL_MS = 1500;
const POLL_MAX_ATTEMPTS = 40; // ~60s de acompanhamento antes de desistir de ficar perguntando
const FINAL_STATUSES = new Set(["executado", "falhou", "cancelado"]);

// Acompanha um comando (pagamento/teste) depois que o endpoint que o
// disparou ja respondeu na hora, sem travar a requisicao HTTP esperando a
// maquina confirmar o pulso fisico. Devolve o comando final (executado,
// falhou ou cancelado) ou null se passar do tempo de acompanhamento - nesse
// caso o comando continua em andamento no backend, so paramos de perguntar.
export async function pollComandoStatus(commandId) {
  if (!commandId) return null;
  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    try {
      const { data } = await api.get(`/comandos-maquinas/${commandId}`);
      if (FINAL_STATUSES.has(data.status)) {
        return data;
      }
    } catch {
      // consulta pontual falhou (rede etc.) - tenta de novo na proxima rodada
    }
  }
  return null;
}
