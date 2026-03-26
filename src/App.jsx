import AppRoutes from "./routes";
import { AuthProvider } from "./context/AuthContext";
import "./styles/theme.css";
import "./index.css";
import { useState, useEffect } from "react";
import Toast from "./components/Toast";
import { addApiErrorListener } from "./api/axios";

export default function App() {
  const [toast, setToast] = useState("");

  useEffect(() => {
    addApiErrorListener((msg) => {
      setToast(msg);
    });
  }, []);

  return (
    <AuthProvider>
      <AppRoutes />
      <Toast message={toast} onClose={() => setToast("")} />
    </AuthProvider>
  );
}
