"use client";
import { Inbox, Plus } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { ActionCard } from "@/components/ui/action-card";
import { Button, IconButton } from "@/components/ui/button";
import { Card, SectionLabel } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Composer } from "@/components/ui/composer";
import { CheckItem, EmptyState, Metric, Progress, Toast } from "@/components/ui/data";
import { Field } from "@/components/ui/field";
import { Message, Steps } from "@/components/ui/message";
import { BottomNav, NavRail } from "@/components/ui/nav";
import { Segmented } from "@/components/ui/segmented";
import { Tabs } from "@/components/ui/tabs";

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-text">{title}</h2>
      {children}
    </section>
  );
}

// Vitrine do sistema visual: cada componente com seus estados, isolado das telas
export default function DesignPage() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [range, setRange] = useState<"day" | "week" | "month">("day");
  const [tab, setTab] = useState("summary");
  const [chips, setChips] = useState({ agenda: true, money: true, forecast: false });
  const [checks, setChecks] = useState([false, true, false]);
  const [undone, setUndone] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <div className="flex flex-1">
      <div className="hidden lg:flex"><NavRail /></div>
      <main className="mx-auto flex w-full max-w-[1120px] flex-col gap-10 px-4 py-8 pb-28 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-label text-muted">Sistema visual</p>
            <h1 className="text-[28px] font-bold leading-[34px]">Componentes</h1>
          </div>
          <Segmented label="Tema" value={theme} onChange={setTheme}
            options={[{ value: "dark", label: "Escuro" }, { value: "light", label: "Claro" }]} />
        </header>

        <Block title="Botões">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Primário</Button>
            <Button variant="secondary">Secundário</Button>
            <Button variant="ghost">Discreto</Button>
            <Button variant="danger">Apagar</Button>
            <Button loading>Salvando</Button>
            <Button disabled>Desativado</Button>
            <Button size="sm" icon={<Plus className="size-4" />}>Novo</Button>
            <Button size="lg">Grande</Button>
            <IconButton label="Avisos" badge={4}><Inbox className="size-5" /></IconButton>
          </div>
        </Block>

        <Block title="Conversa">
          <Card className="flex max-w-[760px] flex-col gap-4">
            <Message from="user">Paguei 42 no almoço e me avisa da academia amanhã às 7h</Message>
            <Steps steps={[{ label: "Salvando o gasto", done: true }, { label: "Criando o aviso", done: false }]} />
            <div className="grid gap-3 sm:grid-cols-2">
              <ActionCard kind="Gasto" title="Almoço" value="−R$ 42,00" valueTone="expense"
                meta="Hoje · Alimentação · Pix" openLabel="Ver no extrato" onOpen={() => {}}
                state={undone ? "undone" : "created"} onUndo={() => setUndone(true)} />
              <ActionCard kind="Lembrete" title="Ir à academia" value="07:00" meta="Amanhã · celular e WhatsApp"
                openLabel="Ver nos lembretes" onOpen={() => {}} onUndo={() => {}} />
              <ActionCard kind="Tarefa" title="Enviar proposta" state="error" />
            </div>
            <Message from="assistant">Pronto: o almoço entrou em Alimentação e o aviso da academia toca amanhã às 7h.</Message>
            <Message from="user" status="error">Quanto gastei esta semana?</Message>
            <Composer onSend={() => {}} />
            <Composer onSend={() => {}} offline />
          </Card>
        </Block>

        <Block title="Seleção e filtros">
          <div className="flex flex-wrap items-center gap-4">
            <Segmented label="Período" value={range} onChange={setRange}
              options={[{ value: "day", label: "Dia" }, { value: "week", label: "Semana" }, { value: "month", label: "Mês" }]} />
            <div className="flex gap-2">
              <Chip selected={chips.agenda} onClick={() => setChips({ ...chips, agenda: !chips.agenda })}>Agenda</Chip>
              <Chip selected={chips.money} onClick={() => setChips({ ...chips, money: !chips.money })}>Dinheiro</Chip>
              <Chip selected={chips.forecast} onClick={() => setChips({ ...chips, forecast: !chips.forecast })}>Previsão</Chip>
            </div>
          </div>
          <Tabs label="Dinheiro" value={tab} onChange={setTab} tabs={[
            { id: "summary", label: "Resumo", content: (
              <div className="grid gap-6 sm:grid-cols-3">
                <Metric label="Entrou em outubro" value="R$ 8.200,00" tone="income" hint="falta receber R$ 0" />
                <Metric label="Saiu em outubro" value="R$ 5.430,90" tone="expense" hint="R$ 310 previstos" />
                <Metric label="Sobra do mês" value="R$ 2.769,10" hint="entrou menos saiu" />
              </div>) },
            { id: "variable", label: "Gastos do dia a dia", content: <p className="text-sm text-body">Gráfico por dia e categoria (chega no build).</p> },
            { id: "recurring", label: "Fixos", content: <p className="text-sm text-body">Assinaturas e contas fixas.</p> },
            { id: "installments", label: "Parcelas", content: <p className="text-sm text-body">Compras parceladas.</p> },
          ]} />
        </Block>

        <Block title="Listas e progresso">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <SectionLabel className="mb-2">Hoje</SectionLabel>
              {["Revisar contrato", "Comprar ração", "Ligar para o banco"].map((t, i) => (
                <CheckItem key={t} title={t} meta={["14:00", "sem horário", "ontem"][i]} overdue={i === 2}
                  done={checks[i]} onToggle={() => setChecks(checks.map((c, j) => (j === i ? !c : c)))} />
              ))}
            </Card>
            <Card className="flex flex-col gap-4">
              <Progress label="Reserva de emergência" value={7200} max={12000} display="R$ 7.200 de R$ 12.000" />
              <Progress label="Leitura no mês" value={9} max={20} display="9 de 20 dias" />
            </Card>
          </div>
        </Block>

        <Block title="Formulário">
          <Card className="grid max-w-xl gap-4">
            <Field label="Descrição" placeholder="Ex.: conta de luz" />
            <Field label="Valor" inputMode="decimal" defaultValue="abc" error="Use só números, como 120,50." />
            <Field label="Vencimento" type="date" hint="Avisamos 2 dias antes." />
          </Card>
        </Block>

        <Block title="Vazio e avisos">
          <div className="grid gap-6 md:grid-cols-2">
            <EmptyState icon={<Inbox className="size-8" />} title="Nenhum hábito ainda"
              text="Diga na conversa o que quer começar, por exemplo: quero ler 15 minutos por dia."
              action={<Button size="sm">Criar hábito</Button>} />
            <div className="flex items-start"><Toast action={<Button size="sm" variant="ghost">Desfazer</Button>}>Tarefa concluída.</Toast></div>
          </div>
        </Block>
      </main>
      <div className="fixed inset-x-4 bottom-4 lg:hidden"><BottomNav /></div>
    </div>
  );
}
