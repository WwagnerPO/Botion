import { Component, type ReactNode } from "react";

/**
 * Si algo falla al dibujar la interfaz, muestra el error y un botón para
 * recargar en lugar de dejar la ventana en blanco. Las notas ya están
 * guardadas en disco.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold">Algo ha fallado en la ventana</h1>
          <p className="mt-2 text-sm text-neutral-500">
            Tus notas están guardadas. Recarga para seguir; si vuelve a pasar, copia este mensaje.
          </p>
          <pre className="mt-4 max-h-40 overflow-auto rounded-md bg-neutral-100 p-3 text-left text-xs whitespace-pre-wrap dark:bg-neutral-800">
            {error.message}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
          >
            Recargar
          </button>
        </div>
      </div>
    );
  }
}
