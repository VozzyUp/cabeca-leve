import { CalendarClock, Camera, Mic, PiggyBank, Repeat, Dumbbell, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cn } from "@/components/ui/cn";
import { BRAND } from "@/lib/brand";
import { PLANS, TRIAL_DAYS } from "@/lib/plans";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { currentUser } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/time";
import { WHATSAPP_PROMISE } from "@/lib/whatsapp/promise";

export const metadata: Metadata = { title: `${BRAND.name} · seu assistente no WhatsApp e no app`, description: BRAND.description };

const cta = "inline-flex h-12 items-center justify-center rounded-md px-6 text-base font-semibold";

// Exemplo de conversa: mostra o que o assistente faz, sem inventar depoimento
const DEMO: { from: "me" | "bot"; text: string }[] = [
  { from: "me", text: "gastei 48 no mercado e me lembra de pagar a luz sexta" },
  { from: "bot", text: "Pronto. Anotei R$ 48,00 em Mercado e criei o lembrete “Pagar a luz” para sexta, às 9h. Errei algo? Toque em Desfazer." },
  { from: "me", text: "monta um treino de 3 dias pra mim" },
  { from: "bot", text: "Montei um treino ABC para segunda, quarta e sexta, com 4 exercícios por dia. Quer que eu te lembre de cada treino?" },
];

const FEATURES: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: CalendarClock, title: "Lembretes que chegam", text: "No WhatsApp, com botões para marcar como feito ou adiar. Também no celular, mesmo com o app fechado." },
  { icon: PiggyBank, title: "Dinheiro sem planilha", text: "Escreva o gasto como falaria. Contas fixas, parcelas, tetos por categoria e o que falta resolver no mês." },
  { icon: Mic, title: "Texto, áudio e foto", text: "Mande um áudio ou uma foto de uma nota. O assistente entende e registra." },
  { icon: Dumbbell, title: "Treino, dieta e metas", text: "Peça um plano pela conversa e acompanhe peso, medidas, hábitos e projetos." },
  { icon: Repeat, title: "Rotina no automático", text: "Resumo da manhã e revisões que você agenda, como “todo domingo, um balanço da semana”." },
  { icon: Camera, title: "Ele lembra de você", text: "Guarda o que importa (alergias, preferências) e você vê e apaga tudo em Ajustes." },
];

const STEPS = [
  ["Crie a conta", `Leva um minuto. São ${TRIAL_DAYS} dias grátis, sem compromisso.`],
  ["Vincule o WhatsApp", "Você conversa com o número do assistente. Ele nunca acessa as suas conversas."],
  ["Fale do jeito que for", "Escreva, mande áudio ou foto. O resto o assistente organiza."],
];

export default async function Page() {
  // quem já entrou segue direto para a conversa; sem o banco ligado (demonstração) também
  if (!isSupabaseConfigured() || (await currentUser())) redirect("/conversa");
  return (
    <div className="flex flex-col gap-20">
      <section aria-labelledby="titulo" className="grid items-center gap-10 pt-4 lg:grid-cols-2">
        <div className="flex flex-col items-start gap-5">
          <h1 id="titulo" className="text-4xl font-bold leading-tight text-text sm:text-5xl">Tire a vida da cabeça</h1>
          <p className="max-w-lg text-lg text-body">Tarefas, lembretes, dinheiro e rotina numa conversa só, no WhatsApp e no app. Fale do seu jeito e o assistente organiza.</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/entrar?modo=criar" className={cn(cta, "bg-accent text-on-accent hover:opacity-90")}>Começar {TRIAL_DAYS} dias grátis</Link>
            <Link href="/planos" className={cn(cta, "border border-border text-text hover:bg-surface-2")}>Ver planos</Link>
          </div>
          <p className="text-sm text-muted">{WHATSAPP_PROMISE}</p>
        </div>
        <div role="img" aria-label="Exemplo de conversa com o assistente" className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-card">
          {DEMO.map((m, i) => (
            <p key={i} className={cn("max-w-[85%] rounded-2xl px-4 py-2 text-sm", m.from === "me" ? "self-end bg-accent text-on-accent" : "self-start bg-surface-2 text-text")}>{m.text}</p>
          ))}
        </div>
      </section>

      <section aria-labelledby="funcoes" className="flex flex-col gap-6">
        <h2 id="funcoes" className="text-2xl font-bold text-text">Tudo numa conversa</h2>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-5">
              <Icon aria-hidden className="size-6 text-accent" />
              <h3 className="font-semibold text-text">{title}</h3>
              <p className="text-sm text-body">{text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="como" className="flex flex-col gap-6">
        <h2 id="como" className="text-2xl font-bold text-text">Como começa</h2>
        <ol className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {STEPS.map(([title, text], i) => (
            <li key={title} className="flex flex-col gap-2">
              <span className="flex size-8 items-center justify-center rounded-full bg-accent font-mono text-sm font-semibold text-on-accent">{i + 1}</span>
              <h3 className="font-semibold text-text">{title}</h3>
              <p className="text-sm text-body">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="preco" className="flex flex-col items-center gap-4 rounded-lg border border-border bg-surface p-8 text-center">
        <h2 id="preco" className="text-2xl font-bold text-text">Um preço simples</h2>
        <p className="text-body">
          <span className="font-mono text-3xl font-semibold text-text">{formatMoney(PLANS.monthly.priceCents)}</span> por mês, ou{" "}
          <span className="font-mono text-3xl font-semibold text-text">{formatMoney(PLANS.yearly.priceCents)}</span> por ano.
        </p>
        <p className="text-sm text-muted">{TRIAL_DAYS} dias grátis. Cancele quando quiser, com um toque, e receba o comprovante na hora.</p>
        <Link href="/entrar?modo=criar" className={cn(cta, "bg-accent text-on-accent hover:opacity-90")}>Começar {TRIAL_DAYS} dias grátis</Link>
      </section>
    </div>
  );
}
