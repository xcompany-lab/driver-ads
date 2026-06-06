import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { ArrowLeft, KeyRound, ShieldCheck, AlertTriangle, Clock } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/hooks/useSession";
import { getMyDriver } from "@/lib/driver";
import {
  getMyPayoutMethod,
  upsertMyPayoutMethod,
  validatePixKey,
  maskPixKey,
  type PixKeyType,
} from "@/lib/driver-payout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { StatusBadge } from "@/components/brand/StatusBadge";

export const Route = createFileRoute("/_authenticated/motorista/pix")({
  component: PixSettingsPage,
});

const KEY_TYPES: { value: PixKeyType; label: string; placeholder: string }[] = [
  { value: "cpf", label: "CPF", placeholder: "000.000.000-00" },
  { value: "cnpj", label: "CNPJ", placeholder: "00.000.000/0000-00" },
  { value: "email", label: "E-mail", placeholder: "voce@exemplo.com" },
  { value: "phone", label: "Telefone", placeholder: "+55 11 99999-9999" },
  { value: "random", label: "Chave aleatória", placeholder: "Chave EVP" },
];

function PixSettingsPage() {
  const { user } = useSession();
  const qc = useQueryClient();

  const { data: driver } = useQuery({
    queryKey: ["my-driver", user?.id],
    queryFn: () => getMyDriver(user!.id),
    enabled: !!user,
  });

  const { data: method, isLoading } = useQuery({
    queryKey: ["my-payout-method", driver?.id],
    queryFn: () => getMyPayoutMethod(driver!.id),
    enabled: !!driver,
  });

  const [keyType, setKeyType] = useState<PixKeyType>("cpf");
  const [keyValue, setKeyValue] = useState("");
  const [legalName, setLegalName] = useState("");

  // Hydrate form whenever the saved method changes.
  useEffect(() => {
    if (method) {
      setKeyType((method.pix_key_type as PixKeyType) ?? "cpf");
      setKeyValue(method.pix_key_value ?? "");
      setLegalName(method.legal_name ?? "");
    } else if (driver) {
      setLegalName(driver.full_name ?? "");
    }
  }, [method, driver]);

  const mutation = useMutation({
    mutationFn: async () => {
      const err = validatePixKey(keyType, keyValue);
      if (err) throw new Error(err);
      if (!driver) throw new Error("Cadastro de motorista incompleto.");
      return upsertMyPayoutMethod({
        driver_id: driver.id,
        pix_key_type: keyType,
        pix_key_value: keyValue,
        legal_name: legalName,
        document_type: keyType === "cnpj" ? "cnpj" : "cpf",
        document_number: keyType === "cpf" || keyType === "cnpj" ? keyValue : driver.cpf,
      });
    },
    onSuccess: () => {
      toast.success("Chave Pix enviada para análise.");
      qc.invalidateQueries({ queryKey: ["my-payout-method", driver?.id] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const status = method?.status;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link to="/motorista/ganhos"><ArrowLeft className="mr-2 h-4 w-4" />Voltar para ganhos</Link>
      </Button>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Chave Pix para recebimento</h1>
        <p className="text-sm text-muted-foreground">
          Cadastre a chave Pix em que você quer receber seus repasses. A equipe
          revisa antes da liberação para evitar fraudes.
        </p>
      </div>

      {status === "approved" && (
        <Alert>
          <ShieldCheck className="h-4 w-4 text-success" />
          <AlertTitle>Chave aprovada</AlertTitle>
          <AlertDescription>
            Seus repasses serão enviados para{" "}
            <span className="font-mono">{method?.pix_key_value_masked}</span>.
          </AlertDescription>
        </Alert>
      )}
      {status === "pending_review" && (
        <Alert>
          <Clock className="h-4 w-4" />
          <AlertTitle>Em análise</AlertTitle>
          <AlertDescription>
            Recebemos sua chave Pix e estamos validando. Você será notificado
            ao final.
          </AlertDescription>
        </Alert>
      )}
      {status === "rejected" && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Chave rejeitada</AlertTitle>
          <AlertDescription>
            {method?.rejection_reason ?? "Reenvie uma chave Pix em seu nome."}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <KeyRound className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">
            {method ? "Atualizar chave Pix" : "Cadastrar chave Pix"}
          </CardTitle>
          <CardDescription>
            A chave precisa estar em seu nome (mesmo CPF do cadastro).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : (
            <>
              <div className="grid gap-2">
                <Label>Tipo da chave</Label>
                <Select value={keyType} onValueChange={(v) => setKeyType(v as PixKeyType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {KEY_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="pix-key">Chave Pix</Label>
                <Input
                  id="pix-key"
                  value={keyValue}
                  onChange={(e) => setKeyValue(e.target.value)}
                  placeholder={KEY_TYPES.find((t) => t.value === keyType)?.placeholder}
                  inputMode={keyType === "phone" || keyType === "cpf" || keyType === "cnpj" ? "numeric" : "text"}
                />
                {keyValue && !validatePixKey(keyType, keyValue) && (
                  <p className="text-xs text-muted-foreground">
                    Exibida como{" "}
                    <span className="font-mono">{maskPixKey(keyType, keyValue)}</span>
                  </p>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="legal-name">Nome do titular</Label>
                <Input
                  id="legal-name"
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  placeholder="Nome completo igual ao banco"
                />
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                {status && <StatusBadge status={status} />}
                <Button
                  className="ml-auto"
                  onClick={() => mutation.mutate()}
                  disabled={mutation.isPending || !keyValue}
                >
                  {mutation.isPending ? "Enviando…" : method ? "Atualizar chave" : "Cadastrar chave"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
