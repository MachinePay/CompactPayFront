import { useEffect } from "react";

export default function Modal({ open, onClose, children }) {
  useEffect(() => {
    if (!open) return;
    const handle = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-bgcard rounded shadow-lg p-6 min-w-[320px] relative">
        <button
          className="absolute top-2 right-2 text-white hover:text-error"
          onClick={onClose}
        >
          ×
        </button>
        {children}
      </div>
    </div>
  );
}
