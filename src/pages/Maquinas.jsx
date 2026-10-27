import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Cpu,
  Download,
  Moon,
  FileText,
  Pencil,
  Plus,
  QrCode,
  RefreshCcw,
  Rocket,
  Search,
  Server,
  ShieldAlert,
  Terminal,
  Timer,
  Trash2,
  UploadCloud,
  Wifi,
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import usePolling from "../hooks/usePolling";
import api, { getApiErrorMessage } from "../api/axios";
import { useAuth } from "../context/useAuth";
import LoadingSpinner from "../components/LoadingSpinner";
import DateRangePicker from "../components/DateRangePicker";
import PointApkChaves from "../components/PointApkChaves";
import HorarioFechadoModal from "../components/HorarioFechadoModal";
import { CabecalhoOrdenavel, FiltroStatus, OrdenacaoMobile } from "../components/MaquinasFiltros";
import { FILTROS_STATUS, buscarMaquinas, ordenarMaquinas } from "../utils/maquinasLista";
import Modal from "../components/Modal";
import Button from "../components/Button";
import Toast from "../components/Toast";
import ConfirmModal from "../components/ConfirmModal";
import { confirmar } from "../utils/confirmar";
import { obterGps } from "../utils/localizacaoCelular";
import { brasiliaDate } from "../utils/dateTime";
import {
  describePulseResultToast,
  pollComandoStatus,
} from "../utils/comandoStatus";

const emptyForm = {
  id_hardware: "",
  nome: "",
  localizacao: "",
  localizacao_mapa: "",
  maquina_ficha: false,
  valor_ficha: "",
  cliente_id: "",
  banco_pagamento: "",
  sumup_reader_id: "",
  sumup_device_code: "",
  sumup_usuario: "",
  stone_serial_number: "",
};

const paymentProviderLabels = {
  mercado_pago: "Mercado Pago",
  pagbank: "PagBank",
  s6pay: "S6Pay",
  token_play: "Token Play",
  sumup: "SumUp",
  stone: "Stone",
  mercado_pago_apk: "Mercado Pago APK",
};

function getPaymentProviders(cliente) {
  if (!cliente) return [];
  return [
    cliente.cliente_mercado_pago || cliente.mp_configurado
      ? "mercado_pago"
      : null,
    cliente.cliente_pagbank ? "pagbank" : null,
    cliente.cliente_s6pay ? "s6pay" : null,
    cliente.cliente_token_play ? "token_play" : null,
    cliente.cliente_sumup || cliente.sumup_configurado ? "sumup" : null,
    cliente.cliente_stone || cliente.stone_configurado ? "stone" : null,
    cliente.mp_configurado ? "mercado_pago_apk" : null,
  ].filter(Boolean);
}

const emptyDeleteState = {
  open: false,
  machine: null,
  confirmationText: "",
};

const emptyUpdateState = {
  open: false,
  machine: null,
  firmwareId: "",
};

const emptyCreditState = {
  open: false,
  machine: null,
  value: "",
};

const emptyCaixaState = {
  open: false,
  machine: null,
  loading: false,
  data: null,
  error: "",
};

const emptyDiagnosticoState = {
  open: false,
  machine: null,
  loading: false,
  eventos: [],
  error: "",
};

const emptyDispositivoConfigState = {
  open: false,
  machine: null,
  saving: false,
  hardResetSec: "",
  fullRestartSec: "",
  pulseCoin: "",
  pulseOut: "",
  pulseCredit: "",
  pulseValue: "",
  pulseQuantity: "",
  pulseGapMs: "",
  coinDebounceUs: "",
};

// Valores de fabrica do firmware (PONTOsalvioIOScerto.ino). O botao
// "Redefinir para o padrao" envia exatamente estes valores para a placa.
const DISPOSITIVO_CONFIG_PADRAO = {
  pulseValue: "1",
  pulseQuantity: "1",
  pulseCredit: "200",
  pulseGapMs: "250",
  pulseCoin: "30",
  coinDebounceUs: "10000",
  pulseOut: "100",
  hardResetSec: "60",
  fullRestartSec: "90",
};

// Campos da configuracao da placa, agrupados pelo que controlam na maquina.
// Cada texto explica o efeito pratico, nao o nome tecnico do firmware.
const DISPOSITIVO_CONFIG_SECOES = [
  {
    titulo: "Liberacao de credito",
    descricao:
      "Como a placa transforma um pagamento (Pix, cartao ou teste pelo painel) em jogadas na maquina. A placa simula a moeda caindo, mandando pulsos para a entrada de credito da maquina.",
    campos: [
      {
        chave: "pulseValue",
        rotulo: "Valor de cada credito (R$)",
        dica: "Quanto o cliente paga por 1 credito. Ex.: 1 = cada R$ 1 pago vira 1 credito. Se sobrar troco (ex.: R$ 2,50 com credito de R$ 1), os R$ 0,50 ficam guardados para o proximo pagamento.",
      },
      {
        chave: "pulseQuantity",
        rotulo: "Pulsos por credito",
        dica: "Quantos pulsos a maquina precisa receber para contar 1 credito. A maioria das maquinas usa 1. Funciona a partir do firmware 2.7.6.",
      },
      {
        chave: "pulseCredit",
        rotulo: "Duracao de cada pulso (ms)",
        dica: "Quanto tempo cada pulso fica ligado. Se a maquina nao reconhece o credito, aumente. Se ela conta 2 creditos por pulso, diminua.",
      },
      {
        chave: "pulseGapMs",
        rotulo: "Intervalo entre pulsos (ms)",
        dica: "Espera entre um pulso e o proximo. Junto com a duracao, define a velocidade: se a maquina perde pulsos quando eles vem rapido, aumente. Entre 20 e 5000. Funciona a partir do firmware 2.7.6.",
      },
    ],
  },
  {
    titulo: "Entrada de dinheiro (moedeiro e noteiro)",
    descricao:
      "Como a placa conta o dinheiro fisico que entra pelo moedeiro ou noteiro da maquina. Cada pulso valido conta como R$ 1,00 no faturamento.",
    campos: [
      {
        chave: "pulseCoin",
        rotulo: "Duracao minima do pulso de moeda/nota (ms)",
        dica: "Pulsos mais curtos que isso sao ignorados como ruido eletrico. Se moedas de verdade nao estao sendo contadas, diminua. Se aparecem moedas que nao entraram, aumente.",
      },
      {
        chave: "coinDebounceUs",
        rotulo: "Intervalo minimo entre moedas (microssegundos)",
        dica: "Dois pulsos mais proximos que isso contam como uma moeda so (evita contar a mesma moeda duas vezes). 10000 = 0,01 segundo.",
      },
    ],
  },
  {
    titulo: "Saida de premio (sensor de pelucia)",
    descricao: "Como a placa conta as pelucias que saem pela boca da maquina.",
    campos: [
      {
        chave: "pulseOut",
        rotulo: "Bloqueio apos saida de pelucia (ms)",
        dica: "Depois de detectar uma pelucia, o sensor fica bloqueado esse tempo para nao contar a mesma pelucia duas vezes. Se uma pelucia conta 2 vezes, aumente.",
      },
    ],
  },
  {
    titulo: "Reconexao Wi-Fi",
    descricao: "O que a placa faz quando perde o Wi-Fi. Em geral nao precisa mexer.",
    campos: [
      {
        chave: "hardResetSec",
        rotulo: "Reiniciar o radio Wi-Fi apos (segundos)",
        dica: "Sem Wi-Fi por esse tempo, a placa desliga e liga o radio Wi-Fi para tentar de novo. Entre 10 e 600.",
        tipo: "number",
      },
      {
        chave: "fullRestartSec",
        rotulo: "Reiniciar a placa apos (segundos)",
        dica: "Sem Wi-Fi por esse tempo, a placa reinicia por completo (a configuracao nao se perde). Entre 10 e 600.",
        tipo: "number",
      },
    ],
  },
];

