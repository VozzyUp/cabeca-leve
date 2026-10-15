import {
  BellRing, Check, CircleSlash, Dumbbell, FileText, Globe, HeartHandshake, KeyRound, LifeBuoy, ReceiptText, ShieldCheck, Users, WalletCards, type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import conversa from "@/public/landing/conversa.png";
import { cn } from "@/components/ui/cn";
import { BRAND } from "@/lib/brand";
import { whatsappLimit } from "@/lib/limits";
import { PLANS, TRIAL_DAYS, yearlySaving } from "@/lib/plans";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { currentUser } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/time";
import { WHATSAPP_PROMISE } from "@/lib/whatsapp/promise";

// Sempre no pedido: no build não há banco nem sessão, e a página estática ficava presa no
// redirecionamento para /conversa (com cache de 1 ano), sem nunca mostrar o início a quem não entrou
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: `${BRAND.name} · seu assistente no WhatsApp e no app`, description: BRAND.description };

// Landing (replica/launch/landing.md): ângulo "o assistente que responde quando você precisa".
// Sem depoimento, número de usuários ou nota inventada; a captura é do app de verdade.
const cta = "inline-flex h-12 items-center justify-center rounded-md px-6 text-base font-semibold";
const primary = "bg-accent text-on-accent hover:opacity-90";
const secondary = "border border-border text-text hover:bg-surface-2";

const PROBLEMS: { title: string; text: string }[] = [
  { title: "Você pagou e ficou sem resposta", text: "Acesso que não libera, suporte que é só robô e cobrança que continua depois de cancelar." },
  { title: "Você anota e ele não acha", text: "Lembrete que não chega e relatório que não bate com o que você lançou." },
];

const STEPS = [
  ["Crie a conta", `${TRIAL_DAYS} dias grátis, sem cartão.`],
  ["Vincule o WhatsApp", "Você conversa com o número do assistente."],
  ["Fale do seu jeito", "Texto, áudio ou foto. Ele organiza e confirma com um card que dá para desfazer."],
];

// Cada item é uma correção do fixes.md (F1 a F7); o que é preço de entrada fica na linha de baixo
const FIXES: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: LifeBuoy, title: "Uma pessoa de verdade", text: "Peça na conversa ou em Configurações: o chamado tem protocolo e alguém do time responde em até 1 dia útil. O assistente nunca finge ser o suporte." },
  { icon: CircleSlash, title: "Cancelou, parou", text: "Um toque em Configurações e o comprovante com protocolo sai na hora. Se uma cobrança chegar depois, ela é estornada sozinha." },
  { icon: Check, title: "Pagou, entrou", text: "Enquanto o pagamento confirma, o acesso continua. Nada de “assinatura inválida”." },
  { icon: BellRing, title: "Lembrete que chega", text: "No celular e no WhatsApp, com Feito e Adiar. Dá para testar o aviso na hora, em Configurações." },
  { icon: ReceiptText, title: "Conta que bate", text: "Os totais vêm do que você lançou, não de um palpite da IA. O teto por categoria avisa em 80% e em 100%." },
  { icon: ShieldCheck, title: "Seu WhatsApp fica intacto", text: "Você manda mensagem para o assistente. Ele não entra na sua conta nem escreve para os seus contatos." },
];

const ALSO: { icon: LucideIcon; text: string }[] = [
  { icon: WalletCards, text: "contas fixas, parcelas e cartões" },
  { icon: Dumbbell, text: "treino, alimentação e metas" },
  { icon: Globe, text: "pesquisa diária na internet" },
  { icon: FileText, text: "notas e pedidos médicos para reembolso" },
  { icon: KeyRound, text: "cofre de senhas" },
  { icon: Users, text: "conta para o casal ou a família" },
  { icon: HeartHandshake, text: "o tom que combina com você" },
];

const FAQ: [string, string][] = [
  ["Posso testar antes de pagar?", `Sim, ${TRIAL_DAYS} dias, sem cartão. No fim, você escolhe se assina. Tudo o que anotou continua guardado.`],
  ["E se eu quiser cancelar?", "Um toque em Configurações. Comprovante na hora, nenhuma cobrança nova e acesso até o fim do período pago. Cobrança que chegar depois é estornada sozinha."],
  ["Vocês acessam o meu WhatsApp?", WHATSAPP_PROMISE],
  ["Paguei e não liberou. E agora?", "O acesso continua enquanto o pagamento confirma. Se algo travar, peça uma pessoa: o chamado tem protocolo e prazo."],
  ["Consigo trazer o que eu já tenho em outro app?", "Ainda não há importação automática. Mande a lista de contas fixas e lembretes pela conversa, que ele cadastra."],
  ["A IA pode errar?", "Pode. Cada coisa que ela registra vem num card com Desfazer, e os totais vêm do que foi lançado."],
];

