import Link from "next/link";
import { LEGAL_UPDATED, type Section } from "@/lib/legal";

// Página de texto legal: títulos numerados, leitura confortável e sumário no topo
export function LegalPage({ title, intro, sections, other }: { title: string; intro: string; sections: Section[]; other: { href: string; label: string } }) {
  return (
    <article className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-text">{title}</h1>
        <p className="text-sm text-muted">Atualizado em {LEGAL_UPDATED}</p>
        <p className="text-body">{intro}</p>
      </header>
      <nav aria-label="Neste documento" className="rounded-lg border border-border bg-surface p-4">
        <ol className="grid list-decimal grid-cols-1 gap-1 pl-5 text-sm sm:grid-cols-2">
          {sections.map((s, i) => <li key={s.title}><a href={`#s${i + 1}`} className="text-body hover:text-text">{s.title}</a></li>)}
        </ol>
      </nav>
      {sections.map((s, i) => (
        <section key={s.title} id={`s${i + 1}`} aria-labelledby={`h${i + 1}`} className="flex scroll-mt-6 flex-col gap-3">
          <h2 id={`h${i + 1}`} className="text-lg font-semibold text-text">{i + 1}. {s.title}</h2>
          {s.body.map((b, j) => typeof b === "string"
            ? <p key={j} className="text-sm leading-relaxed text-body">{b}</p>
            : <ul key={j} className="flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed text-body">{b.list.map((li) => <li key={li}>{li}</li>)}</ul>)}
        </section>
      ))}
      <p className="text-sm text-muted">Veja também: <Link href={other.href} className="font-medium text-text underline">{other.label}</Link></p>
    </article>
  );
}
