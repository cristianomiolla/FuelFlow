import { useState, useEffect } from "react";
import { X, Loader2, AlertCircle } from "lucide-react";
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
import { Rifornimento, Cantiere } from "@/pages/Dashboard";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface EditRifornimentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  rifornimento: Rifornimento | null;
  cantieri: Cantiere[];
}

export const EditRifornimentoModal = ({
  isOpen,
  onClose,
  onComplete,
  rifornimento,
  cantieri,
}: EditRifornimentoModalProps) => {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tipiCarburante, setTipiCarburante] = useState<{ id: string; nome: string }[]>([]);
  const { toast } = useToast();

  // Fetch fuel types from database
  useEffect(() => {
    const fetchTipiCarburante = async () => {
      const { data, error } = await supabase
        .from("tipi_carburante")
        .select("id, nome")
        .eq("attivo", true)
        .order("nome");
      
      if (!error && data) {
        setTipiCarburante(data);
      }
    };
    fetchTipiCarburante();
  }, []);

  const [formData, setFormData] = useState({
    targa: "",
    punto_vendita: "",
    data_rifornimento: "",
    tipo_carburante: "",
    quantita: "",
    prezzo_unitario: "",
    importo_totale: "",
    chilometraggio: "",
    cantiere_id: "",
  });

  useEffect(() => {
    if (rifornimento) {
      setFormData({
        targa: rifornimento.targa || "",
        punto_vendita: rifornimento.punto_vendita || "",
        data_rifornimento: rifornimento.data_rifornimento || "",
        tipo_carburante: rifornimento.tipo_carburante || "",
        quantita: rifornimento.quantita?.toString() || "",
        prezzo_unitario: rifornimento.prezzo_unitario?.toString() || "",
        importo_totale: rifornimento.importo_totale?.toString() || "",
        chilometraggio: rifornimento.chilometraggio?.toString() || "",
        cantiere_id: rifornimento.cantiere_id || "",
      });
      setError(null);
    }
  }, [rifornimento]);

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!rifornimento) return;

    if (!formData.cantiere_id) {
      setError("Seleziona un cantiere");
      return;
    }

    if (!formData.data_rifornimento) {
      setError("Inserisci la data del rifornimento");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from("rifornimenti")
        .update({
          targa: formData.targa || null,
          punto_vendita: formData.punto_vendita || null,
          data_rifornimento: formData.data_rifornimento,
          tipo_carburante: formData.tipo_carburante || null,
          quantita: formData.quantita ? Number(formData.quantita) : null,
          prezzo_unitario: formData.prezzo_unitario ? Number(formData.prezzo_unitario) : null,
          importo_totale: formData.importo_totale ? Number(formData.importo_totale) : null,
          chilometraggio: formData.chilometraggio ? Number(formData.chilometraggio) : null,
          cantiere_id: formData.cantiere_id,
        })
        .eq("id", rifornimento.id);

      if (updateError) throw updateError;

      toast({
        title: "Rifornimento aggiornato",
        description: "Le modifiche sono state salvate",
      });

      onClose();
      onComplete();
    } catch (err) {
      console.error("Update error:", err);
      setError("Errore durante il salvataggio. Riprova.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !rifornimento) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold text-lg text-foreground">
            Modifica rifornimento
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose} disabled={isSaving}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-lg">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
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
                  value={formData.data_rifornimento}
                  onChange={(e) => handleInputChange("data_rifornimento", e.target.value)}
                />
              </div>

              <div>
                <Label>Targa</Label>
                <Input
                  value={formData.targa}
                  onChange={(e) => handleInputChange("targa", e.target.value)}
                  placeholder="AB123CD"
                />
              </div>

              <div>
                <Label>Tipo carburante</Label>
                <Select
                  value={formData.tipo_carburante}
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
                  value={formData.quantita}
                  onChange={(e) => handleInputChange("quantita", e.target.value)}
                  placeholder="45.50"
                />
              </div>

              <div>
                <Label>Prezzo unitario (€/L)</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={formData.prezzo_unitario}
                  onChange={(e) => handleInputChange("prezzo_unitario", e.target.value)}
                  placeholder="1.789"
                />
              </div>

              <div>
                <Label>Importo totale (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.importo_totale}
                  onChange={(e) => handleInputChange("importo_totale", e.target.value)}
                  placeholder="81.40"
                />
              </div>

              <div>
                <Label>Chilometraggio</Label>
                <Input
                  type="number"
                  value={formData.chilometraggio}
                  onChange={(e) => handleInputChange("chilometraggio", e.target.value)}
                  placeholder="125000"
                />
              </div>

              <div className="col-span-2">
                <Label>Punto vendita</Label>
                <Input
                  value={formData.punto_vendita}
                  onChange={(e) => handleInputChange("punto_vendita", e.target.value)}
                  placeholder="Eni, IP, Q8, ecc."
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-4 border-t border-border bg-muted/30">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={isSaving}>
            Annulla
          </Button>
          <Button className="flex-1 btn-hero" onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvataggio...
              </>
            ) : (
              "Salva modifiche"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
