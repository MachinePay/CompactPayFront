import { Home, Server, Users, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Sidebar() {
  const { user, logout } = useAuth();
  return (
    <aside className="bg-bgcard h-screen w-56 flex flex-col justify-between">
      <nav className="mt-8">
        <ul>
          <li>
            <a
              href="/dashboard"
              className="flex items-center gap-2 px-4 py-2 text-white hover:bg-primary rounded transition"
            >
              <Home /> Dashboard
            </a>
          </li>
          <li>
            <a
              href="/maquinas"
              className="flex items-center gap-2 px-4 py-2 text-white hover:bg-primary rounded transition"
            >
              <Server /> Máquinas
            </a>
          </li>
          {user?.role === "admin" && (
            <li>
              <a
                href="/usuarios"
                className="flex items-center gap-2 px-4 py-2 text-white hover:bg-primary rounded transition"
              >
                <Users /> Usuários
              </a>
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
