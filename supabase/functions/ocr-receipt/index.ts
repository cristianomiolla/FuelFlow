import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReceiptData {
  targa: string | null;
  punto_vendita: string | null;
  data_rifornimento: string | null;
  tipo_carburante: string | null;
  quantita: number | null;
  prezzo_unitario: number | null;
  importo_totale: number | null;
  raw_text: string;
}

interface TipoCarburante {
  id: string;
  nome: string;
  descrizione: string | null;
}

// Function to match OCR-detected fuel type with database entries
function matchFuelType(detectedType: string | null, availableTypes: TipoCarburante[]): string | null {
  if (!detectedType || availableTypes.length === 0) {
    return null;
  }

  const normalized = detectedType.toLowerCase().trim();
  
  // Exact match first
  const exactMatch = availableTypes.find(t => t.nome.toLowerCase() === normalized);
  if (exactMatch) {
    return exactMatch.nome;
  }

  // Partial match - check if detected type contains or is contained in any available type
  for (const tipo of availableTypes) {
    const tipoNorm = tipo.nome.toLowerCase();
    if (normalized.includes(tipoNorm) || tipoNorm.includes(normalized)) {
      return tipo.nome;
    }
  }

  // Common OCR variations mapping
  const variations: Record<string, string[]> = {
    "diesel": ["gasolio", "gas-oil", "gasoil", "gpl diesel", "diesel+"],
    "benzina": ["super", "unleaded", "senza piombo", "verde", "b10"],
    "gpl": ["gas", "lpg", "autogpl"],
    "metano": ["cng", "gas naturale", "gnc"],
    "adblue": ["ad blue", "def", "urea"],
    "benzina premium": ["v-power", "excellium", "premium unleaded", "100 ottani"],
    "diesel premium": ["v-power diesel", "excellium diesel", "premium diesel"],
    "elettrico": ["electric", "ev", "ricarica"]
  };

  for (const tipo of availableTypes) {
    const tipoNorm = tipo.nome.toLowerCase();
    const variationList = variations[tipoNorm];
    if (variationList && variationList.some(v => normalized.includes(v))) {
      return tipo.nome;
    }
  }

  // If no match found, return the original detected type (will need manual correction)
  console.log(`No match found for fuel type: "${detectedType}"`);
  return detectedType;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("Missing authorization header");
      return new Response(
        JSON.stringify({ error: "Non autorizzato" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error("Authentication failed:", authError?.message);
      return new Response(
        JSON.stringify({ error: "Non autorizzato" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Authenticated user:", user.id);

    // Fetch available fuel types from database
    const { data: tipiCarburante, error: tipiError } = await supabase
      .from("tipi_carburante")
      .select("id, nome, descrizione")
      .eq("attivo", true);

    if (tipiError) {
      console.error("Error fetching fuel types:", tipiError.message);
    }

    const availableFuelTypes: TipoCarburante[] = tipiCarburante || [];
    const fuelTypeNames = availableFuelTypes.map(t => t.nome);
    
    console.log("Available fuel types:", fuelTypeNames.join(", "));

    const { image_base64 } = await req.json();

    if (!image_base64) {
      return new Response(
        JSON.stringify({ error: "Immagine non fornita" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate image size (max 10MB base64)
    if (image_base64.length > 10 * 1024 * 1024 * 1.37) {
      return new Response(
        JSON.stringify({ error: "Immagine troppo grande (max 10MB)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!GOOGLE_AI_API_KEY) {
      throw new Error("GOOGLE_AI_API_KEY non configurata");
    }

    // Build dynamic fuel type instructions for the AI
    const fuelTypeInstructions = fuelTypeNames.length > 0
      ? `I tipi di carburante validi sono SOLO: ${fuelTypeNames.join(", ")}. Cerca di mappare il tipo trovato a uno di questi valori.`
      : `Tipi comuni: Diesel, Benzina, GPL, Metano, AdBlue, Benzina Premium, Diesel Premium, Elettrico`;

    const systemPrompt = `Sei un sistema OCR specializzato nell'estrazione dati da scontrini di rifornimento carburante italiani.

Analizza l'immagine dello scontrino e estrai i seguenti dati:
- targa: La targa del veicolo (se presente). Formato: lettere e numeri (es. AB123CD)
- punto_vendita: Il nome della stazione di servizio o distributore
- data_rifornimento: La data del rifornimento in formato YYYY-MM-DD
- tipo_carburante: Tipo di carburante. ${fuelTypeInstructions}
- quantita: Litri erogati (solo numero decimale)
- prezzo_unitario: Prezzo al litro in euro (solo numero decimale)
- importo_totale: Importo totale in euro (solo numero decimale)

IMPORTANTE:
- Restituisci null per i campi che non riesci a leggere o non sono presenti
- I numeri devono essere in formato decimale con punto (es. 45.50)
- La data deve essere in formato YYYY-MM-DD
- Se trovi "€" o "EUR", estrai solo il valore numerico
- Cerca sinonimi: "TOTALE", "IMPORTO", "DA PAGARE" per l'importo totale
- Cerca "P.U.", "€/L", "PREZZO/LITRO" per il prezzo unitario
- Cerca "LITRI", "L", "QTA" per la quantità
- Per tipo_carburante, cerca: GASOLIO=Diesel, SUPER/VERDE=Benzina, GPL, METANO, ADBLUE

Restituisci SOLO un JSON valido con questa struttura esatta, senza testo aggiuntivo:
{
  "targa": null | "stringa",
  "punto_vendita": null | "stringa",
  "data_rifornimento": null | "YYYY-MM-DD",
  "tipo_carburante": null | "stringa",
  "quantita": null | numero,
  "prezzo_unitario": null | numero,
  "importo_totale": null | numero,
  "raw_text": "testo completo estratto dallo scontrino"
}`;

    const fullPrompt = `${systemPrompt}

Analizza questo scontrino di rifornimento ed estrai tutti i dati possibili. Restituisci solo JSON.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_AI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: fullPrompt },
                {
                  inline_data: {
                    mime_type: "image/jpeg",
                    data: image_base64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite richieste Google AI superato. Riprova tra qualche minuto." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 400) {
        return new Response(
          JSON.stringify({ error: "API key Google non valida o richiesta malformata." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("Google AI error:", response.status, errorText);
      throw new Error(`Errore Google AI: ${response.status}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      throw new Error("Nessuna risposta dall'AI");
    }

    // Parse JSON response
    let receiptData: ReceiptData;
    try {
      // Remove markdown code blocks if present
      let cleanContent = content.replace(/```json\n?|\n?```/g, "").trim();

      // If JSON is incomplete, try to fix it by finding the first complete JSON object
      if (!cleanContent.endsWith("}")) {
        const jsonMatch = cleanContent.match(/\{[\s\S]*"raw_text":\s*"[^"]*"\s*\}/);
        if (jsonMatch) {
          cleanContent = jsonMatch[0];
        } else {
          // Try to find any valid JSON object
          const firstBrace = cleanContent.indexOf("{");
          const lastBrace = cleanContent.lastIndexOf("}");
          if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            cleanContent = cleanContent.substring(firstBrace, lastBrace + 1);
          }
        }
      }

      receiptData = JSON.parse(cleanContent);
    } catch (e) {
      console.error("Failed to parse AI response:", content);
      console.error("Parse error:", e);
      // Return partial data with raw text
      receiptData = {
        targa: null,
        punto_vendita: null,
        data_rifornimento: null,
        tipo_carburante: null,
        quantita: null,
        prezzo_unitario: null,
        importo_totale: null,
        raw_text: content,
      };
    }

    // Map the detected fuel type to a valid database entry
    if (receiptData.tipo_carburante) {
      const originalType = receiptData.tipo_carburante;
      receiptData.tipo_carburante = matchFuelType(originalType, availableFuelTypes);
      console.log(`Fuel type mapping: "${originalType}" -> "${receiptData.tipo_carburante}"`);
    }

    console.log("OCR completed successfully for user:", user.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: receiptData,
        available_fuel_types: fuelTypeNames
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("OCR error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Errore sconosciuto" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
