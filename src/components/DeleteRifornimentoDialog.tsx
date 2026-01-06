import { useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Rifornimento } from "@/pages/Dashboard";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface DeleteRifornimentoDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  rifornimento: Rifornimento | null;
}

export const DeleteRifornimentoDialog = ({
  isOpen,
  onClose,
  onComplete,
  rifornimento,
}: DeleteRifornimentoDialogProps) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  const handleDelete = async () => {
    if (!rifornimento) return;

    setIsDeleting(true);

    try {
      const { error } = await supabase
        .from("rifornimenti")
        .delete()
        .eq("id", rifornimento.id);

      if (error) throw error;

      toast({
        title: "Rifornimento eliminato",
        description: "Il record è stato rimosso",
      });

      onClose();
      onComplete();
    } catch (err) {
      console.error("Delete error:", err);
      toast({
        title: "Errore",
        description: "Impossibile eliminare il rifornimento",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!rifornimento) return null;

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
            <AlertDialogTitle>Elimina rifornimento</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="pt-2">
            Sei sicuro di voler eliminare questo rifornimento?
            <div className="mt-3 p-3 bg-muted rounded-lg text-sm text-foreground">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Data:</span>
                <span className="font-medium">
                  {format(new Date(rifornimento.data_rifornimento), "dd MMMM yyyy", { locale: it })}
                </span>
              </div>
              {rifornimento.targa && (
                <div className="flex justify-between mt-1">
                  <span className="text-muted-foreground">Targa:</span>
                  <span className="font-mono">{rifornimento.targa}</span>
                </div>
              )}
              {rifornimento.importo_totale && (
                <div className="flex justify-between mt-1">
                  <span className="text-muted-foreground">Importo:</span>
                  <span className="font-semibold">
                    € {rifornimento.importo_totale.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
            </div>
            <p className="mt-3 text-destructive text-sm">
              Questa azione non può essere annullata.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isDeleting}>
            Annulla
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Eliminazione...
              </>
            ) : (
              "Elimina"
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