// Exemplo ao vivo para a secao de credito: quantos pulsos sai um pagamento
// de R$ 10 com os valores do formulario (ou o padrao, se em branco).
function exemploCredito(state) {
  const numero = (valor, padrao) => {
    const n = Number(String(valor || "").replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : padrao;
  };
  const valor = numero(state.pulseValue, 1);
  const quantidade = Math.round(numero(state.pulseQuantity, 1));
  const duracao = numero(state.pulseCredit, 200);
  const intervalo = numero(state.pulseGapMs, 250);
  const creditos = Math.floor(10 / valor);
  const pulsos = creditos * quantidade;
  const segundos = pulsos > 0 ? (pulsos * (duracao + 40) + (pulsos - 1) * intervalo) / 1000 : 0;
  return { creditos, pulsos, segundos };
}

// A mensagem MQTT "@config|" so existe a partir dessa versao do firmware -
// espelha MIN_FIRMWARE_VERSION_FOR_DEVICE_CONFIG no backend. Desabilita o
// botao em placas mais antigas em vez de deixar clicar e falhar so na hora.
const MIN_FIRMWARE_VERSION_FOR_DEVICE_CONFIG = [2, 1, 0];

function machineSupportsDeviceConfig(machine) {
  const match = /version_(\d+)\.(\d+)\.(\d+)/.exec(machine?.firmware_version || "");
  if (!match) return false;
  const versao = [Number(match[1]), Number(match[2]), Number(match[3])];
  for (let i = 0; i < MIN_FIRMWARE_VERSION_FOR_DEVICE_CONFIG.length; i += 1) {
    if (versao[i] > MIN_FIRMWARE_VERSION_FOR_DEVICE_CONFIG[i]) return true;
    if (versao[i] < MIN_FIRMWARE_VERSION_FOR_DEVICE_CONFIG[i]) return false;
  }
  return true;
}

const quickCreditValues = [2, 5, 10, 20, 50, 100];

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default function Maquinas() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const persistedFilters = useMemo(() => {
    try {
      return JSON.parse(
        localStorage.getItem("compactpay.maquinas.filters") || "{}",
      );
    } catch {
      return {};
    }
  }, []);
  const [maquinas, setMaquinas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [firmwareVersions, setFirmwareVersions] = useState([]);
  const [loading, setLoading] = useState(false);
  // periodo/dateRange NAO sao persistidos (so cliente_id) - um filtro de
  // periodo ficando preso silenciosamente entre sessoes (inclusive apos
  // logout/login, ja que localStorage nao depende da sessao) fazia o
  // faturamento da lista bater diferente do total real, sem nenhuma pista
  // visual do motivo. Default "fechamento": sem limite de calendario, so o
  // clamp por ultimo fechamento de cada maquina - maquina sem fechamento
  // nenhum ainda mostra tudo desde sempre.
  const [periodo, setPeriodo] = useState("fechamento");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [selectedClienteId, setSelectedClienteId] = useState(
    persistedFilters.cliente_id || "",
  );
  const [buscaMaquina, setBuscaMaquina] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  // So a ordenacao fica salva (filtro de status escondido entre sessoes
  // confundiria, igual o periodo - ver comentario acima).
  const [ordem, setOrdem] = useState(persistedFilters.ordem || null);
  const [showModal, setShowModal] = useState(false);
  const [editingMachineId, setEditingMachineId] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [generatingId, setGeneratingId] = useState(false);
  const [validatingMp, setValidatingMp] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState("");
  const [sendingCreditId, setSendingCreditId] = useState("");
  const [sendingUpdateId, setSendingUpdateId] = useState("");
  const [togglingFiltroSaidaId, setTogglingFiltroSaidaId] = useState("");
  const [verifyingMachineId, setVerifyingMachineId] = useState("");
  const [toast, setToast] = useState({ message: "", type: "success" });
  const [deleteState, setDeleteState] = useState(emptyDeleteState);
  const [updateState, setUpdateState] = useState(emptyUpdateState);
  const [creditState, setCreditState] = useState(emptyCreditState);
  const [caixaState, setCaixaState] = useState(emptyCaixaState);
  const [diagnosticoState, setDiagnosticoState] = useState(
    emptyDiagnosticoState,
  );
  const [horarioFechadoMachine, setHorarioFechadoMachine] = useState(null);
  const [dispositivoConfigState, setDispositivoConfigState] = useState(
    emptyDispositivoConfigState,
  );
  const [sumupReaders, setSumupReaders] = useState([]);
  const [loadingSumupReaders, setLoadingSumupReaders] = useState(false);
  const [pairingSumup, setPairingSumup] = useState(false);
  const [usuarioSumup, setUsuarioSumup] = useState({ carregando: false, login: null, erro: "" });
  const [pairingCode, setPairingCode] = useState("");
  const [pairingName, setPairingName] = useState("");
  const [pairingMessage, setPairingMessage] = useState({ text: "", type: "" });
  const selectedCliente = usuarios.find(
    (item) => String(item.cliente_id) === String(form.cliente_id),
  );
  const paymentProviders = getPaymentProviders(selectedCliente);

  const loadSumupReaders = useCallback(() => {
    if (!form.cliente_id) {
      setSumupReaders([]);
      return;
    }
    setLoadingSumupReaders(true);
    api
      .get(`/clientes/${form.cliente_id}/sumup/readers`)
      .then(({ data }) => setSumupReaders(Array.isArray(data) ? data : []))
      .catch(() => setSumupReaders([]))
      .finally(() => setLoadingSumupReaders(false));
  }, [form.cliente_id]);

  useEffect(() => {
    if (!showModal || form.banco_pagamento !== "sumup" || !form.cliente_id) {
      setSumupReaders([]);
      return;
    }
    loadSumupReaders();
  }, [showModal, form.banco_pagamento, form.cliente_id, loadSumupReaders]);

  const handlePairSumupReader = async () => {
    if (!pairingCode.trim()) {
      setPairingMessage({ text: "Informe o codigo de pareamento.", type: "error" });
      return;
    }
    setPairingSumup(true);
    setPairingMessage({ text: "", type: "" });
    try {
      const { data } = await api.post(`/clientes/${form.cliente_id}/sumup/readers`, {
        pairing_code: pairingCode.trim(),
        name: pairingName.trim() || undefined,
      });
      setPairingMessage({
        text: `Reader "${data.name || data.id}" pareado! (status: ${data.status || "processing"})`,
        type: "success",
      });
      setPairingCode("");
      setPairingName("");
      loadSumupReaders();
    } catch (error) {
      setPairingMessage({
        text: getApiErrorMessage(error, "Nao foi possivel parear o reader."),
        type: "error",
      });
    } finally {
      setPairingSumup(false);
    }
  };

  useEffect(() => {
    localStorage.setItem(
      "compactpay.maquinas.filters",
      JSON.stringify({ cliente_id: selectedClienteId, ordem }),
    );
  }, [selectedClienteId, ordem]);

  const loadMaquinas = useCallback(
    async (options = {}) => {
      const silent = Boolean(options?.silent);
      if (!user) return;
      if (user.role === "admin" && !selectedClienteId) {
        setMaquinas([]);
        setLoading(false);
        return;
      }
      if (!silent) setLoading(true);
      const params = [];
      if (periodo) params.push(`periodo=${periodo}`);
      if (dateRange.start) params.push(`data_inicio=${encodeURIComponent(dateRange.start)}`);
      if (dateRange.end) params.push(`data_fim=${encodeURIComponent(dateRange.end)}`);
      if (user.role === "admin" && selectedClienteId) {
        params.push(`cliente_id=${encodeURIComponent(selectedClienteId)}`);
      }
      const paramStr = params.length ? `?${params.join("&")}` : "";
      try {
        const res = await api.get(`/maquinas${paramStr}`);
        setMaquinas(res.data);
      } catch (error) {
        setToast({
          message: getApiErrorMessage(
            error,
            "Nao foi possivel carregar as maquinas.",
          ),
          type: "error",
        });
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [dateRange, periodo, selectedClienteId, user],
  );

  const loadUsuarios = useCallback(async () => {
    if (user?.role !== "admin") return;
    try {
      const res = await api.get("/usuarios");
      setUsuarios(res.data.filter((item) => item.role === "cliente"));
    } catch (error) {
      setToast({
        message: getApiErrorMessage(
          error,
          "Nao foi possivel carregar os clientes.",
        ),
        type: "error",
      });
    }
  }, [user?.role]);

  const loadFirmwareVersions = useCallback(async () => {
    if (user?.role !== "admin") return;
    try {
      const { data } = await api.get("/firmware-versions");
      setFirmwareVersions(data);
    } catch (error) {
      setToast({
        message: getApiErrorMessage(
          error,
          "Nao foi possivel carregar as versoes de firmware.",
        ),
        type: "error",
      });
    }
  }, [user?.role]);

  useEffect(() => {
    const timer = window.setTimeout(loadMaquinas, 0);
    return () => window.clearTimeout(timer);
  }, [loadMaquinas]);

  // Durante atualizacao de firmware, 5s para acompanhar o progresso.
  const hasUpdateInProgress = maquinas.some((item) =>
    ["sent", "downloading", "restarting"].includes(item.firmware_update_status),
  );
  const podeAtualizarLista = Boolean(user) && !(user?.role === "admin" && !selectedClienteId);
  usePolling(() => loadMaquinas({ silent: true }), 20000, podeAtualizarLista && !hasUpdateInProgress);
  usePolling(loadMaquinas, 5000, hasUpdateInProgress);

  useEffect(() => {
    const timer = window.setTimeout(loadUsuarios, 0);
    return () => window.clearTimeout(timer);
  }, [loadUsuarios]);

  useEffect(() => {
    const timer = window.setTimeout(loadFirmwareVersions, 0);
    return () => window.clearTimeout(timer);
  }, [loadFirmwareVersions]);

  const generateId = async () => {
    setGeneratingId(true);
    try {
      const { data } = await api.get("/maquinas/novo-id");
      setForm((current) => ({ ...current, id_hardware: data.id_hardware }));
      setCopyFeedback("");
    } catch (error) {
      setToast({
        message: getApiErrorMessage(
          error,
          "Nao foi possivel gerar o ID da maquina.",
        ),
        type: "error",
      });
    } finally {
      setGeneratingId(false);
    }
  };

  const openCreateMachineModal = () => {
    setEditingMachineId("");
    const cliente = usuarios.find(
      (item) => String(item.cliente_id) === String(selectedClienteId),
    );
    const providers = getPaymentProviders(cliente);
    setForm({
      ...emptyForm,
      cliente_id: selectedClienteId || "",
      banco_pagamento: providers[0] || "",
    });
    setCopyFeedback("");
    setShowModal(true);
    generateId();
  };

  const copyMachineId = async () => {
    if (!form.id_hardware) return;
    try {
      await navigator.clipboard.writeText(form.id_hardware);
      setCopyFeedback("ID copiado para configurar no ESP.");
    } catch {
      setCopyFeedback("Nao foi possivel copiar. Selecione o ID manualmente.");
    }
  };

  const validateSelectedMercadoPago = async () => {
    if (!form.cliente_id) return null;
    setValidatingMp(true);
    try {
      const { data } = await api.get(
        `/mercado-pago/clientes/${form.cliente_id}/validacao`,
      );
      if (data?.ok) {
        setToast({
          message: "Mercado Pago validado. Cliente pronto para criar maquina.",
          type: "success",
        });
        return data;
      }
      const blockingChecks = (data?.checks || []).filter(
        (item) => !item.ok && (item.severity || "error") === "error",
      );
      const message = blockingChecks.length
        ? blockingChecks
            .map((item) => `${item.label}: ${item.message}`)
            .join(" ")
        : data?.next_step ||
          "Revise a integracao Mercado Pago antes de criar a maquina.";
      setToast({ message, type: "error" });
      return data;
    } catch (error) {
      setToast({
        message: getApiErrorMessage(
          error,
          "Nao foi possivel validar o Mercado Pago.",
        ),
        type: "error",
      });
      return null;
    } finally {
      setValidatingMp(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const selectedProvider =
        form.banco_pagamento || paymentProviders[0] || "mercado_pago";
      const payload = {
        nome: form.nome,
        localizacao: form.localizacao,
        // Opcional (admin): link do Google Maps ou "lat, lng". Vazio na edicao
        // tira a maquina do mapa; quem nao e admin nao manda (nao mexe).
        ...(user?.role === "admin" ? { localizacao_mapa: form.localizacao_mapa.trim() } : {}),
        maquina_ficha: Boolean(form.maquina_ficha),
        valor_ficha: form.maquina_ficha ? Number(String(form.valor_ficha).replace(",", ".")) : null,
        banco_pagamento: selectedProvider,
        cliente_id:
          user?.role === "admin"
            ? form.cliente_id === ""
              ? null
              : Number(form.cliente_id)
            : user.cliente_id,
      };
      if (selectedProvider === "sumup") {
        if (!form.sumup_reader_id && !form.sumup_device_code) {
          throw new Error(
            "Escolha qual reader SumUp fica vinculado a esta maquina, ou informe o codigo do reader.",
          );
        }
        payload.sumup_reader_id = form.sumup_reader_id;
        payload.sumup_device_code = form.sumup_device_code;
        payload.sumup_usuario = form.sumup_usuario.trim();
      }
      if (selectedProvider === "stone") {
        if (!form.stone_serial_number.trim()) {
          throw new Error("Informe o numero de serie da maquininha Stone desta maquina.");
        }
        payload.stone_serial_number = form.stone_serial_number.trim().toUpperCase();
      }

      if (
        !editingMachineId &&
        user?.role === "admin" &&
        selectedProvider === "mercado_pago"
      ) {
        const data = await validateSelectedMercadoPago();
        if (!data?.ok) {
          const blockingChecks = (data?.checks || []).filter(
            (item) => !item.ok && (item.severity || "error") === "error",
          );
          const message = blockingChecks.length
            ? blockingChecks
                .map((item) => `${item.label}: ${item.message}`)
                .join(" ")
            : data?.next_step ||
              "Valide a integracao Mercado Pago antes de criar a maquina.";
          throw new Error(message);
        }
      }

      if (editingMachineId) {
        await api.put(`/maquinas/${editingMachineId}`, payload);
        setToast({
          message: "Maquina atualizada com sucesso.",
          type: "success",
        });
      } else {
        await api.post("/maquinas", {
          id_hardware: form.id_hardware,
          ...payload,
        });
        setToast({
          message: "Maquina cadastrada com sucesso.",
          type: "success",
        });
      }
      setShowModal(false);
      setEditingMachineId("");
      setForm(emptyForm);
      setCopyFeedback("");
      await loadMaquinas();
    } catch (error) {
      setToast({
        message: getApiErrorMessage(
          error,
          "Nao foi possivel salvar a maquina.",
        ),
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCriarUsuarioSumup = async (recriar = false) => {
    if (!editingMachineId) return;
    if (recriar) {
      const ok = await confirmar({
        titulo: "Criar outro usuario para esta maquininha?",
        texto:
          "O sistema cria um usuario novo na SumUp e passa a usar ele para identificar o Pix. Depois sera preciso " +
          "sair da maquininha e entrar com o login novo.",
        confirmarTexto: "Criar novo",
        perigoso: true,
      });
      if (!ok) return;
    }
    setUsuarioSumup({ carregando: true, login: null, erro: "" });
    try {
      const { data } = await api.post(`/maquinas/${editingMachineId}/sumup/usuario`, recriar ? { recriar: true } : {});
      setUsuarioSumup({ carregando: false, login: data, erro: "" });
      setForm((current) => ({ ...current, sumup_usuario: data.usuario }));
      await loadMaquinas({ silent: true });
    } catch (error) {
      setUsuarioSumup({
        carregando: false,
        login: null,
        erro: getApiErrorMessage(error, "Nao foi possivel criar o usuario na SumUp."),
      });
    }
  };

  const handleVerLoginSumup = async () => {
    if (!editingMachineId) return;
    setUsuarioSumup({ carregando: true, login: null, erro: "" });
    try {
      const { data } = await api.get(`/maquinas/${editingMachineId}/sumup/usuario`);
      setUsuarioSumup({
        carregando: false,
        login: data.senha ? data : null,
        erro: data.senha ? "" : "Este usuario nao foi criado pelo sistema - a senha nao esta guardada aqui.",
      });
    } catch (error) {
      setUsuarioSumup({ carregando: false, login: null, erro: getApiErrorMessage(error, "Nao foi possivel buscar o login.") });
    }
  };

  const handleEditMachine = (machine) => {
    setEditingMachineId(machine.id_hardware);
    setUsuarioSumup({ carregando: false, login: null, erro: "" });
    setForm({
      id_hardware: machine.id_hardware,
      nome: machine.nome || "",
      localizacao: machine.localizacao || "",
      localizacao_mapa:
        machine.latitude != null && machine.longitude != null ? `${machine.latitude}, ${machine.longitude}` : "",
      maquina_ficha: Boolean(machine.maquina_ficha),
      valor_ficha: machine.valor_ficha != null ? String(machine.valor_ficha) : "",
      cliente_id: machine.cliente_id == null ? "" : String(machine.cliente_id),
      banco_pagamento: machine.banco_pagamento || "mercado_pago",
      sumup_reader_id: machine.sumup_reader_id || "",
      sumup_device_code: machine.sumup_device_code || "",
      sumup_usuario: machine.sumup_usuario || "",
      stone_serial_number: machine.stone_serial_number || "",
    });
    setCopyFeedback("");
    setShowModal(true);
  };

  const handleToggleFiltroSaidaPosCredito = async (machine) => {
    const proximoValor = !machine.ignorar_saida_pos_credito;
    setTogglingFiltroSaidaId(machine.id_hardware);
    try {
      await api.post(
        `/maquinas/${machine.id_hardware}/filtro-saida-pos-credito`,
        { ativo: proximoValor },
      );
      setToast({
        message: proximoValor
          ? "Filtro anti falso-positivo de saida ativado para esta maquina."
          : "Filtro anti falso-positivo de saida desativado para esta maquina.",
        type: "success",
      });
      await loadMaquinas({ silent: true });
    } catch (error) {
      setToast({
        message: getApiErrorMessage(
          error,
          "Nao foi possivel alterar o filtro desta maquina.",
        ),
        type: "error",
      });
    } finally {
      setTogglingFiltroSaidaId("");
    }
  };

  const requestDeleteMachine = (machine) => {
    setDeleteState({
      open: true,
      machine,
      confirmationText: "",
    });
  };

  const handleDeleteMachine = async () => {
    try {
      await api.delete(`/maquinas/${deleteState.machine?.id_hardware}`);
      setToast({ message: "Maquina excluida com sucesso.", type: "success" });
      setDeleteState(emptyDeleteState);
      await loadMaquinas();
    } catch (error) {
      setToast({
        message: getApiErrorMessage(
          error,
          "Nao foi possivel excluir a maquina.",
        ),
        type: "error",
      });
    }
  };

  const openCreditModal = (machine) => {
    setCreditState({
      open: true,
      machine,
      value: "",
    });
  };

  const handleConsultarCaixa = async (machine) => {
    setCaixaState({
      open: true,
      machine,
      loading: true,
      data: null,
      error: "",
    });
    try {
      const { data } = await api.get(`/maquinas/${machine.id_hardware}/caixa`);
      setCaixaState({ open: true, machine, loading: false, data, error: "" });
    } catch (error) {
      setCaixaState({
        open: true,
        machine,
        loading: false,
        data: null,
        error: getApiErrorMessage(
          error,
          "Nao foi possivel consultar o caixa no Mercado Pago.",
        ),
      });
    }
  };

  const handleAbrirDiagnostico = async (machine) => {
    setDiagnosticoState({
      open: true,
      machine,
      loading: true,
      eventos: [],
      error: "",
    });
    try {
      const { data } = await api.get(
        `/maquinas/${machine.id_hardware}/eventos-dispositivo`,
      );
      setDiagnosticoState({
        open: true,
        machine,
        loading: false,
        eventos: data.eventos || [],
        error: "",
      });
    } catch (error) {
      setDiagnosticoState({
        open: true,
        machine,
        loading: false,
        eventos: [],
        error: getApiErrorMessage(
          error,
          "Nao foi possivel carregar o diagnostico da placa.",
        ),
      });
    }
  };

  const handleAbrirConfigDispositivo = (machine) => {
    setDispositivoConfigState({
      open: true,
      machine,
      saving: false,
      hardResetSec:
        machine.wifi_hard_reset_ms != null
          ? String(Math.round(machine.wifi_hard_reset_ms / 1000))
          : "",
      fullRestartSec:
        machine.wifi_full_restart_ms != null
          ? String(Math.round(machine.wifi_full_restart_ms / 1000))
          : "",
      pulseCoin: machine.pulse_coin || "",
      pulseOut: machine.pulse_out || "",
      pulseCredit: machine.pulse_credit || "",
      pulseValue: machine.pulse_value || "",
      pulseQuantity: machine.pulse_quantity || "",
      pulseGapMs: machine.pulse_gap_ms || "",
      coinDebounceUs: machine.coin_debounce_us || "",
    });
  };

  const handleRedefinirConfigDispositivo = async () => {
    const machine = dispositivoConfigState.machine;
    if (!machine) return;
    const confirmado = await confirmar({
      titulo: `Redefinir a placa ${machine.nome || machine.id_hardware} para o padrao?`,
      texto:
        "Toda a configuracao volta ao padrao de fabrica e e' enviada agora: valor do credito R$ 1, 1 pulso por credito, " +
        "pulso de 200 ms, intervalo de 250 ms, moeda minima de 30 ms, intervalo entre moedas de 10000 us, " +
        "bloqueio de pelucia de 100 ms, reconexao Wi-Fi 60 s / 90 s.",
      confirmarTexto: "Redefinir e enviar",
      perigoso: true,
    });
    if (!confirmado) return;
    handleSalvarConfigDispositivo(DISPOSITIVO_CONFIG_PADRAO);
  };

  const handleSalvarConfigDispositivo = async (valoresForcados = null) => {
    const machine = dispositivoConfigState.machine;
    if (!machine) return;
    const valores = { ...dispositivoConfigState, ...(valoresForcados || {}) };
    const texto = (campo) => String(valores[campo] || "").trim();
    setDispositivoConfigState((current) => ({ ...current, ...(valoresForcados || {}), saving: true }));
    try {
      const payload = {
        wifi_hard_reset_ms: texto("hardResetSec") ? Math.round(Number(texto("hardResetSec")) * 1000) : null,
        wifi_full_restart_ms: texto("fullRestartSec") ? Math.round(Number(texto("fullRestartSec")) * 1000) : null,
        pulse_coin: texto("pulseCoin"),
        pulse_out: texto("pulseOut"),
        pulse_credit: texto("pulseCredit"),
        pulse_value: texto("pulseValue"),
        pulse_quantity: texto("pulseQuantity"),
        pulse_gap_ms: texto("pulseGapMs"),
        coin_debounce_us: texto("coinDebounceUs"),
      };
      const { data } = await api.post(
        `/maquinas/${machine.id_hardware}/config-dispositivo`,
        payload,
      );
      setToast({
        message: data.enviado
          ? valoresForcados
            ? "Configuracao redefinida para o padrao e enviada para a placa."
            : "Configuracao atualizada e enviada para a placa."
          : "Configuracao salva, mas a placa parece offline agora - sera aplicada quando ela reconectar e voce reenviar.",
        type: data.enviado ? "success" : "warning",
      });
      setDispositivoConfigState(emptyDispositivoConfigState);
      await loadMaquinas({ silent: true });
    } catch (error) {
      setToast({
        message: getApiErrorMessage(
          error,
          "Nao foi possivel salvar a configuracao da placa.",
        ),
        type: "error",
      });
      setDispositivoConfigState((current) => ({ ...current, saving: false }));
    }
  };

  const handleCopiarPix = async () => {
    const codigo = caixaState.data?.qr?.qr_code;
    if (!codigo) return;
    try {
      await navigator.clipboard.writeText(codigo);
      setToast({ message: "Codigo Pix copiado.", type: "success" });
    } catch {
      setToast({ message: "Nao foi possivel copiar o codigo.", type: "error" });
    }
  };

  const sendTestCredit = async () => {
    const machine = creditState.machine;
    if (!machine) return;
    const value = Number(String(creditState.value).replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) {
      setToast({
        message: "Informe um valor maior que zero.",
        type: "error",
      });
      return;
    }

    setSendingCreditId(machine.id_hardware);
    try {
      const { data } = await api.post(
        `/maquinas/${machine.id_hardware}/credito-teste`,
        {
          valor: value,
        },
      );
      setCreditState(emptyCreditState);

      // Nao mostra nada ainda so por ter enviado - o botao ja fica em
      // "Enviando..." enquanto isso. So avisa quando a placa responder de
      // verdade (ou quando o backend desistir de esperar por ela), com o
      // resultado real: falha, pulso enviado (sem confirmacao final) ou
      // confirmado.
      const resultado = await pollComandoStatus(data.command_id, data.pulsos);
      setToast(describePulseResultToast(resultado, value, machine.id_hardware));
      await loadMaquinas();
    } catch (error) {
      setToast({
        message: getApiErrorMessage(
          error,
          "Nao foi possivel enviar o credito de teste.",
        ),
        type: "error",
      });
    } finally {
      setSendingCreditId("");
    }
  };

  const requestFirmwareUpdate = (machine) => {
    if (!machine.status_online) {
      setToast({
        message: "Maquina offline. Aguarde ela ficar online para atualizar.",
        type: "error",
      });
      return;
    }
    if (
      ["sent", "downloading", "restarting"].includes(
        machine.firmware_update_status,
      )
    ) {
      setToast({
        message: "Ja existe uma atualizacao em andamento para esta maquina.",
        type: "error",
      });
      return;
    }
    setUpdateState({
      open: true,
      machine,
      firmwareId: firmwareVersions[0]?.id ? String(firmwareVersions[0].id) : "",
    });
  };

  const verifyMachineOnline = async (machine) => {
    setVerifyingMachineId(machine.id_hardware);
    try {
      const { data } = await api.post(
        `/maquinas/${machine.id_hardware}/verificar-online`,
      );
      setToast({
        message: data.online
          ? `A placa ${machine.id_hardware} respondeu e esta online.`
          : `A placa ${machine.id_hardware} nao respondeu e foi marcada como offline.`,
        type: data.online ? "success" : "error",
      });
      await loadMaquinas();
    } catch (error) {
      setToast({
        message: getApiErrorMessage(
          error,
          "Nao foi possivel verificar a placa.",
        ),
        type: "error",
      });
      await loadMaquinas();
    } finally {
      setVerifyingMachineId("");
    }
  };

  const sendFirmwareUpdate = async () => {
    const machine = updateState.machine;
    if (!machine) return;
    if (!updateState.firmwareId) {
      setToast({
        message: "Selecione uma versao de firmware antes de atualizar.",
        type: "error",
      });
      return;
    }
    setSendingUpdateId(machine.id_hardware);
    try {
      await api.post(`/maquinas/${machine.id_hardware}/atualizacao`, {
        firmware_version_id: Number(updateState.firmwareId),
      });
      setToast({
        message: `Atualizacao enviada para ${machine.id_hardware}.`,
        type: "success",
      });
      setUpdateState(emptyUpdateState);
      await loadMaquinas();
    } catch (error) {
      setToast({
        message: getApiErrorMessage(
          error,
          "Nao foi possivel enviar a atualizacao.",
        ),
        type: "error",
      });
    } finally {
      setSendingUpdateId("");
    }
  };

  const onlineCount = maquinas.filter((m) => m.status_online).length;

  // A contagem dos botoes de status respeita a busca; a lista respeita os dois.
  const maquinasBuscadas = useMemo(() => buscarMaquinas(maquinas, buscaMaquina), [maquinas, buscaMaquina]);
  const maquinasVisiveis = useMemo(() => {
    const filtro = FILTROS_STATUS.find((item) => item.id === filtroStatus) || FILTROS_STATUS[0];
    return ordenarMaquinas(maquinasBuscadas.filter(filtro.testa), ordem);
  }, [maquinasBuscadas, filtroStatus, ordem]);
  const filtrando = Boolean(buscaMaquina.trim()) || filtroStatus !== "todos";

  return (
    <div className="flex min-h-full flex-col gap-4">
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ message: "", type: toast.type })}
      />

      <Modal
        open={updateState.open}
        onClose={() => setUpdateState(emptyUpdateState)}
        title="Confirmar atualizacao"
      >
        <div className="space-y-5">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--color-text-soft)]">
              Atualizacao OTA
            </div>
            <h2 className="mt-2 text-3xl font-extrabold text-[var(--color-text)]">
              {updateState.machine?.nome || updateState.machine?.id_hardware}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-soft)]">
              Escolha a versao cadastrada e confirme o envio para a placa
              online.
            </p>
          </div>

          <div className="grid gap-3 rounded-[22px] border border-[var(--color-border)] bg-[var(--color-bg-muted)] p-4 text-sm">
            <InfoLine
              label="Maquina"
              value={updateState.machine?.id_hardware || "--"}
            />
            <InfoLine
              label="Versao atual"
              value={
                updateState.machine?.firmware_version ||
                "Aguardando sinal da placa"
              }
            />
            <InfoLine
              label="Ultimo sinal"
              value={
                updateState.machine?.ultimo_sinal
                  ? brasiliaDate(updateState.machine.ultimo_sinal).format(
                      "DD/MM/YYYY HH:mm:ss",
                    )
                  : "Sem sinal"
              }
            />
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[var(--color-text)]">
              Versao para enviar
            </span>
            <select
              className="w-full rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-4 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
              value={updateState.firmwareId}
              onChange={(event) =>
                setUpdateState((current) => ({
                  ...current,
                  firmwareId: event.target.value,
                }))
              }
              required
            >
              <option value="">Selecione a versao</option>
              {firmwareVersions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nome}
                </option>
              ))}
            </select>
          </label>

          {updateState.firmwareId ? (
            <div className="rounded-[18px] border border-[var(--color-border)] bg-white p-4 text-sm">
              <div className="font-semibold text-[var(--color-text)]">
                URL do firmware
              </div>
              <a
                className="mt-2 block break-all text-[var(--color-primary-strong)] hover:underline"
                href={
                  firmwareVersions.find(
                    (item) =>
                      String(item.id) === String(updateState.firmwareId),
                  )?.url_bin
                }
                target="_blank"
                rel="noreferrer"
              >
                {
                  firmwareVersions.find(
                    (item) =>
                      String(item.id) === String(updateState.firmwareId),
                  )?.url_bin
                }
              </a>
            </div>
          ) : null}

          <div className="flex gap-3 rounded-[18px] border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            Nao desligue a placa durante a atualizacao. Ela pode reiniciar
            sozinha e voltar informando a nova versao.
          </div>

          <Button
            type="button"
            className="w-full justify-center"
            onClick={sendFirmwareUpdate}
            disabled={
              sendingUpdateId === updateState.machine?.id_hardware ||
              !updateState.firmwareId
            }
          >
            <UploadCloud size={18} />
            {sendingUpdateId === updateState.machine?.id_hardware
              ? "Enviando..."
              : "Enviar atualizacao"}
          </Button>
        </div>
      </Modal>

      <Modal
        open={creditState.open}
        onClose={() => {
          if (!sendingCreditId) setCreditState(emptyCreditState);
        }}
      >
        <div className="mx-auto max-w-xl space-y-5">
          <div className="text-center">
            <div className="mx-auto flex h-24 w-52 items-center justify-center overflow-hidden rounded-2xl bg-white">
              <img
                src="/logoCompactpay.jpeg"
                alt="CompactPay"
                className="h-full w-full object-contain"
              />
            </div>
            <h2 className="mt-3 text-3xl font-extrabold text-[var(--color-text)]">
              Enviar crédito
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-soft)]">
              Escolha ou digite o valor para enviar à máquina{" "}
              <strong>
                {creditState.machine?.nome || creditState.machine?.id_hardware}
              </strong>
              . O envio será registrado como pagamento de teste.
            </p>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[var(--color-text)]">
              Valor do crédito
            </span>
            <div className="flex items-center rounded-[18px] border border-[var(--color-border)] bg-white px-4 focus-within:border-[var(--color-primary)]">
              <span className="font-extrabold text-[var(--color-primary)]">
                R$
              </span>
              <input
                type="text"
                inputMode="decimal"
                autoFocus
                className="min-w-0 flex-1 bg-transparent px-3 py-4 text-xl font-extrabold text-[var(--color-text)] outline-none"
                placeholder="Ex.: 10,00"
                value={creditState.value}
                onChange={(event) =>
                  setCreditState((current) => ({
                    ...current,
                    value: event.target.value.replace(/[^\d.,]/g, ""),
                  }))
                }
              />
            </div>
          </label>

          <div>
            <div className="mb-2 text-sm font-semibold text-[var(--color-text)]">
              Valores rápidos
            </div>
            <div className="grid grid-cols-3 gap-2">
              {quickCreditValues.map((value) => {
                const selected =
                  Number(String(creditState.value).replace(",", ".")) === value;
                return (
                  <button
                    key={value}
                    type="button"
                    className={`rounded-[14px] border px-3 py-3 text-sm font-extrabold transition ${
                      selected
                        ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                        : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                    }`}
                    onClick={() =>
                      setCreditState((current) => ({
                        ...current,
                        value: value.toFixed(2).replace(".", ","),
                      }))
                    }
                  >
                    {formatCurrency(value)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              className="pill-button inline-flex items-center justify-center px-5 py-3 font-semibold"
              onClick={() => setCreditState(emptyCreditState)}
              disabled={Boolean(sendingCreditId)}
            >
              Fechar
            </button>
            <Button
              type="button"
              className="justify-center"
              onClick={sendTestCredit}
              disabled={Boolean(sendingCreditId) || !creditState.value}
            >
              <Rocket size={17} />
              {sendingCreditId ? "Enviando..." : "Enviar crédito"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={caixaState.open}
        onClose={() => setCaixaState(emptyCaixaState)}
      >
        <div className="space-y-5">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--color-text-soft)]">
              Caixa Mercado Pago
            </div>
            <h2 className="mt-2 text-3xl font-extrabold tracking-[-0.04em] text-[var(--color-text)]">
              {caixaState.machine?.nome || caixaState.machine?.id_hardware}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-soft)]">
              QR code fixo de Pix desse caixa - dá para copiar o código, baixar
              a imagem ou o PDF pronto para imprimir e colar na máquina.
            </p>
          </div>

          {caixaState.loading ? (
            <LoadingSpinner className="h-40" />
          ) : caixaState.error ? (
            <div className="rounded-[18px] border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-[var(--color-error)]">
              {caixaState.error}
            </div>
          ) : caixaState.data ? (
            <div className="space-y-4">
              <div className="rounded-[22px] border border-[var(--color-border)] bg-[var(--color-bg-muted)] p-4">
                <InfoLine
                  label="Caixa (POS)"
                  value={caixaState.data.name || caixaState.data.pos_id}
                />
                <InfoLine label="ID do caixa" value={caixaState.data.pos_id} />
              </div>

              {caixaState.data.qr?.image ? (
                <div className="flex justify-center rounded-[22px] border border-[var(--color-border)] bg-white p-4">
                  <img
                    src={caixaState.data.qr.image}
                    alt="QR code Pix do caixa"
                    className="h-64 w-64 object-contain"
                  />
                </div>
              ) : (
                <div className="rounded-[18px] border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
                  Este caixa ainda não tem QR code gerado pelo Mercado Pago.
                </div>
              )}

              {caixaState.data.qr?.qr_code ? (
                <div className="rounded-[18px] border border-[var(--color-border)] bg-white p-4">
                  <div className="text-sm font-semibold text-[var(--color-text)]">
                    Código Pix (copia e cola)
                  </div>
                  <div className="mt-2 max-h-24 overflow-y-auto break-all rounded-[12px] bg-[var(--color-bg-muted)] p-3 text-xs text-[var(--color-text-soft)]">
                    {caixaState.data.qr.qr_code}
                  </div>
                  <button
                    type="button"
                    className="pill-button mt-3 inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold"
                    onClick={handleCopiarPix}
                  >
                    <Copy size={15} />
                    Copiar código Pix
                  </button>
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <a
                  href={caixaState.data.qr?.template_document || undefined}
                  target="_blank"
                  rel="noreferrer"
                  className={`pill-button inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold ${
                    caixaState.data.qr?.template_document
                      ? ""
                      : "pointer-events-none opacity-50"
                  }`}
                >
                  <FileText size={16} />
                  Abrir PDF para imprimir
                </a>
                <a
                  href={caixaState.data.qr?.template_image || undefined}
                  target="_blank"
                  rel="noreferrer"
                  className={`pill-button inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold ${
                    caixaState.data.qr?.template_image
                      ? ""
                      : "pointer-events-none opacity-50"
                  }`}
                >
                  <Download size={16} />
                  Baixar imagem (PNG)
                </a>
              </div>
            </div>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={diagnosticoState.open}
        onClose={() => setDiagnosticoState(emptyDiagnosticoState)}
      >
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--color-text-soft)]">
                Diagnostico da placa
              </div>
              <h2 className="mt-2 text-2xl font-extrabold tracking-[-0.04em] text-[var(--color-text)]">
                {diagnosticoState.machine?.nome ||
                  diagnosticoState.machine?.id_hardware}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--color-text-soft)]">
                Log tecnico bruto que a placa manda por MQTT (config de
                pulso/moeda, velocidade do noteiro, wifi, reinicios etc.) - util
                pra configurar uma maquina nova sem precisar abrir o log do
                servidor.
              </p>
            </div>
            <button
              type="button"
              className="pill-button inline-flex shrink-0 items-center justify-center gap-2 px-3 py-2 text-sm font-semibold"
              onClick={() =>
                diagnosticoState.machine &&
                handleAbrirDiagnostico(diagnosticoState.machine)
              }
              disabled={diagnosticoState.loading}
            >
              <RefreshCcw
                size={15}
                className={diagnosticoState.loading ? "animate-spin" : ""}
              />
              Atualizar
            </button>
          </div>

          {diagnosticoState.loading ? (
            <LoadingSpinner className="h-40" />
          ) : diagnosticoState.error ? (
            <div className="rounded-[18px] border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-[var(--color-error)]">
              {diagnosticoState.error}
            </div>
          ) : diagnosticoState.eventos.length === 0 ? (
            <div className="rounded-[18px] border border-[var(--color-border)] bg-white p-6 text-center text-sm text-[var(--color-text-soft)]">
              Nenhum evento tecnico recebido da placa ainda.
            </div>
          ) : (
            <div className="max-h-[50vh] space-y-2 overflow-y-auto rounded-[18px] border border-[var(--color-border)] bg-[var(--color-bg-muted)] p-3">
              {diagnosticoState.eventos.map((evento) => (
                <div
                  key={evento.id}
                  className="rounded-[12px] border border-[var(--color-border)] bg-white px-3 py-2"
                >
                  <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--color-text-soft)]">
                    {brasiliaDate(evento.created_at).format(
                      "DD/MM/YYYY HH:mm:ss",
                    )}
                  </div>
                  <div className="mt-1 break-all font-mono text-xs text-[var(--color-text)]">
                    {evento.descricao}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={dispositivoConfigState.open}
        onClose={() => setDispositivoConfigState(emptyDispositivoConfigState)}
      >
        <div className="space-y-5">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--color-text-soft)]">
              Configuracao da placa
            </div>
            <h2 className="mt-2 text-2xl font-extrabold tracking-[-0.04em] text-[var(--color-text)]">
              {dispositivoConfigState.machine?.nome || dispositivoConfigState.machine?.id_hardware}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-soft)]">
              Ajusta so esta maquina. Sao os mesmos campos do portal da placa
              (CONFIG_COMPACTPAY), <strong>exceto nome e senha do Wi-Fi</strong>,
              que so mudam pelo portal. <strong>Campo em branco nao muda nada</strong>:
              a placa continua com o valor que ja tem. A placa precisa estar
              online para receber; se estiver offline, a configuracao fica salva
              aqui e e' so enviar de novo quando ela voltar.
            </p>
          </div>

          {DISPOSITIVO_CONFIG_SECOES.map((secao, indice) => (
            <section
              key={secao.titulo}
              className={indice > 0 ? "border-t border-[var(--color-border)] pt-5" : ""}
            >
              <div className="text-sm font-bold uppercase tracking-[0.16em] text-[var(--color-text)]">
                {secao.titulo}
              </div>
              <p className="mt-1 mb-4 text-xs leading-5 text-[var(--color-text-soft)]">{secao.descricao}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                {secao.campos.map((campo) => (
                  <label key={campo.chave} className="block">
                    <span className="block text-sm font-semibold text-[var(--color-text)]">{campo.rotulo}</span>
                    <span className="mt-1 block text-xs leading-5 text-[var(--color-text-soft)]">{campo.dica}</span>
                    <span className="mb-2 mt-1 block text-xs font-semibold text-[var(--color-primary)]">
                      Padrao: {DISPOSITIVO_CONFIG_PADRAO[campo.chave]}
                    </span>
                    <input
                      type={campo.tipo || "text"}
                      inputMode="decimal"
                      className="w-full rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-4 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
                      placeholder={`Em branco = mantem o atual (padrao ${DISPOSITIVO_CONFIG_PADRAO[campo.chave]})`}
                      value={dispositivoConfigState[campo.chave]}
                      onChange={(event) =>
                        setDispositivoConfigState((current) => ({
                          ...current,
                          [campo.chave]: event.target.value,
                        }))
                      }
                    />
                  </label>
                ))}
              </div>
              {indice === 0 ? (() => {
                const exemplo = exemploCredito(dispositivoConfigState);
                return (
                  <div className="mt-4 rounded-[16px] border border-[var(--color-border)] bg-[var(--color-bg-muted)] px-4 py-3 text-xs leading-5 text-[var(--color-text)]">
                    <strong>Exemplo com estes valores:</strong> um pagamento de R$ 10,00 vira{" "}
                    {exemplo.creditos} credito(s) = <strong>{exemplo.pulsos} pulso(s)</strong>, liberados em
                    pelo menos {exemplo.segundos.toFixed(1).replace(".", ",")} s (a placa ainda espera o retorno do
                    contador da maquina, entao pode demorar um pouco mais).
                  </div>
                );
              })() : null}
            </section>
          ))}

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              className="pill-button inline-flex w-full items-center justify-center gap-2 px-5 py-3 font-semibold"
              onClick={handleRedefinirConfigDispositivo}
              disabled={dispositivoConfigState.saving}
            >
              Redefinir para o padrao
            </button>
            <Button
              type="button"
              className="w-full justify-center"
              onClick={() => handleSalvarConfigDispositivo()}
              disabled={dispositivoConfigState.saving}
            >
              {dispositivoConfigState.saving ? "Enviando..." : "Salvar e enviar para a placa"}
            </Button>
          </div>
        </div>
      </Modal>

      <HorarioFechadoModal
        machine={horarioFechadoMachine}
        onClose={() => setHorarioFechadoMachine(null)}
        onSaved={() => loadMaquinas({ silent: true })}
      />

      <CardSectionHeader
        title="Maquinas"
        description="Cadastre novas unidades, gere IDs para o ESP e crie automaticamente o caixa no Mercado Pago do cliente."
        actions={
          user?.role === "admin" ? (
            <Button className="justify-center" onClick={openCreateMachineModal}>
              <Plus size={18} />
              Nova maquina
            </Button>
          ) : null
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        <SummaryCard
          icon={<Server size={18} />}
          label="Maquinas cadastradas"
          value={String(maquinas.length)}
          helper="Total visivel no painel"
        />
        <SummaryCard
          icon={<CheckCircle2 size={18} />}
          label="Ativas agora"
          value={String(onlineCount)}
          helper="Ultimo sinal recebido nos ultimos 90 segundos"
          featured
        />
        <SummaryCard
          icon={<Cpu size={18} />}
          label="Prontas para ESP"
          value={String(maquinas.length)}
          helper="IDs prontos para vinculacao no ESP"
        />
      </div>

      <section className="app-panel rounded-[30px] p-5 md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex min-w-[220px] flex-1 items-center gap-2 rounded-full border border-[var(--color-border)] bg-white px-4 py-3 text-sm sm:flex-none">
              <Search
                size={16}
                className="shrink-0 text-[var(--color-text-soft)]"
              />
              <input
                className="min-w-0 flex-1 bg-transparent outline-none"
                placeholder="Buscar: nome, ID, local, cliente, Wi-Fi, IP, serial..."
                title="Busca em ID, nome, local, cliente, rede Wi-Fi, IP, firmware, banco e serial/usuario da maquininha. Varias palavras: todas precisam aparecer."
                value={buscaMaquina}
                onChange={(event) => setBuscaMaquina(event.target.value)}
              />
            </label>
            {user?.role === "admin" ? (
              <label className="flex min-w-[260px] items-center gap-3 rounded-full border border-[var(--color-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--color-text)]">
                Cliente
                <select
                  className="min-w-0 flex-1 bg-transparent text-[var(--color-text-soft)] outline-none"
                  value={selectedClienteId}
                  onChange={(event) => setSelectedClienteId(event.target.value)}
                >
                  <option value="">Selecione um cliente</option>
                  {usuarios.map((item) => (
                    <option key={item.id} value={item.cliente_id ?? ""}>
                      {(item.nome || item.email) +
                        (item.cliente_id ? ` - ${item.cliente_id}` : "")}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="flex items-center gap-3 rounded-full border border-[var(--color-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--color-text)]">
              Periodo
              <select
                className="bg-transparent text-[var(--color-text-soft)] outline-none"
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value)}
              >
                <option value="fechamento">Desde o fechamento</option>
                <option value="dia">Dia</option>
                <option value="mes">Mes</option>
              </select>
            </label>
            <DateRangePicker value={dateRange} onChange={setDateRange} withTime />
          </div>

          <button
            className="pill-button inline-flex items-center justify-center gap-2 px-5 py-3 font-semibold"
            onClick={loadMaquinas}
            type="button"
          >
            <RefreshCcw size={16} />
            Recarregar
          </button>
        </div>

        {maquinas.length > 0 && !(user?.role === "admin" && !selectedClienteId) ? (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <FiltroStatus maquinas={maquinasBuscadas} valor={filtroStatus} onChange={setFiltroStatus} />
            <div className="flex items-center gap-3">
              {filtrando ? (
                <span className="text-xs text-[var(--color-text-soft)]">
                  {maquinasVisiveis.length} de {maquinas.length} maquina(s)
                </span>
              ) : null}
              <OrdenacaoMobile ordem={ordem} onChange={setOrdem} />
            </div>
          </div>
        ) : null}

        <div className="mt-4 overflow-hidden rounded-[26px] border border-[var(--color-border)] bg-white">
          {user?.role === "admin" && !selectedClienteId ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 px-6 text-center">
              <div className="text-base font-semibold text-[var(--color-text)]">
                Selecione um cliente para listar as maquinas
              </div>
              <div className="max-w-md text-sm leading-6 text-[var(--color-text-soft)]">
                A listagem fica filtrada por cliente para manter a tela rapida e
                organizada mesmo com muitas maquinas cadastradas.
              </div>
            </div>
          ) : loading ? (
            <LoadingSpinner className="h-40" />
          ) : maquinasVisiveis.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-3 px-6 text-center text-sm text-[var(--color-text-soft)]">
              {filtrando
                ? "Nenhuma maquina encontrada para essa busca/filtro."
                : "Nenhuma maquina cadastrada ainda. Gere um ID, configure o ESP e crie a unidade por aqui."}
              {filtrando ? (
                <button
                  type="button"
                  className="pill-button px-4 py-2 text-xs font-semibold"
                  onClick={() => {
                    setBuscaMaquina("");
                    setFiltroStatus("todos");
                  }}
                >
                  Limpar busca e filtro
                </button>
              ) : null}
            </div>
          ) : (
            <>
              <div className="grid gap-3 p-3 md:hidden">
                {maquinasVisiveis.map((m) => (
                  <MachineMobileCard
                    key={m.id_hardware}
                    machine={m}
                    user={user}
                    sendingCreditId={sendingCreditId}
                    sendingUpdateId={sendingUpdateId}
                    verifyingMachineId={verifyingMachineId}
                    canUpdateFirmware={Boolean(
                      m.status_online && firmwareVersions.length > 0,
                    )}
                    onOpen={() => navigate(`/maquinas/${m.id_hardware}`)}
                    onSendCredit={() => openCreditModal(m)}
                    onConsultarCaixa={() => handleConsultarCaixa(m)}
                    onVerify={() => verifyMachineOnline(m)}
                    onSendUpdate={() => requestFirmwareUpdate(m)}
                    onEdit={() => handleEditMachine(m)}
                    onDelete={() => requestDeleteMachine(m)}
                    onToggleFiltroSaida={() =>
                      handleToggleFiltroSaidaPosCredito(m)
                    }
                    togglingFiltroSaida={
                      togglingFiltroSaidaId === m.id_hardware
                    }
                    onAbrirDiagnostico={() => handleAbrirDiagnostico(m)}
                    onAbrirHorarioFechado={() => setHorarioFechadoMachine(m)}
                  />
                ))}
              </div>
              <div className="hidden md:block">
                <table className="w-full table-fixed text-sm">
                  <thead className="bg-[var(--color-bg-muted)] text-left text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-soft)]">
                    <tr>
                      <CabecalhoOrdenavel coluna="maquina" ordem={ordem} onChange={setOrdem} className="px-3 py-3 w-[15%]">Maquina</CabecalhoOrdenavel>
                      <CabecalhoOrdenavel coluna="status" ordem={ordem} onChange={setOrdem} className="px-3 py-3 w-[11%]">Status</CabecalhoOrdenavel>
                      <CabecalhoOrdenavel coluna="sinal" ordem={ordem} onChange={setOrdem} className="px-3 py-3 w-[10%]">Sinal</CabecalhoOrdenavel>
                      <CabecalhoOrdenavel coluna="atividade" ordem={ordem} onChange={setOrdem} className="px-3 py-3 w-[13%]">Atividade</CabecalhoOrdenavel>
                      <CabecalhoOrdenavel coluna="local" ordem={ordem} onChange={setOrdem} className="px-3 py-3 w-[13%]">Local / Banco</CabecalhoOrdenavel>
                      <CabecalhoOrdenavel coluna="firmware" ordem={ordem} onChange={setOrdem} className="px-3 py-3 w-[14%]">Caixa / Firmware</CabecalhoOrdenavel>
                      <CabecalhoOrdenavel coluna="resultados" ordem={ordem} onChange={setOrdem} className="px-3 py-3 w-[10%]">Resultados</CabecalhoOrdenavel>
                      <th className="px-3 py-3 w-[14%]">Acoes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {maquinasVisiveis.map((m) => (
                      <tr
                        key={m.id_hardware}
                        className="cursor-pointer border-t border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-primary-soft)]"
                        onClick={() => navigate(`/maquinas/${m.id_hardware}`)}
                      >
                        <td className="px-3 py-3 align-top">
                          <div className="truncate font-semibold text-[var(--color-primary-strong)]">
                            {m.id_hardware}
                          </div>
                          <div className="truncate text-xs text-[var(--color-text-soft)]">
                            {m.nome || "--"}
                          </div>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <span
                            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                            style={{
                              backgroundColor:
                                m.status_operacional === "operando"
                                  ? "var(--color-primary-soft)"
                                  : m.status_operacional === "atencao"
                                    ? "#fff2d8"
                                    : m.status_operacional === "fechado"
                                      ? "#e2e8f0"
                                      : "#fee2e2",
                              color:
                                m.status_operacional === "operando"
                                  ? "var(--color-success)"
                                  : m.status_operacional === "atencao"
                                    ? "var(--color-warning)"
                                    : m.status_operacional === "fechado"
                                      ? "#475569"
                                      : "var(--color-error)",
                            }}
                            title={
                              m.status_operacional === "fechado"
                                ? "Sem sinal dentro do horario em que o ponto fica fechado"
                                : undefined
                            }
                          >
                            {m.status_online ? (
                              <CheckCircle2 size={13} />
                            ) : m.status_operacional === "fechado" ? (
                              <Moon size={13} />
                            ) : (
                              <XCircle size={13} />
                            )}
                            {m.status_online
                              ? "Online"
                              : m.status_operacional === "operando"
                                ? "Operando"
                                : m.status_operacional === "fechado"
                                  ? "Fechado"
                                  : "Offline"}
                          </span>
                          <button
                            type="button"
                            className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-[var(--color-text-soft)] transition hover:text-[var(--color-primary)] disabled:cursor-wait disabled:opacity-60"
                            onClick={(e) => {
                              e.stopPropagation();
                              verifyMachineOnline(m);
                            }}
                            disabled={verifyingMachineId === m.id_hardware}
                          >
                            <RefreshCcw
                              size={11}
                              className={
                                verifyingMachineId === m.id_hardware
                                  ? "animate-spin"
                                  : ""
                              }
                            />
                            {verifyingMachineId === m.id_hardware
                              ? "Verificando"
                              : "Verificar placa"}
                          </button>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <WifiSignal
                            online={m.status_online}
                            quality={m.wifi_quality}
                            rssi={m.wifi_rssi}
                            compact
                          />
                          {m.ip_local ? (
                            <div
                              className="mt-1 text-[11px] text-[var(--color-text-soft)]"
                              title="IP que a placa recebeu do roteador do local"
                            >
                              IP {m.ip_local}
                            </div>
                          ) : null}
                          {m.wifi_ssid ? (
                            <div
                              className="max-w-[150px] truncate text-[11px] text-[var(--color-text-soft)]"
                              title={`Rede Wi-Fi: ${m.wifi_ssid}`}
                            >
                              Rede {m.wifi_ssid}
                            </div>
                          ) : null}
                          {m.firmware_version ? (
                            <div
                              className="text-[11px] text-[var(--color-text-soft)]"
                              title={m.firmware_version}
                            >
                              Firmware {versaoCurtaFirmware(m.firmware_version)}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-3 py-3 align-top text-xs text-[var(--color-text-soft)]">
                          <div className="truncate">
                            {m.ultima_atividade_em
                              ? brasiliaDate(m.ultima_atividade_em).format(
                                  "DD/MM HH:mm",
                                )
                              : "Sem atividade"}
                          </div>
                          <div className="mt-1 truncate">
                            {m.ultimo_pagamento_em
                              ? `Pag.: ${brasiliaDate(m.ultimo_pagamento_em).format("DD/MM HH:mm")}`
                              : m.ultimo_teste_em
                                ? `Teste: ${brasiliaDate(m.ultimo_teste_em).format("DD/MM HH:mm")}`
                                : m.ultima_saida_em
                                  ? `Saida: ${brasiliaDate(m.ultima_saida_em).format("DD/MM HH:mm")}`
                                  : "Sem eventos"}
                          </div>
                        </td>
                        <td className="px-3 py-3 align-top text-xs">
                          <div className="truncate text-[var(--color-text-soft)]">
                            {m.localizacao || "--"}
                          </div>
                          <div className="mt-1 truncate font-semibold text-[var(--color-text)]">
                            {paymentProviderLabels[
                              m.banco_pagamento || "mercado_pago"
                            ] ||
                              m.banco_pagamento ||
                              "--"}
                          </div>
                        </td>
                        <td className="px-3 py-3 align-top text-xs">
                          <div className="truncate font-semibold text-[var(--color-text)]">
                            {m.mp_pos_external_id || "--"}
                          </div>
                          <div className="mt-1 truncate text-[var(--color-text-soft)]">
                            {m.mp_pos_id ? `POS ${m.mp_pos_id}` : "Sem caixa"}
                          </div>
                          <div className="mt-1.5">
                            <FirmwareBadge machine={m} compact />
                          </div>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <div className="text-xs">
                            <div className="font-semibold text-[var(--color-text)]">
                              {m.faturamento?.toFixed
                                ? `R$ ${m.faturamento.toFixed(2)}`
                                : "--"}
                            </div>
                            {m.maquina_ficha ? (
                              <div
                                className="mt-1 text-[var(--color-text-soft)]"
                                title={`Valor real das fichas: ${m.fisico_quantidade ?? 0} x R$ ${Number(m.valor_ficha || 0).toFixed(2)}`}
                              >
                                {m.fisico_quantidade ?? 0} fichas = R$ {Number(m.faturamento_fisico || 0).toFixed(2)}
                              </div>
                            ) : null}
                            <div className="mt-1 text-[var(--color-text-soft)]">
                              {m.quantidade_saidas ?? 0} pelucias
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <div className="flex flex-wrap gap-1.5">
                            <IconActionButton
                              icon={Rocket}
                              label="Enviar credito"
                              tone="primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                openCreditModal(m);
                              }}
                              disabled={Boolean(sendingCreditId)}
                              busy={sendingCreditId === m.id_hardware}
                            />
                            <IconActionButton
                              icon={QrCode}
                              label="Consultar caixa (QR code Pix)"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleConsultarCaixa(m);
                              }}
                            />
                            {user?.role === "admin" ? (
                              <>
                                <IconActionButton
                                  icon={UploadCloud}
                                  label={
                                    !m.status_online
                                      ? "Maquina offline"
                                      : firmwareVersions.length === 0
                                        ? "Cadastre uma versao em Firmwares"
                                        : [
                                              "sent",
                                              "downloading",
                                              "restarting",
                                            ].includes(m.firmware_update_status)
                                          ? "Ja existe uma atualizacao em andamento"
                                          : "Atualizar firmware"
                                  }
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    requestFirmwareUpdate(m);
                                  }}
                                  disabled={
                                    sendingUpdateId === m.id_hardware ||
                                    !m.status_online ||
                                    firmwareVersions.length === 0 ||
                                    [
                                      "sent",
                                      "downloading",
                                      "restarting",
                                    ].includes(m.firmware_update_status)
                                  }
                                  busy={sendingUpdateId === m.id_hardware}
                                />
                                <IconActionButton
                                  icon={Pencil}
                                  label="Editar maquina"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditMachine(m);
                                  }}
                                />
                                <IconActionButton
                                  icon={ShieldAlert}
                                  label={
                                    "Filtro saida pos-credito: " +
                                    (m.ignorar_saida_pos_credito
                                      ? "ativo (clique para desativar)"
                                      : "inativo (clique para ativar)")
                                  }
                                  tone={
                                    m.ignorar_saida_pos_credito
                                      ? "warning"
                                      : undefined
                                  }
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleFiltroSaidaPosCredito(m);
                                  }}
                                  disabled={
                                    togglingFiltroSaidaId === m.id_hardware
                                  }
                                  busy={togglingFiltroSaidaId === m.id_hardware}
                                />
                                <IconActionButton
                                  icon={Moon}
                                  label="Horario do ponto fechado"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setHorarioFechadoMachine(m);
                                  }}
                                />
                                <IconActionButton
                                  icon={Terminal}
                                  label="Diagnostico da placa (log tecnico)"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAbrirDiagnostico(m);
                                  }}
                                />
                                <IconActionButton
                                  icon={Timer}
                                  label={
                                    machineSupportsDeviceConfig(m)
                                      ? "Configuracao da placa (pulso/moeda/reconexao)"
                                      : `Firmware ${m.firmware_version || "desconhecido"} nao suporta configuracao remota - atualize a placa primeiro`
                                  }
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAbrirConfigDispositivo(m);
                                  }}
                                  disabled={!machineSupportsDeviceConfig(m)}
                                />
                                <IconActionButton
                                  icon={Trash2}
                                  label="Excluir maquina"
                                  tone="danger"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    requestDeleteMachine(m);
                                  }}
                                />
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </section>

      <Modal
        open={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingMachineId("");
        }}
      >
        <div className="space-y-5">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--color-text-soft)]">
              Cadastro de maquina
            </div>
            <h2 className="mt-2 text-3xl font-extrabold tracking-[-0.04em] text-[var(--color-text)]">
              {editingMachineId
                ? "Editar maquina"
                : "Cadastrar e vincular ao ESP"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-soft)]">
              {editingMachineId
                ? "Atualize os dados cadastrais da maquina e mantenha o cliente responsavel correto."
                : "Escolha o usuario cliente. O sistema ja busca o proximo ID e cria automaticamente um caixa no Mercado Pago com o nome do ponto."}
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleCreate}>
            <div className="rounded-[24px] border border-[var(--color-border)] bg-[var(--color-bg-muted)] p-4">
              <div className="text-sm font-semibold text-[var(--color-text)]">
                ID da maquina
              </div>
              <div className="mt-3 flex flex-col gap-3 md:flex-row">
                <input
                  className="w-full rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-4 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
                  placeholder="Ex.: 1000"
                  value={form.id_hardware}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      id_hardware: e.target.value.toUpperCase(),
                    }))
                  }
                  disabled={Boolean(editingMachineId)}
                />
                <button
                  type="button"
                  className="pill-button inline-flex items-center justify-center gap-2 px-5 py-3 font-semibold"
                  onClick={generateId}
                  disabled={generatingId || Boolean(editingMachineId)}
                >
                  <RefreshCcw
                    size={16}
                    className={generatingId ? "animate-spin" : ""}
                  />
                  {generatingId ? "Gerando" : "Proximo ID"}
                </button>
                <button
                  type="button"
                  className="pill-button inline-flex items-center justify-center gap-2 px-5 py-3 font-semibold"
                  onClick={copyMachineId}
                  disabled={!form.id_hardware}
                >
                  <Copy size={16} />
                  Copiar
                </button>
              </div>
              <div className="mt-3 text-xs text-[var(--color-text-soft)]">
                O ID e gerado automaticamente a partir de{" "}
                <span className="font-semibold text-[var(--color-text)]">
                  1000
                </span>
                , mas voce pode alterar antes de cadastrar.
              </div>
              {copyFeedback ? (
                <div className="mt-3 text-sm font-medium text-[var(--color-success)]">
                  {copyFeedback}
                </div>
              ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {user?.role === "admin" ? (
                <label className="block md:col-span-2">
                  <span className="mb-2 block text-sm font-semibold text-[var(--color-text)]">
                    Vincular ao cliente
                  </span>
                  <select
                    className="w-full rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-4 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
                    value={form.cliente_id || ""}
                    onChange={(e) =>
                      setForm((current) => {
                        const cliente = usuarios.find(
                          (item) => String(item.cliente_id) === e.target.value,
                        );
                        const providers = getPaymentProviders(cliente);
                        return {
                          ...current,
                          cliente_id: e.target.value,
                          banco_pagamento: providers[0] || "",
                        };
                      })
                    }
                    required
                  >
                    <option value="">Selecione o cliente responsavel</option>
                    {usuarios.map((item) => (
                      <option key={item.id} value={item.cliente_id ?? ""}>
                        {(item.nome || item.email) +
                          (item.cliente_id
                            ? ` - cliente ${item.cliente_id}`
                            : "")}
                        {item.mp_configurado ? "" : " - Mercado Pago pendente"}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {user?.role === "admin" ? (
                <label className="block md:col-span-2">
                  <span className="mb-2 block text-sm font-semibold text-[var(--color-text)]">
                    Banco da maquina
                  </span>
                  <select
                    className="w-full rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-4 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
                    value={form.banco_pagamento}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        banco_pagamento: e.target.value,
                      }))
                    }
                    required
                    disabled={
                      !form.cliente_id ||
                      paymentProviders.length === 0 ||
                      Boolean(editingMachineId)
                    }
                  >
                    <option value="">
                      {form.cliente_id
                        ? "Selecione o banco da maquina"
                        : "Selecione um cliente primeiro"}
                    </option>
                    {paymentProviders.map((provider) => {
                      const implementado =
                        provider === "mercado_pago" ||
                        provider === "token_play" ||
                        provider === "sumup" ||
                        provider === "stone" ||
                        provider === "mercado_pago_apk";
                      return (
                        <option
                          key={provider}
                          value={provider}
                          disabled={!implementado}
                        >
                          {paymentProviderLabels[provider]}
                          {!implementado ? " - em breve" : ""}
                        </option>
                      );
                    })}
                  </select>
                  {form.cliente_id && paymentProviders.length === 0 ? (
                    <span className="mt-2 block text-xs font-medium text-[var(--color-error)]">
                      Este cliente ainda nao tem banco de pagamento habilitado.
                    </span>
                  ) : null}
                  {form.cliente_id &&
                  form.banco_pagamento === "mercado_pago" &&
                  !selectedCliente?.mp_configurado ? (
                    <span className="mt-2 block rounded-[14px] bg-amber-50 px-3 py-2 text-xs font-medium leading-5 text-[var(--color-warning)]">
                      Antes de cadastrar, o sistema vai validar o Mercado Pago
                      deste cliente. Se faltar token ou conta valida, o cadastro
                      sera bloqueado.
                    </span>
                  ) : null}
                  {form.cliente_id &&
                  form.banco_pagamento === "mercado_pago" ? (
                    <button
                      type="button"
                      className="mt-3 inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--color-text)] transition hover:border-[var(--color-primary)]"
                      onClick={validateSelectedMercadoPago}
                      disabled={validatingMp}
                    >
                      <RefreshCcw
                        size={15}
                        className={validatingMp ? "animate-spin" : ""}
                      />
                      {validatingMp
                        ? "Validando MP..."
                        : "Validar MP deste cliente"}
                    </button>
                  ) : null}
                  {form.cliente_id && form.banco_pagamento === "sumup" ? (
                    <div className="mt-3">
                      <span className="mb-2 block text-sm font-semibold text-[var(--color-text)]">
                        Reader (maquininha) SumUp
                      </span>
                      <select
                        className="w-full rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-4 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
                        value={form.sumup_reader_id}
                        onChange={(e) =>
                          setForm((current) => ({
                            ...current,
                            sumup_reader_id: e.target.value,
                          }))
                        }
                        disabled={loadingSumupReaders}
                      >
                        <option value="">
                          {loadingSumupReaders
                            ? "Carregando readers..."
                            : sumupReaders.length === 0
                              ? "Nenhum reader encontrado"
                              : "Selecione o reader ja pareado"}
                        </option>
                        {sumupReaders.map((reader) => (
                          <option key={reader.id} value={reader.id}>
                            {reader.label || reader.id}
                          </option>
                        ))}
                      </select>
                      {!loadingSumupReaders && sumupReaders.length === 0 ? (
                        <span className="mt-2 block rounded-[14px] bg-amber-50 px-3 py-2 text-xs font-medium leading-5 text-[var(--color-warning)]">
                          Nenhum reader pareado nessa conta SumUp ainda - pareie a
                          maquininha pelo app do SumUp antes de continuar.
                        </span>
                      ) : null}

                      <div className="mt-4 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg-muted)] p-4">
                        <span className="mb-2 block text-sm font-semibold text-[var(--color-text)]">
                          Parear nova maquininha (pra aparecer na lista acima)
                        </span>
                        <p className="mb-3 text-xs leading-5 text-[var(--color-text-soft)]">
                          No aparelho: menu (gaveta de cima) → Connections → conecta no
                          Wi-Fi → selecione &quot;API&quot; → Connect. O codigo aparece na
                          tela e expira em 5 minutos.
                        </p>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <input
                            type="text"
                            className="flex-1 rounded-[14px] border border-[var(--color-border)] bg-white px-3 py-3 text-sm text-[var(--color-text)] outline-none"
                            placeholder="Codigo de pareamento"
                            value={pairingCode}
                            onChange={(e) => setPairingCode(e.target.value)}
                          />
                          <input
                            type="text"
                            className="flex-1 rounded-[14px] border border-[var(--color-border)] bg-white px-3 py-3 text-sm text-[var(--color-text)] outline-none"
                            placeholder="Nome (opcional)"
                            value={pairingName}
                            onChange={(e) => setPairingName(e.target.value)}
                          />
                          <button
                            type="button"
                            className="pill-button whitespace-nowrap px-4 py-3 text-sm font-semibold"
                            onClick={handlePairSumupReader}
                            disabled={pairingSumup}
                          >
                            {pairingSumup ? "Pareando..." : "Parear"}
                          </button>
                        </div>
                        {pairingMessage.text ? (
                          <p
                            className={`mt-2 text-xs font-medium ${
                              pairingMessage.type === "error" ? "text-rose-600" : "text-emerald-600"
                            }`}
                          >
                            {pairingMessage.text}
                          </p>
                        ) : null}
                      </div>

                      <span className="mb-2 mt-4 block text-sm font-semibold text-[var(--color-text)]">
                        Ou codigo do reader (sem pareamento Cloud)
                      </span>
                      <input
                        type="text"
                        className="w-full rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-4 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
                        placeholder="Ex: 200300136586"
                        value={form.sumup_device_code}
                        onChange={(e) =>
                          setForm((current) => ({
                            ...current,
                            sumup_device_code: e.target.value,
                          }))
                        }
                      />
                      <span className="mt-2 block text-xs leading-5 text-[var(--color-text-soft)]">
                        Faca um pagamento de teste nessa maquininha e peça o codigo que
                        aparece no log do servidor (campo "card_reader.code" do recibo) -
                        util quando a maquininha nao esta pareada na Cloud API da SumUp.
                      </span>

                      <span className="mb-2 mt-4 block text-sm font-semibold text-[var(--color-text)]">
                        Usuario SumUp logado nesta maquininha (para Pix)
                      </span>
                      <input
                        type="text"
                        className="w-full rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-4 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
                        placeholder="Ex: maquina1014@seudominio.com"
                        autoComplete="off"
                        value={form.sumup_usuario}
                        onChange={(e) =>
                          setForm((current) => ({
                            ...current,
                            sumup_usuario: e.target.value,
                          }))
                        }
                      />
                      <span className="mt-2 block text-xs leading-5 text-[var(--color-text-soft)]">
                        O Pix feito na maquininha nao informa qual maquininha foi usada - so o usuario
                        logado nela. Mesmo com uma maquina so, logue a maquininha com um usuario (operador) proprio
                        e coloque aqui o e-mail dele: so o Pix desse usuario libera pulso. Sem este campo o Pix
                        nao e' creditado (fica pendente). Cada usuario so pode estar em uma maquina.
                      </span>

                      {user?.role === "admin" && editingMachineId ? (
                        <div className="mt-3 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg-muted)] p-4">
                          <span className="block text-sm font-semibold text-[var(--color-text)]">
                            Criar o usuario automaticamente
                          </span>
                          <p className="mt-1 text-xs leading-5 text-[var(--color-text-soft)]">
                            O sistema cria um usuario so desta maquininha na conta SumUp do cliente e preenche o campo
                            acima. Depois, na maquininha, saia da conta atual e entre com o login e a senha mostrados.
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="pill-button pill-button--primary px-4 py-2 text-sm font-semibold disabled:opacity-50"
                              onClick={() => handleCriarUsuarioSumup(false)}
                              disabled={usuarioSumup.carregando}
                            >
                              {usuarioSumup.carregando ? "Aguarde..." : "Criar usuario da maquininha"}
                            </button>
                            <button
                              type="button"
                              className="pill-button px-4 py-2 text-sm font-semibold"
                              onClick={handleVerLoginSumup}
                              disabled={usuarioSumup.carregando}
                            >
                              Ver login
                            </button>
                            <button
                              type="button"
                              className="pill-button px-4 py-2 text-sm font-semibold"
                              onClick={() => handleCriarUsuarioSumup(true)}
                              disabled={usuarioSumup.carregando}
                            >
                              Criar outro
                            </button>
                          </div>
                          {usuarioSumup.login ? (
                            <div className="mt-3 rounded-[12px] bg-white px-3 py-2 text-sm">
                              <div>
                                Login: <strong className="select-all">{usuarioSumup.login.usuario}</strong>
                              </div>
                              <div>
                                Senha: <strong className="select-all font-mono">{usuarioSumup.login.senha}</strong>
                              </div>
                            </div>
                          ) : null}
                          {usuarioSumup.erro ? (
                            <p className="mt-2 text-xs font-medium text-rose-600">{usuarioSumup.erro}</p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {form.cliente_id && form.banco_pagamento === "stone" ? (
                    <div className="mt-3">
                      <span className="mb-2 block text-sm font-semibold text-[var(--color-text)]">
                        Numero de serie da maquininha Stone
                      </span>
                      <input
                        type="text"
                        className="w-full rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-4 uppercase text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
                        placeholder="Ex: 6N021234"
                        autoComplete="off"
                        value={form.stone_serial_number}
                        onChange={(e) =>
                          setForm((current) => ({
                            ...current,
                            stone_serial_number: e.target.value,
                          }))
                        }
                      />
                      <span className="mt-2 block text-xs leading-5 text-[var(--color-text-soft)]">
                        Fica na etiqueta atras da maquininha (S/N) ou no menu Sobre dela. Toda venda digitada
                        nessa maquininha (credito, debito ou Pix) libera o pulso nesta maquina. Cada maquininha so
                        pode estar em uma maquina. Estorno e' feito na propria maquininha ou no Portal Stone.
                      </span>
                    </div>
                  ) : null}
                  {form.cliente_id && form.banco_pagamento === "mercado_pago_apk" ? (
                    <PointApkChaves
                      clienteId={form.cliente_id}
                      maquinaId={editingMachineId || form.id_hardware}
                      maquinaNome={form.nome}
                    />
                  ) : null}
                </label>
              ) : null}

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-[var(--color-text)]">
                  Nome do ponto
                </span>
                <input
                  className="w-full rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-4 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
                  placeholder="Ex.: Grua Shopping Centro"
                  value={form.nome}
                  onChange={(e) =>
                    setForm((current) => ({ ...current, nome: e.target.value }))
                  }
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-[var(--color-text)]">
                  Localizacao
                </span>
                <input
                  className="w-full rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-4 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
                  placeholder="Ex.: Piso 2 - corredor central"
                  value={form.localizacao}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      localizacao: e.target.value,
                    }))
                  }
                />
              </label>

              <div className="block rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-3">
                <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold text-[var(--color-text)]">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--color-primary)]"
                    checked={form.maquina_ficha}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        maquina_ficha: e.target.checked,
                      }))
                    }
                  />
                  Maquina de ficha
                </label>
                <p className="mt-1 text-xs text-[var(--color-text-soft)]">
                  Marque se a entrada fisica desta maquina recebe fichas. Cada ficha que entrar passa a valer o valor
                  abaixo no faturamento.
                </p>
                {form.maquina_ficha ? (
                  <label className="mt-3 block">
                    <span className="mb-2 block text-sm font-semibold text-[var(--color-text)]">
                      Valor de cada ficha (R$)
                    </span>
                    <input
                      className="w-full rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-4 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
                      placeholder="Ex.: 2,50"
                      inputMode="decimal"
                      value={form.valor_ficha}
                      onChange={(e) =>
                        setForm((current) => ({
                          ...current,
                          valor_ficha: e.target.value,
                        }))
                      }
                      required
                    />
                    <span className="mt-1 block text-xs text-[var(--color-text-soft)]">
                      Vale para as fichas que entrarem daqui em diante.
                    </span>
                  </label>
                ) : null}
              </div>

              {user?.role === "admin" ? (
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-[var(--color-text)]">
                    Localizacao no mapa (opcional)
                  </span>
                  <input
                    className="w-full rounded-[18px] border border-[var(--color-border)] bg-white px-4 py-4 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
                    placeholder="Link do Google Maps ou coordenadas (ex.: -23.5505, -46.6333)"
                    value={form.localizacao_mapa}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        localizacao_mapa: e.target.value,
                      }))
                    }
                  />
                  <button
                    type="button"
                    className="mt-2 text-sm font-semibold text-[var(--color-primary)] underline"
                    onClick={async () => {
                      try {
                        const gps = await obterGps();
                        setForm((current) => ({
                          ...current,
                          localizacao_mapa: `${gps.latitude.toFixed(6)}, ${gps.longitude.toFixed(6)}`,
                        }));
                        setToast({ message: `Localizacao atual preenchida (+-${gps.precisao_m} m).`, type: "success" });
                      } catch (erro) {
                        setToast({ message: erro.message, type: "error" });
                      }
                    }}
                  >
                    Usar minha localizacao atual
                  </button>
                  <span className="mt-1 block text-xs text-[var(--color-text-soft)]">
                    So aparece no Mapa quem tiver isso preenchido. Para tirar do mapa, apague o campo.
                  </span>
                </label>
              ) : null}
            </div>

            <Button
              type="submit"
              className="w-full justify-center"
              disabled={saving}
            >
              {saving
                ? "Salvando maquina..."
                : editingMachineId
                  ? "Salvar alteracoes"
                  : "Cadastrar maquina"}
            </Button>
          </form>
        </div>
      </Modal>

      <ConfirmModal
        open={deleteState.open}
        title="Excluir maquina"
        description={
          <>
            Voce esta prestes a excluir permanentemente a maquina{" "}
            <strong>
              {deleteState.machine?.nome || deleteState.machine?.id_hardware}
            </strong>{" "}
            (ID {deleteState.machine?.id_hardware}).
            <br />
            <br />
            <strong>
              TODOS os dados dessa maquina serao apagados para sempre e NAO
              podem ser recuperados:
            </strong>{" "}
            pagamentos, vendas, testes, historico de operacoes, fechamentos
            salvos, comandos enviados e alertas. Faturamento ja registrado (
            {deleteState.machine?.faturamento?.toFixed
              ? `R$ ${deleteState.machine.faturamento.toFixed(2)}`
              : "R$ 0,00"}{" "}
            no periodo filtrado) tambem sera perdido.
            <br />
            <br />
            Se a maquina so precisa sair de operacao, considere apenas
            desvincular do cliente em vez de excluir.
          </>
        }
        confirmLabel="Excluir maquina e apagar tudo"
        requireText="confirmar"
        inputValue={deleteState.confirmationText}
        inputPlaceholder='Digite "confirmar"'
        onInputChange={(value) =>
          setDeleteState((current) => ({ ...current, confirmationText: value }))
        }
        onCancel={() => setDeleteState(emptyDeleteState)}
        onConfirm={handleDeleteMachine}
      />
    </div>
  );
}

