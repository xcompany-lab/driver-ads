import { useQuery } from "@tanstack/react-query";
import { listVehicleCatalog } from "@/lib/vehicle-catalog";

/** Catálogo modelo→imagem. Muda raramente, então cache longo. */
export function useVehicleCatalog() {
  return useQuery({
    queryKey: ["vehicle-catalog"],
    queryFn: listVehicleCatalog,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
  });
}
