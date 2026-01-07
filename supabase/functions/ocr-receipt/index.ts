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
  chilometri: number | null;
  raw_text: string;
  confidence_score?: number;
  validation_warnings?: string[];
}

interface TipoCarburante {
  id: string;
  nome: string;
  descrizione: string | null;
}

// Document AI response interface
interface DocumentAIResponse {
  document?: {
    text?: string;
    entities?: Array<{
      type?: string;
      mentionText?: string;
      confidence?: number;
      normalizedValue?: {
        text?: string;
        dateValue?: {
          year?: number;
          month?: number;
          day?: number;
        };
        moneyValue?: {
          units?: string;
          nanos?: number;
        };
      };
    }>;
    pages?: Array<{
      blocks?: Array<{
        layout?: {
          textAnchor?: {
            textSegments?: Array<{
              startIndex?: string;
              endIndex?: string;
            }>;
          };
        };
      }>;
    }>;
  };
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}

interface ServiceAccountKey {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
  universe_domain: string;
}

// Function to create JWT for Google OAuth2
function createJWT(serviceAccount: ServiceAccountKey, scope: string): string {
  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: serviceAccount.client_email,
    scope: scope,
    aud: serviceAccount.token_uri,
    exp: now + 3600,
    iat: now,
  };

  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const encodedClaim = btoa(JSON.stringify(claim)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const signatureInput = `${encodedHeader}.${encodedClaim}`;

  return signatureInput;
}

// Get OAuth2 access token from Google
async function getAccessToken(serviceAccount: ServiceAccountKey): Promise<string> {
  const scope = "https://www.googleapis.com/auth/cloud-platform";

  // Create JWT assertion
  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: serviceAccount.client_email,
    scope: scope,
    aud: serviceAccount.token_uri,
    exp: now + 3600,
    iat: now,
  };

  // Encode header and claim
  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const claimB64 = btoa(JSON.stringify(claim)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const signatureInput = `${headerB64}.${claimB64}`;

  // Import private key
  const privateKeyPem = serviceAccount.private_key;
  const pemContents = privateKeyPem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");

  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );

  // Sign the JWT
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    encoder.encode(signatureInput)
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const jwt = `${signatureInput}.${signatureB64}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch(serviceAccount.token_uri, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error("Token exchange failed:", errorText);
    throw new Error(`Failed to get access token: ${tokenResponse.status}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

// Validation and confidence scoring
interface ValidationResult {
  isValid: boolean;
  confidence: number;
  warnings: string[];
  correctedData?: Partial<ReceiptData>;
}

