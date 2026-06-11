import { Component } from "react";
import { RefreshCcw } from "lucide-react";

export default class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidUpdate(previousProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] p-6">
        <section className="app-panel max-w-xl rounded-[30px] p-8 text-center">
          <div className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--color-text-soft)]">
            Atualizacao necessaria
          </div>
          <h1 className="mt-3 text-3xl font-extrabold tracking-[-0.04em] text-[var(--color-text)]">
            Nao foi possivel carregar esta tela
          </h1>
          <p className="mt-3 text-sm leading-7 text-[var(--color-text-soft)]">
            Recarregue o painel para buscar a versao mais recente do sistema.
          </p>
          <button
            className="pill-button pill-button--primary mt-6 inline-flex items-center justify-center gap-2 px-5 py-3 font-semibold"
            type="button"
            onClick={this.handleReload}
          >
            <RefreshCcw size={16} />
            Recarregar painel
          </button>
        </section>
      </main>
    );
  }
}
