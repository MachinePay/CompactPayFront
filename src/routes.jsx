import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/useAuth";

import Layout from "./components/Layout";
import LoadingSpinner from "./components/LoadingSpinner";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const AuditoriaSistema = lazy(() => import("./pages/AuditoriaSistema"));
const MaquinaHistorico = lazy(() => import("./pages/MaquinaHistorico"));
const RelatorioDetalhadoMaquina = lazy(() => import("./pages/RelatorioDetalhadoMaquina"));
const Maquinas = lazy(() => import("./pages/Maquinas"));
const Produtos = lazy(() => import("./pages/Produtos"));
const TestePagamento = lazy(() => import("./pages/TestePagamento"));
const Transacoes = lazy(() => import("./pages/Transacoes"));
const Usuarios = lazy(() => import("./pages/Usuarios"));
const Login = lazy(() => import("./pages/Login"));

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" />;
}

function RouteFallback() {
  return <LoadingSpinner className="min-h-screen" />;
}

function PrivatePage({ children }) {
  return (
    <PrivateRoute>
      <Layout>{children}</Layout>
    </PrivateRoute>
  );
}

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<PrivatePage><Dashboard /></PrivatePage>} />
          <Route path="/maquinas" element={<PrivatePage><Maquinas /></PrivatePage>} />
          <Route path="/maquinas/:machineId" element={<PrivatePage><MaquinaHistorico /></PrivatePage>} />
          <Route path="/relatorio-maquina" element={<PrivatePage><RelatorioDetalhadoMaquina /></PrivatePage>} />
          <Route path="/produtos" element={<PrivatePage><Produtos /></PrivatePage>} />
          <Route path="/teste-pagamento" element={<PrivatePage><TestePagamento /></PrivatePage>} />
          <Route path="/transacoes" element={<PrivatePage><Transacoes /></PrivatePage>} />
          <Route path="/usuarios" element={<PrivatePage><Usuarios /></PrivatePage>} />
          <Route path="/auditoria" element={<PrivatePage><AuditoriaSistema /></PrivatePage>} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
