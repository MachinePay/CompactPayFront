import { AlertTriangle } from "lucide-react";

import Modal from "./Modal";

export default function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  tone = "danger",
  loading = false,
  onCancel,
  onConfirm,
}) {
  const confirmClass =
    tone === "danger"
      ? "border-rose-200 bg-rose-50 text-[var(--color-error)] hover:bg-rose-100"
      : "border-[var(--color-border)] bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-strong)]";

  return (
    <Modal open={open} onClose={onCancel}>
      <div className="space-y-5">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-[var(--color-error)]">
            <AlertTriangle size={22} />
          </div>
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--color-text-soft)]">
              Confirmacao
            </div>
            <h2 className="mt-2 text-3xl font-extrabold tracking-[-0.04em] text-[var(--color-text)]">
              {title}
            </h2>
            {description ? (
              <p className="mt-2 text-sm leading-6 text-[var(--color-text-soft)]">
                {description}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="pill-button inline-flex flex-1 items-center justify-center px-5 py-3 font-semibold"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`inline-flex flex-1 items-center justify-center rounded-full border px-5 py-3 font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${confirmClass}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Processando..." : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
