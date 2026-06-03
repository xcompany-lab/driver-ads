import { cn } from "@/lib/utils";

type Tone = "neutral" | "info" | "success" | "warning" | "destructive" | "brand";

const toneMap: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  info: "bg-info/10 text-info border border-info/20",
  success: "bg-success/10 text-success border border-success/20",
  warning: "bg-warning/15 text-warning-foreground border border-warning/30",
  destructive: "bg-destructive/10 text-destructive border border-destructive/20",
  brand: "bg-gradient-brand text-primary-foreground shadow-brand",
};

// Map all operational statuses across the platform to a visual tone
const STATUS_TONES: Record<string, { tone: Tone; label: string }> = {
  // Generic
  pending_review: { tone: "warning", label: "Em análise" },
  approved: { tone: "success", label: "Aprovado" },
  rejected: { tone: "destructive", label: "Reprovado" },
  suspended: { tone: "destructive", label: "Suspenso" },
  inactive: { tone: "neutral", label: "Inativo" },

  // Campaign
  draft: { tone: "neutral", label: "Rascunho" },
  submitted: { tone: "info", label: "Enviada" },
  under_review: { tone: "warning", label: "Em análise" },
  awaiting_payment: { tone: "warning", label: "Aguardando pagamento" },
  paid: { tone: "success", label: "Pago" },
  active: { tone: "brand", label: "Ativa" },
  paused: { tone: "warning", label: "Pausada" },
  completed: { tone: "neutral", label: "Encerrada" },
  canceled: { tone: "destructive", label: "Cancelada" },

  // Assignment
  invited: { tone: "info", label: "Convidado" },
  accepted: { tone: "success", label: "Aceito" },
  declined: { tone: "destructive", label: "Recusado" },
  awaiting_installation: { tone: "warning", label: "Aguardando instalação" },
  proof_submitted: { tone: "info", label: "Comprovante enviado" },
  proof_rejected: { tone: "destructive", label: "Comprovante reprovado" },

  // Installation / payment
  pending: { tone: "warning", label: "Pendente" },
  failed: { tone: "destructive", label: "Falhou" },
  overdue: { tone: "destructive", label: "Vencido" },
  refunded: { tone: "neutral", label: "Reembolsado" },
  scheduled: { tone: "info", label: "Agendado" },
  needs_resubmission: { tone: "warning", label: "Reenviar foto" },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const cfg = STATUS_TONES[status] ?? { tone: "neutral" as Tone, label: status };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        toneMap[cfg.tone],
        className,
      )}
    >
      {cfg.label}
    </span>
  );
}
