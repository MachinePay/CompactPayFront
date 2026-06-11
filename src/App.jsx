import AppRoutes from "./routes";
import { AuthProvider } from "./context/AuthContext";
import "./styles/theme.css";
import "./index.css";
import { useState, useEffect } from "react";
import Toast from "./components/Toast";
import { addApiErrorListener } from "./api/axios";

export default function App() {
  const [toast, setToast] = useState({ message: "", type: "error", title: "", requestId: "" });

  useEffect(() => {
    const removeListener = addApiErrorListener((payload) => {
      if (typeof payload === "string") {
        setToast({ message: payload, type: "error", title: "Erro", requestId: "" });
        return;
      }
      setToast({
        message: payload.message,
        type: payload.type || "error",
        title: payload.title || "Erro",
        requestId: payload.requestId || "",
      });
    });
    return removeListener;
  }, []);

  return (
    <AuthProvider>
      <AppRoutes />
      <Toast
        message={toast.message}
        type={toast.type}
        title={toast.title}
        requestId={toast.requestId}
        onClose={() => setToast({ message: "", type: "error", title: "", requestId: "" })}
      />
    </AuthProvider>
  );
}
