import { ArrowLeft, Home } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <section className="app-panel max-w-2xl rounded-[30px] p-8 text-center md:p-10">
        <div className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--color-text-soft)]">
          Pagina nao encontrada
        </div>
        <h1 className="mt-3 text-4xl font-extrabold tracking-[-0.05em] text-[var(--color-text)] md:text-5xl">
          Esse caminho nao existe
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-[var(--color-text-soft)] md:text-base">
          Verifique o endereco acessado ou volte para uma area principal do painel.
        </p>

        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            className="pill-button inline-flex items-center justify-center gap-2 px-5 py-3 font-semibold"
            type="button"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft size={16} />
            Voltar
          </button>
          <Link
            className="pill-button pill-button--primary inline-flex items-center justify-center gap-2 px-5 py-3 font-semibold"
            to="/"
          >
            <Home size={16} />
            Dashboard
          </Link>
        </div>
      </section>
    </div>
  );
}