const waText = (n: number) => (n === 1 ? "1 WhatsApp" : `até ${n} WhatsApps`);

export default async function Page() {
  // quem já entrou segue direto para a conversa; sem o banco ligado (demonstração) também
  if (!isSupabaseConfigured() || (await currentUser())) redirect("/conversa");
  return (
    <div className="flex flex-col gap-20">
      <section aria-labelledby="titulo" className="grid items-center gap-10 pt-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="flex flex-col items-start gap-5">
          <h1 id="titulo" className="text-4xl font-bold leading-tight text-text sm:text-5xl">
            Seu assistente no WhatsApp. E uma pessoa de verdade quando você precisar.
          </h1>
          <p className="max-w-xl text-lg text-body">
            Tarefas, lembretes e dinheiro numa conversa. {TRIAL_DAYS} dias grátis sem cartão, cancelamento em um toque com comprovante.
          </p>
          <Link href="/entrar?modo=criar" className={cn(cta, primary)}>Começar {TRIAL_DAYS} dias grátis</Link>
          <p className="text-sm text-muted">{WHATSAPP_PROMISE}</p>
        </div>
        <Image src={conversa} alt="O app de verdade: na conversa, um lembrete e uma tarefa criados a partir de frases comuns, cada um com o botão Desfazer"
          priority sizes="(min-width: 1024px) 380px, 90vw" className="mx-auto w-full max-w-[380px] rounded-2xl border border-border shadow-pop" />
      </section>

      <section aria-labelledby="problema" className="flex flex-col gap-6">
        <h2 id="problema" className="text-2xl font-bold text-text">Assistente que some na hora que você mais precisa</h2>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {PROBLEMS.map((p) => (
            <li key={p.title} className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-5">
              <h3 className="font-semibold text-text">{p.title}</h3>
              <p className="text-sm text-body">{p.text}</p>
            </li>
          ))}
        </ul>
        <p className="text-body">Aqui é diferente desde o primeiro dia.</p>
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

      <section aria-labelledby="diferente" className="flex flex-col gap-6">
        <h2 id="diferente" className="text-2xl font-bold text-text">O que você pode cobrar da gente</h2>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FIXES.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-5">
              <Icon aria-hidden className="size-6 text-accent" />
              <h3 className="font-semibold text-text">{title}</h3>
              <p className="text-sm text-body">{text}</p>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-text">E o resto que você espera de um assistente:</p>
          <ul className="flex flex-wrap gap-2">
            {ALSO.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-sm text-body">
                <Icon aria-hidden className="size-4 text-muted" />{text}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="preco" className="flex flex-col gap-6">
        <h2 id="preco" className="text-2xl font-bold text-text">Um preço simples</h2>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[PLANS.monthly, PLANS.yearly].map((p) => {
            const yearly = p.id === "yearly";
            return (
              <li key={p.id} className={cn("flex flex-col gap-3 rounded-lg border bg-surface p-6", yearly ? "border-accent" : "border-border")}>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-text">{p.name}</h3>
                  {yearly && <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-on-accent">economize {Math.round(yearlySaving * 100)}%</span>}
                </div>
                <p><span className="font-mono text-3xl font-semibold text-text">{formatMoney(p.priceCents)}</span> <span className="text-sm text-muted">{p.period}</span></p>
                <p className="text-sm text-body">{yearly ? "pagamento único no Pix ou no cartão, sem renovação automática" : "no cartão, cancele quando quiser"}</p>
                <p className="flex items-center gap-2 text-sm text-body"><Check aria-hidden className="size-4 text-success" />{waText(whatsappLimit(p.id))} e tudo do app</p>
              </li>
            );
          })}
        </ul>
        <p className="text-sm text-muted">{TRIAL_DAYS} dias grátis antes de qualquer cobrança. <Link href="/planos" className="font-medium text-text underline">Ver os planos</Link></p>
      </section>

      <section aria-labelledby="duvidas" className="flex flex-col gap-4">
        <h2 id="duvidas" className="text-2xl font-bold text-text">Dúvidas</h2>
        <div className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group px-4 py-3">
              <summary className="cursor-pointer text-sm font-medium text-text">{q}</summary>
              <p className="mt-2 text-sm text-body">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <section aria-labelledby="final" className="flex flex-col items-center gap-4 rounded-lg border border-border bg-surface p-8 text-center">
        <h2 id="final" className="text-2xl font-bold text-text">Tire a vida da cabeça hoje</h2>
        <p className="text-body">Comece pelo que está pesando agora: uma conta, um lembrete, uma tarefa.</p>
        <Link href="/entrar?modo=criar" className={cn(cta, primary)}>Começar {TRIAL_DAYS} dias grátis</Link>
        <Link href="/entrar" className={cn(cta, secondary, "h-10 text-sm")}>Já tenho conta</Link>
      </section>
    </div>
  );
}
