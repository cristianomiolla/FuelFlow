import { useState, useMemo } from "react";
import { Fuel, Euro, TrendingUp, Calendar, BarChart3, ChevronLeft, ChevronRight } from "lucide-react";
import { Rifornimento, Cantiere } from "@/pages/Dashboard";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { format, setMonth, setYear } from "date-fns";
import { it } from "date-fns/locale";

interface StatsCardsProps {
  rifornimenti: Rifornimento[];
  cantieri: Cantiere[];
  isLoading: boolean;
}

export const StatsCards = ({ rifornimenti, cantieri, isLoading }: StatsCardsProps) => {
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth());
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedCantiere, setSelectedCantiere] = useState<string | null>(null);

  // Get available years from data
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    rifornimenti.forEach(r => {
      const date = new Date(r.data_rifornimento);
      years.add(date.getFullYear());
    });
    years.add(currentDate.getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [rifornimenti]);

  const selectedDate = useMemo(() => {
    return setYear(setMonth(new Date(), selectedMonth), selectedYear);
  }, [selectedMonth, selectedYear]);

  // Filter rifornimenti by selected month/year and cantiere
  const filteredRifornimenti = useMemo(() => {
    return rifornimenti.filter((r) => {
      const date = new Date(r.data_rifornimento);
      const matchesMonth = date.getMonth() === selectedMonth && date.getFullYear() === selectedYear;
      const matchesCantiere = !selectedCantiere || r.cantiere_id === selectedCantiere;
      return matchesMonth && matchesCantiere;
    });
  }, [rifornimenti, selectedMonth, selectedYear, selectedCantiere]);

  // Calculate stats
  const totalLitri = filteredRifornimenti.reduce(
    (sum, r) => sum + (r.quantita || 0),
    0
  );

  const totalSpesa = filteredRifornimenti.reduce(
    (sum, r) => sum + (r.importo_totale || 0),
    0
  );

  const avgPrezzo = filteredRifornimenti.length > 0
    ? filteredRifornimenti.reduce((sum, r) => sum + (r.prezzo_unitario || 0), 0) /
      filteredRifornimenti.filter((r) => r.prezzo_unitario).length || 0
    : 0;

  const stats = [
    {
      label: "Rifornimenti",
      value: filteredRifornimenti.length,
      icon: Calendar,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      label: "Litri erogati",
      value: `${totalLitri.toLocaleString("it-IT", { maximumFractionDigits: 0 })} L`,
      icon: Fuel,
      color: "text-accent",
      bgColor: "bg-accent/10",
    },
    {
      label: "Spesa totale",
      value: `€ ${totalSpesa.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: Euro,
      color: "text-success",
      bgColor: "bg-success/10",
    },
    {
      label: "Prezzo medio/L",
      value: `€ ${avgPrezzo.toLocaleString("it-IT", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`,
      icon: TrendingUp,
      color: "text-warning",
      bgColor: "bg-warning/10",
    },
  ];

  const handleMonthChange = (value: number[]) => {
    setSelectedMonth(value[0]);
  };

  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(prev => prev - 1);
    } else {
      setSelectedMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(prev => prev + 1);
    } else {
      setSelectedMonth(prev => prev + 1);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5" />
          <Skeleton className="h-6 w-40" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-card rounded-xl border border-border p-4">
              <Skeleton className="h-4 w-20 mb-3" />
              <Skeleton className="h-8 w-32" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-muted-foreground" />
          <h2 className="font-semibold text-foreground">Statistiche Generali</h2>
        </div>
      </div>

      {/* Month Selector */}
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <button 
            onClick={handlePrevMonth}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-muted-foreground" />
          </button>
          <div className="text-center">
            <span className="font-medium text-foreground capitalize">
              {format(selectedDate, "MMMM yyyy", { locale: it })}
            </span>
          </div>
          <button 
            onClick={handleNextMonth}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
        <Slider
          value={[selectedMonth]}
          onValueChange={handleMonthChange}
          min={0}
          max={11}
          step={1}
          className="w-full"
        />
        <div className="flex justify-between mt-2 text-xs text-muted-foreground">
          <span>Gen</span>
          <span>Feb</span>
          <span>Mar</span>
          <span>Apr</span>
          <span>Mag</span>
          <span>Giu</span>
          <span>Lug</span>
          <span>Ago</span>
          <span>Set</span>
          <span>Ott</span>
          <span>Nov</span>
          <span>Dic</span>
        </div>
      </div>

      {/* Cantiere Chips */}
      {cantieri.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Badge
            variant={selectedCantiere === null ? "default" : "outline"}
            className="cursor-pointer transition-colors"
            onClick={() => setSelectedCantiere(null)}
          >
            Tutti i cantieri
          </Badge>
          {cantieri.map((cantiere) => (
            <Badge
              key={cantiere.id}
              variant={selectedCantiere === cantiere.id ? "default" : "outline"}
              className="cursor-pointer transition-colors"
              onClick={() => setSelectedCantiere(cantiere.id)}
            >
              {cantiere.nome}
            </Badge>
          ))}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-card rounded-xl border border-border p-4 card-elevated animate-fade-in"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-8 h-8 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
            <p className="text-lg sm:text-xl font-bold text-foreground tabular-nums">
              {stat.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
