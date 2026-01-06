import { useState } from "react";
import { Plus, Trash2, Building2, Pencil, Check, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Cantiere } from "@/pages/Dashboard";

interface GestioneCantieriModalProps {
  isOpen: boolean;
  onClose: () => void;
  cantieri: Cantiere[];
  onRefresh: () => void;
}

export const GestioneCantieriModal = ({
  isOpen,
  onClose,
  cantieri,
  onRefresh,
}: GestioneCantieriModalProps) => {
  const [newCantiereName, setNewCantiereName] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const handleAddCantiere = async () => {
    if (!newCantiereName.trim()) {
      toast({
        title: "Errore",
        description: "Inserisci un nome per il cantiere",
        variant: "destructive",
      });
      return;
    }

    setIsAdding(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Utente non autenticato");
      }

      const { error } = await supabase
        .from("cantieri")
        .insert({ nome: newCantiereName.trim(), user_id: user.id });

      if (error) throw error;

      toast({
        title: "Cantiere aggiunto",
        description: `"${newCantiereName}" è stato aggiunto con successo`,
      });
      setNewCantiereName("");
      onRefresh();
    } catch (error) {
      console.error("Error adding cantiere:", error);
      toast({
        title: "Errore",
        description: "Impossibile aggiungere il cantiere",
        variant: "destructive",
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleStartEdit = (cantiere: Cantiere) => {
    setEditingId(cantiere.id);
    setEditingName(cantiere.nome);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  const handleSaveEdit = async () => {
    if (!editingName.trim() || !editingId) {
      toast({
        title: "Errore",
        description: "Il nome non può essere vuoto",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("cantieri")
        .update({ nome: editingName.trim() })
        .eq("id", editingId);

      if (error) throw error;

      toast({
        title: "Cantiere modificato",
        description: "Il nome è stato aggiornato con successo",
      });
      setEditingId(null);
      setEditingName("");
      onRefresh();
    } catch (error) {
      console.error("Error updating cantiere:", error);
      toast({
        title: "Errore",
        description: "Impossibile modificare il cantiere",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCantiere = async (cantiere: Cantiere) => {
    setDeletingId(cantiere.id);
    try {
      const { error } = await supabase
        .from("cantieri")
        .delete()
        .eq("id", cantiere.id);

      if (error) throw error;

      toast({
        title: "Cantiere eliminato",
        description: `"${cantiere.nome}" è stato eliminato`,
      });
      onRefresh();
    } catch (error: any) {
      console.error("Error deleting cantiere:", error);
      
      if (error.code === "23503") {
        toast({
          title: "Impossibile eliminare",
          description: "Questo cantiere ha dei rifornimenti associati. Elimina prima i rifornimenti.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Errore",
          description: "Impossibile eliminare il cantiere",
          variant: "destructive",
        });
      }
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Gestione Cantieri
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Add new cantiere */}
          <div className="flex gap-2">
            <Input
              placeholder="Nome nuovo cantiere..."
              value={newCantiereName}
              onChange={(e) => setNewCantiereName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddCantiere()}
            />
            <Button
              onClick={handleAddCantiere}
              disabled={isAdding || !newCantiereName.trim()}
              className="shrink-0"
            >
              <Plus className="w-4 h-4 mr-1" />
              Aggiungi
            </Button>
          </div>

          {/* List of cantieri */}
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-2">
              {cantieri.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nessun cantiere presente
                </p>
              ) : (
                cantieri.map((cantiere) => (
                  <div
                    key={cantiere.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg group"
                  >
                    {editingId === cantiere.id ? (
                      <div className="flex items-center gap-2 flex-1">
                        <Input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveEdit();
                            if (e.key === "Escape") handleCancelEdit();
                          }}
                          className="h-8"
                          autoFocus
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleSaveEdit}
                          disabled={isSaving || !editingName.trim()}
                          className="h-8 w-8 text-green-600 hover:text-green-700"
                        >
                          {isSaving ? (
                            <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Check className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleCancelEdit}
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <span className="font-medium">{cantiere.nome}</span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleStartEdit(cantiere)}
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteCantiere(cantiere)}
                            disabled={deletingId === cantiere.id}
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          >
                            {deletingId === cantiere.id ? (
                              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};
