import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2, Mail, Lock, Eye, EyeOff, Building2, Car } from "lucide-react";
import { AuthCard } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn } from "@/lib/auth";
import { roleHome, type AppRole } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";
import { ForgotPasswordDialog } from "@/components/auth/ForgotPasswordDialog";

export const Route = createFileRoute("/auth/")({
  head: () => ({ meta: [{ title: "Entrar — Driver Ads" }] }),
  component: AuthIndex,
});

function AuthIndex() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  return (
    <AuthCard
      title="Bem-vindo de volta!"
      subtitle={mode === "signin" ? "Faça login para acessar sua conta" : "Escolha seu tipo de cadastro"}
    >
      {mode === "signin" ? (
        <SignInForm onSignupClick={() => setMode("signup")} />
      ) : (
        <SignupChooser onBack={() => setMode("signin")} />
      )}
    </AuthCard>
  );
}

function SignInForm({ onSignupClick }: { onSignupClick: () => void }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgotOpen, setForgotOpen] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await signIn(email, password);
      const uid = res.user?.id;
      if (!uid) throw new Error("Falha ao iniciar sessão.");
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid);
      const roles = (data ?? []).map((r) => r.role as AppRole);
      const order: AppRole[] = ["admin", "operator", "advertiser", "driver"];
      const primary = order.find((r) => roles.includes(r)) ?? null;
      if (!primary) {
        await supabase.auth.signOut();
        throw new Error("Sua conta ainda não tem um perfil ativo.");
      }
      navigate({ to: roleHome(primary) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível entrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-white">E-mail</Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="pl-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-primary/60"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password" className="text-white">Senha</Label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pl-10 pr-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-primary/60"
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <div className="flex justify-end pt-1">
          <Link to="/auth" className="text-sm text-primary hover:underline">
            Esqueceu sua senha?
          </Link>
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" variant="hero" size="lg" className="w-full bg-gradient-brand-flow shadow-brand" disabled={loading}>
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Entrar
      </Button>

      <div className="pt-2 border-t border-white/10" />

      <p className="text-center text-sm text-white/60">
        Ainda não tem uma conta?{" "}
        <button
          type="button"
          onClick={onSignupClick}
          className="text-primary hover:underline font-medium"
        >
          Cadastre-se
        </button>
      </p>
    </form>
  );
}

function SignupChooser({ onBack }: { onBack: () => void }) {
  return (
    <div className="space-y-3">
      <Link
        to="/auth/anunciante"
        className="group flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 p-4 transition-all hover:border-primary/50 hover:bg-white/10"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Building2 className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="font-semibold text-white">Sou Anunciante</div>
          <div className="text-xs text-white/60">Quero criar campanhas e contratar motoristas.</div>
        </div>
      </Link>
      <Link
        to="/auth/motorista"
        className="group flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 p-4 transition-all hover:border-primary/50 hover:bg-white/10"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Car className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="font-semibold text-white">Sou Motorista</div>
          <div className="text-xs text-white/60">Quero monetizar meu veículo com publicidade.</div>
        </div>
      </Link>
      <button
        type="button"
        onClick={onBack}
        className="w-full text-center text-sm text-white/60 hover:text-white/90 pt-2"
      >
        ← Voltar para login
      </button>
    </div>
  );
}
