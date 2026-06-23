import React, { useState, useEffect } from "react";
import { Alumno, Group, Room, PC, SparePart, MaintenanceLog } from "../types";
import { 
  LogOut, Laptop, CheckCircle, AlertTriangle, Clock, Wrench, Search, 
  Sparkles, FileText, Upload, Calendar, Send, ChevronRight, Ban, RefreshCw, Info
} from "lucide-react";
import ComputerHistoryModal from "./ComputerHistoryModal";
import InventoryCatalog from "./InventoryCatalog";
import NeonStatusIndicator from "./NeonStatusIndicator";
import { jsPDF } from "jspdf";

interface StudentWorkspaceProps {
  alumno: Alumno;
  group: Group | null;
  room: Room | null;
  onLogout: () => void;
}

export default function StudentWorkspace({
  alumno,
  group,
  room,
  onLogout
}: StudentWorkspaceProps) {
  // States
  const [pcs, setPcs] = useState<PC[]>([]);
  const [inventory, setInventory] = useState<SparePart[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPc, setSelectedPc] = useState<PC | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [studentRepairs, setStudentRepairs] = useState(0);

  // History modal trigger
  const [historyPc, setHistoryPc] = useState<{ id: string; tag: string } | null>(null);

  // Maintenance Form State
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [photoBefore, setPhotoBefore] = useState<string | null>(null);
  const [photoBeforeName, setPhotoBeforeName] = useState("");
  const [failureDesc, setFailureDesc] = useState("");
  const [outcomeState, setOutcomeState] = useState<"En mantenimiento" | "Reparado" | "Irreparable">("En mantenimiento");
  
  // Specific states for Finish / Irreparable
  const [photoAfter, setPhotoAfter] = useState<string | null>(null);
  const [photoAfterName, setPhotoAfterName] = useState("");
  const [solutionDesc, setSolutionDesc] = useState("");
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [techJustification, setTechJustification] = useState("");
  const [selectedParts, setSelectedParts] = useState<string[]>([]);

  // AI Diagnostic States
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<{ causes: string[]; solutions: string[] } | null>(null);
  const [aiError, setAiError] = useState("");

  // Load Data
  const loadWorkspaceData = () => {
    if (!room) {
      setLoading(false);
      return;
    }
    setLoading(true);
    
    // Parallel fetch PCs and Spare Parts Catalog
    Promise.all([
      fetch("/api/pcs").then(res => res.json()),
      fetch("/api/inventory").then(res => res.json())
    ])
      .then(([allPcs, parts]) => {
        // Filter PCs that correspond only to the assigned salon
        const salonPcs = allPcs.filter((p: PC) => p.roomId === room.id);
        setPcs(salonPcs);
        setInventory(parts);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error loading workspace data", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadWorkspaceData();
  }, [room]);

  // Handle PC Select for maintenance
  const handleSelectPc = (pc: PC) => {
    setSelectedPc(pc);
    setAiResult(null);
    setAiError("");
    setFailureDesc("");
    setPhotoBefore(null);
    setPhotoBeforeName("");
    setPhotoAfter(null);
    setPhotoAfterName("");
    setSolutionDesc("");
    setTechJustification("");
    setSelectedParts([]);
    setOutcomeState("En mantenimiento");
  };

  // Drag and Drop/Upload parser to base64
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, isBefore: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (isBefore) {
      setPhotoBeforeName(file.name);
    } else {
      setPhotoAfterName(file.name);
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      if (isBefore) {
        setPhotoBefore(base64);
      } else {
        setPhotoAfter(base64);
      }
    };
    reader.readAsDataURL(file);
  };

  // AI Diagnostic trigger
  const handleAiDiagnostic = async () => {
    if (!failureDesc.trim()) {
      setAiError("Por favor describa la falla del equipo antes de consultar el diagnóstico por IA.");
      return;
    }

    setAiLoading(true);
    setAiError("");
    setAiResult(null);

    try {
      const res = await fetch("/api/ai/diagnosis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ failureDesc })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Error al generar diagnóstico.");
      }

      const data = await res.json();
      setAiResult(data.diagnosis);
    } catch (err: any) {
      console.error(err);
      setAiError(err.message || "No se pudo establecer conexión con el recomendador de IA.");
    } finally {
      setAiLoading(false);
    }
  };

  // Parts select toggle
  const handleTogglePart = (partId: string) => {
    if (selectedParts.includes(partId)) {
      setSelectedParts(selectedParts.filter(id => id !== partId));
    } else {
      setSelectedParts([...selectedParts, partId]);
    }
  };

  // Submit report to server
  const handleSubmitMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPc) return;

    // Manual Form Validations
    if (!startDate) {
      alert("Por favor seleccione la fecha de inicio.");
      return;
    }

    if (!failureDesc.trim() && outcomeState !== "Operativo") {
      alert("Es obligatorio describir la falla o diagnóstico técnico que presenta el equipo.");
      return;
    }

    if (!photoBefore && outcomeState !== "Operativo") {
      alert("Es obligatorio subir la foto de evidencia ANTES del diagnóstico.");
      return;
    }

    if (outcomeState === "Reparado") {
      if (!endDate) {
        alert("Por favor seleccione la fecha de finalización.");
        return;
      }
      if (!solutionDesc.trim()) {
        alert("Es obligatorio detallar qué solución o cambio se aplicó para marcarlo como Reparado.");
        return;
      }
      if (!photoAfter) {
        alert("Es obligatorio subir la foto de evidencia DESPUÉS del diagnóstico/reparación para cambiar el estado a reparado.");
        return;
      }
    }

    if (outcomeState === "Irreparable") {
      if (!techJustification.trim()) {
        alert("Es obligatorio proporcionar la justificación técnica exhaustiva por la cual el equipo es irreparable.");
        return;
      }
    }

    const payload = {
      pcId: selectedPc.id,
      state: outcomeState,
      studentId: alumno.id,
      studentName: alumno.name,
      failureDesc,
      solutionDesc: outcomeState === "Reparado" ? solutionDesc : undefined,
      techJustification: outcomeState === "Irreparable" ? techJustification : undefined,
      photoBefore,
      photoAfter: outcomeState === "Reparado" ? photoAfter : undefined,
      partsUsed: selectedParts.map(id => {
        const item = inventory.find(p => p.id === id);
        return item ? item.name : "";
      }).filter(Boolean)
    };

    try {
      const response = await fetch("/api/maintenance/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error("No se pudo registrar el mantenimiento.");
      }

      // Explicit user confirmation with navigation to main screen
      alert(`¡Reporte de Mantenimiento ingresado con éxito!\nEl estado de la computadora ${selectedPc.tag} ha sido actualizado a: ${outcomeState === "En mantenimiento" ? "En Mantenimiento" : outcomeState}.`);
      
      // Clear local states
      setFailureDesc("");
      setSolutionDesc("");
      setTechJustification("");
      setPhotoBefore(null);
      setPhotoBeforeName("");
      setPhotoAfter(null);
      setPhotoAfterName("");
      setSelectedParts([]);

      // Redirect immediately to home select screen
      setSelectedPc(null);
      loadWorkspaceData();
    } catch (err: any) {
      alert(err.message || "Error al procesar la solicitud.");
    }
  };

  // Alumno service report generator (PDF)
  const generatePersonalPDFReport = async () => {
    if (!alumno) return;

    setLoading(true);
    try {
      // Get all recent maintenance logs from server to count successes
      const res = await fetch("/api/pcs");
      const pcsData = await res.json();
      
      const resLogs = await fetch("/api/alumnos"); // Dummy fetch to satisfy loading but let's query all completed repairs
      const allPcsInSalon = pcsData.filter((p: PC) => p.roomId === room?.id);
      
      // Let's filter logs belonging to this alumno specifically that were repaired
      const logsRes = await fetch("/api/pcs"); // Wait, let's fetch all history records
      const logsList: MaintenanceLog[] = [];
      
      for (const pc of allPcsInSalon) {
        const hRes = await fetch(`/api/pcs/${pc.id}/history`);
        const hData = await hRes.json();
        const studentSolvedLogs = hData.filter((l: MaintenanceLog) => l.studentId === alumno.id && l.type === "Reparado");
        logsList.push(...studentSolvedLogs);
      }

      // Initialize jsPDF
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "letter"
      });

      // Colors: Wine themed University branding
      // Header Banner
      doc.setFillColor(154, 28, 60); // Wine Burgundy
      doc.rect(0, 0, 216, 38, "F");

      // Header Text
      doc.setTextColor(255, 255, 255);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(22);
      doc.text("UESLAB - REPORTE DE HORAS DE SERVICIO", 14, 16);
      
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(10);
      doc.text("Reporte Mensual de Evidencia Técnica Individual", 14, 23);
      doc.text(`Fecha de Emisión: ${new Date().toLocaleDateString()}`, 14, 29);

      // Student Info Block
      doc.setFillColor(248, 250, 252); // soft grey
      doc.rect(14, 46, 188, 42, "F");
      doc.setDrawColor(226, 232, 240);
      doc.rect(14, 46, 188, 42, "S");

      doc.setTextColor(15, 23, 42);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(11);
      doc.text("DATOS PERSONALES DEL ESTUDIANTE", 20, 52);

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(9.5);
      doc.text(`Nombre Completo: ${alumno.name}`, 20, 60);
      doc.text(`Carrera Profesional: ${alumno.career}`, 20, 66);
      doc.text(`Semestre Escolar: ${alumno.semester}° Semestre`, 20, 72);
      doc.text(`Número de Expediente: ${alumno.expediente}`, 20, 78);

      // Group Details Block (Right side of the info block)
      doc.text(`Cve Folio Grupo: ${group?.folio || "N/A"}`, 120, 60);
      doc.text(`Laboratorio Asignado: ${room?.name || "N/A"}`, 120, 66);
      doc.text(`Total Computadoras: ${room?.pcsCount || 0} equipos`, 120, 72);
      doc.setFont("Helvetica", "bold");
      doc.text(`Equipos Reparados con Éxito: ${logsList.length}`, 120, 78);

      // Section Title: Detailed repairs
      doc.setTextColor(15, 23, 42);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(12);
      doc.text("RELACIÓN DE EQUIPOS REPARADOS (EVIDENCIA)", 14, 102);
      
      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(0.5);
      doc.line(14, 104, 202, 104);

      // Inventory/repairs list with coordinates
      let yCoord = 112;
      doc.setFontSize(9);

      if (logsList.length === 0) {
        doc.setFont("Helvetica", "oblique");
        doc.setTextColor(100, 116, 139);
        doc.text("No tiene equipos marcados colectivamente como 'Reparado' aún en este periodo.", 14, yCoord);
        doc.text("Complete reparaciones con foto de salida para registrarlas en su reporte de horas.", 14, yCoord + 6);
      } else {
        // Headers
        doc.setFont("Helvetica", "bold");
        doc.text("Equipo", 16, yCoord);
        doc.text("Fecha", 36, yCoord);
        doc.text("Falla Atendida", 60, yCoord);
        doc.text("Acción / Corrección Ejecutada", 125, yCoord);
        
        doc.line(14, yCoord + 2, 202, yCoord + 2);
        yCoord += 8;

        doc.setFont("Helvetica", "normal");
        logsList.forEach((log, index) => {
          if (yCoord > 240) {
            doc.addPage();
            yCoord = 20;
            // Repeat headers in new page
            doc.setFont("Helvetica", "bold");
            doc.text("Equipo", 16, yCoord);
            doc.text("Fecha", 36, yCoord);
            doc.text("Falla Atendida", 60, yCoord);
            doc.text("Acción / Corrección Ejecutada", 125, yCoord);
            doc.line(14, yCoord + 2, 202, yCoord + 2);
            yCoord += 8;
            doc.setFont("Helvetica", "normal");
          }

          doc.text(log.pcTag, 16, yCoord);
          doc.text(log.changeDate, 36, yCoord);
          
          // Truncate failure & solutions for neat table lines
          const failDesc = log.failureDesc.length > 36 ? log.failureDesc.substring(0, 33) + "..." : log.failureDesc;
          const solDesc = (log.solutionDesc || "").length > 42 ? (log.solutionDesc || "").substring(0, 39) + "..." : (log.solutionDesc || "");
          
          doc.text(failDesc, 60, yCoord);
          doc.text(solDesc, 125, yCoord);

          yCoord += 8;
        });
      }

      // Signatures
      yCoord = Math.max(180, yCoord + 20);
      doc.setDrawColor(200, 200, 200);
      doc.line(25, yCoord, 85, yCoord);
      doc.line(130, yCoord, 190, yCoord);

      doc.setFontSize(8.5);
      doc.setFont("Helvetica", "bold");
      doc.text("Firma de Conformidad del Alumno", 32, yCoord + 5);
      doc.text("Sello / Firma Coordinador de Soporte", 134, yCoord + 5);
      
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(8);
      doc.text(alumno.name, 35, yCoord + 9);
      doc.text("UesLab Sistema de Gestión", 145, yCoord + 9);

      // Save PDF
      doc.save(`Reporte_Horas_${alumno.expediente}.pdf`);
      
    } catch (err) {
      console.error(err);
      alert("Error al generar PDF.");
    } finally {
      setLoading(false);
    }
  };

  const filteredPcs = pcs.filter((pc) => 
    pc.tag.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pc.state.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      
      {/* HEADER NAVIGATION */}
      <nav className="h-14 bg-vino-claro flex items-center sticky top-0 z-40 border-b border-vino-oscuro shrink-0 text-white shadow-md">
        <div className="w-full max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="bg-white/10 p-2 rounded-md shadow flex items-center justify-center">
              <Laptop className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="text-[9px] font-bold text-white/80 block tracking-wider font-mono uppercase">Universidad Estatal de Sonora</span>
              <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
                UesLab
                <NeonStatusIndicator />
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              id="student-profile-glass-btn"
              type="button"
              onClick={async () => {
                try {
                  const r = await fetch(`/api/alumnos/${alumno.id}/repairs-count`);
                  const d = await r.json();
                  setStudentRepairs(d.count || 0);
                } catch {
                  setStudentRepairs(0);
                }
                setShowProfileModal(true);
              }}
              className="px-3.5 py-1 text-xs text-white bg-white/10 backdrop-blur-md hover:bg-white/20 rounded-md border border-white/20 transition active:scale-95 shadow-sm inline-flex flex-col items-end cursor-pointer"
              title="Mi Diagnóstico de Servicio Social"
            >
              <span className="font-bold">{alumno.name}</span>
              <span className="text-[8.5px] text-emerald-300 font-mono tracking-wider font-bold uppercase">Mi Info • Ver Detalle</span>
            </button>

            <button
              id="student-logout-top"
              onClick={onLogout}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-white/10 backdrop-blur-md hover:bg-white/20 rounded-md border border-white/20 transition inline-flex items-center gap-1.5 shadow duration-150 active:scale-95"
              title="Cerrar Sesión"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left column: Student Profile & Main actions & Spare Parts Catalog */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Card 1: Student Information */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-4 mb-4 pb-4 border-b border-slate-100 font-sans">
              <div className="w-10 h-10 bg-blue-50 text-blue-800 rounded-lg flex items-center justify-center font-bold text-base border border-blue-100">
                {alumno.name.charAt(0)}
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800 leading-tight">{alumno.name}</h2>
                <p className="text-xs font-mono text-slate-400 mt-0.5">{alumno.career}</p>
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500">Expediente asignado:</span>
                <span className="font-mono font-semibold text-gray-950 bg-slate-100 px-2 py-0.5 rounded">{alumno.expediente}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500">Semestre Académico:</span>
                <span className="font-semibold text-gray-950">{alumno.semester}° Semestre</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500">Folio de Grupo:</span>
                <span className="font-semibold text-blue-700 bg-blue-50/80 px-2 py-0.5 rounded">{group?.name || "Sin grupo"}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500">Laboratorio a Atender:</span>
                <span className="font-semibold text-gray-950 line-clamp-1 max-w-[200px]">{room?.name || "Sin Salón asignado"}</span>
              </div>
            </div>

            {/* Evidence PDF generator button */}
            <div className="mt-5 pt-4 border-t border-slate-100">
              <button
                id="btn-reporte-alumno-pdf"
                onClick={generatePersonalPDFReport}
                className="w-full flex items-center justify-center gap-2 px-3.5 py-1.5 bg-vino-claro/85 backdrop-blur-md hover:bg-vino-claro-hover text-white rounded-md text-xs font-semibold transition duration-150 active:scale-95 shadow border border-vino-claro/10"
              >
                <FileText className="w-3.5 h-3.5" />
                Generar Reporte de Horas (PDF)
              </button>
              <p className="text-[10px] text-gray-400 text-center mt-2 font-mono">
                Certifica tus equipos reparados del mes como evidencia de servicio.
              </p>
            </div>
          </div>

          {/* Spare Parts Inventory display (Read Only for student, but shows critical items so they know if materials are lacking) */}
          <InventoryCatalog isAdmin={false} />

        </div>

        {/* Right column: Interactive PC work station */}
        <div className="lg:col-span-8 space-y-6">
          
          {selectedPc ? (
            /* Active Maintenance Form Station */
            <div className="bg-white rounded-2xl border border-blue-100 shadow-md p-6 relative overflow-hidden animate-fade-in">
              {/* Highlight ribbon */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-blue-600"></div>

              <div className="flex items-center justify-between mb-5">
                <div>
                  <button
                    id="btn-back-to-pcs"
                    onClick={() => setSelectedPc(null)}
                    className="text-xs text-gray-550 hover:text-gray-900 flex items-center gap-1 mb-2 font-medium"
                  >
                    ← Volver a la lista de computadoras
                  </button>
                  <h3 className="text-lg font-bold text-gray-900">
                    Estación de Mantenimiento / Reporte Escolar
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Laboratorio: <span className="font-semibold">{room?.name}</span> • Equipo: <span className="font-mono font-bold text-blue-700">{selectedPc.tag}</span>
                  </p>
                </div>

                <button
                  id="btn-view-clinical-history"
                  onClick={() => setHistoryPc({ id: selectedPc.id, tag: selectedPc.tag })}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                >
                  <Clock className="w-3.5 h-3.5" />
                  Ver Historial de PC
                </button>
              </div>

              {/* OUTCOME SELECTOR TAB SYSTEM */}
              <div className="grid grid-cols-3 gap-2 bg-gray-50 p-1.5 rounded-xl border border-gray-100 mb-6">
                <button
                  id="tab-state-mantenimiento"
                  type="button"
                  onClick={() => setOutcomeState("En mantenimiento")}
                  className={`py-2 px-3 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition duration-150 ${
                    outcomeState === "En mantenimiento"
                      ? "bg-amber-100 text-amber-800 shadow"
                      : "text-gray-500 hover:bg-gray-150/50"
                  }`}
                >
                  <Wrench className="w-3.5 h-3.5" />
                  Mantenimiento
                </button>
                <button
                  id="tab-state-reparado"
                  type="button"
                  onClick={() => setOutcomeState("Reparado")}
                  className={`py-2 px-3 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition duration-150 ${
                    outcomeState === "Reparado"
                      ? "bg-emerald-100 text-emerald-800 shadow"
                      : "text-gray-500 hover:bg-gray-150/50"
                  }`}
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  Reparado (Éxito)
                </button>
                <button
                  id="tab-state-irreparable"
                  type="button"
                  onClick={() => setOutcomeState("Irreparable")}
                  className={`py-2 px-3 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition duration-150 ${
                    outcomeState === "Irreparable"
                      ? "bg-rose-100 text-rose-800 shadow"
                      : "text-gray-500 hover:bg-gray-150/50"
                  }`}
                >
                  <Ban className="w-3.5 h-3.5" />
                  Irreparable
                </button>
              </div>

              <form id="student-maintenance-form" onSubmit={handleSubmitMaintenance} className="space-y-6">
                {/* 1. Common Fields section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      Fecha de Inicio de Reparación *
                    </label>
                    <input
                      id="input-repair-start-date"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-slate-300 bg-white rounded-lg focus:outline-none focus:border-vino-claro"
                    />
                  </div>

                  {/* Dual Column for Photo Uploads on Desktop */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5% flex items-center gap-1">
                      <Upload className="w-3.5 h-3.5 text-gray-400" />
                      Carga de Evidencia Fotográfica (Fallas e Integración) *
                    </label>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Botón Foto Antes */}
                      <div className="p-2 border border-slate-200 rounded-lg bg-slate-50 flex flex-col justify-between gap-2.5">
                        <div className="relative">
                          <input
                            id="input-repair-photo-before"
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleFileChange(e, true)}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                          />
                          <button
                            type="button"
                            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-vino-claro hover:bg-vino-claro-hover text-white text-xs font-semibold rounded-md shadow-sm transition active:scale-95"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            Cargar Foto ANTES
                          </button>
                        </div>
                        {photoBefore ? (
                          <div className="flex items-center gap-2 bg-white p-1 rounded border border-slate-100 animate-fade-in">
                            <img
                              referrerPolicy="no-referrer"
                              src={photoBefore} 
                              alt="Antes Preview" 
                              className="w-9 h-7 object-cover rounded border border-slate-200 bg-white shadow-xs shrink-0"
                            />
                            <span className="text-[10px] text-emerald-700 font-bold truncate flex-1">{photoBeforeName || "evidencia_inicial.png"}</span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-zinc-550 text-center font-medium block">Evidencia inicial (Requerido)</span>
                        )}
                      </div>

                      {/* Botón Foto Después */}
                      <div className="p-2 border border-slate-200 rounded-lg bg-slate-50 flex flex-col justify-between gap-2.5">
                        <div className="relative">
                          <input
                            id="input-repair-photo-after"
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleFileChange(e, false)}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                          />
                          <button
                            type="button"
                            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-vino-claro hover:bg-vino-claro-hover text-white text-xs font-semibold rounded-md shadow-sm transition active:scale-95"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            Cargar Foto DESPUÉS
                          </button>
                        </div>
                        {photoAfter ? (
                          <div className="flex items-center gap-2 bg-white p-1 rounded border border-slate-100 animate-fade-in">
                            <img
                              referrerPolicy="no-referrer"
                              src={photoAfter} 
                              alt="Después Preview" 
                              className="w-9 h-7 object-cover rounded border border-slate-200 bg-white shadow-xs shrink-0"
                            />
                            <span className="text-[10px] text-emerald-700 font-bold truncate flex-1">{photoAfterName || "evidencia_concluido.png"}</span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-zinc-550 text-center font-medium block">Evidencia final (Para reparados)</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* DIAGNOSTIC INPUT WITH INTEGRATED GEMINI AI */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-semibold text-gray-600">
                      ¿Qué falla presenta? / Diagnóstico Técnico *
                    </label>
                    <button
                      id="btn-consult-ai-helper"
                      type="button"
                      onClick={handleAiDiagnostic}
                      className="flex items-center gap-1.5 text-[11px] font-bold text-blue-800 hover:text-blue-900 bg-blue-100 hover:bg-blue-150/70 px-3 py-1 rounded-full shadow-sm animate-pulse"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Asistente IA (Diagnosticar)
                    </button>
                  </div>
                  <textarea
                    id="textarea-repair-failure"
                    rows={3}
                    value={failureDesc}
                    onChange={(e) => setFailureDesc(e.target.value)}
                    placeholder="Escriba aquí los síntomas de la computadora (ej. No da video, se congela a los 5 minutos, emite un pitido continuo, etc.)"
                    className="w-full text-sm px-3.5 py-3 border border-gray-250 bg-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/10"
                    required
                  ></textarea>
                </div>

                {/* AI DIAGNOSTIC DISPLAY PANEL */}
                {aiLoading && (
                  <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 flex items-center gap-3 animate-pulse">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
                    <span className="text-xs font-semibold text-blue-700 font-sans">
                      Asistente UesLab AI analizando falla escolar...
                    </span>
                  </div>
                )}

                {aiError && (
                  <div className="p-4 rounded-xl bg-rose-50 border border-rose-100 text-xs text-rose-700 font-medium font-sans">
                    {aiError}
                  </div>
                )}

                {aiResult && (
                  <div className="p-4 rounded-lg bg-blue-50/30 border-l-4 border-l-blue-600 border border-slate-200 shadow-md space-y-3 animate-fade-in">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-blue-700" />
                      <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider font-sans">
                        Sugerencias de Diagnóstico (UesLab IA)
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Causes list */}
                      <div className="bg-white/90 p-3.5 rounded-lg border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">💡 Posibles Causas</span>
                        <ul className="space-y-1.5">
                          {aiResult.causes.map((cause, i) => (
                            <li key={i} className="text-xs text-slate-700 flex items-start gap-1">
                              <span className="text-blue-500 mt-0.5">•</span>
                              {cause}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Solutions list */}
                      <div className="bg-white/90 p-3.5 rounded-lg border border-slate-200">
                        <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest block mb-2 font-sans">🛠️ Soluciones Recomendadas</span>
                        <ul className="space-y-1.5">
                          {aiResult.solutions.map((sol, i) => (
                            <li key={i} className="text-xs text-slate-750 flex items-start gap-1">
                              <span className="text-emerald-500 mt-0.5">✓</span>
                              {sol}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}


                {/* 2. SPECIFIC FOR REPARADO SECTION */}
                {outcomeState === "Reparado" && (
                  <div className="space-y-4 p-5 rounded-2xl bg-emerald-50/20 border border-emerald-100/80 animate-fade-in">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle className="w-4.5 h-4.5 text-emerald-600" />
                      <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Detalles de la Reparación Exitosa</h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-emerald-700 mb-1.5 flex items-center gap-1">
                          <Calendar className="w-4 h-4 text-emerald-600" />
                          Fecha de Finalización *
                        </label>
                        <input
                          id="input-repair-end-date"
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="w-full text-sm px-3.5 py-2 border border-slate-300 bg-white rounded-lg focus:outline-none focus:border-emerald-600 font-sans"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-emerald-700 mb-1.5">
                        Relación de cambios realizados / Piezas Reparadas *
                      </label>
                      <textarea
                        id="textarea-repair-solution"
                        rows={2}
                        value={solutionDesc}
                        onChange={(e) => setSolutionDesc(e.target.value)}
                        placeholder="Escriba qué cambió, qué componentes ajustó o qué software configuró en la PC"
                        className="w-full text-sm px-3.5 py-3.5 border border-emerald-200 bg-white rounded-xl focus:outline-none"
                        required
                      ></textarea>
                    </div>

                    {/* SPARE PARTS DEDUCTION CONSOLE */}
                    <div>
                      <span className="block text-xs font-semibold text-emerald-700 mb-2">
                        Refacciones Utilizadas de Inventario (Se descontará stock automáticamente):
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {inventory.map((part) => (
                          <button
                            id={`btn-part-selector-${part.id}`}
                            key={part.id}
                            type="button"
                            disabled={part.stock <= 0}
                            onClick={() => handleTogglePart(part.id)}
                            className={`px-3 py-1.5 text-xs rounded-xl font-mono flex items-center gap-1.5 border transition duration-150 ${
                              selectedParts.includes(part.id)
                                ? "bg-emerald-600 text-white border-emerald-600"
                                : part.stock <= 0
                                  ? "bg-gray-100 text-gray-300 border-gray-100 cursor-not-allowed"
                                  : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                            }`}
                          >
                            🧩 {part.name} ({part.stock} pz)
                          </button>
                        ))}
                      </div>
                    </div>

                  </div>
                )}


                {/* 3. SPECIFIC FOR IRREPARABLE SECTION */}
                {outcomeState === "Irreparable" && (
                  <div className="space-y-4 p-5 rounded-2xl bg-rose-50/20 border border-rose-100/80 animate-fade-in">
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="w-4.5 h-4.5 text-rose-600" />
                      <h4 className="text-xs font-bold text-rose-850 uppercase tracking-wider">Justificación Técnica de Descarte</h4>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-rose-700 mb-1.5">
                        Explique detalladamente por qué el equipo no tiene solución viable *
                      </label>
                      <textarea
                        id="textarea-repair-justification"
                        rows={3}
                        value={techJustification}
                        onChange={(e) => setTechJustification(e.target.value)}
                        placeholder="Ej. Motherboard presenta daño por cortocircuito quemando pistas internas multicapa. No es viable la reparación y carecemos de microscopio y estación de pre-calentado exigido..."
                        className="w-full text-sm px-3.5 py-3.5 border border-rose-200 bg-white rounded-xl focus:outline-none"
                        required
                      ></textarea>
                    </div>
                  </div>
                )}


                {/* BUTTONS BAR BAR */}
                <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
                  <button
                    id="btn-maintenance-cancel"
                    type="button"
                    onClick={() => setSelectedPc(null)}
                    className="px-5 py-2.5 text-xs font-semibold text-gray-650 hover:text-gray-900 bg-white border border-gray-250 rounded-xl transition duration-150 active:scale-95"
                  >
                    Salir de Estación
                  </button>
                  <button
                    id="btn-maintenance-submit"
                    type="submit"
                    className={`px-6 py-2.5 text-xs font-bold text-white rounded-xl shadow-sm transition duration-150 active:scale-95 flex items-center gap-1.5 ${
                      outcomeState === "En mantenimiento"
                        ? "bg-amber-600 hover:bg-amber-700"
                        : outcomeState === "Reparado"
                          ? "bg-emerald-600 hover:bg-emerald-700"
                          : "bg-rose-600 hover:bg-rose-700"
                    }`}
                  >
                    <Send className="w-3.5 h-3.5" />
                    {outcomeState === "En mantenimiento" 
                      ? "Marcar en Mantenimiento" 
                      : outcomeState === "Reparado" 
                        ? "Marcar como Reparado" 
                        : "Marcar como Irreparable"}
                  </button>
                </div>

              </form>
            </div>
          ) : (
            /* Computers List Grid Grid */
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-sans">
                    Estado Clínico del Salón: {room?.name || "Sin Salón"}
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5 font-sans">
                    Seleccione un equipo asignado de la cuadrícula interactiva para actualizar su estatus.
                  </p>
                </div>

                {/* Search query */}
                <div className="relative max-w-xs w-full">
                  <input
                    id="input-search-pcs"
                    type="text"
                    placeholder="Buscar PC o estatus..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full text-xs pl-9 pr-4 py-1.5 border border-slate-300 bg-white rounded-md focus:outline-none"
                  />
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                </div>
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-900 border-t-transparent mb-3"></div>
                  <p className="text-xs text-gray-400">Consultando computadoras...</p>
                </div>
              ) : filteredPcs.length === 0 ? (
                <div className="text-center py-12 text-sm text-gray-400 font-sans">
                  Ninguna computadora coincide con los criterios de búsqueda.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {filteredPcs.map((pc) => {
                    const isAssignedToMe = pc.assignedAlumnoId === alumno.id;
                    
                    // Style by state
                    let stateColorClasses = "bg-gray-100 text-gray-700 ring-gray-200/50";
                    let stateDot = "bg-gray-400";
                    let stateSpanish = "Operativo";

                    if (pc.state === "En mantenimiento") {
                      stateColorClasses = "bg-amber-50 text-amber-800 ring-amber-100/80";
                      stateDot = "bg-amber-500 animate-pulse";
                      stateSpanish = "En Mantenimiento";
                    } else if (pc.state === "Reparado") {
                      stateColorClasses = "bg-emerald-50 text-emerald-800 ring-emerald-100/80";
                      stateDot = "bg-emerald-500";
                      stateSpanish = "Reparado";
                    } else if (pc.state === "Irreparable") {
                      stateColorClasses = "bg-rose-50 text-rose-800 ring-rose-100/80";
                      stateDot = "bg-rose-500";
                      stateSpanish = "Irreparable";
                    } else if (pc.state === "Operativo") {
                      stateColorClasses = "bg-blue-50 text-blue-800 ring-blue-100/80";
                      stateDot = "bg-blue-500";
                      stateSpanish = "Operativo";
                    }

                    return (
                      <div
                        key={pc.id}
                        className={`rounded-lg border p-3.5 transition-all flex flex-col justify-between ${
                          isAssignedToMe
                            ? "bg-blue-50/20 border-blue-250 shadow-sm"
                            : "bg-white border-slate-200 hover:border-slate-350"
                        }`}
                      >
                        <div>
                          {/* Card Top */}
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-mono text-xs font-bold text-slate-800">
                              {pc.tag}
                            </span>

                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] text-gray-400 font-mono">
                                Act: {pc.lastUpdate}
                              </span>
                            </div>
                          </div>

                          <div className="space-y-1.5 mb-3.5">
                            {/* Badges line */}
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ring-1 ml-auto flex items-center gap-1 ${stateColorClasses}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${stateDot}`}></span>
                                {stateSpanish}
                              </span>
                            </div>

                            {/* Alumno Assignment Badge */}
                            <div>
                              {pc.assignedAlumnoId ? (
                                isAssignedToMe ? (
                                  <span className="text-[10px] font-semibold text-blue-700 bg-blue-100/70 py-0.5 px-2 rounded flex items-center gap-1 w-fit">
                                    🧑‍💻 Asignado a Ti
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-medium text-gray-500 bg-gray-100 py-0.5 px-2 rounded flex items-center gap-1 w-fit">
                                    👤 Compañero
                                  </span>
                                )
                              ) : (
                                <span className="text-[10px] text-gray-400 font-sans block bg-gray-50 py-0.5 px-2 rounded w-fit italic">
                                  Sin Asignación directa
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 pt-2 border-t border-slate-100">
                          <button
                            id={`btn-pc-history-${pc.id}`}
                            onClick={() => setHistoryPc({ id: pc.id, tag: pc.tag })}
                            className="flex-1 py-1 px-2.5 text-[10px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition"
                          >
                            Diagnósticos
                          </button>
                          <button
                            id={`btn-pc-atender-${pc.id}`}
                            onClick={() => handleSelectPc(pc)}
                            className={`flex-1 py-1 px-2.5 text-[10px] font-bold rounded transition active:scale-95 ${
                              isAssignedToMe
                                ? "bg-blue-600 hover:bg-blue-700 text-white shadow"
                                : "bg-slate-800 hover:bg-slate-750 text-white"
                            }`}
                          >
                            Actualizar PC
                          </button>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>
      </main>

      {/* History modal renderer */}
      {historyPc && (
        <ComputerHistoryModal
          pcId={historyPc.id}
          pcTag={historyPc.tag}
          roomName={room?.name || "Salón"}
          onClose={() => setHistoryPc(null)}
        />
      )}

      {/* Student self profile modal with backdrop blur */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
          <div className="bg-white border border-slate-250 rounded-xl max-w-sm w-full p-5 shadow-2xl relative text-slate-800 animate-slide-up">
            <button
              onClick={() => setShowProfileModal(false)}
              className="absolute top-3.5 right-3.5 p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition duration-150 font-bold"
            >
              ✕
            </button>

            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100">
              <div className="w-9 h-9 bg-vino-claro/10 text-vino-claro rounded-lg flex items-center justify-center font-bold text-sm">
                🎓
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Mi Expediente</h3>
                <p className="text-sm font-extrabold text-slate-950 font-mono mt-0.5">{alumno.expediente}</p>
              </div>
            </div>

            <div className="space-y-3 font-sans text-xs">
              <div className="space-y-1">
                <span className="text-slate-500 font-medium">Nombre de Alumno:</span>
                <span className="block font-bold text-slate-900 bg-slate-50 px-2 py-1.5 rounded border border-slate-100">
                  {alumno.name}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-500">Carrera:</span>
                  <span className="block font-semibold text-slate-800 mt-1">{alumno.career}</span>
                </div>
                <div>
                  <span className="text-slate-500">Semestre:</span>
                  <span className="block font-semibold text-slate-800 mt-1">{alumno.semester}° Semestre</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2.5 border-t border-slate-50">
                <div>
                  <span className="text-slate-500">Registro de Soporte:</span>
                  <span className="block font-mono font-bold text-emerald-600 bg-emerald-50 text-center py-1 rounded border border-emerald-100 mt-1">
                    {alumno.startDate || "No especificado"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Fecha de Término:</span>
                  <span className="block font-mono font-bold text-rose-600 bg-rose-50 text-center py-1 rounded border border-rose-100 mt-1">
                    {alumno.endDate || "No especificado"}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <div className="flex justify-between items-center bg-blue-50/55 p-3 rounded-lg border border-blue-100 mt-1">
                  <div>
                    <span className="text-[10px] text-blue-850 font-extrabold block uppercase tracking-wider">Computadoras Reparadas</span>
                    <span className="text-slate-500 text-[11px]">Total acumulado</span>
                  </div>
                  <span className="text-lg font-black text-blue-900 font-mono bg-white w-9 h-9 rounded-full border border-blue-150 flex items-center justify-center shadow-xs">
                    {studentRepairs}
                  </span>
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 rounded border border-slate-150 text-[10px] text-slate-500 leading-relaxed font-mono mt-1 flex justify-between items-center">
                <span>Mi Folio de Grupo:</span>
                <span className="bg-slate-200 px-1.5 py-0.5 rounded text-slate-800 font-bold block">{group?.folio || "Sin grupo"}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5 pt-1.5">
              <button
                onClick={() => setShowProfileModal(false)}
                className="px-4 py-1.5 bg-vino-claro hover:bg-vino-claro-hover text-white rounded-md text-xs font-bold transition duration-150 active:scale-95 shadow-sm"
              >
                Cerrar Ventana
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="bg-white border-t border-slate-200 py-4 mt-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-wrap items-center justify-between gap-4 text-[11px] text-slate-400 font-sans">
          <span>© 2026 UesLab Escuela De Cómputo</span>
          <span>Tecnología de Asistencia Digital de Mantenimiento</span>
        </div>
      </footer>

    </div>
  );
}
