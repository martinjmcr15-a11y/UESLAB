import React, { useEffect, useState } from "react";
import { MaintenanceLog } from "../types";
import { X, Calendar, User, Wrench, AlertTriangle, CheckCircle, FileText, Image } from "lucide-react";

interface ComputerHistoryModalProps {
  pcId: string;
  pcTag: string;
  roomName: string;
  onClose: () => void;
}

export default function ComputerHistoryModal({
  pcId,
  pcTag,
  roomName,
  onClose
}: ComputerHistoryModalProps) {
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/pcs/${pcId}/history`)
      .then((res) => {
        if (!res.ok) throw new Error("Error loading computer history");
        return res.json();
      })
      .then((data) => {
        // Sort newest first
        const sorted = data.sort((a: MaintenanceLog, b: MaintenanceLog) => 
          new Date(b.changeDate).getTime() - new Date(a.changeDate).getTime()
        );
        setLogs(sorted);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [pcId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div 
        id="computer-history-modal"
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] border border-gray-100"
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full uppercase">
                Historial Clínico
              </span>
              <span className="text-sm font-medium text-gray-500">
                {roomName}
              </span>
            </div>
            <h3 className="text-xl font-semibold mt-1 text-gray-900 font-sans">
              Equipo: <span className="font-mono text-blue-700">{pcTag}</span>
            </h3>
          </div>
          <button 
            id="close-history-modal"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent mb-3"></div>
              <p className="text-sm text-gray-505">Cargando bitácora de mantenimiento...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                <FileText className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-600">Sin historial registrado</p>
              <p className="text-xs text-gray-400 max-w-xs mt-1">Este equipo no ha recibido reparaciones ni reportes de mantenimiento preventivo hasta la fecha.</p>
            </div>
          ) : (
            <div className="relative border-l border-gray-200 ml-4 py-2 space-y-8">
              {logs.map((log) => {
                // Determine icon and colors based on state
                let statusIcon = <Wrench className="w-4 h-4 text-amber-600" />;
                let statusBg = "bg-amber-100";
                let statusTitle = "Mantenimiento";
                let statusColorClass = "text-amber-800 bg-amber-50";

                if (log.type === "Reparado") {
                  statusIcon = <CheckCircle className="w-4 h-4 text-emerald-600" />;
                  statusBg = "bg-emerald-100";
                  statusTitle = "Reparado con Éxito";
                  statusColorClass = "text-emerald-800 bg-emerald-50";
                } else if (log.type === "Irreparable") {
                  statusIcon = <AlertTriangle className="w-4 h-4 text-rose-600" />;
                  statusBg = "bg-rose-100";
                  statusTitle = "Declarado Irreparable";
                  statusColorClass = "text-rose-800 bg-rose-50";
                }

                return (
                  <div key={log.id} className="relative pl-8 group">
                    {/* Circle Bullet Badge */}
                    <div className={`absolute -left-3 top-1.5 w-6 h-6 rounded-full flex items-center justify-center ring-4 ring-white ${statusBg}`}>
                      {statusIcon}
                    </div>

                    <div className="bg-gray-50/70 hover:bg-gray-50 p-4 rounded-xl border border-gray-100 transition duration-150">
                      {/* Top bar info */}
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${statusColorClass}`}>
                          {statusTitle}
                        </span>

                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-gray-400" />
                            {log.changeDate}
                          </span>
                          <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-gray-400" />
                            {log.studentName}
                          </span>
                        </div>
                      </div>

                      {/* Diagnostic details */}
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs text-gray-400 font-mono uppercase tracking-wide">Falla Reportada / Diagnóstico:</p>
                          <p className="text-sm text-gray-700 font-sans mt-0.5 whitespace-pre-wrap">{log.failureDesc}</p>
                        </div>

                        {log.solutionDesc && (
                          <div className="border-t border-gray-100 pt-2">
                            <p className="text-xs text-blue-500 font-mono uppercase tracking-wide">Solución Aplicada:</p>
                            <p className="text-sm text-gray-750 font-sans mt-0.5 whitespace-pre-wrap">{log.solutionDesc}</p>
                          </div>
                        )}

                        {log.techJustification && (
                          <div className="border-t border-gray-100 pt-2">
                            <p className="text-xs text-rose-500 font-mono uppercase tracking-wide">Justificación Técnica:</p>
                            <p className="text-sm text-rose-700 font-medium font-sans mt-0.5 bg-rose-50/50 p-2 rounded-lg border border-rose-100/50 whitespace-pre-wrap">
                              {log.techJustification}
                            </p>
                          </div>
                        )}

                        {/* Used Spare Parts */}
                        {log.partsUsed && log.partsUsed.length > 0 && (
                          <div className="pt-1">
                            <p className="text-[11px] text-gray-400 font-mono uppercase">Refacciones Utilizadas:</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {log.partsUsed.map((partName, idx) => (
                                <span key={idx} className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-md font-mono">
                                  🧩 {partName}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Image before/after carousel */}
                        {(log.photoBefore || log.photoAfter) && (
                          <div className="grid grid-cols-2 gap-3 pt-2">
                            {log.photoBefore && (
                              <div className="">
                                <span className="text-[10px] text-gray-400 font-mono block mb-1">Evidencia (Antes)</span>
                                <div className="aspect-video w-full rounded-lg overflow-hidden border border-gray-200 bg-gray-100 flex items-center justify-center">
                                  <img 
                                    referrerPolicy="no-referrer"
                                    src={log.photoBefore} 
                                    alt="Evidencia Antes" 
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              </div>
                            )}
                            {log.photoAfter && (
                              <div className="">
                                <span className="text-[10px] text-gray-400 font-mono block mb-1">Evidencia (Después)</span>
                                <div className="aspect-video w-full rounded-lg overflow-hidden border border-gray-200 bg-gray-100 flex items-center justify-center">
                                  <img 
                                    referrerPolicy="no-referrer"
                                    src={log.photoAfter} 
                                    alt="Evidencia Después" 
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
          <button
            id="close-modal-footer"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-250 rounded-xl hover:bg-gray-50 transition active:scale-95"
          >
            Cerrar Historial
          </button>
        </div>
      </div>
    </div>
  );
}
