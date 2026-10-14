"use client";
import { useState, useTransition } from "react";
import { setAutomationChannel } from "@/app/actions";
import type { Automation } from "@/lib/data/types";

// Troca por onde a revisão ou a pesquisa chega, direto no card
export function AutomationChannel({ id, title, channel }: { id: string; title: string; channel: Automation["channel"] }) {
  const [value, setValue] = useState(channel);
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();
  return (
    <label className="flex flex-wrap items-center gap-2 text-xs text-body">
      Chega por
      <select aria-label={`Por onde chega: ${title}`} value={value} disabled={pending}
        onChange={(e) => {
          const next = e.target.value as Automation["channel"];
          const before = value;
          setValue(next); setError(false);
          start(async () => { try { await setAutomationChannel(id, next); } catch { setValue(before); setError(true); } });
        }}
        className="h-8 rounded-md border border-border-input bg-bg px-2 text-xs text-text">
        <option value="whatsapp">WhatsApp</option>
        <option value="push">notificação no aparelho</option>
        <option value="email">e-mail</option>
      </select>
      {error && <span role="alert" className="text-danger">Não deu para trocar.</span>}
    </label>
  );
}
