import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./context/useAuth";

import Layout from "./components/Layout";
import LoadingSpinner from "./components/LoadingSpinner";
import RouteErrorBoundary from "./components/RouteErrorBoundary";

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
const NotFound = lazy(() => import("./pages/NotFound"));

function PrivateRoute({ children }) {
  const { user } = useAuth();
  const location = useLocation();

  return user ? children : <Navigate to="/login" replace state={{ from: location }} />;
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

function AccessDenied() {
  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <section className="app-panel max-w-xl rounded-[30px] p-8 text-center">
        <div className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--color-text-soft)]">
          Acesso restrito
        </div>
        <h1 className="mt-3 text-3xl font-extrabold tracking-[-0.04em] text-[var(--color-text)]">
          Voce nao tem permissao para abrir esta tela
        </h1>
        <p className="mt-3 text-sm leading-7 text-[var(--color-text-soft)]">
          Use uma conta administradora para acessar esta area do painel.
        </p>
      </section>
    </div>
  );
}

function AdminPage({ children }) {
  const { user } = useAuth();

  return (
    <PrivatePage>
      {user?.role === "admin" ? children : <AccessDenied />}
    </PrivatePage>
  );
}

function RouteContent() {
  const location = useLocation();

  return (
    <RouteErrorBoundary resetKey={location.pathname}>
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
          <Route path="/usuarios" element={<AdminPage><Usuarios /></AdminPage>} />
          <Route path="/auditoria" element={<AdminPage><AuditoriaSistema /></AdminPage>} />
          <Route path="*" element={<PrivatePage><NotFound /></PrivatePage>} />
        </Routes>
      </Suspense>
    </RouteErrorBoundary>
  );
}

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <RouteContent />
    </BrowserRouter>
  );
}
