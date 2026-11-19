// Maquina vending: em vez do sensor de saida, os premios sao contados pelo
// valor que entra. Ex.: 1 premio a cada R$ 15 -> R$ 30 contam 2; R$ 12 nao
// conta nada e, quando entram mais R$ 3, conta 1 (o troco fica guardado).

const inputClass =
  "w-full rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-4 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]";

export function vendingFormInicial(machine) {
  return {
    maquina_vending: Boolean(machine?.maquina_vending),
    vending_premios: machine?.vending_premios != null ? String(machine.vending_premios) : "1",
    vending_valor: machine?.vending_valor != null ? String(machine.vending_valor) : "",
    vending_saldo: machine?.vending_saldo || 0,
  };
}

export function vendingPayload(form) {
  if (!form.maquina_vending) return { maquina_vending: false };
  return {
    maquina_vending: true,
    vending_premios: Number(String(form.vending_premios).trim()),
    vending_valor: Number(String(form.vending_valor).replace(",", ".")),
  };
}

export default function VendingMaquinaCampos({ form, setForm }) {
  const saldo = Number(form.vending_saldo || 0);
  const set = (campo) => (e) =>
    setForm((current) => ({
      ...current,
      [campo]: campo === "maquina_vending" ? e.target.checked : e.target.value,
    }));

  return (
    <div className="block rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-3">
      <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold text-[var(--color-text)]">
        <input
          type="checkbox"
          className="h-4 w-4 accent-[var(--color-primary)]"
          checked={Boolean(form.maquina_vending)}
          onChange={set("maquina_vending")}
        />
        Vending machine
      </label>
      <p className="mt-1 text-xs text-[var(--color-text-soft)]">
        Os premios passam a ser contados pelo valor que entra, e nao pelo sensor de saida. O que sobrar fica guardado
        para a proxima entrada.
      </p>
      {form.maquina_vending ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[var(--color-text)]">Quantidade de premios</span>
            <input
              className={inputClass}
              placeholder="Ex.: 1"
              inputMode="numeric"
              value={form.vending_premios}
              onChange={set("vending_premios")}
              required
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[var(--color-text)]">A cada (R$)</span>
            <input
              className={inputClass}
              placeholder="Ex.: 15"
              inputMode="decimal"
              value={form.vending_valor}
              onChange={set("vending_valor")}
              required
            />
          </label>
          <span className="block text-xs text-[var(--color-text-soft)] sm:col-span-2">
            Ex.: 1 premio a cada R$ 15: entrou R$ 30, contam 2; entrou R$ 12, nao conta, e com mais R$ 3 conta 1.
            Mudar a regra zera o valor guardado.
            {saldo ? ` Guardado agora: R$ ${Number(saldo).toFixed(2)}.` : ""}
          </span>
        </div>
      ) : null}
    </div>
  );
}
