import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import api, { getApiErrorMessage } from "../api/axios";
import Modal from "./Modal";

// Edicao da maquina pelo cliente (nao admin): so nome do ponto e localizacao
// (PATCH /maquinas/{id}/ponto). Em maquina SumUp mostra, so para ver, o usuario
// logado na maquininha e a senha dele (GET /maquinas/{id}/sumup/usuario).
const campo =
  "w-full rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-4 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]";

export default function EditarPontoCliente({ machine, onClose, onSaved }) {
  const [nome, setNome] = useState("");
  const [localizacao, setLocalizacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [login, setLogin] = useState(null); // {usuario, senha}
  const [loginErro, setLoginErro] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);

  const ehSumup = (machine?.banco_pagamento || "") === "sumup";

  useEffect(() => {
    if (!machine) return;
    setNome(machine.nome || "");
    setLocalizacao(machine.localizacao || "");
    setErro("");
    setLogin(null);
    setLoginErro("");
    setMostrarSenha(false);
    if ((machine.banco_pagamento || "") !== "sumup") return;
    let ativo = true;
    api
      .get(`/maquinas/${encodeURIComponent(machine.id_hardware)}/sumup/usuario`)
      .then(({ data }) => {
        if (ativo) setLogin(data);
      })
      .catch((error) => {
        if (ativo) setLoginErro(getApiErrorMessage(error, "Nao foi possivel buscar o login da maquininha."));
      });
    return () => {
      ativo = false;
    };
  }, [machine]);

  const salvar = async (e) => {
    e.preventDefault();
    setSalvando(true);
    setErro("");
    try {
      await api.patch(`/maquinas/${encodeURIComponent(machine.id_hardware)}/ponto`, {
        nome: nome.trim(),
        localizacao: localizacao.trim(),
      });
      await onSaved?.();
      onClose();
    } catch (error) {
      setErro(getApiErrorMessage(error, "Nao foi possivel salvar."));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal open={Boolean(machine)} onClose={onClose}>
      {machine ? (
        <form className="space-y-5" onSubmit={salvar}>
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--color-text-soft)]">
              Editar maquina
            </div>
            <h2 className="mt-2 text-3xl font-extrabold tracking-[-0.04em] text-[var(--color-text)]">
              Maquina {machine.id_hardware}
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[var(--color-text)]">Nome do ponto</span>
              <input
                className={campo}
                placeholder="Ex.: Grua Shopping Centro"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                maxLength={120}
                required
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[var(--color-text)]">Localizacao</span>
              <input
                className={campo}
                placeholder="Ex.: Piso 2 - corredor central"
                value={localizacao}
                onChange={(e) => setLocalizacao(e.target.value)}
                maxLength={255}
              />
            </label>
          </div>

          {ehSumup ? (
            <div className="rounded-[18px] border border-[var(--color-border)] bg-[var(--color-bg-muted)] p-4">
              <span className="block text-sm font-semibold text-[var(--color-text)]">Login da maquininha SumUp</span>
              <p className="mt-1 text-xs leading-5 text-[var(--color-text-soft)]">
                So para consulta. Para trocar o usuario da maquininha, fale com o suporte.
              </p>
              {loginErro ? (
                <p className="mt-2 text-xs font-medium text-rose-600">{loginErro}</p>
              ) : !login ? (
                <p className="mt-2 text-xs text-[var(--color-text-soft)]">Carregando...</p>
              ) : (
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-[var(--color-text)]">Usuario logado</span>
                    <input className={campo} value={login.usuario || "Nenhum usuario cadastrado"} readOnly />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-[var(--color-text)]">Senha</span>
                    <div className="relative">
                      <input
                        className={`${campo} pr-12 font-mono`}
                        type={mostrarSenha ? "text" : "password"}
                        value={login.senha || ""}
                        placeholder={login.senha ? "" : "Senha nao guardada no sistema"}
                        readOnly
                      />
                      {login.senha ? (
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-soft)]"
                          onClick={() => setMostrarSenha((v) => !v)}
                          title={mostrarSenha ? "Esconder senha" : "Mostrar senha"}
                        >
                          {mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      ) : null}
                    </div>
                  </label>
                </div>
              )}
            </div>
          ) : null}

          {erro ? <p className="text-sm font-medium text-rose-600">{erro}</p> : null}

          <div className="flex justify-end gap-3">
            <button type="button" className="pill-button px-5 py-3 text-sm font-semibold" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-full bg-[var(--color-primary)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
              disabled={salvando}
            >
              {salvando ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      ) : null}
    </Modal>
  );
}
