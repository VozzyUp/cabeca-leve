"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { adminDeleteAccount, adminEndPlan, adminSetPlan, adminSetTrial } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, SectionLabel } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { MAX_PLAN_DAY, renewFrom } from "@/lib/domain/accounts";

type Notice = { tone: "ok" | "error"; text: string } | null;
const select = "h-10 rounded-md border border-border-input bg-bg px-3 text-sm text-text";

// Ações do time numa conta: plano manual (dar, renovar, trocar, encerrar), teste e exclusão
export function AccountControls({ userId, email, manual, plan, until, trialEndsOn, today, isTeam }: {
  userId: string; email: string; manual: boolean; plan: "monthly" | "yearly" | null; until: string | null; trialEndsOn: string; today: string; isTeam: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [notice, setNotice] = useState<Notice>(null);
  const [planChoice, setPlanChoice] = useState<"monthly" | "yearly">(plan ?? "monthly");
  const [planEnd, setPlanEnd] = useState(until && until > today ? until : renewFrom(null, today, 30));
  const [trialEnd, setTrialEnd] = useState(trialEndsOn);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [typed, setTyped] = useState("");

  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>, done: string, after?: () => void) {
    setNotice(null);
    start(async () => {
      try {
        const r = await fn();
        if (r.ok) { setNotice({ tone: "ok", text: done }); router.refresh(); after?.(); }
        else setNotice({ tone: "error", text: r.error });
      } catch { setNotice({ tone: "error", text: "Não deu para salvar. Tente de novo." }); }
    });
  }

  return (
    <>
      {notice && <p role={notice.tone === "error" ? "alert" : "status"} className={notice.tone === "error" ? "text-sm text-danger" : "text-sm text-success"}>{notice.text}</p>}

      <Card className="flex flex-col gap-4">
        <SectionLabel>Plano manual</SectionLabel>
        <p className="text-sm text-body">Dá acesso sem cobrar: vale como um plano pago, até o dia escolhido. Serve para cortesia, parceria, renovar quem pagou fora ou corrigir um problema.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="plano-manual" className="text-sm font-medium text-body">Plano</label>
            <select id="plano-manual" className={select} value={planChoice} onChange={(e) => setPlanChoice(e.target.value as "monthly" | "yearly")}>
              <option value="monthly">Mensal</option>
              <option value="yearly">Anual</option>
            </select>
          </div>
          <Field label="Vale até" type="date" min={today} max={MAX_PLAN_DAY} value={planEnd} onChange={(e) => setPlanEnd(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Atalhos de data do plano">
          <Button size="sm" variant="ghost" onClick={() => setPlanEnd(renewFrom(until, today, 30))}>+30 dias</Button>
          <Button size="sm" variant="ghost" onClick={() => setPlanEnd(renewFrom(until, today, 365))}>+1 ano</Button>
          <Button size="sm" variant="ghost" onClick={() => setPlanEnd("2099-12-31")}>Até 2099</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button loading={pending} onClick={() => run(() => adminSetPlan(userId, planChoice, planEnd), `Plano ${planChoice === "yearly" ? "anual" : "mensal"} até ${planEnd.split("-").reverse().join("/")}.`)}>
            {manual ? "Salvar plano manual" : "Dar o plano"}
          </Button>
          {manual && <Button variant="danger" loading={pending} onClick={() => run(() => adminEndPlan(userId), "Plano manual encerrado.")}>Encerrar plano manual</Button>}
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <SectionLabel>Teste grátis</SectionLabel>
        <p className="text-sm text-body">O último dia do teste. Para encerrar agora, escolha ontem.</p>
        <Field label="Teste vale até" type="date" value={trialEnd} onChange={(e) => setTrialEnd(e.target.value)} className="max-w-xs" />
        <div className="flex flex-wrap gap-2" role="group" aria-label="Atalhos de data do teste">
          <Button size="sm" variant="ghost" onClick={() => setTrialEnd(renewFrom(trialEndsOn, today, 7))}>+7 dias</Button>
          <Button size="sm" variant="ghost" onClick={() => setTrialEnd(renewFrom(trialEndsOn, today, 30))}>+30 dias</Button>
        </div>
        <div><Button variant="secondary" loading={pending} onClick={() => run(() => adminSetTrial(userId, trialEnd), `Teste até ${trialEnd.split("-").reverse().join("/")}.`)}>Salvar teste</Button></div>
      </Card>

      {!isTeam && (
        <Card className="flex flex-col gap-3 border-danger">
          <SectionLabel>Excluir a conta</SectionLabel>
          <p className="text-sm text-body">Apaga a conta e tudo dela: conversas, tarefas, gastos, documentos e arquivos. Não tem volta. Assinatura paga na Asaas precisa ser cancelada lá antes.</p>
          <div><Button variant="danger" onClick={() => { setTyped(""); setConfirmDelete(true); }}>Excluir esta conta</Button></div>
        </Card>
      )}

      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Excluir a conta">
        <p className="text-sm text-body">Para confirmar, digite o e-mail da conta: <strong className="break-all text-text">{email}</strong></p>
        <Field label="E-mail da conta" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmDelete(false)}>Cancelar</Button>
          <Button variant="danger" loading={pending} disabled={typed.trim().toLowerCase() !== email.toLowerCase()}
            onClick={() => run(() => adminDeleteAccount(userId, typed), "Conta excluída.", () => { setConfirmDelete(false); router.push("/admin/contas"); })}>
            Excluir para sempre
          </Button>
        </div>
      </Dialog>
    </>
  );
}
