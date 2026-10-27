// Busca, filtro por status e ordenacao da lista da tela de Maquinas. Tudo no
// navegador, em cima do que /maquinas ja devolve.

const BANCOS = {
  mercado_pago: "Mercado Pago",
  mercado_pago_apk: "Mercado Pago APK Point SmartApp",
  sumup: "SumUp",
  stone: "Stone",
  pagbank: "PagBank",
  s6pay: "S6Pay",
  token_play: "Token Play",
};

/** online | sem_movimento | fechado | offline */
export function categoriaStatus(m) {
  if (m.status_online) return m.status_operacional === "atencao" ? "sem_movimento" : "online";
  return m.status_operacional === "fechado" ? "fechado" : "offline";
}

export const FILTROS_STATUS = [
  { id: "todos", nome: "Todas", testa: () => true },
  { id: "online", nome: "Online", testa: (m) => Boolean(m.status_online) },
  {
    id: "sem_movimento",
    nome: "Sem movimento",
    ajuda: "Online, mas sem pagamento, teste ou saida no periodo",
    testa: (m) => categoriaStatus(m) === "sem_movimento",
  },
  { id: "offline", nome: "Offline", testa: (m) => categoriaStatus(m) === "offline" },
  { id: "fechado", nome: "Fechado", testa: (m) => categoriaStatus(m) === "fechado" },
];

function normalizar(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Busca em ID, nome, local, cliente, rede Wi-Fi, IP, firmware, banco e
 * identificadores das maquininhas (Stone/SumUp). Varias palavras: todas
 * precisam aparecer (em qualquer campo). */
export function buscarMaquinas(maquinas, termo) {
  const palavras = normalizar(termo).split(/\s+/).filter(Boolean);
  if (!palavras.length) return maquinas;
  return maquinas.filter((m) => {
    const texto = normalizar(
      [
        m.id_hardware,
        m.nome,
        m.localizacao,
        m.cliente_nome,
        m.wifi_ssid,
        m.ip_local,
        m.firmware_version,
        BANCOS[m.banco_pagamento || "mercado_pago"] || m.banco_pagamento,
        m.stone_serial_number,
        m.sumup_device_code,
        m.sumup_reader_id,
        m.sumup_usuario,
      ]
        .filter(Boolean)
        .join(" | "),
    );
    return palavras.every((palavra) => texto.includes(palavra));
  });
}

// Problema primeiro na ordem crescente.
const PESO_STATUS = { offline: 0, sem_movimento: 1, fechado: 2, online: 3 };

const comparaTexto = (a, b) =>
  String(a ?? "").localeCompare(String(b ?? ""), "pt-BR", { numeric: true, sensitivity: "base" });

const tempo = (valor) => (valor ? new Date(valor).getTime() : null);

export const COLUNAS_ORDENACAO = {
  maquina: { nome: "Maquina", valor: (m) => m.nome || m.id_hardware, texto: true },
  status: { nome: "Status", valor: (m) => PESO_STATUS[categoriaStatus(m)] },
  sinal: { nome: "Sinal Wi-Fi", valor: (m) => (m.status_online ? m.wifi_quality ?? -1 : -2) },
  atividade: { nome: "Ultima atividade", valor: (m) => tempo(m.ultima_atividade_em) },
  local: { nome: "Local", valor: (m) => m.localizacao, texto: true },
  firmware: { nome: "Firmware", valor: (m) => m.firmware_version, texto: true },
  resultados: { nome: "Faturamento", valor: (m) => Number(m.faturamento || 0) },
};

/** ordem: { coluna, direcao: "asc" | "desc" } ou null (ordem original). Vazios
 * sempre no fim. */
export function ordenarMaquinas(maquinas, ordem) {
  const coluna = ordem && COLUNAS_ORDENACAO[ordem.coluna];
  if (!coluna) return maquinas;
  const sinal = ordem.direcao === "desc" ? -1 : 1;
  return [...maquinas].sort((a, b) => {
    const va = coluna.valor(a);
    const vb = coluna.valor(b);
    const vazioA = va === null || va === undefined || va === "";
    const vazioB = vb === null || vb === undefined || vb === "";
    if (vazioA || vazioB) return vazioA === vazioB ? 0 : vazioA ? 1 : -1;
    const resultado = coluna.texto ? comparaTexto(va, vb) : va - vb;
    return resultado * sinal || comparaTexto(a.id_hardware, b.id_hardware);
  });
}

/** Clique na coluna: crescente -> decrescente -> sem ordenacao. Numeros e
 * datas comecam do maior (mais util: maior faturamento, atividade recente). */
export function proximaOrdem(atual, coluna) {
  const primeira = COLUNAS_ORDENACAO[coluna]?.texto || coluna === "status" ? "asc" : "desc";
  if (!atual || atual.coluna !== coluna) return { coluna, direcao: primeira };
  if (atual.direcao === primeira) return { coluna, direcao: primeira === "asc" ? "desc" : "asc" };
  return null;
}
