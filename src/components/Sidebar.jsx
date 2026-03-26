import { Home, LogOut, Server, Users } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Sidebar() {
  const { user, logout } = useAuth();

  const linkClassName = ({ isActive }) =>
    `flex items-center gap-2 px-4 py-2 text-white rounded transition ${
      isActive ? "bg-primary" : "hover:bg-primary"
    }`;

  return (
    <aside className="bg-bgcard h-screen w-56 flex flex-col justify-between">
      <nav className="mt-8">
        <ul>
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
          {user?.role === "admin" && (
            <li>
              <NavLink to="/usuarios" className={linkClassName}>
                <Users /> Usuarios
              </NavLink>
            </li>
          )}
        </ul>
      </nav>
      <button
        onClick={logout}
        className="flex items-center gap-2 px-4 py-2 mb-4 text-white hover:bg-error rounded transition"
      >
        <LogOut /> Sair
      </button>
    </aside>
  );
}
