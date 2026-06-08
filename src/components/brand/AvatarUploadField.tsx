import { useState } from "react";
import { Camera, Loader2, UserCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface Props {
  currentUrl?: string | null;
  fallback: string;
  label: string;
  onUpload: (file: File) => Promise<void>;
}

export function AvatarUploadField({ currentUrl, fallback, label, onUpload }: Props) {
  const [busy, setBusy] = useState(false);
  const inputId = `avatar-${label.replace(/\s+/g, "-")}`;
  const initials = fallback
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      await onUpload(file);
      toast.success("Foto de perfil atualizada");
    } catch (err) {
      toast.error((err as Error).message || "Erro ao enviar avatar");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-full border bg-muted text-lg font-semibold text-muted-foreground">
        {currentUrl ? (
          <img src={currentUrl} alt="" className="h-full w-full object-cover" />
        ) : initials ? (
          initials
        ) : (
          <UserCircle className="h-9 w-9" />
        )}
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">{label}</p>
        <input id={inputId} type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={busy} />
        <Button asChild type="button" size="sm" variant="outline" disabled={busy}>
          <label htmlFor={inputId} className="cursor-pointer">
            {busy ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Camera className="mr-2 h-3.5 w-3.5" />}
            Trocar foto
          </label>
        </Button>
      </div>
    </div>
  );
}
