import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, LogOut, Fuel, FileSpreadsheet, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RifornimentiTable } from "@/components/RifornimentiTable";
import { UploadModal } from "@/components/UploadModal";
import { GestioneCantieriModal } from "@/components/GestioneCantieriModal";
import { StatsCards } from "@/components/StatsCards";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";

export interface Rifornimento {
  id: string;
  targa: string | null;
  punto_vendita: string | null;
  data_rifornimento: string;
  tipo_carburante: string | null;
  quantita: number | null;
  prezzo_unitario: number | null;
  importo_totale: number | null;
  chilometraggio: number | null;
  cantiere_id: string;
  note: string | null;
  immagine_url: string | null;
  data_inserimento: string;
  cantieri?: { nome: string };
}

export interface Cantiere {
  id: string;
  nome: string;
  attivo: boolean;
}

const Dashboard = () => {
  const [rifornimenti, setRifornimenti] = useState<Rifornimento[]>([]);
  const [cantieri, setCantieri] = useState<Cantiere[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isCantieriModalOpen, setIsCantieriModalOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [rifornimentiRes, cantieriRes] = await Promise.all([
        supabase
          .from("rifornimenti")
          .select("*, cantieri(nome)")
          .order("data_rifornimento", { ascending: false }),
        supabase.from("cantieri").select("*").eq("attivo", true).order("nome"),
      ]);

      if (rifornimentiRes.error) throw rifornimentiRes.error;
      if (cantieriRes.error) throw cantieriRes.error;

      setRifornimenti(rifornimentiRes.data || []);
      setCantieri(cantieriRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i dati",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const { session } = useAuthRedirect({
    redirectTo: "/",
    requireAuth: true,
    onSessionReady: fetchData
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const handleUploadComplete = () => {
    setIsUploadModalOpen(false);
    fetchData();
  };

  // Show loading while checking auth
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Fuel className="w-12 h-12 text-primary mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Caricamento...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-sm border-b border-border">
        <div className="container-padding py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="FuelFlow Logo" className="w-10 h-10 drop-shadow-[0_0_3px_rgba(234,88,12,0.25)]" />
              <div className="hidden sm:block">
                <h1 className="font-semibold text-foreground">FuelFlow</h1>
                <p className="text-xs text-muted-foreground">Dashboard operativa</p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCantieriModalOpen(true)}
                className="gap-2"
              >
                <Building2 className="w-4 h-4" />
                <span className="hidden sm:inline">Cantieri</span>
              </Button>
              
              <Button
                onClick={() => setIsUploadModalOpen(true)}
                className="btn-hero gap-2"
                size="sm"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Nuovo Rifornimento</span>
                <span className="sm:hidden">Nuovo</span>
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="text-muted-foreground hover:text-foreground"
              >
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container-padding py-6">
        {/* Stats */}
        <StatsCards rifornimenti={rifornimenti} cantieri={cantieri} isLoading={isLoading} />

        {/* Table section */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-muted-foreground" />
              <h2 className="font-semibold text-foreground">Registro Rifornimenti</h2>
            </div>
            <span className="text-sm text-muted-foreground">
              {rifornimenti.length} {rifornimenti.length === 1 ? "record" : "records"}
            </span>
          </div>

          <RifornimentiTable
            rifornimenti={rifornimenti}
            cantieri={cantieri}
            isLoading={isLoading}
            onRefresh={fetchData}
          />
        </div>
      </main>

      {/* Upload Modal */}
      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onComplete={handleUploadComplete}
        cantieri={cantieri}
      />

      {/* Gestione Cantieri Modal */}
      <GestioneCantieriModal
        isOpen={isCantieriModalOpen}
        onClose={() => setIsCantieriModalOpen(false)}
        cantieri={cantieri}
        onRefresh={fetchData}
      />
    </div>
  );
};

export default Dashboard;
