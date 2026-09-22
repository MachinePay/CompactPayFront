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

function formatCurrencyBRL(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

// Traduz o resultado final do polling num toast unico com o desfecho real -
// pra quem esta testando so importam 3 respostas: confirmou, mandou mas nao
// confirmou tudo, ou falhou (e se foi por falta de resposta da placa, o
// pagamento ja foi estornado sozinho pelo backend). Usado no lugar de
// mostrar um toast imediato de "comando enviado" - a UI so avisa quando a
// placa responder de verdade (ou quando o backend desistir de esperar).
export function describePulseResultToast(resultado, valor, machineId) {
  const valorFormatado = formatCurrencyBRL(valor);
  if (!resultado) {
    return {
      message: `Sem confirmacao da maquina ${machineId} apos 60s. O pagamento de teste de ${valorFormatado} continua em acompanhamento - confira o historico da maquina.`,
      type: "error",
    };
  }
  if (resultado.status === "executado") {
    if (resultado.detalhe_status === "PULSOS_ENVIADOS_SEM_RETORNO") {
      return {
        message: `Pulso enviado para ${machineId} (${valorFormatado}), mas a placa nao confirmou o retorno de todos os pulsos. Confira se o premio saiu de verdade.`,
        type: "success",
      };
    }
    if (resultado.detalhe_status === "SALDO_PENDENTE") {
      return {
        message: `Pulso enviado para ${machineId} (${valorFormatado}) - ainda ha saldo pendente pra liberar.`,
        type: "success",
      };
    }
    return {
      message: `Pulso confirmado em ${machineId} - pagamento de teste de ${valorFormatado} liberado.`,
      type: "success",
    };
  }
  if (resultado.status === "falhou") {
    if (resultado.detalhe_status === "retry_esgotado") {
      return {
        message: `Falha: a placa ${machineId} nao respondeu ao comando. O pagamento de teste de ${valorFormatado} foi estornado automaticamente.`,
        type: "error",
      };
    }
    return {
      message: `Falha no pulso da maquina ${machineId} (${resultado.detalhe_status || "sem detalhe"}). Verifique manualmente se precisa estornar.`,
      type: "error",
    };
  }
  return {
    message: `Comando cancelado para ${machineId}.`,
    type: "error",
  };
}
