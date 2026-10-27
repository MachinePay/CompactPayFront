import { useEffect, useState } from "react";

import api, { getApiErrorMessage } from "../api/axios";
import Button from "./Button";
import Modal from "./Modal";

// 0=segunda ... 6=domingo (igual ao backend / datetime.weekday()).
const DIAS = [
  "Segunda",
  "Terca",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sabado",
  "Domingo",
];

const DIA_PADRAO = { fecha: false, diaTodo: false, inicio: "22:00", fim: "08:00" };

function diasVazios() {
  return DIAS.map(() => ({ ...DIA_PADRAO }));
}

function paraDias(horarios) {
  const dias = diasVazios();
  for (const item of horarios || []) {
    if (item.dia < 0 || item.dia > 6) continue;
    const diaTodo = item.inicio === "00:00" && item.fim === "00:00";
    dias[item.dia] = { fecha: true, diaTodo, inicio: item.inicio, fim: item.fim };
  }
  return dias;
}

function paraHorarios(dias) {
  return dias
    .map((dia, indice) =>
      dia.fecha
        ? {
            dia: indice,
            inicio: dia.diaTodo ? "00:00" : dia.inicio,
            fim: dia.diaTodo ? "00:00" : dia.fim,
          }
        : null,
    )
    .filter(Boolean);
}

/** Dias e horarios em que o ponto da maquina fica fechado. Sem sinal nesse
 * horario a maquina aparece como "Fechado" em vez de "Offline". */
export default function HorarioFechadoModal({ machine, onClose, onSaved }) {
  const [dias, setDias] = useState(diasVazios);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!machine) return;
    let ativo = true;
    setErro("");
    setLoading(true);
    api
      .get(`/maquinas/${machine.id_hardware}/horario-fechado`)
      .then((res) => {
        if (ativo) setDias(paraDias(res.data?.horarios));
      })
      .catch((err) => {
        if (ativo) setErro(getApiErrorMessage(err, "Nao foi possivel carregar o horario"));
      })
      .finally(() => {
        if (ativo) setLoading(false);
      });
    return () => {
      ativo = false;
    };
  }, [machine]);

  const alterar = (indice, campos) =>
    setDias((atual) => atual.map((dia, i) => (i === indice ? { ...dia, ...campos } : dia)));

  const salvar = async () => {
    setSaving(true);
    setErro("");
    try {
      await api.put(`/maquinas/${machine.id_hardware}/horario-fechado`, {
        horarios: paraHorarios(dias),
      });
      onSaved?.();
      onClose();
    } catch (err) {
      setErro(getApiErrorMessage(err, "Nao foi possivel salvar o horario"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={Boolean(machine)} onClose={onClose}>
      <div className="space-y-5">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--color-text-soft)]">
            Horario do ponto fechado
          </div>
          <h2 className="mt-2 text-2xl font-extrabold tracking-[-0.04em] text-[var(--color-text)]">
            {machine?.nome || machine?.id_hardware}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--color-text-soft)]">
            Marque os dias em que o ponto fecha e o horario (de Brasilia). Se a
            maquina ficar sem sinal nesse horario ela aparece como{" "}
            <strong>Fechado</strong> e nao gera alerta de offline. Se o fim for
            menor que o inicio, o fechamento vai ate o dia seguinte (ex.: segunda
            22:00 ate terca 08:00). Nenhum dia marcado = o ponto nunca fecha.
          </p>
        </div>

        {loading ? (
          <div className="text-sm text-[var(--color-text-soft)]">Carregando...</div>
        ) : (
          <div className="divide-y divide-[var(--color-border)] rounded-[18px] border border-[var(--color-border)] bg-white">
            {dias.map((dia, indice) => (
              <div key={DIAS[indice]} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <label className="flex w-32 items-center gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={dia.fecha}
                    onChange={(e) => alterar(indice, { fecha: e.target.checked })}
                  />
                  {DIAS[indice]}
                </label>
                {dia.fecha ? (
                  <>
                    <label className="flex items-center gap-2 text-sm text-[var(--color-text-soft)]">
                      <input
                        type="checkbox"
                        checked={dia.diaTodo}
                        onChange={(e) => alterar(indice, { diaTodo: e.target.checked })}
                      />
                      Dia todo
                    </label>
                    {!dia.diaTodo ? (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-[var(--color-text-soft)]">das</span>
                        <input
                          type="time"
                          className="rounded-lg border border-[var(--color-border)] px-2 py-1"
                          value={dia.inicio}
                          onChange={(e) => alterar(indice, { inicio: e.target.value })}
                        />
                        <span className="text-[var(--color-text-soft)]">as</span>
                        <input
                          type="time"
                          className="rounded-lg border border-[var(--color-border)] px-2 py-1"
                          value={dia.fim}
                          onChange={(e) => alterar(indice, { fim: e.target.value })}
                        />
                      </div>
                    ) : null}
                  </>
                ) : (
                  <span className="text-sm text-[var(--color-text-soft)]">Aberto</span>
                )}
              </div>
            ))}
          </div>
        )}

        {erro ? <div className="text-sm font-semibold text-[var(--color-error)]">{erro}</div> : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            className="pill-button inline-flex w-full items-center justify-center gap-2 px-5 py-3 font-semibold"
            onClick={() => setDias(diasVazios())}
            disabled={saving || loading}
          >
            Nunca fecha
          </button>
          <Button
            type="button"
            className="w-full justify-center"
            onClick={salvar}
            disabled={saving || loading}
          >
            {saving ? "Salvando..." : "Salvar horario"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
