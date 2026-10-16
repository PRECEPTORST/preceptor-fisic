import React from "react";

/**
 * Airbag global (padrão Cockpit). Exceção de render vira uma tela de erro com
 * botão de recarregar e detalhes técnicos, em vez de página branca. O registro
 * vai pro console com o prefixo [fisic-crash] e o último fica no localStorage.
 */
type Props = { children: React.ReactNode };
type State = { error: Error | null; info: string | null };

export class ErrorBoundary extends React.Component<Props, State> {
  override state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo) {
    const registro = {
      quando: new Date().toISOString(),
      url: window.location.href,
      erro: String(error?.message ?? error),
      stack: error?.stack ?? null,
      componente: info?.componentStack ?? null,
    };
    console.error("[fisic-crash]", registro);
    try {
      localStorage.setItem("fisic_ultimo_crash", JSON.stringify(registro));
    } catch {
      /* storage indisponível: o console já registrou */
    }
    this.setState({ info: info?.componentStack ?? null });
  }

  override render() {
    if (!this.state.error) return this.props.children;
    const { error, info } = this.state;
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg p-6">
        <div className="w-full max-w-xl rounded-lg border border-line bg-bg-elevated p-6 shadow-card">
          <p className="eyebrow mb-2">Algo quebrou nesta tela</p>
          <p className="mb-4 text-body text-ink-soft">
            O erro foi registrado. Recarregue para continuar. Se voltar a acontecer, mande um print desta caixa para o
            suporte.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mb-4 rounded-md bg-primary px-4 py-2 text-caption font-semibold text-primary-foreground"
          >
            Recarregar
          </button>
          <details className="text-caption text-ink-mute">
            <summary className="cursor-pointer">Detalhes técnicos</summary>
            <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap break-words rounded-md bg-bg-muted p-3 font-mono">
              {String(error?.message ?? error)}
              {"\n\n"}
              {error?.stack ?? ""}
              {info ? `\n\ncomponente:\n${info}` : ""}
            </pre>
          </details>
        </div>
      </div>
    );
  }
}
