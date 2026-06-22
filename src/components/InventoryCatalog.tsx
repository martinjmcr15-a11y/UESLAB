import React, { useState, useEffect } from "react";
import { SparePart } from "../types";
import { Package, AlertTriangle, Plus, PenSquare, CornerDownRight, PlusCircle, Trash } from "lucide-react";

interface InventoryCatalogProps {
  isAdmin: boolean;
  onInventoryChanged?: () => void;
}

export default function InventoryCatalog({
  isAdmin,
  onInventoryChanged
}: InventoryCatalogProps) {
  const [parts, setParts] = useState<SparePart[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllParts, setShowAllParts] = useState(false);
  
  // Refill Form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPartName, setNewPartName] = useState("");
  const [newPartStock, setNewPartStock] = useState("5");
  const [newPartMin, setNewPartMin] = useState("3");
  const [saving, setSaving] = useState(false);

  // Quick Restock State
  const [restockId, setRestockId] = useState<string | null>(null);
  const [restockQty, setRestockQty] = useState("5");

  const loadInventory = () => {
    setLoading(true);
    fetch("/api/inventory")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load inventory");
        return res.json();
      })
      .then((data) => {
        setParts(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadInventory();
  }, []);

  const handleAddPart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartName) return;

    setSaving(true);
    fetch("/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newPartName,
        stock: parseInt(newPartStock, 10),
        minStock: parseInt(newPartMin, 10)
      })
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to add spare part");
        return res.json();
      })
      .then(() => {
        setNewPartName("");
        setNewPartStock("5");
        setNewPartMin("3");
        setShowAddForm(false);
        loadInventory();
        if (onInventoryChanged) onInventoryChanged();
      })
      .catch((err) => console.error(err))
      .finally(() => setSaving(false));
  };

  const handleRestock = (partId: string, currentStock: number) => {
    const qty = parseInt(restockQty, 10);
    if (isNaN(qty) || qty <= 0) return;

    fetch(`/api/inventory/${partId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stock: currentStock + qty
      })
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to restock");
        return res.json();
      })
      .then(() => {
        setRestockId(null);
        setRestockQty("5");
        loadInventory();
        if (onInventoryChanged) onInventoryChanged();
      })
      .catch((err) => console.error(err));
  };

  const handleDeletePart = (partId: string) => {
    if (!confirm("¿Está seguro de eliminar esta refacción del catálogo?")) return;

    fetch(`/api/inventory/${partId}`, { method: "DELETE" })
      .then((res) => {
        if (!res.ok) throw new Error("Error al intentar eliminar la refacción.");
        return res.json();
      })
      .then(() => {
        alert("¡Refacción eliminada del catálogo exitosamente!");
        loadInventory();
        if (onInventoryChanged) onInventoryChanged();
      })
      .catch((err) => alert(err.message));
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 font-sans flex items-center gap-2">
            <Package className="w-5 h-5 text-gray-700" />
            Catálogo de Refacciones Críticas
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Componentes empleados para reparaciones rápidas en salones de cómputo.
          </p>
        </div>

        {isAdmin && (
          <button
            id="btn-add-refaccion"
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-xl transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Registrar Refacción
          </button>
        )}
      </div>

      {/* Add Part Form */}
      {showAddForm && isAdmin && (
        <form 
          id="form-add-refaccion"
          onSubmit={handleAddPart} 
          className="mb-6 p-4 rounded-xl bg-gray-55/70 border border-gray-200/50 space-y-4 animate-fade-in"
        >
          <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Nueva Refacción</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Nombre del Componente</label>
              <input
                id="input-refaccion-name"
                type="text"
                value={newPartName}
                onChange={(e) => setNewPartName(e.target.value)}
                placeholder="Ej. Memoria RAM DDR4 8GB"
                className="w-full text-sm px-3 py-1.5 border border-gray-250 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Stock Inicial</label>
              <input
                id="input-refaccion-stock"
                type="number"
                value={newPartStock}
                onChange={(e) => setNewPartStock(e.target.value)}
                min="0"
                className="w-full text-sm px-3 py-1.5 border border-gray-250 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Alerta de Stock Crítico (Mín)</label>
              <input
                id="input-refaccion-min"
                type="number"
                value={newPartMin}
                onChange={(e) => setNewPartMin(e.target.value)}
                min="1"
                className="w-full text-sm px-3 py-1.5 border border-gray-250 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500"
                required
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              id="btn-refaccion-cancel"
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-xs font-medium px-3.5 py-1.5 text-gray-500 hover:text-gray-700 bg-white border border-gray-200 rounded-lg"
            >
              Cancelar
            </button>
            <button
              id="btn-refaccion-save"
              type="submit"
              disabled={saving}
              className="text-xs font-semibold px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Guardar Componente"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="py-6 flex justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-800 border-t-transparent"></div>
        </div>
      ) : parts.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">No hay refacciones dadas de alta en el inventario.</p>
      ) : (
        <div className="relative">
          <div 
            className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 transition-all duration-300 ${
              !showAllParts ? "max-h-[290px] overflow-hidden select-none pointer-events-none filter blur-[2px] opacity-70" : ""
            }`}
          >
            {parts.map((p) => {
              const isCritical = p.stock < p.minStock;
              return (
                <div 
                  key={p.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isCritical 
                      ? "bg-rose-50/40 border-rose-100 shadow-sm shadow-rose-100/30" 
                      : "bg-gray-50/50 border-gray-100 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-bold text-slate-800 font-sans break-words whitespace-normal leading-snug flex-1 pr-1 flex items-center gap-1.5">
                        {p.name}
                        {isAdmin && (
                          <button
                            id={`btn-delete-spare-${p.id}`}
                            onClick={() => handleDeletePart(p.id)}
                            className="p-0.5 text-slate-400 hover:text-rose-600 rounded duration-150 transition shrink-0"
                            title="Eliminar esta refacción del catálogo"
                          >
                            <Trash className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </h4>
                      {isCritical && (
                        <span className="flex items-center gap-1 text-[9px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded uppercase animate-pulse shrink-0">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          CRÍTICO
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${isCritical ? "bg-rose-100/60 text-rose-700" : "bg-slate-100 text-slate-700"}`}>
                        {p.stock} pz
                      </span>
                      <span className="text-[10px] text-zinc-400 font-mono">
                        (Mínimo: {p.minStock})
                      </span>
                    </div>
                  </div>

                  {isCritical && (
                    <p className="text-xs text-rose-700 font-medium font-sans mt-2">
                      🚨 Inventario insuficiente. Requiere reabastecimiento urgente.
                    </p>
                  )}

                  {/* Refill interactives */}
                  {isAdmin && (
                    <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                      {restockId === p.id ? (
                        <div className="flex items-center gap-1.5 w-full animate-fade-in">
                          <span className="text-[10px] text-gray-500 font-mono">Surtir:</span>
                          <input
                            id={`input-restock-qty-${p.id}`}
                            type="number"
                            value={restockQty}
                            onChange={(e) => setRestockQty(e.target.value)}
                            min="1"
                            className="w-12 text-xs px-1.5 py-1 border border-gray-250 bg-white rounded focus:outline-none"
                          />
                          <button
                            id={`btn-apply-restock-${p.id}`}
                            onClick={() => handleRestock(p.id, p.stock)}
                            className="text-[11px] font-semibold px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded transition"
                          >
                            Aplicar
                          </button>
                          <button
                            id={`btn-cancel-restock-${p.id}`}
                            onClick={() => setRestockId(null)}
                            className="text-[10px] px-1.5 py-1 text-gray-400 hover:text-gray-600"
                          >
                            X
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="text-[10px] font-mono text-gray-400">Suministro Escolar</span>
                          <button
                            id={`btn-restock-trigger-${p.id}`}
                            onClick={() => setRestockId(p.id)}
                            className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 font-sans"
                          >
                            <PlusCircle className="w-3.5 h-3.5" />
                            Reabastecer
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {!showAllParts && (
            <div className="absolute inset-0 bg-gradient-to-t from-white via-white/90 to-transparent flex flex-col items-center justify-end pb-4 pt-16">
              <div className="bg-white/95 backdrop-blur-md px-6 py-5 rounded-2xl border border-slate-200 shadow-xl text-center flex flex-col items-center max-w-sm">
                <Package className="w-7 h-7 text-vino-claro mb-2 animate-bounce" />
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">Catálogo de Inventario Completo</h4>
                <p className="text-[11px] text-slate-500 mb-4 leading-normal font-sans">
                  Hay <strong className="text-vino-claro font-bold">{parts.length} refacciones dadas de alta</strong>. Despliegue el contenedor para visualizarlas e iniciar reabastecimientos.
                </p>
                <button
                  type="button"
                  id="btn-expand-all-inventory"
                  onClick={() => setShowAllParts(true)}
                  className="px-4 py-2.5 bg-vino-claro hover:bg-vino-claro/90 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1.5"
                >
                  <Package className="w-3.5 h-3.5" />
                  Ver Todas las Refacciones ({parts.length})
                </button>
              </div>
            </div>
          )}

          {showAllParts && (
            <div className="flex justify-center mt-6">
              <button
                type="button"
                id="btn-collapse-inventory"
                onClick={() => setShowAllParts(false)}
                className="px-4 py-2 text-xs font-bold text-slate-650 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all hover:scale-102 active:scale-98"
              >
                Ocultar listado extenso (Colapsar refacciones)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
