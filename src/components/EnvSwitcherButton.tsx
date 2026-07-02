import { Link } from "@tanstack/react-router";
import { Repeat } from "lucide-react";

export function EnvSwitcherButton({ className = "" }: { className?: string }) {
  return (
    <Link
      to="/escolher-ambiente"
      className={`inline-flex items-center gap-1.5 rounded-md border border-current/20 px-2.5 py-1.5 text-xs font-medium hover:bg-current/10 ${className}`}
      title="Trocar Ambiente"
    >
      <Repeat className="h-3.5 w-3.5" /> Trocar Ambiente
    </Link>
  );
}
