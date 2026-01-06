import { useState, useMemo } from "react";
import {
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  X,
  Calendar,
  Building2,
  Car,
  Fuel,
  Pencil,
  Trash2,
  MoreHorizontal,
  CalendarIcon,
  Download,
} from "lucide-react";
import * as XLSX from "xlsx";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Rifornimento, Cantiere } from "@/pages/Dashboard";
import { EditRifornimentoModal } from "./EditRifornimentoModal";
import { DeleteRifornimentoDialog } from "./DeleteRifornimentoDialog";
import { format, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface RifornimentiTableProps {
  rifornimenti: Rifornimento[];
  cantieri: Cantiere[];
  isLoading: boolean;
  onRefresh: () => void;
}

type SortField = "data_rifornimento" | "importo_totale" | "quantita" | "targa";
type SortDirection = "asc" | "desc";

export const RifornimentiTable = ({
  rifornimenti,
  cantieri,
  isLoading,
  onRefresh,
}: RifornimentiTableProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCantiere, setFilterCantiere] = useState<string>("all");
  const [filterCarburante, setFilterCarburante] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [sortField, setSortField] = useState<SortField>("data_rifornimento");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [showFilters, setShowFilters] = useState(false);
  
  const [editingRifornimento, setEditingRifornimento] = useState<Rifornimento | null>(null);
  const [deletingRifornimento, setDeletingRifornimento] = useState<Rifornimento | null>(null);

  const carburantiUnique = useMemo(() => {
    const types = new Set(
      rifornimenti.map((r) => r.tipo_carburante).filter(Boolean) as string[]
    );
    return Array.from(types).sort();
  }, [rifornimenti]);

  const filteredAndSortedData = useMemo(() => {
    let data = [...rifornimenti];

    // Apply search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      data = data.filter(
        (r) =>
          r.targa?.toLowerCase().includes(term) ||
          r.punto_vendita?.toLowerCase().includes(term) ||
          r.cantieri?.nome.toLowerCase().includes(term)
      );
    }

    // Apply cantiere filter
    if (filterCantiere && filterCantiere !== "all") {
      data = data.filter((r) => r.cantiere_id === filterCantiere);
    }

    // Apply carburante filter
    if (filterCarburante && filterCarburante !== "all") {
      data = data.filter((r) => r.tipo_carburante === filterCarburante);
    }

    // Apply date range filter
    if (dateFrom) {
      data = data.filter((r) => {
        const rifDate = new Date(r.data_rifornimento);
        return !isBefore(rifDate, startOfDay(dateFrom));
      });
    }
    if (dateTo) {
      data = data.filter((r) => {
        const rifDate = new Date(r.data_rifornimento);
        return !isAfter(rifDate, endOfDay(dateTo));
      });
    }

    // Apply sorting
    data.sort((a, b) => {
      let aVal: any, bVal: any;

      switch (sortField) {
        case "data_rifornimento":
          aVal = new Date(a.data_rifornimento).getTime();
          bVal = new Date(b.data_rifornimento).getTime();
          break;
        case "importo_totale":
          aVal = a.importo_totale || 0;
          bVal = b.importo_totale || 0;
          break;
        case "quantita":
          aVal = a.quantita || 0;
          bVal = b.quantita || 0;
          break;
        case "targa":
          aVal = a.targa || "";
          bVal = b.targa || "";
          break;
        default:
          return 0;
      }

      if (sortDirection === "asc") {
        return aVal > bVal ? 1 : -1;
      }
      return aVal < bVal ? 1 : -1;
    });

    return data;
  }, [rifornimenti, searchTerm, filterCantiere, filterCarburante, dateFrom, dateTo, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? (
      <ChevronUp className="w-4 h-4" />
    ) : (
      <ChevronDown className="w-4 h-4" />
    );
  };

  const getFuelBadgeClass = (tipo: string | null) => {
    if (!tipo) return "bg-muted text-muted-foreground";
    const lower = tipo.toLowerCase();
    if (lower.includes("diesel") || lower.includes("gasolio")) return "fuel-diesel";
    if (lower.includes("benzina")) return "fuel-benzina";
    if (lower.includes("gpl")) return "fuel-gpl";
    if (lower.includes("metano")) return "fuel-metano";
    return "bg-muted text-muted-foreground";
  };

  const clearFilters = () => {
    setSearchTerm("");
    setFilterCantiere("all");
    setFilterCarburante("all");
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const handleExportExcel = () => {
    const exportData = filteredAndSortedData.map((r) => ({
      "Data": format(new Date(r.data_rifornimento), "dd/MM/yyyy", { locale: it }),
      "Targa": r.targa || "",
      "Carburante": r.tipo_carburante || "",
      "Litri": r.quantita || "",
      "Prezzo/L": r.prezzo_unitario || "",
      "Totale": r.importo_totale || "",
      "Km": r.chilometraggio || "",
      "Cantiere": r.cantieri?.nome || "",
      "Stazione": r.punto_vendita || "",
      "Note": r.note || "",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rifornimenti");
    
    const fileName = `rifornimenti_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const hasActiveFilters = searchTerm || filterCantiere !== "all" || filterCarburante !== "all" || dateFrom || dateTo;

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="p-4 border-b border-border">
          <Skeleton className="h-10 w-full max-w-sm" />
        </div>
        <div className="p-4 space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden animate-fade-in">
      {/* Search and filters bar */}
      <div className="p-4 border-b border-border space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Cerca per targa, stazione, cantiere..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-2"
          >
            <Filter className="w-4 h-4" />
            Filtri
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
                {[searchTerm, filterCantiere !== "all", filterCarburante !== "all", dateFrom, dateTo].filter(Boolean).length}
              </Badge>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={handleExportExcel}
            className="gap-2"
            disabled={filteredAndSortedData.length === 0}
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Esporta Excel</span>
          </Button>
        </div>

        {/* Expanded filters */}
        {showFilters && (
          <div className="flex flex-wrap gap-3 pt-2">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <Select value={filterCantiere} onValueChange={setFilterCantiere}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Tutti i cantieri" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti i cantieri</SelectItem>
                  {cantieri.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Fuel className="w-4 h-4 text-muted-foreground" />
              <Select value={filterCarburante} onValueChange={setFilterCarburante}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Tutti i carburanti" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti</SelectItem>
                  {carburantiUnique.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date range filter */}
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-muted-foreground" />
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[140px] justify-start text-left font-normal",
                      !dateFrom && "text-muted-foreground"
                    )}
                  >
                    {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Da"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={dateFrom}
                    onSelect={setDateFrom}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                    locale={it}
                  />
                </PopoverContent>
              </Popover>
              <span className="text-muted-foreground">—</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[140px] justify-start text-left font-normal",
                      !dateTo && "text-muted-foreground"
                    )}
                  >
                    {dateTo ? format(dateTo, "dd/MM/yyyy") : "A"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={dateTo}
                    onSelect={setDateTo}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                    locale={it}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
                <X className="w-4 h-4" />
                Pulisci
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th
                className="cursor-pointer hover:bg-muted transition-colors"
                onClick={() => handleSort("data_rifornimento")}
              >
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  Data
                  <SortIcon field="data_rifornimento" />
                </div>
              </th>
              <th
                className="cursor-pointer hover:bg-muted transition-colors"
                onClick={() => handleSort("targa")}
              >
                <div className="flex items-center gap-1">
                  <Car className="w-4 h-4" />
                  Targa
                  <SortIcon field="targa" />
                </div>
              </th>
              <th className="text-left">Carburante</th>
              <th
                className="cursor-pointer hover:bg-muted transition-colors text-right"
                onClick={() => handleSort("quantita")}
              >
                <div className="flex items-center justify-end gap-1">
                  Litri
                  <SortIcon field="quantita" />
                </div>
              </th>
              <th className="text-right">Prezzo/L</th>
              <th
                className="cursor-pointer hover:bg-muted transition-colors text-right"
                onClick={() => handleSort("importo_totale")}
              >
                <div className="flex items-center justify-end gap-1">
                  Totale
                  <SortIcon field="importo_totale" />
                </div>
              </th>
              <th className="hidden sm:table-cell text-right">Km</th>
              <th className="hidden md:table-cell text-left">Cantiere</th>
              <th className="hidden lg:table-cell text-left">Stazione</th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedData.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Fuel className="w-12 h-12 opacity-20" />
                    <p>Nessun rifornimento trovato</p>
                    {hasActiveFilters && (
                      <Button variant="link" onClick={clearFilters} className="mt-2">
                        Rimuovi filtri
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              filteredAndSortedData.map((r) => (
                <tr key={r.id} className="group">
                  <td className="font-medium">
                    {format(new Date(r.data_rifornimento), "dd MMM yyyy", { locale: it })}
                  </td>
                  <td>
                    <span className="font-mono text-sm">
                      {r.targa || <span className="text-muted-foreground">—</span>}
                    </span>
                  </td>
                  <td>
                    <Badge variant="outline" className={getFuelBadgeClass(r.tipo_carburante)}>
                      {r.tipo_carburante || "N/D"}
                    </Badge>
                  </td>
                  <td className="text-right tabular-nums">
                    {r.quantita?.toLocaleString("it-IT", { minimumFractionDigits: 2 }) || "—"}
                  </td>
                  <td className="text-right tabular-nums text-muted-foreground">
                    {r.prezzo_unitario
                      ? `€ ${r.prezzo_unitario.toLocaleString("it-IT", { minimumFractionDigits: 3 })}`
                      : "—"}
                  </td>
                  <td className="text-right tabular-nums font-semibold">
                    {r.importo_totale
                      ? `€ ${r.importo_totale.toLocaleString("it-IT", { minimumFractionDigits: 2 })}`
                      : "—"}
                  </td>
                  <td className="hidden sm:table-cell text-right tabular-nums text-muted-foreground">
                    {r.chilometraggio?.toLocaleString("it-IT") || "—"}
                  </td>
                  <td className="hidden md:table-cell text-muted-foreground text-sm">
                    {r.cantieri?.nome || "—"}
                  </td>
                  <td className="hidden lg:table-cell text-muted-foreground text-sm truncate max-w-[200px]">
                    {r.punto_vendita || "—"}
                  </td>
                  <td>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingRifornimento(r)}>
                          <Pencil className="w-4 h-4 mr-2" />
                          Modifica
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDeletingRifornimento(r)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Elimina
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer with count */}
      <div className="p-3 border-t border-border bg-muted/30">
        <p className="text-xs text-muted-foreground text-center">
          Visualizzati {filteredAndSortedData.length} di {rifornimenti.length} rifornimenti
        </p>
      </div>

      {/* Edit Modal */}
      <EditRifornimentoModal
        isOpen={!!editingRifornimento}
        onClose={() => setEditingRifornimento(null)}
        onComplete={onRefresh}
        rifornimento={editingRifornimento}
        cantieri={cantieri}
      />

      {/* Delete Dialog */}
      <DeleteRifornimentoDialog
        isOpen={!!deletingRifornimento}
        onClose={() => setDeletingRifornimento(null)}
        onComplete={onRefresh}
        rifornimento={deletingRifornimento}
      />
    </div>
  );
};
