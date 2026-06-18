import { useEffect, useState } from "react";
import dayjs from "dayjs";
import { Cpu, Link as LinkIcon, Pencil, Plus, Power, RefreshCcw, Trash2, UploadCloud } from "lucide-react";

import api, { getApiErrorMessage } from "../api/axios";
import Button from "../components/Button";
import LoadingSpinner from "../components/LoadingSpinner";
import Modal from "../components/Modal";
import Toast from "../components/Toast";
import ConfirmModal from "../components/ConfirmModal";

const emptyForm = {
  id: null,
  nome: "",
  url_bin: "",
  observacao: "",
  ativo: true,
  source: "link",
  file: null,
};

export default function FirmwareVersions() {
  const [firmwares, setFirmwares] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteStep, setDeleteStep] = useState(1);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "success" });

  const loadFirmwares = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/firmware-versions?include_inactive=true");
      setFirmwares(data);
    } catch (error) {
      setToast({ message: getApiErrorMessage(error, "Nao foi possivel carregar as versoes."), type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFirmwares();
  }, []);

  const openCreate = () => {
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (firmware) => {
    setForm({
      id: firmware.id,
      nome: firmware.nome || "",
      url_bin: firmware.url_bin || "",
      observacao: firmware.observacao || "",
      ativo: Boolean(firmware.ativo),
      source: "link",
      file: null,
    });
    setShowModal(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);

    try {
      if (!form.id && form.source === "file") {
        if (!form.file) {
          setToast({ message: "Selecione o arquivo .bin antes de salvar.", type: "error" });
          setSaving(false);
          return;
        }
        const formData = new FormData();
        formData.append("nome", form.nome.trim());
        formData.append("observacao", form.observacao.trim());
        formData.append("ativo", String(form.ativo));
        formData.append("file", form.file);
        await api.post("/firmware-versions/upload", formData);
        setToast({ message: "Arquivo enviado e versao cadastrada com sucesso.", type: "success" });
      } else if (form.id) {
        const payload = {
          nome: form.nome.trim(),
          url_bin: form.url_bin.trim(),
          observacao: form.observacao.trim() || null,
          ativo: form.ativo,
        };
        await api.put(`/firmware-versions/${form.id}`, payload);
        setToast({ message: "Versao atualizada com sucesso.", type: "success" });
      } else {
        const payload = {
          nome: form.nome.trim(),
          url_bin: form.url_bin.trim(),
          observacao: form.observacao.trim() || null,
          ativo: form.ativo,
        };
        await api.post("/firmware-versions", payload);
        setToast({ message: "Versao cadastrada com sucesso.", type: "success" });
      }
      setShowModal(false);
      setForm(emptyForm);
      await loadFirmwares();
    } catch (error) {
      setToast({ message: getApiErrorMessage(error, "Nao foi possivel salvar a versao."), type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (firmware) => {
    try {
      await api.put(`/firmware-versions/${firmware.id}`, { ativo: !firmware.ativo });
      await loadFirmwares();
    } catch (error) {
      setToast({ message: getApiErrorMessage(error, "Nao foi possivel alterar o status."), type: "error" });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/firmware-versions/${deleteTarget.id}/permanent`, {
        params: { confirmacao: deleteConfirmation },
      });
      closeDeleteConfirmation();
      setToast({ message: "Firmware excluido permanentemente.", type: "success" });
      await loadFirmwares();
    } catch (error) {
      setToast({ message: getApiErrorMessage(error, "Nao foi possivel excluir o firmware."), type: "error" });
    } finally {
      setDeleting(false);
    }
  };

  const openDeleteConfirmation = (firmware) => {
    setDeleteTarget(firmware);
    setDeleteStep(1);
    setDeleteConfirmation("");
  };

  const closeDeleteConfirmation = () => {
    setDeleteTarget(null);
    setDeleteStep(1);
    setDeleteConfirmation("");
  };

  const activeCount = firmwares.filter((item) => item.ativo).length;

  return (
    <div className="flex min-h-full flex-col gap-4">
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ message: "", type: toast.type })}
      />
      <ConfirmModal
        open={Boolean(deleteTarget)}
        title={deleteStep === 1 ? "Excluir firmware?" : "Confirmacao final"}
        description={
          deleteStep === 1
            ? `O firmware ${deleteTarget?.nome || ""} sera removido permanentemente. Esta acao nao pode ser desfeita.`
            : `Para excluir definitivamente ${deleteTarget?.nome || ""}, digite EXCLUIR abaixo.`
        }
        confirmLabel={deleteStep === 1 ? "Continuar" : "Excluir definitivamente"}
        loading={deleting}
        requireText={deleteStep === 2 ? "EXCLUIR" : ""}
        inputValue={deleteConfirmation}
        onInputChange={setDeleteConfirmation}
        onCancel={closeDeleteConfirmation}
        onConfirm={() => {
          if (deleteStep === 1) {
            setDeleteStep(2);
            return;
          }
          handleDelete();
        }}
      />

      <section className="app-panel rounded-[30px] p-5 md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--color-text-soft)]">
              Atualizacao remota
            </div>
            <h1 className="mt-3 text-3xl font-extrabold text-[var(--color-text)] md:text-5xl">
              Firmwares
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--color-text-soft)] md:text-base">
              Cadastre as versoes disponiveis para enviar OTA sem alterar variavel da Render.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="pill-button inline-flex items-center justify-center gap-2 px-5 py-3 font-semibold"
              onClick={loadFirmwares}
            >
              <RefreshCcw size={16} />
              Recarregar
            </button>
            <Button className="justify-center" onClick={openCreate}>
              <Plus size={18} />
              Nova versao
            </Button>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Versoes" value={String(firmwares.length)} helper="Total cadastrado" />
        <SummaryCard label="Ativas" value={String(activeCount)} helper="Aparecem no envio OTA" featured />
        <SummaryCard label="Inativas" value={String(firmwares.length - activeCount)} helper="Guardadas para auditoria" />
      </div>

      <section className="app-panel rounded-[30px] p-5 md:p-6">
        <div className="overflow-hidden rounded-[26px] border border-[var(--color-border)] bg-white">
          {loading ? (
            <LoadingSpinner className="h-40" />
          ) : firmwares.length === 0 ? (
            <div className="flex h-40 items-center justify-center px-6 text-center text-sm text-[var(--color-text-soft)]">
              Nenhuma versao cadastrada ainda.
            </div>
          ) : (
            <>
              <div className="grid gap-3 p-3 md:hidden">
                {firmwares.map((firmware) => (
                  <FirmwareMobileCard
                    key={firmware.id}
                    firmware={firmware}
                    onEdit={() => openEdit(firmware)}
                    onToggle={() => toggleActive(firmware)}
                    onDelete={() => openDeleteConfirmation(firmware)}
                  />
                ))}
              </div>
              <div className="hidden overflow-x-auto md:block">
                <table className="min-w-full">
                  <thead className="bg-[var(--color-bg-muted)] text-left text-xs uppercase tracking-[0.18em] text-[var(--color-text-soft)]">
                    <tr>
                      <th className="px-5 py-4 whitespace-nowrap">Versao</th>
                      <th className="px-5 py-4 whitespace-nowrap">Link do .bin</th>
                      <th className="px-5 py-4 whitespace-nowrap">Observacao</th>
                      <th className="px-5 py-4 whitespace-nowrap">Data</th>
                      <th className="px-5 py-4 whitespace-nowrap">Status</th>
                      <th className="px-5 py-4 whitespace-nowrap">Acoes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {firmwares.map((firmware) => (
                      <tr key={firmware.id} className="border-t border-[var(--color-border)] text-sm text-[var(--color-text)]">
                        <td className="px-5 py-4 min-w-[220px] font-bold">{firmware.nome}</td>
                        <td className="px-5 py-4 min-w-[360px]">
                          <a className="block max-w-[340px] truncate font-semibold text-[var(--color-primary-strong)] hover:underline" href={firmware.url_bin} target="_blank" rel="noreferrer">
                            {firmware.url_bin}
                          </a>
                        </td>
                        <td className="px-5 py-4 min-w-[260px] text-[var(--color-text-soft)]">{firmware.observacao || "--"}</td>
                        <td className="px-5 py-4 min-w-[160px] text-[var(--color-text-soft)]">
                          {dayjs(firmware.updated_at).format("DD/MM/YYYY HH:mm")}
                        </td>
                        <td className="px-5 py-4 min-w-[120px]">
                          <StatusPill active={firmware.ativo} />
                        </td>
                        <td className="px-5 py-4 min-w-[260px]">
                          <div className="flex flex-wrap gap-2">
                            <button type="button" className="pill-button inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold" onClick={() => openEdit(firmware)}>
                              <Pencil size={15} />
                              Editar
                            </button>
                            <button type="button" className="pill-button inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold" onClick={() => toggleActive(firmware)}>
                              <Power size={15} />
                              {firmware.ativo ? "Inativar" : "Ativar"}
                            </button>
                            {!firmware.ativo ? (
                              <button type="button" className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-[var(--color-error)]" onClick={() => openDeleteConfirmation(firmware)}>
                                <Trash2 size={15} />
                                Excluir
                              </button>
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

      <Modal open={showModal} onClose={() => setShowModal(false)} title={form.id ? "Editar versao" : "Nova versao"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--color-text-soft)]">
              Firmware OTA
            </div>
            <h2 className="mt-2 text-3xl font-extrabold text-[var(--color-text)]">
              {form.id ? "Editar versao" : "Nova versao"}
            </h2>
          </div>
          <label className="block">
            <span className="text-sm font-semibold text-[var(--color-text)]">Nome da versao</span>
            <input
              className="mt-2 w-full rounded-[18px] border border-[var(--color-border)] px-4 py-3 outline-none focus:border-[var(--color-primary)]"
              value={form.nome}
              onChange={(event) => setForm((current) => ({ ...current, nome: event.target.value }))}
              placeholder="CP0001-2026-06-17-ota"
              required
            />
          </label>

          {!form.id ? (
            <div className="grid grid-cols-2 gap-2 rounded-[18px] border border-[var(--color-border)] bg-[var(--color-bg-muted)] p-1">
              <button
                type="button"
                className={`inline-flex items-center justify-center gap-2 rounded-[14px] px-4 py-3 text-sm font-bold transition ${
                  form.source === "link"
                    ? "bg-white text-[var(--color-primary-strong)] shadow-[0_8px_20px_rgba(34,61,43,0.08)]"
                    : "text-[var(--color-text-soft)]"
                }`}
                onClick={() => setForm((current) => ({ ...current, source: "link", file: null }))}
              >
                <LinkIcon size={16} />
                Link
              </button>
              <button
                type="button"
                className={`inline-flex items-center justify-center gap-2 rounded-[14px] px-4 py-3 text-sm font-bold transition ${
                  form.source === "file"
                    ? "bg-white text-[var(--color-primary-strong)] shadow-[0_8px_20px_rgba(34,61,43,0.08)]"
                    : "text-[var(--color-text-soft)]"
                }`}
                onClick={() => setForm((current) => ({ ...current, source: "file", url_bin: "" }))}
              >
                <UploadCloud size={16} />
                Arquivo
              </button>
            </div>
          ) : null}

          {form.source === "file" && !form.id ? (
            <label className="block rounded-[20px] border border-dashed border-[var(--color-border)] bg-white px-4 py-5">
              <span className="text-sm font-semibold text-[var(--color-text)]">Arquivo .bin</span>
              <input
                type="file"
                accept=".bin,application/octet-stream"
                className="mt-3 w-full text-sm text-[var(--color-text-soft)]"
                onChange={(event) =>
                  setForm((current) => ({ ...current, file: event.target.files?.[0] || null }))
                }
                required
              />
              <div className="mt-2 text-xs text-[var(--color-text-soft)]">
                O backend vai salvar o arquivo e gerar o link automaticamente para a placa baixar.
              </div>
            </label>
          ) : (
            <label className="block">
              <span className="text-sm font-semibold text-[var(--color-text)]">Link do .bin</span>
              <input
                className="mt-2 w-full rounded-[18px] border border-[var(--color-border)] px-4 py-3 outline-none focus:border-[var(--color-primary)]"
                value={form.url_bin}
                onChange={(event) => setForm((current) => ({ ...current, url_bin: event.target.value }))}
                placeholder="https://raw.githubusercontent.com/.../firmware.bin"
                required
              />
            </label>
          )}
          <label className="block">
            <span className="text-sm font-semibold text-[var(--color-text)]">Observacao</span>
            <textarea
              className="mt-2 w-full rounded-[18px] border border-[var(--color-border)] px-4 py-3 outline-none focus:border-[var(--color-primary)]"
              value={form.observacao}
              rows={4}
              onChange={(event) => setForm((current) => ({ ...current, observacao: event.target.value }))}
              placeholder="Ex.: versao com OTA, ajuste de pulso, teste LED1..."
            />
          </label>
          <label className="flex items-center gap-3 rounded-[18px] border border-[var(--color-border)] bg-[var(--color-bg-muted)] px-4 py-3 text-sm font-semibold text-[var(--color-text)]">
            <input
              type="checkbox"
              checked={form.ativo}
              onChange={(event) => setForm((current) => ({ ...current, ativo: event.target.checked }))}
            />
            Versao ativa
          </label>
          <Button type="submit" className="w-full justify-center" disabled={saving}>
            <Cpu size={18} />
            {saving ? "Salvando..." : "Salvar versao"}
          </Button>
        </form>
      </Modal>
    </div>
  );
}

function SummaryCard({ label, value, helper, featured = false }) {
  return (
    <section className={`rounded-[24px] p-5 shadow-[0_14px_35px_rgba(34,61,43,0.08)] ${featured ? "bg-[var(--color-primary)] text-white" : "app-panel"}`}>
      <div className={`text-sm font-semibold ${featured ? "text-white/72" : "text-[var(--color-text-soft)]"}`}>{label}</div>
      <div className="mt-3 text-4xl font-extrabold">{value}</div>
      <div className={`mt-3 text-sm ${featured ? "text-white/74" : "text-[var(--color-text-soft)]"}`}>{helper}</div>
    </section>
  );
}

function StatusPill({ active }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-2 text-xs font-bold ${active ? "bg-emerald-50 text-[var(--color-success)]" : "bg-slate-100 text-slate-600"}`}>
      {active ? "Ativo" : "Inativo"}
    </span>
  );
}

function FirmwareMobileCard({ firmware, onEdit, onToggle, onDelete }) {
  return (
    <article className="rounded-[18px] border border-[var(--color-border)] bg-white p-4 shadow-[0_8px_20px_rgba(34,61,43,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-base font-extrabold text-[var(--color-primary-strong)]">{firmware.nome}</div>
          <div className="mt-1 text-xs text-[var(--color-text-soft)]">{dayjs(firmware.updated_at).format("DD/MM/YYYY HH:mm")}</div>
        </div>
        <StatusPill active={firmware.ativo} />
      </div>
      <a className="mt-3 block truncate text-sm font-semibold text-[var(--color-primary-strong)]" href={firmware.url_bin} target="_blank" rel="noreferrer">
        {firmware.url_bin}
      </a>
      {firmware.observacao ? <div className="mt-3 text-sm text-[var(--color-text-soft)]">{firmware.observacao}</div> : null}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" className="pill-button inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold" onClick={onEdit}>
          <Pencil size={15} />
          Editar
        </button>
        <button type="button" className="pill-button inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold" onClick={onToggle}>
          <Power size={15} />
          {firmware.ativo ? "Inativar" : "Ativar"}
        </button>
        {!firmware.ativo ? (
          <button type="button" className="col-span-2 inline-flex min-h-[42px] items-center justify-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-[var(--color-error)]" onClick={onDelete}>
            <Trash2 size={15} />
            Excluir permanentemente
          </button>
        ) : null}
      </div>
    </article>
  );
}