function CardSectionHeader({ title, description, actions }) {
  return (
    <section className="app-panel rounded-[30px] p-6 md:p-7">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--color-text-soft)]">
            Operacao
          </div>
          <h1 className="mt-3 text-4xl font-extrabold tracking-[-0.05em] text-[var(--color-text)] md:text-5xl">
            {title}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--color-text-soft)] md:text-base">
            {description}
          </p>
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-3">{actions}</div>
        ) : null}
      </div>
    </section>
  );
}

function SummaryCard({ icon, label, value, helper, featured = false }) {
  return (
    <section
      className={`app-panel rounded-[28px] p-6 ${
        featured
          ? "bg-[linear-gradient(135deg,var(--color-primary)_0%,var(--color-primary-strong)_100%)] text-white shadow-[0_22px_40px_rgba(31,122,76,0.28)]"
          : ""
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <div
            className={`text-sm font-semibold ${featured ? "text-white/72" : "text-[var(--color-text-soft)]"}`}
          >
            {label}
          </div>
          <div className="mt-4 text-4xl font-extrabold tracking-[-0.05em]">
            {value}
          </div>
        </div>
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-full ${
            featured
              ? "bg-white/16 text-white"
              : "bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
          }`}
        >
          {icon}
        </div>
      </div>
      <div
        className={`mt-4 text-sm ${featured ? "text-white/74" : "text-[var(--color-text-soft)]"}`}
      >
        {helper}
      </div>
    </section>
  );
}

