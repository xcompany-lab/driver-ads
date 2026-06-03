import { useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AuthCard } from "@/components/auth/AuthCard";
import { ForgotPasswordDialog } from "@/components/auth/ForgotPasswordDialog";
import { signIn } from "@/lib/auth";
import { roleHome } from "@/hooks/useSession";
import type { AppRole } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  title: string;
  subtitle: string;
  expectedRole: AppRole | AppRole[];
  allowSignup?: boolean;
  signupNode?: ReactNode;
}

export function AuthShell({ title, subtitle, expectedRole, allowSignup = true, signupNode }: Props) {
  return (
    <AuthCard title={title} subtitle={subtitle}>
      {allowSignup && signupNode ? (
        <Tabs defaultValue="signin" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Entrar</TabsTrigger>
            <TabsTrigger value="signup">Criar conta</TabsTrigger>
          </TabsList>
          <TabsContent value="signin" className="pt-4">
            <SignInForm expectedRole={expectedRole} />
          </TabsContent>
          <TabsContent value="signup" className="pt-4">{signupNode}</TabsContent>
        </Tabs>
      ) : (
        <SignInForm expectedRole={expectedRole} />
      )}
    </AuthCard>
  );
}

function SignInForm({ expectedRole }: { expectedRole: AppRole | AppRole[] }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allowed = Array.isArray(expectedRole) ? expectedRole : [expectedRole];

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
      const match = allowed.find((r) => roles.includes(r));
      if (!match) {
        await supabase.auth.signOut();
        throw new Error("Esta conta não tem permissão para este portal.");
      }
      navigate({ to: roleHome(match) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível entrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field id="email" label="E-mail">
        <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field id="password" label="Senha">
        <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" variant="hero" className="w-full" disabled={loading}>
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Entrar
      </Button>
    </form>
  );
}

export function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
