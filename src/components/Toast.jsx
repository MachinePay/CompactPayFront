import { useEffect } from "react";

export default function Toast({ message, type = "error", onClose }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  if (!message) return null;
  return (
    <div
      className={`fixed top-6 right-6 z-50 px-4 py-2 rounded shadow text-white ${type === "error" ? "bg-error" : "bg-success"}`}
    >
      {message}
      <button className="ml-4 text-white/80 hover:text-white" onClick={onClose}>
        ×
      </button>
    </div>
  );
}
