import { Activity, CreditCard, Home, LogOut, Server, Users } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Sidebar() {
  const { user, logout } = useAuth();

  const linkClassName = ({ isActive }) =>
    `flex items-center gap-3 rounded-2xl px-4 py-3 font-medium transition ${
      isActive
        ? "bg-[linear-gradient(135deg,var(--color-primary-soft),#f6fbf8)] text-[var(--color-primary-strong)] shadow-[0_10px_30px_rgba(31,122,76,0.12)]"
        : "text-[var(--color-text-soft)] hover:bg-white hover:text-[var(--color-text)]"
    }`;

  return (
    <aside className="app-panel flex w-full flex-col justify-between p-4 lg:w-[260px]">
      <div className="space-y-8">
        <div className="rounded-[24px] bg-[linear-gradient(135deg,#ffffff_0%,#eff5ef_100%)] p-5 soft-ring">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-primary-soft)] text-xl font-bold text-[var(--color-primary)]">
              C
            </div>
            <div>
              <div className="text-lg font-bold text-[var(--color-text)]">CompactPay</div>
              <div className="text-sm text-[var(--color-text-soft)]">Painel operacional</div>
            </div>
          </div>
        </div>

        <nav>
          <div className="px-3 pb-3 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-text-soft)]">
            Menu
          </div>
          <ul className="space-y-2">
            <li>
              <NavLink to="/" end className={linkClassName}>
                <Home /> Dashboard
              </NavLink>
            </li>
            <li>
              <NavLink to="/maquinas" className={linkClassName}>
                <Server /> Maquinas
              </NavLink>
            </li>
            <li>
              <NavLink to="/produtos" className={linkClassName}>
                <CreditCard /> Produtos
              </NavLink>
            </li>
            <li>
              <NavLink to="/transacoes" className={linkClassName}>
                <Activity /> Transacoes
              </NavLink>
            </li>
            {user?.role === "admin" && (
              <li>
                <NavLink to="/usuarios" className={linkClassName}>
                  <Users /> Usuarios
                </NavLink>
              </li>
            )}
          </ul>
        </nav>

        <div className="rounded-[28px] bg-[radial-gradient(circle_at_top,_rgba(52,148,92,0.35),transparent_35%),linear-gradient(145deg,#07160d_0%,#10331f_55%,#15512f_100%)] p-5 text-white shadow-[0_18px_48px_rgba(19,51,31,0.34)]">
          <div className="text-xs uppercase tracking-[0.28em] text-white/55">Conta</div>
          <div className="mt-3 text-lg font-semibold">{user?.email || "Operador"}</div>
          <div className="mt-1 text-sm text-white/70">
            {user?.role === "admin" ? "Administrador" : "Cliente"}
          </div>
          <div className="mt-6 rounded-full border border-white/15 bg-white/10 px-4 py-3 text-sm text-white/85">
            Gestao de maquinas, usuarios e desempenho financeiro em um unico painel.
          </div>
        </div>
      </div>

      <button
        onClick={logout}
        className="mt-5 flex items-center justify-center gap-2 rounded-full border border-[var(--color-border)] bg-white/90 px-4 py-3 font-semibold text-[var(--color-text)] transition hover:border-[var(--color-error)] hover:text-[var(--color-error)]"
      >
        <LogOut /> Sair
      </button>
    </aside>
  );
}