function validateReceiptData(data: Omit<ReceiptData, 'raw_text' | 'confidence_score' | 'validation_warnings'>): ValidationResult {
  const warnings: string[] = [];
  let confidence = 100;
  const correctedData: Partial<ReceiptData> = {};

  // 1. VALIDAZIONE CROSS-FIELD: quantità × prezzo ≈ totale
  if (data.quantita !== null && data.prezzo_unitario !== null && data.importo_totale !== null) {
    const calculatedTotal = data.quantita * data.prezzo_unitario;
    const difference = Math.abs(calculatedTotal - data.importo_totale);
    const percentDiff = (difference / data.importo_totale) * 100;

    if (percentDiff > 5) {
      warnings.push(`Incoerenza matematica: ${data.quantita}L × €${data.prezzo_unitario}/L = €${calculatedTotal.toFixed(2)}, ma totale rilevato = €${data.importo_totale}`);
      confidence -= 20;
    }
  }

  // 2. VALIDAZIONE RANGE PREZZI (realistici per mercato italiano)
  if (data.prezzo_unitario !== null) {
    if (data.prezzo_unitario < 0.50 || data.prezzo_unitario > 4.00) {
      warnings.push(`Prezzo unitario sospetto: €${data.prezzo_unitario}/L (range normale: €0.50-€4.00)`);
      confidence -= 15;
    }
  }

  // 3. VALIDAZIONE RANGE QUANTITÀ
  if (data.quantita !== null) {
    if (data.quantita < 1) {
      warnings.push(`Quantità troppo bassa: ${data.quantita}L (minimo realistico: 1L)`);
      confidence -= 15;
    }
    if (data.quantita > 150) {
      warnings.push(`Quantità troppo alta: ${data.quantita}L (massimo realistico per auto: ~150L)`);
      confidence -= 10;
    }
  }

  // 4. VALIDAZIONE IMPORTO TOTALE
  if (data.importo_totale !== null) {
    if (data.importo_totale < 5) {
      warnings.push(`Importo totale troppo basso: €${data.importo_totale} (minimo realistico: €5)`);
      confidence -= 10;
    }
    if (data.importo_totale > 400) {
      warnings.push(`Importo totale molto alto: €${data.importo_totale} (massimo comune: ~€400)`);
      confidence -= 5;
    }
  }

  // 5. VALIDAZIONE DATA
  if (data.data_rifornimento !== null) {
    const rifDate = new Date(data.data_rifornimento);
    const now = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(now.getFullYear() - 1);

    if (rifDate > now) {
      warnings.push(`Data rifornimento nel futuro: ${data.data_rifornimento}`);
      confidence -= 25;
    }
    if (rifDate < oneYearAgo) {
      warnings.push(`Data rifornimento molto vecchia: ${data.data_rifornimento} (oltre 1 anno fa)`);
      confidence -= 10;
    }
  }

  // 6. VALIDAZIONE TARGA (formato italiano)
  if (data.targa !== null) {
    const targaPattern = /^[A-Z]{2}\d{3}[A-Z]{2}$/;
    if (!targaPattern.test(data.targa)) {
      warnings.push(`Targa non conforme al formato italiano standard: ${data.targa}`);
      confidence -= 10;
    }
  }

  // 7. VALIDAZIONE CHILOMETRI
  if (data.chilometri !== null) {
    if (data.chilometri < 0) {
      warnings.push(`Chilometri negativi: ${data.chilometri}`);
      confidence -= 15;
      correctedData.chilometri = null;
    }
    if (data.chilometri > 999999) {
      warnings.push(`Chilometri molto alti: ${data.chilometri} (potrebbe essere un errore OCR)`);
      confidence -= 5;
    }
    // Controlla se è un decimale (errore comune OCR)
    if (data.chilometri % 1 !== 0) {
      warnings.push(`Chilometri con decimali: ${data.chilometri} (convertito a intero)`);
      correctedData.chilometri = Math.round(data.chilometri);
      confidence -= 5;
    }
  }

  // 8. SCORING COMPLETEZZA DATI
  const fieldsToCheck = ['targa', 'punto_vendita', 'data_rifornimento', 'tipo_carburante', 'quantita', 'prezzo_unitario', 'importo_totale'];
  const filledFields = fieldsToCheck.filter(field => data[field as keyof typeof data] !== null).length;
  const completeness = (filledFields / fieldsToCheck.length) * 100;

  if (completeness < 70) {
    warnings.push(`Dati incompleti: solo ${filledFields}/${fieldsToCheck.length} campi rilevati (${completeness.toFixed(0)}%)`);
    confidence -= (100 - completeness) / 2; // Penalità proporzionale
  }

  // Calcolo confidence finale (0-100)
  confidence = Math.max(0, Math.min(100, confidence));

  return {
    isValid: warnings.length === 0,
    confidence: Math.round(confidence),
    warnings,
    correctedData: Object.keys(correctedData).length > 0 ? correctedData : undefined
  };
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

// Extract structured data from Document AI response
function extractReceiptData(docAIResponse: DocumentAIResponse, availableFuelTypes: TipoCarburante[]): ReceiptData {
  const rawText = docAIResponse.document?.text || "";

  let targa: string | null = null;
  let punto_vendita: string | null = null;
  let data_rifornimento: string | null = null;
  let tipo_carburante: string | null = null;
  let quantita: number | null = null;
  let prezzo_unitario: number | null = null;
  let importo_totale: number | null = null;
  let chilometri: number | null = null;

  // Extract from raw text using patterns
  const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // Extract targa (Italian license plate pattern)
  const targaPattern = /\b[A-Z]{2}\s*\d{3}\s*[A-Z]{2}\b/i;
  for (const line of lines) {
    const match = line.match(targaPattern);
    if (match) {
      targa = match[0].replace(/\s+/g, '').toUpperCase();
      break;
    }
  }

  // Extract date (various formats)
  const datePatterns = [
    /(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/,  // DD-MM-YYYY or DD/MM/YYYY
    /(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/,  // YYYY-MM-DD or YYYY/MM/DD
    /(\d{1,2})\s+(gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic)[a-z]*\s+(\d{4})/i, // DD Month YYYY
  ];

  for (const line of lines) {
    for (const pattern of datePatterns) {
      const match = line.match(pattern);
      if (match) {
        // Parse and normalize to YYYY-MM-DD
        if (match[3] && match[3].length === 4) {
          // DD-MM-YYYY format
          const day = match[1].padStart(2, '0');
          const month = match[2].padStart(2, '0');
          const year = match[3];
          data_rifornimento = `${year}-${month}-${day}`;
        } else if (match[1].length === 4) {
          // YYYY-MM-DD format
          data_rifornimento = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
        }
        break;
      }
    }
    if (data_rifornimento) break;
  }

  // Extract fuel type
  const fuelKeywords = availableFuelTypes.map(t => t.nome.toLowerCase());
  for (const line of lines) {
    const lineLower = line.toLowerCase();
    for (const keyword of fuelKeywords) {
      if (lineLower.includes(keyword)) {
        tipo_carburante = matchFuelType(keyword, availableFuelTypes);
        break;
      }
    }
    // Common variations
    if (!tipo_carburante) {
      if (lineLower.includes('gasolio') || lineLower.includes('diesel')) {
        tipo_carburante = matchFuelType('diesel', availableFuelTypes);
      } else if (lineLower.includes('benzina') || lineLower.includes('super')) {
        tipo_carburante = matchFuelType('benzina', availableFuelTypes);
      } else if (lineLower.includes('gpl')) {
        tipo_carburante = matchFuelType('gpl', availableFuelTypes);
      }
    }
    if (tipo_carburante) break;
  }

  // Extract quantities and prices
  const quantityPatterns = [
    /(?:quantit[aà]|litri|lt?|vol)[:\s]*(\d+[.,]\d+)/i,
    /(\d+[.,]\d+)\s*(?:l|lt|litri)\b/i,
  ];

  const pricePerLiterPatterns = [
    /(?:p\.?u\.?|prezzo[\/\s]?unit|€\/l)[:\s]*(\d+[.,]\d+)/i,
    /(\d+[.,]\d+)\s*€\/l/i,
  ];

  const totalPatterns = [
    /(?:totale|importo|euro|eur|tot)[:\s]*(\d+[.,]\d+)/i,
    /€\s*(\d+[.,]\d+)/,
  ];

  // Pattern per chilometri - cerca numeri vicino a "km" (da 1 a 6 cifre)
  const kmPatterns = [
    // "ODO: 125000", "Odometro: 125.000", "ODO 5000" (più specifico, prioritario)
    /(?:odo|odometro|contachilometri)[:\s]*(\d{1,3}(?:[.,]\d{3})*|\d{1,6})/i,
    // "Chilometri: 125000", "Kilometri 125.000", "km: 5000" (specifico)
    /(?:chilometri|kilometri|km)[:\s]+(\d{1,3}(?:[.,]\d{3})*|\d{1,6})/i,
    // "125000 km", "125.000 km", "5000 km", "125000km"
    /\b(\d{1,3}(?:[.,]\d{3})+|\d{4,6})\s*km\b/i,
    // "km 125000", "km125000" (senza spazi o con spazi)
    /\bkm\s*(\d{4,6})\b/i,
  ];

  for (const line of lines) {
    // Extract quantity
    if (!quantita) {
      for (const pattern of quantityPatterns) {
        const match = line.match(pattern);
        if (match) {
          quantita = parseFloat(match[1].replace(',', '.'));
          break;
        }
      }
    }

    // Extract price per liter
    if (!prezzo_unitario) {
      for (const pattern of pricePerLiterPatterns) {
        const match = line.match(pattern);
        if (match) {
          prezzo_unitario = parseFloat(match[1].replace(',', '.'));
          break;
        }
      }
    }

    // Extract total
    if (!importo_totale) {
      for (const pattern of totalPatterns) {
        const match = line.match(pattern);
        if (match) {
          const value = parseFloat(match[1].replace(',', '.'));
          // Only accept reasonable total amounts (> 5€)
          if (value > 5) {
            importo_totale = value;
            break;
          }
        }
      }
    }

    // Extract chilometri
    if (!chilometri) {
      for (const pattern of kmPatterns) {
        const match = line.match(pattern);
        if (match) {
          // Remove thousand separators (. or ,) and convert to integer
          const cleanNumber = match[1].replace(/[.,]/g, '');
          const value = parseInt(cleanNumber, 10);
          // Only accept reasonable km values (between 0 and 999999)
          if (value >= 0 && value <= 999999) {
            chilometri = value;
            break;
          }
        }
      }
    }
  }

  // Extract punto vendita (usually one of the first lines or contains keywords)
  const vendorKeywords = ['eni', 'ip', 'q8', 'agip', 'esso', 'tamoil', 'shell', 'total', 'repsol'];
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i];
    const lineLower = line.toLowerCase();

    if (vendorKeywords.some(k => lineLower.includes(k)) ||
        (line.length > 5 && line.length < 50 && /^[A-Z]/.test(line))) {
      punto_vendita = line;
      break;
    }
  }

  return {
    targa,
    punto_vendita,
    data_rifornimento,
    tipo_carburante,
    quantita,
    prezzo_unitario,
    importo_totale,
    chilometri,
    raw_text: rawText
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authentication from request
    const authHeader = req.headers.get("Authorization");

    console.log("Auth header present:", !!authHeader);

    if (!authHeader) {
      console.error("Missing authorization header - verify_jwt might be disabled");
      return new Response(
        JSON.stringify({ error: "Non autorizzato - header mancante" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Use service role key for admin operations, but verify user from JWT
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Create a client with the user's token to verify authentication
    const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await userSupabase.auth.getUser();

    if (authError || !user) {
      console.error("Authentication failed:", authError?.message);
      return new Response(
        JSON.stringify({ error: `Non autorizzato - ${authError?.message || "utente non trovato"}` }),
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

    // Get Google Service Account credentials
    const serviceAccountJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
    if (!serviceAccountJson) {
      console.error("Missing GOOGLE_SERVICE_ACCOUNT_KEY");
      throw new Error("Credenziali Google non configurate");
    }

    const serviceAccount: ServiceAccountKey = JSON.parse(serviceAccountJson);
    const LOCATION = Deno.env.get("GOOGLE_CLOUD_LOCATION") || "eu";
    const PROCESSOR_ID = Deno.env.get("DOCUMENT_AI_PROCESSOR_ID");
    const PROJECT_NUMBER = Deno.env.get("GOOGLE_CLOUD_PROJECT_NUMBER");

    if (!PROCESSOR_ID) {
      console.error("Missing DOCUMENT_AI_PROCESSOR_ID");
      throw new Error("Processor ID non configurato");
    }

    if (!PROJECT_NUMBER) {
      console.error("Missing GOOGLE_CLOUD_PROJECT_NUMBER");
      throw new Error("Project Number non configurato");
    }

    console.log("Using Document AI processor:", {
      project_number: PROJECT_NUMBER,
      location: LOCATION,
      processor: PROCESSOR_ID
    });

    // Get OAuth2 access token
    console.log("Getting OAuth2 access token...");
    const accessToken = await getAccessToken(serviceAccount);
    console.log("Access token obtained successfully");

    // Call Document AI API with OAuth2 - use PROJECT_NUMBER instead of project_id
    const documentAIUrl = `https://${LOCATION}-documentai.googleapis.com/v1/projects/${PROJECT_NUMBER}/locations/${LOCATION}/processors/${PROCESSOR_ID}:process`;

    const response = await fetch(documentAIUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        rawDocument: {
          content: image_base64,
          mimeType: "image/jpeg",
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Document AI error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite richieste Document AI superato. Riprova tra qualche minuto." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 400) {
        return new Response(
          JSON.stringify({ error: "Richiesta malformata." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 403) {
        return new Response(
          JSON.stringify({ error: "Accesso negato. Verifica le credenziali Document AI." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`Errore Document AI: ${response.status} - ${errorText}`);
    }

    const data: DocumentAIResponse = await response.json();

    if (data.error) {
      console.error("Document AI returned error:", data.error);
      throw new Error(`Document AI error: ${data.error.message || data.error.status}`);
    }

    if (!data.document?.text) {
      console.warn("No text extracted from document");
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            targa: null,
            punto_vendita: null,
            data_rifornimento: null,
            tipo_carburante: null,
            quantita: null,
            prezzo_unitario: null,
            importo_totale: null,
            chilometri: null,
            raw_text: "Nessun testo estratto dall'immagine"
          },
          available_fuel_types: fuelTypeNames
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const extractedText = data.document.text;
    console.log("Document AI extracted text length:", extractedText.length);

    // Now use Gemini to intelligently parse the extracted text
    const GEMINI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!GEMINI_API_KEY) {
      console.error("Missing GOOGLE_AI_API_KEY for Gemini");
      throw new Error("Gemini API key non configurata");
    }

    // Build dynamic fuel type instructions for Gemini
    const fuelTypeInstructions = fuelTypeNames.length > 0
      ? `I tipi di carburante validi sono SOLO: ${fuelTypeNames.join(", ")}. Cerca di mappare il tipo trovato a uno di questi valori.`
      : `Tipi comuni: Diesel, Benzina, GPL, Metano, AdBlue, Benzina Premium, Diesel Premium, Elettrico`;

    const geminiPrompt = `# RUOLO
Sei un sistema di analisi dati specializzato nell'estrazione di informazioni da scontrini di rifornimento carburante italiani.

# COMPITO
Analizza il testo OCR estratto da uno scontrino e trova TUTTI i seguenti dati con massima precisione:

## CAMPI DA ESTRARRE:
1. **targa**: Targa del veicolo. Formato italiano (es. AB123CD, AA123BB). Cerca etichette: "TARGA", "VEICOLO", "AUTO", "TARGET"
2. **punto_vendita**: Nome completo della stazione di servizio o distributore. Cerca all'inizio del testo: logo, intestazione, nome azienda
3. **data_rifornimento**: Data del rifornimento in formato YYYY-MM-DD. Cerca: "DATA", "DATE", timestamp, date
4. **tipo_carburante**: Tipo di carburante. ${fuelTypeInstructions}
   - Cerca: "PRODOTTO", "CARBURANTE", "TIPO", nomi prodotti
   - Mappature comuni: GASOLIO→Diesel, SUPER/VERDE→Benzina, GPL→GPL, METANO→Metano
5. **quantita**: Litri erogati (solo numero decimale). Cerca: "LITRI", "L", "QTA", "QUANTITA", "VOLUME", "LT"
6. **prezzo_unitario**: Prezzo al litro in €/L (solo numero decimale). Cerca: "P.U.", "€/L", "PREZZO/LITRO", "PREZZO UNITARIO", "PU", "PREZZO"
7. **importo_totale**: Importo totale pagato in euro (solo numero decimale). Cerca: "TOTALE", "IMPORTO", "DA PAGARE", "EURO", "EUR", "TOTAL", "TOT"
8. **chilometri**: Chilometraggio del veicolo al momento del rifornimento (solo numero intero, senza decimali)
   - Cerca etichette: "KM", "CHILOMETRI", "KILOMETRI", "ODO", "ODOMETRO", "CONTACHILOMETRI"
   - **IMPORTANTE**: Spesso il chilometraggio appare come numero seguito da "km" (es. "125000 km", "5000 km", "45.678km", "125.000 km")
   - Cerca numeri (da 1 a 6 cifre) seguiti o preceduti dalla parola "km" anche senza etichetta esplicita
   - Esempi comuni negli scontrini:
     * "km 5000" → 5000
     * "km 125000" → 125000
     * "125.000 km" → 125000 (rimuovi separatori di migliaia)
     * "5.000 km" → 5000 (rimuovi separatori di migliaia)
     * "45678km" → 45678
     * "ODO: 125000" → 125000
     * "Contachilometri 125.000" → 125000
     * "1500 km" → 1500 (anche per auto nuove)
   - Rimuovi SEMPRE separatori di migliaia (punti o virgole): "125.000" → 125000, "125,000" → 125000
   - Se non presente o illeggibile, restituisci **null**

# REGOLE CRITICHE:
✓ Restituisci **null** per campi non presenti o illeggibili (NON inventare dati)
✓ Numeri in formato decimale con PUNTO: 45.50 (non virgola)
✓ I chilometri sono numeri INTERI (es. 125000, 45678) - NON usare decimali
✓ Per i chilometri, RIMUOVI separatori di migliaia: "125.000" o "125,000" → 125000
✓ Date formato: YYYY-MM-DD (es. 2025-01-07)
✓ Rimuovi simboli monetari: "45.50€" → 45.50
✓ Cerca in TUTTO il testo, non solo nelle righe centrali
✓ Sii PRECISO con i numeri, leggi attentamente ogni cifra
✓ Se vedi numeri con virgola (es. 45,50), convertili in formato con punto (45.50)
✓ I chilometri sono OPZIONALI: se non li trovi, lascia null
✓ CRITICO per chilometri: cerca numeri (da 1 a 6 cifre) vicino alla parola "km" anche se non c'è etichetta come "Chilometri:" o "ODO:" - possono essere sia bassi (es. 1500 per auto nuove) che alti (es. 125000)

# FORMATO OUTPUT:
Restituisci **SOLO** un oggetto JSON valido, senza markdown, senza testo aggiuntivo, senza spiegazioni:

{
  "targa": null,
  "punto_vendita": "Nome Distributore",
  "data_rifornimento": "2025-01-07",
  "tipo_carburante": "Diesel",
  "quantita": 45.50,
  "prezzo_unitario": 1.85,
  "importo_totale": 84.18,
  "chilometri": 125000
}

# TESTO OCR DA ANALIZZARE:
${extractedText}

# AZIONE:
Analizza ORA il testo OCR ed estrai tutti i dati seguendo le regole sopra. Rispondi SOLO con il JSON.`;

    console.log("Calling Gemini to analyze extracted text...");
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: geminiPrompt }],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            topP: 0.95,
            topK: 40,
            maxOutputTokens: 2048,
            responseMimeType: "application/json",
          },
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
          ]
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error("Gemini error:", geminiResponse.status, errorText);
      throw new Error(`Errore Gemini: ${geminiResponse.status}`);
    }

    const geminiData = await geminiResponse.json();
    const geminiContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!geminiContent) {
      throw new Error("Nessuna risposta da Gemini");
    }

    // Parse JSON response from Gemini
    let receiptData: ReceiptData;
    try {
      let cleanContent = geminiContent.replace(/```json\n?|\n?```/g, "").trim();
      const parsed = JSON.parse(cleanContent);

      // Map the detected fuel type to a valid database entry
      if (parsed.tipo_carburante) {
        const originalType = parsed.tipo_carburante;
        parsed.tipo_carburante = matchFuelType(originalType, availableFuelTypes);
        console.log(`Fuel type mapping: "${originalType}" -> "${parsed.tipo_carburante}"`);
      }

      // VALIDAZIONE E CORREZIONE DATI
      const validation = validateReceiptData(parsed);
      console.log(`Validation result: confidence=${validation.confidence}%, warnings=${validation.warnings.length}`);

      if (validation.warnings.length > 0) {
        console.log("Validation warnings:", validation.warnings);
      }

      // Applica correzioni automatiche se presenti
      const finalData = {
        ...parsed,
        ...(validation.correctedData || {})
      };

      receiptData = {
        ...finalData,
        raw_text: extractedText,
        confidence_score: validation.confidence,
        validation_warnings: validation.warnings.length > 0 ? validation.warnings : undefined
      };
    } catch (e) {
      console.error("Failed to parse Gemini response:", geminiContent);
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
        chilometri: null,
        raw_text: extractedText,
        confidence_score: 0,
        validation_warnings: ["Errore nel parsing della risposta Gemini"]
      };
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
