import { useEffect, useState } from "react";
import { Loader2, Upload, CheckCircle2, FileText, Eye } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { getSignedDocUrl } from "@/lib/driver-documents";

interface Props {
  label: string;
  currentPath: string | null | undefined;
  onUpload: (file: File) => Promise<void>;
  accept?: string;
}

export function DocumentUploadField({ label, currentPath, onUpload, accept = "image/*,application/pdf" }: Props) {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (currentPath) {
      getSignedDocUrl(currentPath).then((u) => active && setPreview(u));
    } else {
      setPreview(null);
    }
    return () => { active = false; };
  }, [currentPath]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo deve ter no máximo 10MB");
      return;
    }
    setBusy(true);
    try {
      await onUpload(file);
      toast.success(`${label} enviado`);
    } catch (err) {
      toast.error((err as Error).message || "Erro ao enviar");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  const inputId = `doc-${label.replace(/\s+/g, "-")}`;

  return (
    <div className="rounded-lg border border-border bg-card/50 p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {currentPath ? (
            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
          ) : (
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          <Label htmlFor={inputId} className="text-sm font-medium truncate">{label}</Label>
        </div>
        {currentPath && preview && (
          <a href={preview} target="_blank" rel="noreferrer" className="text-xs text-primary inline-flex items-center gap-1 hover:underline shrink-0">
            <Eye className="h-3 w-3" /> Ver
          </a>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input id={inputId} type="file" accept={accept} className="hidden" onChange={handleFile} disabled={busy} />
        <Button asChild type="button" size="sm" variant={currentPath ? "outline" : "default"} disabled={busy}>
          <label htmlFor={inputId} className="cursor-pointer">
            {busy ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Upload className="mr-2 h-3 w-3" />}
            {currentPath ? "Reenviar" : "Enviar arquivo"}
          </label>
        </Button>
        <span className={`text-xs font-medium ${currentPath ? "text-amber-600" : "text-muted-foreground"}`}>
          {currentPath ? "Em análise" : "Pendente"}
        </span>
      </div>
    </div>
  );
}
