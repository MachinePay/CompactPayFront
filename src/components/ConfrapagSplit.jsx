import { useEffect, useState } from "react";
import { Split } from "lucide-react";

import api, { getApiErrorMessage } from "../api/axios";

// Banco "confrapag_sdk": split de pagamento da maquina (so admin).
// Na venda com cartao, a maquininha divide o valor: o destinatario recebe a parte
// configurada (percentual ou R$ fixo por venda) e o dono da maquina o restante.
// Os dois precisam ser do mesmo afiliador na ConfraPag. Pix nao entra no split.
const vazio = { ativo: false, tipo: "percentual", valor: "", documento_destino: "", afiliador: "" };

export default function ConfrapagSplit({ maquinaId }) {
  const [form, setForm] = useState(vazio);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!maquinaId) return;
    setCarregando(true);
    api
      .get(`/confrapag/maquinas/${encodeURIComponent(maquinaId)}/split`)
      .then(({ data }) =>
        setForm({
          ativo: data.ativo,
          tipo: data.tipo || "percentual",
          valor: data.valor ? String(data.valor).replace(".", ",") : "",
          documento_destino: data.documento_destino || "",
          afiliador: data.afiliador || "",
        }),
      )
      .catch(() => setForm(vazio))
      .finally(() => setCarregando(false));
  }, [maquinaId]);

  const salvar = async () => {
    setSalvando(true);
    setMensagem("");
    try {
      const { data } = await api.put(`/confrapag/maquinas/${encodeURIComponent(maquinaId)}/split`, {
        ativo: form.ativo,
        tipo: form.tipo,
        valor: Number(String(form.valor).replace(",", ".")) || 0,
        documento_destino: form.documento_destino.trim() || null,
        afiliador: form.afiliador.trim() || null,
      });
      setForm((atual) => ({ ...atual, ativo: data.ativo, documento_destino: data.documento_destino || "" }));
      setMensagem(data.ativo ? "Split salvo e ligado." : "Split desligado.");
      setErro("");
    } catch (error) {
      setErro(getApiErrorMessage(error, "Nao foi possivel salvar o split"));
    } finally {
      setSalvando(false);
    }
  };

  const campo =
    "w-full rounded-[12px] border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]";
  const exemplo =
    form.tipo === "percentual"
      ? `Ex.: venda de R$ 10,00 com ${form.valor || "10"}% -> destinatario recebe R$ ${(10 * (Number(String(form.valor || "10").replace(",", ".")) || 0) / 100).toFixed(2).replace(".", ",")}`
      : `Ex.: venda de R$ 10,00 -> destinatario recebe R$ ${form.valor || "1,00"} e o dono o restante`;

  return (
    <div className="mt-3 rounded-[14px] border border-amber-200 bg-amber-50/60 p-4">
      <span className="mb-1 flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
        <Split size={16} />
        Split de pagamento (somente admin)
      </span>
      <p className="mb-3 text-xs leading-5 text-[var(--color-text-soft)]">
        Divide cada venda no cartao desta maquina entre o dono e um destinatario do mesmo afiliador na ConfraPag.
        Vale so para cartao (Pix nao entra). Se a divisao falhar, o credito e' liberado do mesmo jeito.
      </p>

      {carregando ? (
        <p className="text-xs text-[var(--color-text-soft)]">Carregando...</p>
      ) : (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
            <input
              type="checkbox"
              checked={form.ativo}
              onChange={(e) => setForm((atual) => ({ ...atual, ativo: e.target.checked }))}
            />
            Ha split nesta maquina
          </label>

          {form.ativo ? (
            <>
              <div className="flex gap-2">
                <select
                  className={campo}
                  value={form.tipo}
                  onChange={(e) => setForm((atual) => ({ ...atual, tipo: e.target.value }))}
                >
                  <option value="percentual">Porcentagem de cada pagamento</option>
                  <option value="valor">Valor fixo por produto vendido (R$)</option>
                </select>
                <input
                  className={campo}
                  inputMode="decimal"
                  placeholder={form.tipo === "percentual" ? "% (ex.: 10)" : "R$ (ex.: 1,00)"}
                  value={form.valor}
                  onChange={(e) => setForm((atual) => ({ ...atual, valor: e.target.value }))}
                />
              </div>
              <p className="text-xs text-[var(--color-text-soft)]">{exemplo}</p>
              <input
                className={campo}
                inputMode="numeric"
                placeholder="CNPJ ou CPF de quem recebe a parte do split"
                value={form.documento_destino}
                onChange={(e) => setForm((atual) => ({ ...atual, documento_destino: e.target.value }))}
              />
              <input
                className={campo}
                placeholder="Codigo do afiliador na ConfraPag (se a ConfraPag exigir)"
                value={form.afiliador}
                onChange={(e) => setForm((atual) => ({ ...atual, afiliador: e.target.value }))}
              />
            </>
          ) : null}

          <button
            type="button"
            onClick={salvar}
            disabled={salvando || !maquinaId}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-60"
          >
            {salvando ? "Salvando..." : "Salvar split"}
          </button>
          {mensagem ? <p className="text-xs font-medium text-emerald-700">{mensagem}</p> : null}
          {erro ? <p className="text-xs font-medium text-rose-600">{erro}</p> : null}
        </div>
      )}
    </div>
  );
}
