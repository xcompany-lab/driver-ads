import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { AuthCard } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type Search = {
  token_hash?: string;
  type?: string;
  next?: string;
};

export const Route = createFileRoute("/auth/confirm")({
  head: () => ({ meta: [{ title: "Confirmando — Driver Ads" }] }),
  validateSearch: (search: Record<string, unknown>): Search => ({
    token_hash: typeof search.token_hash === "string" ? search.token_hash : undefined,
    type: typeof search.type === "string" ? search.type : undefined,
    next: typeof search.next === "string" ? search.next : undefined,
  }),
  component: ConfirmPage,
});

function ConfirmPage() {
  const navigate = useNavigate();
  const { token_hash, type, next } = Route.useSearch();
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token_hash || !type) {
        setError("Link inválido ou incompleto.");
        setStatus("error");
        return;
      }
      const { error: err } = await supabase.auth.verifyOtp({
        token_hash,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        type: type as any,
      });
      if (cancelled) return;
      if (err) {
        setError(err.message || "Não foi possível confirmar o link.");
        setStatus("error");
        return;
      }
      setStatus("ok");
      const dest =
        type === "recovery"
          ? "/auth/reset-password"
          : next && next.startsWith("/")
            ? next
            : "/";
      setTimeout(() => navigate({ to: dest }), 1200);
    })();
    return () => {
      cancelled = true;
    };
  }, [token_hash, type, next, navigate]);

  return (
    <AuthCard
      title={status === "ok" ? "Tudo certo!" : "Confirmando..."}
      subtitle={status === "ok" ? "Redirecionando..." : "Aguarde um instante."}
    >
      {status === "loading" ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-white/60" />
        </div>
      ) : status === "ok" ? (
        <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/10 p-4 text-white">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-primary mt-0.5" />
          <div className="text-sm">Link confirmado com sucesso.</div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-white">
            <AlertCircle className="h-5 w-5 shrink-0 text-destructive mt-0.5" />
            <div className="text-sm">{error}</div>
          </div>
          <Button onClick={() => navigate({ to: "/login" })} className="w-full">
            Voltar para o login
          </Button>
        </div>
      )}
    </AuthCard>
  );
}
