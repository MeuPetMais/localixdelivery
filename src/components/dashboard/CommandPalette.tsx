import { useEffect, useState } from "react";
import { DashboardAudit } from "@/lib/dashboard";

export interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
}

export function CommandPalette({ commands }: { commands: CommandItem[] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!open) return null;
  const filtered = commands.filter((c) => c.label.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-24" onClick={() => setOpen(false)}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-xl border bg-background shadow-xl">
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar telas ou ações…"
          className="w-full border-b bg-transparent px-4 py-3 text-sm outline-none"
        />
        <ul className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 && <li className="p-3 text-sm text-muted-foreground">Nenhum resultado</li>}
          {filtered.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => {
                  DashboardAudit.record({ type: "COMMAND", payload: { id: c.id } });
                  c.run();
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
              >
                <span>{c.label}</span>
                {c.hint && <span className="text-xs text-muted-foreground">{c.hint}</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