function MachineMobileCard({
  machine,
  user,
  sendingCreditId,
  sendingUpdateId,
  verifyingMachineId,
  canUpdateFirmware,
  onOpen,
  onSendCredit,
  onConsultarCaixa,
  onVerify,
  onSendUpdate,
  onEdit,
  onDelete,
  onToggleFiltroSaida,
  togglingFiltroSaida,
  onAbrirDiagnostico,
  onAbrirHorarioFechado,
}) {
  return (
    <article className="min-w-0 rounded-[18px] border border-[var(--color-border)] bg-white p-4 shadow-[0_8px_20px_rgba(34,61,43,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <button type="button" className="min-w-0 text-left" onClick={onOpen}>
          <div className="truncate text-base font-extrabold text-[var(--color-primary-strong)]">
            {machine.nome || machine.id_hardware}
          </div>
          <div className="mt-1 text-xs font-semibold text-[var(--color-text-soft)]">
            ID {machine.id_hardware}
          </div>
        </button>
        <MachineStatusBadge status={machine.status_operacional} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <InfoPill
          label="Faturamento"
          value={
            machine.faturamento?.toFixed
              ? `R$ ${machine.faturamento.toFixed(2)}`
              : "--"
          }
        />
        {machine.maquina_ficha ? (
          <InfoPill
            label={`Fichas (R$ ${Number(machine.valor_ficha || 0).toFixed(2)} cada)`}
            value={`${machine.fisico_quantidade ?? 0} = R$ ${Number(machine.faturamento_fisico || 0).toFixed(2)}`}
          />
        ) : null}
        <InfoPill
          label="Pelucias"
          value={String(machine.quantidade_saidas ?? 0)}
        />
        <InfoPill
          label="Wi-Fi"
          value={
            <WifiSignal
              online={machine.status_online}
              quality={machine.wifi_quality}
              rssi={machine.wifi_rssi}
              compact
            />
          }
        />
        {machine.ip_local ? (
          <InfoPill label="IP local" value={machine.ip_local} />
        ) : null}
        {machine.wifi_ssid ? (
          <InfoPill label="Rede Wi-Fi" value={machine.wifi_ssid} />
        ) : null}
        <InfoPill
          label="Banco"
          value={
            paymentProviderLabels[machine.banco_pagamento || "mercado_pago"] ||
            machine.banco_pagamento ||
            "--"
          }
        />
        <InfoPill label="Local" value={machine.localizacao || "--"} wide />
        <InfoPill
          label="Ultima atividade"
          value={
            machine.ultima_atividade_em
              ? brasiliaDate(machine.ultima_atividade_em).format("DD/MM HH:mm")
              : "Sem atividade"
          }
          wide
        />
      </div>

      <div className="mt-3">
        <FirmwareBadge machine={machine} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          className="col-span-2 pill-button inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold"
          onClick={onVerify}
          disabled={verifyingMachineId === machine.id_hardware}
        >
          <RefreshCcw
            size={15}
            className={
              verifyingMachineId === machine.id_hardware ? "animate-spin" : ""
            }
          />
          {verifyingMachineId === machine.id_hardware
            ? "Verificando placa..."
            : "Verificar se a placa esta online"}
        </button>
        <button
          type="button"
          className="pill-button pill-button--primary inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold"
          onClick={onSendCredit}
          disabled={sendingCreditId === machine.id_hardware}
        >
          <Rocket size={15} />
          {sendingCreditId === machine.id_hardware ? "Enviando" : "Credito"}
        </button>
        <button
          type="button"
          className="pill-button inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold"
          onClick={onConsultarCaixa}
        >
          <QrCode size={15} />
          Caixa
        </button>
        <button
          type="button"
          className="pill-button inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold"
          onClick={onOpen}
        >
          <Server size={15} />
          Abrir
        </button>
        {user?.role === "admin" ? (
          <>
            <button
              type="button"
              className="col-span-2 pill-button inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold"
              onClick={onSendUpdate}
              disabled={
                sendingUpdateId === machine.id_hardware ||
                !canUpdateFirmware ||
                ["sent", "downloading", "restarting"].includes(
                  machine.firmware_update_status,
                )
              }
              title={
                !machine.status_online
                  ? "Maquina offline"
                  : !canUpdateFirmware
                    ? "Cadastre uma versao em Firmwares"
                    : ["sent", "downloading", "restarting"].includes(
                          machine.firmware_update_status,
                        )
                      ? "Ja existe uma atualizacao em andamento"
                      : "Atualizar firmware"
              }
            >
              <UploadCloud size={15} />
              {sendingUpdateId === machine.id_hardware
                ? "Enviando"
                : machine.firmware_update_status === "downloading"
                  ? `Baixando${machine.firmware_update_progress != null ? ` ${machine.firmware_update_progress}%` : "..."}`
                  : ["sent", "restarting"].includes(
                        machine.firmware_update_status,
                      )
                    ? "Em andamento"
                    : "Atualizar"}
            </button>
            <button
              type="button"
              className="pill-button inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold"
              onClick={onEdit}
            >
              <Pencil size={15} />
              Editar
            </button>
            <button
              type="button"
              title={
                "Filtro saida pos-credito: " +
                (machine.ignorar_saida_pos_credito
                  ? "ativo (clique para desativar)"
                  : "inativo (clique para ativar)")
              }
              className={`inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-full border px-2 py-2 text-xs font-semibold transition ${
                machine.ignorar_saida_pos_credito
                  ? "border-amber-300 bg-amber-100 text-amber-700"
                  : "border-[var(--color-border)] bg-white text-[var(--color-text)]"
              }`}
              onClick={onToggleFiltroSaida}
              disabled={togglingFiltroSaida}
            >
              <ShieldAlert
                size={14}
                className={
                  togglingFiltroSaida ? "shrink-0 animate-spin" : "shrink-0"
                }
              />
              <span className="truncate">
                {machine.ignorar_saida_pos_credito
                  ? "Filtro: ativo"
                  : "Filtro: inativo"}
              </span>
            </button>
            <button
              type="button"
              className="col-span-2 pill-button inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold"
              onClick={onAbrirDiagnostico}
            >
              <Terminal size={15} />
              Diagnostico da placa
            </button>
            <button
              type="button"
              className="col-span-2 pill-button inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold"
              onClick={onAbrirHorarioFechado}
            >
              <Moon size={15} />
              Horario do ponto fechado
            </button>
            <button
              type="button"
              className="col-span-2 inline-flex min-h-[42px] items-center justify-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-[var(--color-error)]"
              onClick={onDelete}
            >
              <Trash2 size={15} />
              Excluir
            </button>
          </>
        ) : null}
      </div>
    </article>
  );
}

