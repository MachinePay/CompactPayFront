import { createElement, useCallback, useEffect, useState } from "react";

import api from "../api/axios";

// Pontos: agrupamento OPCIONAL das maquinas de um cliente, so para organizar a
// lista (rotas /pontos em backend pontos_grupos.py). Nao tem nada a ver com o
// "Nome do ponto" (nome_local) da maquina. Sem pontos criados a lista fica
// exatamente como era: aplicarPontos/listarComPontos devolvem a mesma ordem.
// A UI fica em components/PontosMaquinas.jsx.

export const SEM_PONTO = "sem_ponto";
export const TODOS_PONTOS = "todos";
const SEM_LISTA = [];
const SEM_MAPA = {};

/** Carrega os pontos do cliente (admin: do cliente escolhido) e o filtro. */
export function usePontosMaquinas(user, clienteId) {
  const ehAdmin = user?.role === "admin";
  // Admin ve os pontos do cliente escolhido; sem cliente escolhido, nada.
  const chave = !user || (ehAdmin && !clienteId) ? null : ehAdmin ? String(clienteId) : "proprio";
  const habilitado = chave != null;
  // dados.chave guarda de quem sao os pontos carregados: ao trocar de cliente
  // os do anterior nao aparecem enquanto os novos carregam.
  const [dados, setDados] = useState({ chave: null, pontos: [], mapa: {} });
  const [filtroEscolhido, setFiltro] = useState(TODOS_PONTOS);

  const recarregar = useCallback(async () => {
    if (chave == null) return;
    try {
      const params = chave === "proprio" ? "" : `?cliente_id=${encodeURIComponent(chave)}`;
      const { data } = await api.get(`/pontos${params}`);
      setDados({ chave, pontos: data?.pontos || [], mapa: data?.maquinas || {} });
    } catch {
      // Pontos sao so visuais: se falhar, a lista continua sem agrupar.
      setDados({ chave, pontos: [], mapa: {} });
    }
  }, [chave]);

  useEffect(() => {
    const timer = window.setTimeout(recarregar, 0);
    return () => window.clearTimeout(timer);
  }, [recarregar]);

  const carregados = dados.chave === chave;
  const pontos = carregados ? dados.pontos : SEM_LISTA;
  const mapa = carregados ? dados.mapa : SEM_MAPA;
  const setMapa = useCallback((atualizar) => setDados((atual) => ({ ...atual, mapa: atualizar(atual.mapa) })), []);

  // Filtro de um ponto que nao existe mais (excluido / outro cliente) vale "todos".
  const filtro =
    filtroEscolhido === TODOS_PONTOS ||
    (filtroEscolhido === SEM_PONTO && pontos.length > 0) ||
    pontos.some((p) => String(p.id) === String(filtroEscolhido))
      ? filtroEscolhido
      : TODOS_PONTOS;

  const pontoDe = useCallback(
    (machine) => {
      const id = mapa[machine?.id_hardware];
      return id != null && pontos.some((p) => p.id === id) ? id : null;
    },
    [mapa, pontos],
  );

  return { pontos, setMapa, filtro, setFiltro, recarregar, pontoDe, habilitado, clienteId, ehAdmin };
}

/** Filtra pelo ponto escolhido; em "todos" ordena por ponto (Sem ponto por ultimo),
 *  mantendo a ordem atual dentro de cada ponto. Sem pontos: devolve a lista igual. */
export function aplicarPontos(lista, estado) {
  if (!estado?.pontos?.length) return lista;
  const { filtro, pontoDe, pontos } = estado;
  if (filtro === SEM_PONTO) return lista.filter((m) => pontoDe(m) == null);
  if (filtro !== TODOS_PONTOS) return lista.filter((m) => String(pontoDe(m)) === String(filtro));
  const posicao = new Map(pontos.map((p, i) => [p.id, i]));
  return lista
    .map((m, i) => ({ m, i, g: pontoDe(m) == null ? pontos.length : posicao.get(pontoDe(m)) }))
    .sort((a, b) => a.g - b.g || a.i - b.i)
    .map((item) => item.m);
}

/** Como lista.map(render), mas com um <Cabecalho nome total semPonto /> antes
 *  de cada ponto (so em "todos" e com pontos criados). */
export function listarComPontos(lista, estado, Cabecalho, render) {
  if (!estado?.pontos?.length || estado.filtro !== TODOS_PONTOS) return lista.map(render);
  const nomes = new Map(estado.pontos.map((p) => [p.id, p.nome]));
  const totais = new Map();
  lista.forEach((m) => {
    const chave = estado.pontoDe(m) ?? SEM_PONTO;
    totais.set(chave, (totais.get(chave) || 0) + 1);
  });
  const saida = [];
  let anterior;
  lista.forEach((m, i) => {
    const chave = estado.pontoDe(m) ?? SEM_PONTO;
    if (i === 0 || chave !== anterior) {
      saida.push(
        createElement(Cabecalho, {
          key: `ponto-cab-${chave}`,
          nome: chave === SEM_PONTO ? "Sem ponto" : nomes.get(chave),
          total: totais.get(chave),
          semPonto: chave === SEM_PONTO,
        }),
      );
      anterior = chave;
    }
    saida.push(render(m, i));
  });
  return saida;
}
