import { Activity, BarChart3, ClipboardList, CreditCard, Home, LogOut, QrCode, Server, Users } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/useAuth";

export default function Sidebar() {
  const { user, logout } = useAuth();

  const linkClassName = ({ isActive }) =>
    `flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition lg:gap-3 lg:rounded-2xl lg:px-4 lg:py-3 lg:text-base ${
      isActive
        ? "bg-[linear-gradient(135deg,var(--color-primary-soft),#f6fbf8)] text-[var(--color-primary-strong)] shadow-[0_10px_30px_rgba(31,122,76,0.12)]"
        : "text-[var(--color-text-soft)] hover:bg-white hover:text-[var(--color-text)]"
    }`;

  return (
    <aside className="app-panel flex w-full flex-col justify-between gap-3 p-3 lg:w-[260px] lg:p-4">
      <div className="space-y-3 lg:space-y-8">
        <div className="rounded-[18px] bg-[linear-gradient(135deg,#ffffff_0%,#eff5ef_100%)] p-3 soft-ring lg:rounded-[24px] lg:p-5">
          <div className="flex items-center gap-3">
            <img
              src="/logoCompactpay.jpeg"
              alt="CompactPay"
              className="h-10 w-10 rounded-2xl object-cover lg:h-12 lg:w-12"
            />
            <div className="min-w-0">
              <div className="truncate text-base font-bold text-[var(--color-text)] lg:text-lg">CompactPay</div>
              <div className="truncate text-xs text-[var(--color-text-soft)] lg:text-sm">Painel operacional</div>
            </div>
          </div>
        </div>

        <nav>
          <div className="hidden px-3 pb-3 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-text-soft)] lg:block">
            Menu
          </div>
          <ul className="flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-2 lg:overflow-visible lg:pb-0">
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
              <NavLink to="/relatorio-maquina" className={linkClassName}>
                <BarChart3 /> Relatorio Maquina
              </NavLink>
            </li>
            <li>
              <NavLink to="/produtos" className={linkClassName}>
                <CreditCard /> Produtos
              </NavLink>
            </li>
            <li>
              <NavLink to="/teste-pagamento" className={linkClassName}>
                <QrCode /> Teste Pagamento
              </NavLink>
            </li>
            <li>
              <NavLink to="/transacoes" className={linkClassName}>
                <Activity /> Transacoes
              </NavLink>
            </li>
            {user?.role === "admin" && (
              <>
                <li>
                  <NavLink to="/usuarios" className={linkClassName}>
                    <Users /> Usuarios
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/auditoria" className={linkClassName}>
                    <ClipboardList /> Auditoria
                  </NavLink>
                </li>
              </>
            )}
          </ul>
        </nav>

        <div className="hidden rounded-[28px] bg-[radial-gradient(circle_at_top,_rgba(52,148,92,0.35),transparent_35%),linear-gradient(145deg,#07160d_0%,#10331f_55%,#15512f_100%)] p-5 text-white shadow-[0_18px_48px_rgba(19,51,31,0.34)] lg:block">
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
        className="flex items-center justify-center gap-2 rounded-full border border-[var(--color-border)] bg-white/90 px-4 py-2 text-sm font-semibold text-[var(--color-text)] transition hover:border-[var(--color-error)] hover:text-[var(--color-error)] lg:mt-5 lg:py-3 lg:text-base"
      >
        <LogOut /> Sair
      </button>
    </aside>
  );
}
