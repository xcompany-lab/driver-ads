import { useEffect, useState } from "react";
import { Loader2, Upload, CheckCircle2, FileText, Eye, FileImage } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DocumentPreview, isPdfPath } from "@/components/brand/DocumentPreview";

interface Props {
  label: string;
  currentPath: string | null | undefined;
  onUpload: (file: File) => Promise<void>;
  accept?: string;
  status?: "pending" | "approved" | "rejected" | null;
  hideUploadWhenApproved?: boolean;
}

export function DocumentUploadField({
  label,
  currentPath,
  onUpload,
  accept = "image/*,application/pdf",
  status,
  hideUploadWhenApproved = false,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const hasUploaded = Boolean(currentPath) || sent;
  const isPdf = isPdfPath(currentPath);
  const effectiveStatus = sent ? "pending" : status;
  const isApproved = effectiveStatus === "approved";
  const canUpload = !(hideUploadWhenApproved && isApproved);
  const statusText =
    isApproved ? "Aprovado" :
    effectiveStatus === "rejected" ? "Reprovado" :
    hasUploaded ? "Em analise" :
    "Pendente";
  const statusClass =
    isApproved ? "text-green-600" :
    effectiveStatus === "rejected" ? "text-destructive" :
    hasUploaded ? "text-amber-600" :
    "text-muted-foreground";

  useEffect(() => {
    if (currentPath) setSent(false);
  }, [currentPath]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo deve ter no maximo 10MB");
      return;
    }
    setBusy(true);
    try {
      await onUpload(file);
      setSent(true);
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
          {isApproved ? (
            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
          ) : isPdf ? (
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <FileImage className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          <Label htmlFor={inputId} className="text-sm font-medium truncate">
            {label}
            {currentPath && isPdf && <span className="ml-1 text-xs text-muted-foreground">(PDF)</span>}
          </Label>
        </div>
        {currentPath && (
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="text-xs text-primary inline-flex items-center gap-1 hover:underline shrink-0"
          >
            <Eye className="h-3 w-3" /> Ver
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input id={inputId} type="file" accept={accept} className="hidden" onChange={handleFile} disabled={busy} />
        {canUpload && (
          <Button asChild type="button" size="sm" variant={hasUploaded ? "outline" : "default"} disabled={busy}>
            <label htmlFor={inputId} className="cursor-pointer">
              {busy ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Upload className="mr-2 h-3 w-3" />}
              {hasUploaded ? "Reenviar" : "Enviar arquivo"}
            </label>
          </Button>
        )}
        <span className={`text-xs font-medium ${statusClass}`}>
          {statusText}
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground hidden sm:inline">JPG, PNG ou PDF</span>
      </div>

      <DocumentPreview
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        path={currentPath ?? null}
        label={label}
      />
    </div>
  );
}
