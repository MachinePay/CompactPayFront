import {
  Activity,
  BarChart3,
  ClipboardList,
  Cpu,
  CreditCard,
  Home,
  LogOut,
  Menu,
  QrCode,
  Server,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/useAuth";

export default function Sidebar() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const linkClassName = ({ isActive }) =>
    `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition lg:text-base ${
      isActive
        ? "bg-[linear-gradient(135deg,var(--color-primary-soft),#f6fbf8)] text-[var(--color-primary-strong)] shadow-[0_10px_30px_rgba(31,122,76,0.12)]"
        : "text-[var(--color-text-soft)] hover:bg-white hover:text-[var(--color-text)]"
    }`;

  const closeMobile = () => setMobileOpen(false);

  const navItems = (
    <ul className="space-y-2">
      <li>
        <NavLink to="/" end className={linkClassName} onClick={closeMobile}>
          <Home size={20} /> Dashboard
        </NavLink>
      </li>
      <li>
        <NavLink to="/maquinas" className={linkClassName} onClick={closeMobile}>
          <Server size={20} /> Maquinas
        </NavLink>
      </li>
      <li>
        <NavLink
          to="/relatorio-maquina"
          className={linkClassName}
          onClick={closeMobile}
        >
          <BarChart3 size={20} /> Relatorio Maquina
        </NavLink>
      </li>
      <li>
        <NavLink
          to="/teste-pagamento"
          className={linkClassName}
          onClick={closeMobile}
        >
          <QrCode size={20} /> Teste Pagamento
        </NavLink>
      </li>
      <li>
        <NavLink
          to="/transacoes"
          className={linkClassName}
          onClick={closeMobile}
        >
          <Activity size={20} /> Transacoes
        </NavLink>
      </li>
      {user?.role === "admin" && (
        <>
          <li>
            <NavLink
              to="/usuarios"
              className={linkClassName}
              onClick={closeMobile}
            >
              <Users size={20} /> Usuarios
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/firmwares"
              className={linkClassName}
              onClick={closeMobile}
            >
              <Cpu size={20} /> Firmwares
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/auditoria"
              className={linkClassName}
              onClick={closeMobile}
            >
              <ClipboardList size={20} /> Auditoria
            </NavLink>
          </li>
        </>
      )}
    </ul>
  );

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-[var(--color-border)] bg-white/95 px-3 py-2 shadow-[0_8px_24px_rgba(34,61,43,0.08)] backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <img
              src="/logoCompactpay.jpeg"
              alt="CompactPay"
              className="h-9 w-9 rounded-xl object-cover"
            />
            <div className="min-w-0">
              <div className="truncate text-sm font-extrabold text-[var(--color-text)]">
                CompactPay
              </div>
              <div className="truncate text-[11px] font-medium text-[var(--color-text-soft)]">
                {user?.role === "admin" ? "Administrador" : "Cliente"}
              </div>
            </div>
          </div>
          <button
            type="button"
            aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--color-border)] bg-white text-[var(--color-text)]"
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>

      {mobileOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/28 lg:hidden"
          onClick={closeMobile}
        >
          <aside
            className="absolute bottom-0 right-0 top-[58px] flex w-[min(86vw,340px)] flex-col justify-between overflow-y-auto rounded-l-[22px] border-l border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 shadow-[0_20px_70px_rgba(0,0,0,0.22)]"
            onClick={(event) => event.stopPropagation()}
          >
            <nav>
              <div className="px-2 pb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-text-soft)]">
                Menu
              </div>
              {navItems}
            </nav>
            <button
              onClick={logout}
              className="mt-5 flex items-center justify-center gap-2 rounded-full border border-[var(--color-border)] bg-white/90 px-4 py-3 text-sm font-semibold text-[var(--color-text)]"
            >
              <LogOut size={18} /> Sair
            </button>
          </aside>
        </div>
      ) : null}

      <aside className="app-panel hidden w-[260px] flex-col justify-between gap-3 p-4 lg:flex">
        <div className="space-y-3 lg:space-y-8">
          <div className="rounded-[18px] bg-[linear-gradient(135deg,#ffffff_0%,#eff5ef_100%)] p-3 soft-ring lg:rounded-[24px] lg:p-5">
            <div className="flex items-center gap-3">
              <img
                src="/logoCompactpay.jpeg"
                alt="CompactPay"
                className="h-10 w-10 rounded-2xl object-cover lg:h-12 lg:w-12"
              />
              <div className="min-w-0">
                <div className="truncate text-base font-bold text-[var(--color-text)] lg:text-lg">
                  CompactPay
                </div>
                <div className="truncate text-xs text-[var(--color-text-soft)] lg:text-sm">
                  Painel operacional
                </div>
              </div>
            </div>
          </div>

          <nav>
            <div className="hidden px-3 pb-3 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-text-soft)] lg:block">
              Menu
            </div>
            {navItems}
          </nav>

          <div className="hidden rounded-[28px] bg-[radial-gradient(circle_at_top,_rgba(52,148,92,0.35),transparent_35%),linear-gradient(145deg,#07160d_0%,#10331f_55%,#15512f_100%)] p-5 text-white shadow-[0_18px_48px_rgba(19,51,31,0.34)] lg:block">
            <div className="text-xs uppercase tracking-[0.28em] text-white/55">
              Conta
            </div>
            <div className="mt-3 text-lg font-semibold">
              {user?.email || "Operador"}
            </div>
            <div className="mt-1 text-sm text-white/70">
              {user?.role === "admin" ? "Administrador" : "Cliente"}
            </div>
            <div className="mt-6 rounded-full border border-white/15 bg-white/10 px-4 py-3 text-sm text-white/85">
              Gestao de maquinas, usuarios e desempenho financeiro em um unico
              painel.
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
    </>
  );
}
