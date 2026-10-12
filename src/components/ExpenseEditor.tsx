"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { type Transaction } from "@/lib/budget";
import { type ExpenseChange } from "@/lib/expense-edits";

export function ExpenseEditor({
  transaction, onSave, onCancel, saving,
}: {
  transaction: Transaction;
  onSave: (original: Transaction, changes: ExpenseChange) => Promise<boolean>;
  onCancel: () => void;
  saving: boolean;
}) {
  const [amount, setAmount] = useState(String(Math.abs(transaction.amountOre) / 100).replace(".", ","));
  const [label, setLabel] = useState(transaction.label === "Utgift" ? "" : transaction.label);
  const [bookedOn, setBookedOn] = useState(transaction.bookedOn);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => { input.current?.focus({ preventScroll: true }); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const saved = await onSave(transaction, { amount, label, bookedOn });
    if (saved) onCancel();
  }

  return <form className="expense-edit-form" aria-label={"Ändra utgift: " + transaction.label} onSubmit={submit}>
    <strong className="expense-edit-title">Ändra utgift</strong>
    <div className="expense-edit-fields">
      <label>Belopp (kr)
        <input ref={input} type="text" required inputMode="decimal" value={amount}
          onChange={event => setAmount(event.target.value)} />
      </label>
      <label>Beskrivning <span>(valfritt)</span>
        <input type="text" maxLength={90} value={label} onChange={event => setLabel(event.target.value)} />
      </label>
      <label>Datum
        <input type="date" required value={bookedOn} onChange={event => setBookedOn(event.target.value)} />
      </label>
    </div>
    <div className="expense-edit-actions">
      <button type="submit" className="button button-primary" disabled={saving}>
        {saving ? "Sparar …" : "Spara ändringar"}
      </button>
      <button type="button" className="button button-outline" disabled={saving} onClick={onCancel}>
        Avbryt
      </button>
    </div>
  </form>;
}
