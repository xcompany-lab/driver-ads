import { useMemo, useState } from "react";
import { Car } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useVehicleCatalog } from "@/hooks/useVehicleCatalog";
import { resolveVehicleImagePath, vehicleImageUrl } from "@/lib/vehicle-catalog";

interface VehicleImageProps {
  brand: string | null | undefined;
  model: string | null | undefined;
  /** Tamanho em pixels (largura/altura do quadro). Default 56. */
  size?: number;
  className?: string;
}

/**
 * Miniatura ilustrativa do modelo do veículo. Resolve a figura do catálogo
 * (matching tolerante) e cai na silhueta default; se a imagem falhar ao
 * carregar, exibe um ícone genérico.
 */
export function VehicleImage({ brand, model, size = 56, className }: VehicleImageProps) {
  const { data: catalog, isLoading } = useVehicleCatalog();
  const [errored, setErrored] = useState(false);

  const url = useMemo(() => {
    if (!catalog) return null;
    return vehicleImageUrl(resolveVehicleImagePath(brand, model, catalog));
  }, [catalog, brand, model]);

  const frame = cn(
    "flex shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/40",
    className,
  );
  const style = { width: size, height: size };

  if (isLoading) {
    return <Skeleton className={cn("shrink-0 rounded-lg", className)} style={style} />;
  }

  if (!url || errored) {
    return (
      <div className={frame} style={style} aria-label={`${brand ?? ""} ${model ?? ""}`.trim() || "Veículo"}>
        <Car className="h-1/2 w-1/2 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={frame} style={style}>
      <img
        src={url}
        alt={`${brand ?? ""} ${model ?? ""}`.trim() || "Veículo"}
        loading="lazy"
        className="h-full w-full object-contain"
        onError={() => setErrored(true)}
      />
    </div>
  );
}
