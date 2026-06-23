import React, { useState, useEffect } from "react";
import { Database, AlertTriangle, RefreshCw, X, Wifi } from "lucide-react";

interface StatusData {
  status: "connected" | "disconnected";
  engine: string;
  host: string | null;
  database: string | null;
  latency: string | null;
  error: string | null;
}

export default function NeonStatusIndicator() {
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const checkStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/db-status");
      const statusJson = await res.json();
      setData(statusJson);
    } catch (err: any) {
      setData({
        status: "disconnected",
        engine: "Local Fallback State (db.json)",
        host: "ep-broad-bar-atk7zcar-pooler.c-9.us-east-1.aws.neon.tech",
        database: "neondb",
        latency: null,
        error: err.message || "Failed to fetch status."
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
    // Poll every 45s for live connectivity awareness
    const interval = setInterval(checkStatus, 45000);
    return () => clearInterval(interval);
  }, []);

  const isConnected = data?.status === "connected";

  return (
    <div className="relative inline-flex items-center">
      <button
        id="btn-neon-connection-status"
        type="button"
        onClick={() => {
          checkStatus();
          setShowModal(true);
        }}
        className="flex items-center gap-1.5 px-2.5 py-1 bg-white/15 backdrop-blur-md hover:bg-white/25 rounded-full border border-white/10 transition active:scale-95 shadow-sm"
        title="Estado de conexión con Neon PostgreSQL"
      >
        <span className="relative flex h-2 w-2">
          {isConnected ? (
            <>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </>
          ) : (
            <>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
            </>
          )}
        </span>
        <Database className={`w-3.5 h-3.5 ${isConnected ? "text-emerald-300" : "text-rose-300"}`} />
        <span className="text-[10px] uppercase font-bold tracking-wider font-mono text-white/95">
          {isConnected ? "Neon OK" : "Offline"}
        </span>
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-xl max-w-sm w-full p-5 shadow-2xl relative text-slate-800 animate-slide-up">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-3.5 right-3.5 p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition duration-150"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100">
              <Database className={`w-5 h-5 ${isConnected ? "text-emerald-500" : "text-rose-500"}`} />
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Servidor Neon PostgreSQL</h3>
                <p className="text-[10px] text-slate-400 font-mono">Diagnóstico de Base de Datos</p>
              </div>
            </div>

            <div className="space-y-3 font-sans text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-slate-500">Estado de Enlace:</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                  isConnected ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                }`}>
                  {isConnected ? "Sincronizado" : "Modo Fallback local"}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-slate-500">Motor de Base de Datos:</span>
                <span className="font-mono font-bold text-slate-700">{data?.engine || "PostgreSQL (Neon)"}</span>
              </div>

              <div className="py-1 border-b border-slate-50">
                <span className="text-slate-500 block mb-0.5">Host de Servidor:</span>
                <span className="font-mono text-[10px] block truncate text-slate-600 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 select-all">
                  {data?.host || "ep-broad-bar-atk7zcar-pooler.c-9.us-east-1.aws.neon.tech"}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-slate-500">Latencia de Red:</span>
                <span className="font-mono font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                  {data?.latency ? `⚡ ${data.latency}` : "N/A"}
                </span>
              </div>

              {!isConnected && data?.error && (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-md text-rose-800 text-[10px] font-mono leading-relaxed mt-2.5">
                  <span className="font-bold flex items-center gap-1 mb-1 text-rose-900">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Detalle del Fallo:
                  </span>
                  {data.error}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2.5 mt-5 pt-3.5 border-t border-slate-100">
              <button
                onClick={checkStatus}
                disabled={loading}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-bold inline-flex items-center gap-1.5 leading-snug transition duration-150 active:scale-95 disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
                <span>Prueba Manual</span>
              </button>
              
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-1.5 bg-vino-claro hover:bg-vino-claro-hover text-white rounded-md text-xs font-bold leading-snug transition duration-150 active:scale-95 shadow-sm"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
