import { useState, useCallback } from "react";
import { X, Upload, Camera, Loader2, AlertCircle, Check, Sparkles, AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Cantiere } from "@/pages/Dashboard";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTipiCarburante } from "@/hooks/useTipiCarburante";

// Signed URL expiry time (1 year in seconds)
const SIGNED_URL_EXPIRY_SECONDS = 31536000;

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  cantieri: Cantiere[];
}

interface ExtractedData {
  targa: string | null;
  punto_vendita: string | null;
  data_rifornimento: string | null;
  tipo_carburante: string | null;
  quantita: number | null;
  prezzo_unitario: number | null;
  importo_totale: number | null;
  chilometri: number | null;
  raw_text?: string;
  confidence_score?: number;
  validation_warnings?: string[];
}

type Step = "upload" | "processing" | "preview" | "saving";

export const UploadModal = ({
  isOpen,
  onClose,
  onComplete,
  cantieri,
}: UploadModalProps) => {
  const [step, setStep] = useState<Step>("upload");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [formData, setFormData] = useState<ExtractedData & { cantiere_id: string; chilometraggio: string }>({
    targa: null,
    punto_vendita: null,
    data_rifornimento: null,
    tipo_carburante: null,
    quantita: null,
    prezzo_unitario: null,
    importo_totale: null,
    cantiere_id: "",
    chilometraggio: "",
  });
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { tipiCarburante } = useTipiCarburante();

  const resetState = () => {
    setStep("upload");
    setImageFile(null);
    setImagePreview(null);
    setExtractedData(null);
    setFormData({
      targa: null,
      punto_vendita: null,
      data_rifornimento: null,
      tipo_carburante: null,
      quantita: null,
      prezzo_unitario: null,
      importo_totale: null,
      cantiere_id: "",
      chilometraggio: "",
    });
    setError(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFileSelect = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Seleziona un'immagine valida");
      return;
    }

    setImageFile(file);
    setError(null);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Start OCR processing
    setStep("processing");

    try {
      // Check authentication first
      const { data: { session }, error: authError } = await supabase.auth.getSession();

      console.log("Session check:", {
        hasSession: !!session,
        hasAccessToken: !!session?.access_token,
        userId: session?.user?.id,
        authError: authError?.message
      });

      if (authError) {
        console.error("Auth error:", authError);
        throw new Error(`Errore di autenticazione: ${authError.message}`);
      }

      if (!session?.access_token) {
        console.error("No valid session or access token");
        throw new Error("Sessione non valida. Effettua nuovamente il login.");
      }

      // Convert to base64
      const base64Reader = new FileReader();
      base64Reader.onloadend = async () => {
        try {
          const base64String = (base64Reader.result as string).split(",")[1];

          // Get fresh session token
          const { data: { session: currentSession } } = await supabase.auth.getSession();

          console.log("Fresh session check:", {
            hasSession: !!currentSession,
            hasAccessToken: !!currentSession?.access_token,
            userId: currentSession?.user?.id
          });

          if (!currentSession?.access_token) {
            throw new Error("Sessione scaduta, effettua nuovamente il login");
          }

          console.log("Calling OCR function with manual auth header...");

          // Use fetch directly instead of supabase.functions.invoke to have full control over headers
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ocr-receipt`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${currentSession.access_token}`,
                "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              },
              body: JSON.stringify({ image_base64: base64String }),
            }
          );

          const data = await response.json();
          const error = !response.ok ? new Error(data.error || "Edge Function returned a non-2xx status code") : null;

          console.log("OCR response:", { hasData: !!data, hasError: !!error, data, error });

          if (error) {
            console.error("OCR function error:", error);
            throw new Error(error.message || "Errore durante l'analisi");
          }

          if (!data) {
            throw new Error("Nessuna risposta dalla funzione OCR");
          }

          if (data?.error) {
            throw new Error(data.error);
          }

          const extracted = data?.data as ExtractedData;

          // Check if we actually have data
          if (!extracted || Object.keys(extracted).length === 0) {
            throw new Error("Nessun dato estratto dalla ricevuta");
          }

          setExtractedData(extracted);
          setFormData({
            ...extracted,
            cantiere_id: "",
            chilometraggio: extracted.chilometri?.toString() || "",
          });
          setStep("preview");
        } catch (innerErr) {
          console.error("OCR processing error:", innerErr);
          setError(innerErr instanceof Error ? innerErr.message : "Errore durante l'analisi");
          setStep("preview");
          // Still allow manual entry even if OCR fails
          setFormData({
            targa: null,
            punto_vendita: null,
            data_rifornimento: new Date().toISOString().split("T")[0],
            tipo_carburante: null,
            quantita: null,
            prezzo_unitario: null,
            importo_totale: null,
            cantiere_id: "",
            chilometraggio: "",
          });
        }
      };
      base64Reader.readAsDataURL(file);
    } catch (err) {
      console.error("OCR error:", err);
      setError(err instanceof Error ? err.message : "Errore durante l'analisi");
      setStep("preview");
      // Still allow manual entry even if OCR fails
      setFormData({
        targa: null,
        punto_vendita: null,
        data_rifornimento: new Date().toISOString().split("T")[0],
        tipo_carburante: null,
        quantita: null,
        prezzo_unitario: null,
        importo_totale: null,
        cantiere_id: "",
        chilometraggio: "",
      });
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const handleInputChange = (
    field: keyof typeof formData,
    value: string | number | null
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.cantiere_id) {
      setError("Seleziona un cantiere");
      return;
    }

    if (!formData.data_rifornimento) {
      setError("Inserisci la data del rifornimento");
      return;
    }

    setStep("saving");
    setError(null);

    try {
      // Get current user first (needed for storage path)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Utente non autenticato");
      }

      // Upload image if present - use user-scoped path for security
      let imageUrl = null;
      if (imageFile) {
        const fileName = `${user.id}/${Date.now()}-${imageFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from("receipts")
          .upload(fileName, imageFile);

        if (uploadError) {
          console.error("Upload error:", uploadError);
        } else {
          // Use signed URL since bucket is now private
          const { data: urlData, error: signError } = await supabase.storage
            .from("receipts")
            .createSignedUrl(fileName, SIGNED_URL_EXPIRY_SECONDS);
          
          if (!signError && urlData) {
            imageUrl = urlData.signedUrl;
          }
        }
      }

      // Insert record
      const { error: insertError } = await supabase.from("rifornimenti").insert({
        targa: formData.targa || null,
        punto_vendita: formData.punto_vendita || null,
        data_rifornimento: formData.data_rifornimento,
        tipo_carburante: formData.tipo_carburante || null,
        quantita: formData.quantita ? Number(formData.quantita) : null,
        prezzo_unitario: formData.prezzo_unitario ? Number(formData.prezzo_unitario) : null,
        importo_totale: formData.importo_totale ? Number(formData.importo_totale) : null,
        chilometraggio: formData.chilometraggio ? Number(formData.chilometraggio) : null,
        cantiere_id: formData.cantiere_id,
        immagine_url: imageUrl,
        user_id: user.id,
      });

      if (insertError) throw insertError;

      toast({
        title: "Rifornimento salvato",
        description: "Il record è stato inserito correttamente",
      });

      handleClose();
      onComplete();
    } catch (err) {
      console.error("Save error:", err);
      setError("Errore durante il salvataggio. Riprova.");
      setStep("preview");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold text-lg text-foreground">
            {step === "upload" && "Carica scontrino"}
            {step === "processing" && "Analisi in corso..."}
            {step === "preview" && "Verifica i dati"}
            {step === "saving" && "Salvataggio..."}
          </h2>
          <Button variant="ghost" size="icon" onClick={handleClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Step: Upload */}
          {step === "upload" && (
            <div
              className="upload-zone flex flex-col items-center gap-4"
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
            >
              <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center">
                <Upload className="w-8 h-8 text-accent" />
              </div>
              <div className="text-center">
                <p className="font-medium text-foreground">
                  Trascina un'immagine qui
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  oppure clicca per selezionare
                </p>
              </div>
              <div className="flex flex-wrap gap-3 justify-center">
                <label>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileSelect(file);
                    }}
                  />
                  <Button variant="outline" className="gap-2" asChild>
                    <span>
                      <Upload className="w-4 h-4" />
                      Sfoglia
                    </span>
                  </Button>
                </label>
                <label>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileSelect(file);
                    }}
                  />
                  <Button variant="outline" className="gap-2" asChild>
                    <span>
                      <Camera className="w-4 h-4" />
                      Scatta foto
                    </span>
                  </Button>
                </label>
              </div>
              
              <div className="w-full border-t border-border pt-4 mt-2">
                <Button 
                  variant="secondary" 
                  className="w-full gap-2"
                  onClick={() => {
                    setFormData({
                      targa: null,
                      punto_vendita: null,
                      data_rifornimento: new Date().toISOString().split("T")[0],
                      tipo_carburante: null,
                      quantita: null,
                      prezzo_unitario: null,
                      importo_totale: null,
                      cantiere_id: "",
                      chilometraggio: "",
                    });
                    setStep("preview");
                  }}
                >
                  Inserimento manuale (no scansione)
                </Button>
              </div>
            </div>
          )}

          {/* Step: Processing */}
          {step === "processing" && (
            <div className="flex flex-col items-center gap-4 py-12">
              <div className="relative w-24 h-24">
                {imagePreview && (
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full h-full object-cover rounded-lg"
                  />
                )}
                <div className="absolute inset-0 bg-accent/20 rounded-lg overflow-hidden">
                  <div className="absolute inset-x-0 h-1 bg-accent animate-scan" />
                </div>
              </div>
              <div className="flex items-center gap-2 text-foreground">
                <Sparkles className="w-5 h-5 text-accent animate-pulse-subtle" />
                <span className="font-medium">Estrazione dati con AI...</span>
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Stiamo analizzando lo scontrino per estrarre automaticamente i
                dati
              </p>
            </div>
          )}

          {/* Step: Preview/Edit */}
          {step === "preview" && (
            <div className="space-y-4">
              {/* Image preview */}
              {imagePreview && (
                <div className="relative w-full h-32 rounded-lg overflow-hidden bg-muted">
                  <img
                    src={imagePreview}
                    alt="Scontrino"
                    className="w-full h-full object-contain"
                  />
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-lg">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {extractedData && !error && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-success text-sm bg-success/10 p-3 rounded-lg">
                    <Check className="w-4 h-4 flex-shrink-0" />
                    <div className="flex-1">
                      <span>Dati estratti con successo.</span>
                      {extractedData.confidence_score !== undefined && (
                        <span className="ml-2 font-medium">
                          Affidabilità: {extractedData.confidence_score}%
                        </span>
                      )}
                    </div>
                  </div>

                  {extractedData.validation_warnings && extractedData.validation_warnings.length > 0 && (
                    <div className="bg-warning/10 border border-warning/20 rounded-lg p-3">
                      <div className="flex items-start gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-warning">Attenzione - Verifica questi dati:</p>
                        </div>
                      </div>
                      <ul className="text-xs text-muted-foreground space-y-1 ml-6">
                        {extractedData.validation_warnings.map((warning, idx) => (
                          <li key={idx} className="list-disc">{warning}</li>
                        ))}
                      </ul>
                      <p className="text-xs text-muted-foreground mt-2 ml-6">
                        <Info className="w-3 h-3 inline mr-1" />
                        Alcuni dati potrebbero essere stati corretti automaticamente.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Form fields */}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label>Cantiere *</Label>
                  <Select
                    value={formData.cantiere_id}
                    onValueChange={(v) => handleInputChange("cantiere_id", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona cantiere" />
                    </SelectTrigger>
                    <SelectContent>
                      {cantieri.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Data rifornimento *</Label>
                  <Input
                    type="date"
                    value={formData.data_rifornimento || ""}
                    onChange={(e) =>
                      handleInputChange("data_rifornimento", e.target.value)
                    }
                  />
                </div>

                <div>
                  <Label>Targa</Label>
                  <Input
                    value={formData.targa || ""}
                    onChange={(e) => handleInputChange("targa", e.target.value)}
                    placeholder="AB123CD"
                  />
                </div>

                <div>
                  <Label>Tipo carburante</Label>
                  <Select
                    value={formData.tipo_carburante || ""}
                    onValueChange={(v) => handleInputChange("tipo_carburante", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona" />
                    </SelectTrigger>
                    <SelectContent>
                      {tipiCarburante.map((tipo) => (
                        <SelectItem key={tipo.id} value={tipo.nome}>
                          {tipo.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Quantità (L)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.quantita ?? ""}
                    onChange={(e) =>
                      handleInputChange(
                        "quantita",
                        e.target.value ? parseFloat(e.target.value) : null
                      )
                    }
                    placeholder="45.50"
                  />
                </div>

                <div>
                  <Label>Prezzo unitario (€/L)</Label>
                  <Input
                    type="number"
                    step="0.001"
                    value={formData.prezzo_unitario ?? ""}
                    onChange={(e) =>
                      handleInputChange(
                        "prezzo_unitario",
                        e.target.value ? parseFloat(e.target.value) : null
                      )
                    }
                    placeholder="1.789"
                  />
                </div>

                <div>
                  <Label>Importo totale (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.importo_totale ?? ""}
                    onChange={(e) =>
                      handleInputChange(
                        "importo_totale",
                        e.target.value ? parseFloat(e.target.value) : null
                      )
                    }
                    placeholder="81.40"
                  />
                </div>

                <div>
                  <Label>Chilometraggio</Label>
                  <Input
                    type="number"
                    value={formData.chilometraggio || ""}
                    onChange={(e) =>
                      handleInputChange("chilometraggio", e.target.value)
                    }
                    placeholder="125000"
                  />
                </div>

                <div className="col-span-2">
                  <Label>Punto vendita</Label>
                  <Input
                    value={formData.punto_vendita || ""}
                    onChange={(e) =>
                      handleInputChange("punto_vendita", e.target.value)
                    }
                    placeholder="Eni, IP, Q8, ecc."
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step: Saving */}
          {step === "saving" && (
            <div className="flex flex-col items-center gap-4 py-12">
              <Loader2 className="w-12 h-12 text-accent animate-spin" />
              <p className="font-medium text-foreground">Salvataggio in corso...</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === "preview" && (
          <div className="flex gap-3 p-4 border-t border-border">
            <Button variant="outline" className="flex-1" onClick={handleClose}>
              Annulla
            </Button>
            <Button className="flex-1 btn-hero" onClick={handleSubmit}>
              <Check className="w-4 h-4 mr-2" />
              Salva rifornimento
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
