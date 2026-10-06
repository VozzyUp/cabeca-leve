import Link from "next/link";

// Página provisória: as telas reais chegam no /replica-build
export default function Home() {
  return (
    <main className="mx-auto flex max-w-xl flex-1 flex-col justify-center gap-4 p-8">
      <h1 className="text-xl font-bold">Assistente pessoal</h1>
      <p className="text-body">Projeto em construção. O sistema visual está em <Link className="text-info underline" href="/design">/design</Link>.</p>
    </main>
  );
}
