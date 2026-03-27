import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

import Dashboard from "./pages/Dashboard";
import MaquinaHistorico from "./pages/MaquinaHistorico";
import Maquinas from "./pages/Maquinas";
import Produtos from "./pages/Produtos";
import Transacoes from "./pages/Transacoes";
import Usuarios from "./pages/Usuarios";
import Login from "./pages/Login";
import Layout from "./components/Layout";

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" />;
}

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout>
                <Dashboard />
              </Layout>
            </PrivateRoute>
          }
        />
        <Route
          path="/maquinas"
          element={
            <PrivateRoute>
              <Layout>
                <Maquinas />
              </Layout>
            </PrivateRoute>
          }
        />
        <Route
          path="/maquinas/:machineId"
          element={
            <PrivateRoute>
              <Layout>
                <MaquinaHistorico />
              </Layout>
            </PrivateRoute>
          }
        />
        <Route
          path="/produtos"
          element={
            <PrivateRoute>
              <Layout>
                <Produtos />
              </Layout>
            </PrivateRoute>
          }
        />
        <Route
          path="/transacoes"
          element={
            <PrivateRoute>
              <Layout>
                <Transacoes />
              </Layout>
            </PrivateRoute>
          }
        />
        <Route
          path="/usuarios"
          element={
            <PrivateRoute>
              <Layout>
                <Usuarios />
              </Layout>
            </PrivateRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
