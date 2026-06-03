import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, Lock, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { AuthCard } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/reset-password")({
  head: () => ({ meta: [{ title: "Redefinir senha — Driver Ads" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Supabase auto-processa o hash da URL (#access_token=…&type=recovery) e abre sessão temporária.
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setHasRecoverySession(!!data.session);
      setReady(true);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setHasRecoverySession(true);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      setDone(true);
      await supabase.auth.signOut();
      setTimeout(() => navigate({ to: "/auth" }), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível redefinir.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard
      title="Redefinir senha"
      subtitle={done ? "Senha alterada!" : "Escolha uma nova senha para sua conta."}
    >
      {!ready ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-white/60" />
        </div>
      ) : done ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/10 p-4 text-white">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-primary mt-0.5" />
            <div className="text-sm">Senha redefinida com sucesso. Redirecionando para o login…</div>
          </div>
        </div>
      ) : !hasRecoverySession ? (
        <div className="space-y-4">
          <p className="text-sm text-white/70">
            O link de redefinição expirou ou é inválido. Volte para o login e solicite um novo link em
            <strong> Esqueci minha senha</strong>.
          </p>
          <Button onClick={() => navigate({ to: "/auth" })} className="w-full">
            Voltar para o login
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="new-password" className="text-white">Nova senha</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <Input
                id="new-password"
                type={show ? "text" : "password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="pl-10 pr-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
                aria-label={show ? "Ocultar senha" : "Mostrar senha"}
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm-password" className="text-white">Confirmar nova senha</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <Input
                id="confirm-password"
                type={show ? "text" : "password"}
                required
                minLength={6}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                className="pl-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30"
              />
            </div>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <Button type="submit" size="lg" className="w-full bg-gradient-brand-flow shadow-brand" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Redefinir senha
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
