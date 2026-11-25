import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Copy, CreditCard, ImagePlus, Link2, MonitorSmartphone, Package, Power, RefreshCcw, Store } from "lucide-react";

import api, { getApiErrorMessage } from "../api/axios";

// Totem vending: maquina com tablet + agente local (projeto VendingMachine). O tablet
// vende sozinho (offline) e o painel guarda produtos, fotos e a maquininha, e recebe as
// vendas (rotas /totem no backend, app/services/totem.py). Independe do "banco" da maquina.
const MODOS = [
  ["off", "Sem cartao (so nota)"],
  ["mercadopago", "Mercado Pago Point"],
  ["sumup", "SumUp Solo"],
];

const reais = (centavos) =>
  (Number(centavos || 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const dataHora = (iso) => (iso ? new Date(iso).toLocaleString("pt-BR") : "nunca");

// Recorta no centro em quadrado, reduz para no maximo 1080 px e converte para WebP.
async function prepararFoto(arquivo) {
  const url = URL.createObjectURL(arquivo);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Nao consegui abrir essa imagem"));
      el.src = url;
    });
    const lado = Math.min(img.naturalWidth, img.naturalHeight);
    const saida = Math.min(1080, lado);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = saida;
    canvas
      .getContext("2d")
      .drawImage(img, (img.naturalWidth - lado) / 2, (img.naturalHeight - lado) / 2, lado, lado, 0, 0, saida, saida);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.86));
    if (!blob || blob.type !== "image/webp") throw new Error("Este navegador nao gera WebP");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function TotemVendingConfig({ maquinaId, maquinaSalva }) {
  const [totem, setTotem] = useState(undefined); // undefined = carregando
  const [produtos, setProdutos] = useState([]);
  const [codigo, setCodigo] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const [pagamento, setPagamento] = useState({ modo_cartao: "off", mp_terminal_id: "", sumup_reader_id: "" });
  const [points, setPoints] = useState(null);
  const [pareamento, setPareamento] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState("");
  const [erro, setErro] = useState("");

  const base = `/totem/maquinas/${encodeURIComponent(maquinaId)}`;

  const carregar = useCallback(async () => {
    if (!maquinaSalva || !maquinaId) return;
    try {
      const { data } = await api.get(base);
      setTotem(data);
      setPagamento({
        modo_cartao: data.modo_cartao || "off",
        mp_terminal_id: data.mp_terminal_id || "",
        sumup_reader_id: data.sumup_reader_id || "",
      });
      if (data.ativo) setProdutos((await api.get(`${base}/produtos`)).data);
      setErro("");
    } catch (error) {
      setTotem(null);
      setErro(getApiErrorMessage(error, "Nao foi possivel carregar o totem"));
    }
  }, [base, maquinaId, maquinaSalva]);

  useEffect(() => {
    setCodigo(null);
    setAviso("");
    carregar();
  }, [carregar]);

  const executar = async (acao, mensagemErro) => {
    setOcupado(true);
    try {
      const r = await acao();
      setErro("");
      return r;
    } catch (error) {
      setErro(getApiErrorMessage(error, mensagemErro));
      return null;
    } finally {
      setOcupado(false);
    }
  };

  const ativar = (rota) =>
    executar(async () => {
      const { data } = await api.post(`${base}/${rota}`);
      setCodigo({ codigo: data.codigo, expira_em: data.expira_em });
      setCopiado(false);
      await carregar();
    }, "Nao foi possivel gerar o codigo de vinculo");

  const desativar = () => {
    if (!window.confirm("Desativar o totem? O tablet para de receber produtos e de enviar vendas ao painel.")) return;
    executar(async () => {
      await api.delete(base);
      setCodigo(null);
      await carregar();
    }, "Nao foi possivel desativar o totem");
  };

  const salvarPagamento = () =>
    executar(async () => {
      await api.put(`${base}/pagamento`, {
        modo_cartao: pagamento.modo_cartao,
        mp_terminal_id: pagamento.mp_terminal_id || null,
        sumup_reader_id: pagamento.sumup_reader_id || null,
      });
      setAviso("Maquininha salva. O tablet recebe em ate 1 minuto.");
      await carregar();
    }, "Nao foi possivel salvar a maquininha");

  const buscarPoints = () =>
    executar(async () => {
      const { data } = await api.get("/tela/point/terminais", { params: { maquina_id: maquinaId } });
      setPoints(data);
    }, "Nao foi possivel listar as Points da conta");

  const modoIntegrado = () => {
    const id = pagamento.mp_terminal_id;
    if (!id || !window.confirm(`Colocar a Point ${id} em modo integrado? Ela passa a cobrar so o que vier do totem.`)) return;
    executar(async () => {
      await api.post(`/tela/point/terminais/${encodeURIComponent(id)}/modo-integrado`);
      setAviso("Modo integrado ativado. Reinicie a Point para aplicar.");
      setPoints(null);
    }, "Nao foi possivel ativar o modo integrado");
  };

  const criarCaixa = () =>
    executar(async () => {
      await api.post(`${base}/caixa`);
      setAviso("Caixa e loja criados no Mercado Pago. Vincule a Point a esse caixa no app do Mercado Pago.");
      await carregar();
    }, "Nao foi possivel criar o caixa no Mercado Pago");

  const parearSolo = () =>
    executar(async () => {
      await api.post(`${base}/sumup/parear`, { pairing_code: pareamento.trim() });
      setPareamento("");
      setAviso("Solo pareada no totem. Confirme na tela dela se aparecer pedido.");
      await carregar();
    }, "Nao foi possivel parear a Solo");

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(codigo.codigo);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  };

  if (!maquinaSalva) {
    return (
      <div className="mt-3 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg-muted)] p-4 text-xs text-[var(--color-text-soft)]">
        Salve a maquina e abra de novo para configurar o totem vending.
      </div>
    );
  }

  const campo =
    "min-w-0 flex-1 rounded-[10px] border border-[var(--color-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]";
  const botaoCheio = "shrink-0 rounded-full bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60";
  const botaoLinha =
    "shrink-0 rounded-full border border-[var(--color-border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--color-text)] disabled:opacity-60";
  const bloco = "mb-3 rounded-[10px] bg-white px-3 py-3 text-xs";
  const titulo = "mb-2 flex items-center gap-1 text-sm font-semibold text-[var(--color-text)]";

  return (
    <div
      className="mt-3 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg-muted)] p-4"
      // Fica dentro do formulario da maquina: Enter num campo daqui nao deve salvar o formulario de fora.
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target.tagName === "INPUT") e.preventDefault();
      }}
    >
      <span className="mb-1 flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
        <MonitorSmartphone size={16} />
        Totem vending (tablet)
      </span>
      <p className="mb-3 text-xs leading-5 text-[var(--color-text-soft)]">
        Para maquinas com o tablet de vendas. O tablet vende sozinho mesmo sem internet; aqui voce cadastra os
        produtos e a maquininha, e as vendas aparecem no dashboard desta maquina.
      </p>

      {erro ? <p className="mb-3 rounded-[10px] bg-red-50 px-3 py-2 text-xs text-[var(--color-error)]">{erro}</p> : null}
      {aviso ? <p className="mb-3 rounded-[10px] bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{aviso}</p> : null}

      {totem === undefined ? (
        <p className="text-xs text-[var(--color-text-soft)]">Carregando...</p>
      ) : !totem?.ativo ? (
        <button type="button" onClick={() => ativar("ativar")} disabled={ocupado} className={botaoCheio}>
          Ativar totem nesta maquina
        </button>
      ) : (
        <>
          {/* Vinculo do tablet */}
          <div className={bloco}>
            <span className={titulo}>
              <Link2 size={14} />
              Tablet
            </span>
            <span className="mb-2 block text-[var(--color-text-soft)]">
              {totem.vinculado
                ? `Vinculado. Ultimo contato: ${dataHora(totem.ultimo_contato)} - placa ${totem.versao_placa || "?"}, app ${totem.versao_agente || "?"}.`
                : "Ainda nao vinculado. Gere o codigo e digite no tablet."}
            </span>
            {codigo ? (
              <div className="mb-2 rounded-[12px] border border-emerald-300 bg-emerald-50 p-3">
                <span className="block font-semibold text-emerald-800">
                  Codigo de vinculo (vale 24 h, uso unico):
                </span>
                <div className="mt-2 flex items-center gap-2">
                  <code className="rounded-[10px] bg-white px-4 py-2 text-xl font-extrabold tracking-[0.3em] text-[var(--color-text)]">
                    {codigo.codigo}
                  </code>
                  <button type="button" onClick={copiar} className={botaoLinha}>
                    {copiado ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                  </button>
                </div>
                <span className="mt-2 block text-emerald-800">
                  No tablet: toque 8 vezes no canto superior direito, PIN, aba Sistema, &quot;Vinculo com o painel&quot;.
                  Endereco do painel: <b>{String(api.defaults.baseURL || "").replace(/\/api\/v1\/?$/, "")}</b> e este codigo.
                </span>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => ativar("codigo")} disabled={ocupado} className={botaoLinha}>
                <RefreshCcw size={13} className="mr-1 inline" />
                {totem.vinculado ? "Gerar codigo para trocar o tablet" : "Gerar codigo de vinculo"}
              </button>
              <button type="button" onClick={desativar} disabled={ocupado} className={botaoLinha}>
                <Power size={13} className="mr-1 inline" />
                Desativar totem
              </button>
            </div>
          </div>

          {/* Maquininha */}
          <div className={bloco}>
            <span className={titulo}>
              <CreditCard size={14} />
              Maquininha do totem
            </span>
            {totem.modo_pelo_banco ? (
              <span className="mb-2 block text-[var(--color-text-soft)]">
                Definida pelo banco da maquina: <b>{MODOS.find(([v]) => v === pagamento.modo_cartao)?.[1]}</b>.
              </span>
            ) : (
              <select
                className={`${campo} mb-2 w-full`}
                value={pagamento.modo_cartao}
                onChange={(e) => setPagamento((p) => ({ ...p, modo_cartao: e.target.value }))}
              >
                {MODOS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            )}

            {pagamento.modo_cartao === "mercadopago" ? (
              <>
                {!totem.credenciais_cliente?.mercadopago ? (
                  <p className="mb-2 text-[var(--color-error)]">Este cliente ainda nao tem o Mercado Pago conectado (tela Usuarios).</p>
                ) : null}
                {totem.modo_pelo_banco ? (
                  <div className="mb-2 flex flex-wrap items-center gap-2 rounded-[10px] bg-[var(--color-bg-muted)] px-3 py-2">
                    <Store size={14} />
                    {totem.caixa ? (
                      <span>
                        Caixa no Mercado Pago: <b>{totem.caixa.pos_external_id || totem.caixa.pos_id}</b> (loja{" "}
                        {totem.caixa.store_external_id || totem.caixa.store_id})
                      </span>
                    ) : (
                      <>
                        <span className="text-[var(--color-error)]">Esta maquina ainda nao tem caixa no Mercado Pago.</span>
                        <button type="button" onClick={criarCaixa} disabled={ocupado} className={botaoLinha}>
                          Criar caixa e loja
                        </button>
                      </>
                    )}
                  </div>
                ) : null}
                <div className="mb-2 flex gap-2">
                  <input
                    className={campo}
                    placeholder="ID da Point (ex.: PAX_A910__SMARTPOS...)"
                    value={pagamento.mp_terminal_id}
                    onChange={(e) => setPagamento((p) => ({ ...p, mp_terminal_id: e.target.value.trim() }))}
                  />
                  <button type="button" onClick={buscarPoints} disabled={ocupado} className={botaoLinha}>
                    Buscar Points
                  </button>
                </div>
                {points ? (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {points.length ? (
                      points.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setPagamento((x) => ({ ...x, mp_terminal_id: p.id }))}
                          className={`rounded-[10px] border px-3 py-2 text-left ${pagamento.mp_terminal_id === p.id ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)]" : "border-[var(--color-border)]"}`}
                        >
                          <span className="block font-mono">{p.id}</span>
                          <span className="text-[var(--color-text-soft)]">
                            {p.operating_mode === "PDV" ? "integrada" : "nao integrada"}
                            {p.neste_caixa ? " - neste caixa" : ""}
                          </span>
                        </button>
                      ))
                    ) : (
                      <span className="text-[var(--color-text-soft)]">Nenhuma Point na conta.</span>
                    )}
                  </div>
                ) : null}
                <span className="mb-2 block text-[var(--color-text-soft)]">
                  Use uma Point so para o totem: ela nao pode estar em outra maquina nem em escuta.
                  {pagamento.mp_terminal_id ? (
                    <button type="button" onClick={modoIntegrado} disabled={ocupado} className="ml-1 font-semibold text-[var(--color-primary)] underline">
                      Ativar modo integrado
                    </button>
                  ) : null}
                </span>
              </>
            ) : null}

            {pagamento.modo_cartao === "sumup" ? (
              <>
                {!totem.credenciais_cliente?.sumup ? (
                  <p className="mb-2 text-[var(--color-error)]">Este cliente ainda nao tem a API key da SumUp (tela Usuarios).</p>
                ) : null}
                <span className="mb-2 block text-[var(--color-text-soft)]">
                  {totem.sumup_reader_id ? `Solo pareada: ${totem.sumup_reader_id}` : "Nenhuma Solo pareada."} Na Solo:
                  Conexoes &gt; API &gt; Conectar (codigo vale 5 minutos).
                </span>
                <div className="mb-2 flex gap-2">
                  <input
                    className={campo}
                    placeholder="Codigo de pareamento da Solo"
                    value={pareamento}
                    maxLength={20}
                    onChange={(e) => setPareamento(e.target.value.toUpperCase())}
                  />
                  <button type="button" onClick={parearSolo} disabled={ocupado || pareamento.trim().length < 4} className={botaoLinha}>
                    Parear
                  </button>
                </div>
              </>
            ) : null}

            <button type="button" onClick={salvarPagamento} disabled={ocupado} className={botaoCheio}>
              Salvar maquininha
            </button>
          </div>

          {/* Produtos */}
          <div className={bloco}>
            <span className={titulo}>
              <Package size={14} />
              Produtos (baias 0 a 8)
            </span>
            <div className="grid gap-2">
              {produtos.map((p) => (
                <ProdutoTotem key={p.slot} base={base} produto={p} onSalvo={carregar} onErro={setErro} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ProdutoTotem({ base, produto, onSalvo, onErro }) {
  const [p, setP] = useState(produto);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => setP(produto), [produto]);
  const mudou = JSON.stringify(p) !== JSON.stringify(produto);
  const campo =
    "min-w-0 rounded-[10px] border border-[var(--color-border)] bg-white px-2 py-2 text-sm outline-none focus:border-[var(--color-primary)]";

  const enviarFoto = async (arquivo) => {
    if (!arquivo) return;
    setSalvando(true);
    try {
      const blob = await prepararFoto(arquivo);
      const form = new FormData();
      form.append("arquivo", blob, "produto.webp");
      const { data } = await api.post("/totem/midias", form);
      setP((x) => ({ ...x, imagem_hash: data.hash }));
    } catch (error) {
      onErro(getApiErrorMessage(error, error.message || "Nao foi possivel enviar a foto"));
    } finally {
      setSalvando(false);
    }
  };

  const salvar = async () => {
    setSalvando(true);
    try {
      await api.put(`${base}/produtos/${p.slot}`, {
        nome: p.nome,
        preco_centavos: p.preco_centavos,
        imagem_hash: p.imagem_hash || null,
        ativo: p.ativo,
        estoque: p.estoque === "" || p.estoque == null ? null : Number(p.estoque),
        estoque_minimo: p.estoque_minimo === "" || p.estoque_minimo == null ? null : Number(p.estoque_minimo),
      });
      onErro("");
      await onSalvo();
    } catch (error) {
      onErro(getApiErrorMessage(error, "Nao foi possivel salvar o produto"));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-[var(--color-border)] p-2">
      <label className="relative flex h-14 w-14 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-[10px] bg-[var(--color-bg-muted)]">
        {p.imagem_hash ? (
          <img src={`${api.defaults.baseURL}/totem/midias/${p.imagem_hash}.webp`} alt="" className="h-full w-full object-cover" />
        ) : (
          <ImagePlus size={18} className="text-[var(--color-text-soft)]" />
        )}
        <input type="file" accept="image/*" className="hidden" onChange={(e) => enviarFoto(e.target.files?.[0])} />
      </label>
      <span className="w-6 text-center font-bold text-[var(--color-text-soft)]">{p.slot}</span>
      <input className={`${campo} flex-1`} value={p.nome} maxLength={40} onChange={(e) => setP((x) => ({ ...x, nome: e.target.value }))} />
      <input
        className={`${campo} w-28`}
        inputMode="numeric"
        value={reais(p.preco_centavos)}
        onChange={(e) => setP((x) => ({ ...x, preco_centavos: Number(e.target.value.replace(/\D/g, "").slice(0, 8) || 0) }))}
      />
      <input
        className={`${campo} w-20`}
        type="number"
        min="0"
        placeholder="estoque"
        value={p.estoque ?? ""}
        onChange={(e) => setP((x) => ({ ...x, estoque: e.target.value === "" ? null : Number(e.target.value) }))}
      />
      <label className="flex items-center gap-1 text-[var(--color-text-soft)]">
        <input type="checkbox" checked={p.ativo} onChange={(e) => setP((x) => ({ ...x, ativo: e.target.checked }))} />
        ativo
      </label>
      <button
        type="button"
        onClick={salvar}
        disabled={salvando || !mudou}
        className="rounded-full bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
      >
        {salvando ? "..." : "Salvar"}
      </button>
    </div>
  );
}
