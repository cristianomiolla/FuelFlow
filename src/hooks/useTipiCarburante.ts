import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface TipoCarburante {
  id: string;
  nome: string;
}

export const useTipiCarburante = () => {
  const [tipiCarburante, setTipiCarburante] = useState<TipoCarburante[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTipiCarburante = async () => {
      try {
        setIsLoading(true);
        const { data, error: fetchError } = await supabase
          .from("tipi_carburante")
          .select("id, nome")
          .eq("attivo", true)
          .order("nome");

        if (fetchError) throw fetchError;
        setTipiCarburante(data || []);
        setError(null);
      } catch (err) {
        console.error("Error fetching fuel types:", err);
        setError("Impossibile caricare i tipi di carburante");
        setTipiCarburante([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTipiCarburante();
  }, []);

  return { tipiCarburante, isLoading, error };
};
