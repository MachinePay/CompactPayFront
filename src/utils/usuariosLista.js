// Busca, filtros e paginacao da tela de Usuarios. Tudo roda sobre a lista
// inteira (GET /usuarios + /usuarios/resumo-clientes), entao a busca acha o
// cliente mesmo que ele esteja em outra pagina.

export const POR_PAGINA = 10;

export const FILTROS_PADRAO = { perfil: "todos", mp: "todos", sumup: "todos", venda: "todos" };

export const OPCOES_FILTROS = [
  {
    chave: "perfil",
    nome: "Perfil",
    opcoes: [
      ["todos", "Todos"],
      ["admin", "Admin"],
      ["cliente", "Cliente"],
    ],
  },
  {
    chave: "mp",
    nome: "Mercado Pago",
    opcoes: [
      ["todos", "Todos"],
      ["configurado", "Configurado"],
      ["pendente", "Pendente"],
    ],
  },
  {
    chave: "sumup",
    nome: "SumUp",
    opcoes: [
      ["todos", "Todos"],
      ["configurado", "Configurado"],
      ["pendente", "Pendente"],
    ],
  },
  {
    chave: "venda",
    nome: "Vendas",
    opcoes: [
      ["todos", "Todos"],
      ["com", "Com venda"],
      ["sem", "Sem venda"],
    ],
  },
];

/** Junta cada usuario com o resumo do cliente dele (maquinas, SumUp, ultima venda). */
export function juntarResumo(usuarios, resumo) {
  const porCliente = new Map((resumo || []).map((item) => [item.cliente_id, item]));
  return usuarios.map((item) => {
    const r = item.cliente_id != null ? porCliente.get(item.cliente_id) : null;
    return {
      ...item,
      maquinas: r ? r.maquinas : null,
      sumup_configurado: Boolean(r?.sumup_configurado),
      tem_venda: Boolean(r?.tem_venda),
      ultima_venda: r?.ultima_venda || null,
    };
  });
}

function normalizar(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Busca por nome, email, ID interno ou numero do cliente.
 * Numero ("9" ou "#9") casa exato com o ID interno ou o numero do cliente,
 * para "1" nao trazer o 10, 11, 12...
 */
export function casaBusca(item, busca) {
  const termo = normalizar(busca);
  if (!termo) return true;
  const numero = termo.replace(/^#/, "");
  if (/^\d+$/.test(numero)) {
    if (String(item.id) === numero || String(item.cliente_id ?? "") === numero) return true;
  }
  return normalizar(item.nome).includes(termo) || normalizar(item.email).includes(termo);
}

export function casaFiltros(item, filtros) {
  if (filtros.perfil !== "todos" && item.role !== filtros.perfil) return false;
  if (filtros.mp === "configurado" && !item.mp_configurado) return false;
  if (filtros.mp === "pendente" && item.mp_configurado) return false;
  if (filtros.sumup === "configurado" && !item.sumup_configurado) return false;
  if (filtros.sumup === "pendente" && item.sumup_configurado) return false;
  if (filtros.venda === "com" && !item.tem_venda) return false;
  if (filtros.venda === "sem" && item.tem_venda) return false;
  return true;
}

export function formatarUltimaVenda(iso) {
  if (!iso) return "--";
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "--";
  return data.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
