import { Sidebar } from "./components/Sidebar";

export default function App() {
  return (
    <div className="flex h-full">
      <Sidebar />
      <main className="flex flex-1 items-center justify-center p-8">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Bienvenido a Botion</h1>
          <p className="mt-2 text-neutral-500">
            Abre una carpeta con notas Markdown para empezar.
          </p>
        </div>
      </main>
    </div>
  );
}
