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
    const removeListener = addApiErrorListener((msg) => {
      setToast(msg);
    });
    return removeListener;
  }, []);

  return (
    <AuthProvider>
      <AppRoutes />
      <Toast message={toast} onClose={() => setToast("")} />
    </AuthProvider>
  );
}
