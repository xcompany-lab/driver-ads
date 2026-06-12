import { useQuery } from "@tanstack/react-query";
import { listServiceCities } from "@/lib/cities";

export const CITY_DATALIST_ID = "service-cities";

/**
 * Renderiza um <datalist> com as cidades atendidas (emergentes do volume de
 * cadastros). Use junto de um <input list={CITY_DATALIST_ID}> para sugerir
 * cidades sem limitar o que o usuario digita.
 */
export function CitySuggestions() {
  const { data } = useQuery({
    queryKey: ["service-cities"],
    queryFn: listServiceCities,
    staleTime: 1000 * 60 * 10,
  });
  return (
    <datalist id={CITY_DATALIST_ID}>
      {(data ?? []).map((c) => (
        <option key={c.city_key} value={c.display_name} />
      ))}
    </datalist>
  );
}