function FirmwareBadge({ machine, compact = false }) {
  const currentVersion = machine.firmware_version || "";
  const targetVersion = machine.firmware_target_version || "";
  const updateStatus = machine.firmware_update_status || "";
  const hasCurrent = Boolean(currentVersion);
  const hasTarget = Boolean(targetVersion);
  const isUpdated = hasCurrent && hasTarget && currentVersion === targetVersion;
  const needsUpdate =
    hasCurrent && hasTarget && currentVersion !== targetVersion;
  const updateLabel = formatFirmwareUpdateStatus(updateStatus);
  const isUpdating = ["sent", "downloading", "restarting"].includes(
    updateStatus,
  );
  const isFailed = updateStatus === "failed";
  const statusLabel =
    updateLabel ||
    (!hasCurrent
      ? "Sem versao"
      : isUpdated
        ? "Atualizado"
        : needsUpdate
          ? "Atualizacao pendente"
          : "Instalado");

  const tone = !hasCurrent
    ? "border-slate-200 bg-slate-50 text-slate-600"
    : isFailed
      ? "border-rose-200 bg-rose-50 text-rose-800"
      : needsUpdate || isUpdating
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-emerald-200 bg-emerald-50 text-emerald-800";

  if (compact) {
    const title = [
      statusLabel,
      currentVersion || "Aguardando sinal da placa",
      isFailed && machine.firmware_update_error
        ? `Erro: ${machine.firmware_update_error}`
        : null,
    ]
      .filter(Boolean)
      .join(" - ");
    return (
      <div
        className={`inline-flex max-w-full items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] ${tone}`}
        title={title}
      >
        <Cpu size={12} className="shrink-0" />
        <span className="truncate font-bold">{statusLabel}</span>
      </div>
    );
  }

  return (
    <div
      className={`inline-flex max-w-full items-start gap-2 rounded-xl border px-3 py-2 text-xs ${tone}`}
    >
      <Cpu size={15} className="mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="font-bold">{statusLabel}</div>
        <div
          className="mt-1 max-w-[190px] truncate font-semibold"
          title={currentVersion || "Aguardando sinal da placa"}
        >
          {currentVersion || "Aguardando sinal da placa"}
        </div>
        {hasTarget && !isUpdated ? (
          <div
            className="mt-1 max-w-[190px] truncate text-[11px]"
            title={targetVersion}
          >
            Alvo: {targetVersion}
          </div>
        ) : null}
        {isUpdating && machine.firmware_update_progress != null ? (
          <div className="mt-1 text-[11px] font-bold">
            {machine.firmware_update_progress}% concluido
          </div>
        ) : null}
        {isFailed && machine.firmware_update_error ? (
          <div
            className="mt-1 max-w-[190px] truncate text-[11px]"
            title={machine.firmware_update_error}
          >
            Erro: {machine.firmware_update_error}
          </div>
        ) : null}
        {isFailed && machine.firmware_last_good_version ? (
          <div className="mt-1 max-w-[190px] truncate text-[11px] opacity-80">
            Ultima versao boa: {machine.firmware_last_good_version}
          </div>
        ) : null}
        {machine.firmware_updated_at ? (
          <div className="mt-1 text-[11px] opacity-80">
            {brasiliaDate(machine.firmware_updated_at).format("DD/MM HH:mm")}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function IconActionButton({
  icon,
  label,
  onClick,
  disabled = false,
  busy = false,
  tone,
}) {
  const Icon = icon;
  const toneClass =
    tone === "primary"
      ? "border-transparent bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-strong)]"
      : tone === "danger"
        ? "border-rose-200 bg-rose-50 text-[var(--color-error)] hover:bg-rose-100"
        : tone === "warning"
          ? "border-amber-300 bg-amber-100 text-amber-700 hover:bg-amber-200"
          : "border-[var(--color-border)] bg-white text-[var(--color-text)] hover:border-[var(--color-primary)]";
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-50 ${toneClass}`}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon size={15} className={busy ? "animate-spin" : ""} />
    </button>
  );
}

// "version_2.7.9-ip-local-2026-10-14" -> "v2.7.9" (nome completo no title).
function versaoCurtaFirmware(versao) {
  const numero = String(versao || "").match(/\d+\.\d+(\.\d+)?/);
  return numero ? `v${numero[0]}` : versao;
}

function formatFirmwareUpdateStatus(status) {
  const labels = {
    sent: "Atualizacao enviada",
    downloading: "Baixando firmware",
    restarting: "Reiniciando",
    updated: "Atualizado",
    failed: "Atualizacao falhou",
    no_update: "Sem novidade",
  };
  return labels[status] || "";
}

function MachineStatusBadge({ status }) {
  const tone =
    status === "operando"
      ? "bg-[var(--color-primary-soft)] text-[var(--color-success)]"
      : status === "atencao"
        ? "bg-amber-50 text-[var(--color-warning)]"
        : status === "fechado"
          ? "bg-slate-100 text-slate-600"
          : "bg-rose-50 text-[var(--color-error)]";
  const label =
    status === "offline"
      ? "Offline"
      : status === "fechado"
        ? "Fechado"
        : status === "operando"
          ? "Operando"
          : "Online";
  const Icon = status === "offline" ? XCircle : status === "fechado" ? Moon : CheckCircle2;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-bold ${tone}`}
    >
      <Icon size={14} />
      {label}
    </span>
  );
}

function getWifiSignalMeta(online, quality) {
  const normalized =
    Number.isFinite(Number(quality)) && online
      ? Math.max(0, Math.min(100, Number(quality)))
      : null;
  if (!online || normalized === null) {
    return {
      label: online ? "Sem leitura" : "Offline",
      color: "text-slate-400",
      bar: "bg-slate-300",
      width: "20%",
      quality: normalized,
    };
  }
  if (normalized >= 70) {
    return {
      label: "Otimo",
      color: "text-emerald-700",
      bar: "bg-emerald-500",
      width: `${normalized}%`,
      quality: normalized,
    };
  }
  if (normalized >= 40) {
    return {
      label: "Bom",
      color: "text-amber-700",
      bar: "bg-amber-500",
      width: `${normalized}%`,
      quality: normalized,
    };
  }
  return {
    label: "Ruim",
    color: "text-rose-700",
    bar: "bg-rose-500",
    width: `${Math.max(normalized, 12)}%`,
    quality: normalized,
  };
}

function WifiSignal({ online, quality, rssi, compact = false }) {
  const meta = getWifiSignalMeta(online, quality);
  return (
    <div className="min-w-0">
      <div
        className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-bold ${meta.color}`}
      >
        <Wifi size={compact ? 14 : 16} className="shrink-0" />
        <span className="truncate">{meta.label}</span>
        {meta.quality !== null ? (
          <span className="shrink-0">{meta.quality}%</span>
        ) : null}
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all ${meta.bar}`}
          style={{ width: meta.width }}
        />
      </div>
      {!compact ? (
        <div className="mt-1 text-[11px] font-semibold text-[var(--color-text-soft)]">
          {online && Number.isFinite(Number(rssi))
            ? `${rssi} dBm`
            : "Aguardando sinal"}
        </div>
      ) : null}
    </div>
  );
}

function InfoPill({ label, value, wide = false }) {
  return (
    <div
      className={`min-w-0 rounded-[14px] bg-[var(--color-bg-muted)] px-3 py-2 ${wide ? "col-span-2" : ""}`}
    >
      <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-text-soft)]">
        {label}
      </div>
      <div className="mt-1 truncate font-semibold text-[var(--color-text)]">
        {value}
      </div>
    </div>
  );
}

function InfoLine({ label, value }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <span className="shrink-0 font-semibold text-[var(--color-text-soft)]">
        {label}
      </span>
      <span className="min-w-0 truncate text-right font-bold text-[var(--color-text)]">
        {value}
      </span>
    </div>
  );
}
