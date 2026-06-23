import React, { useState, useEffect } from "react";
import { Room, PC, Group, Alumno, MaintenanceLog, SparePart } from "../types";
import { 
  Users, Laptop, Layout, FileText, Plus, Search, Calendar, ChevronDown, CheckCircle, 
  AlertTriangle, Hammer, Key, RefreshCw, Layers, Edit, Trash, BarChart, Settings, UserPlus,
  Eye, EyeOff, Image as ImageIcon, Wrench, Info
} from "lucide-react";
import ComputerHistoryModal from "./ComputerHistoryModal";
import InventoryCatalog from "./InventoryCatalog";
import NeonStatusIndicator from "./NeonStatusIndicator";
import { jsPDF } from "jspdf";

interface AdminDashboardProps {
  adminUser?: {
    id: string;
    name: string;
    expediente: string;
  };
  onLogout: () => void;
}

export default function AdminDashboard({ adminUser, onLogout }: AdminDashboardProps) {
  const isMainAdmin = adminUser?.expediente === "admin";

  // Database States
  const [rooms, setRooms] = useState<Room[]>([]);
  const [pcs, setPcs] = useState<PC[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [inventory, setInventory] = useState<SparePart[]>([]);

  // Filtering / Controls
  const [searchQuery, setSearchQuery] = useState("");
  const [roomFilter, setRoomFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  // Selected computer history modal
  const [historyPc, setHistoryPc] = useState<{ id: string; tag: string; roomName: string } | null>(null);

  // Modals & form expands
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [showAddGroup, setShowAddGroup] = useState(false);

  // --- NEW ROOM FORM STATE ---
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomPcCount, setNewRoomPcCount] = useState("10");

  // --- NEW GROUP (AND STUDENT CREDENTIALS) FORM STATE ---
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupSalonId, setNewGroupSalonId] = useState("");
  const [selectedStudentIdsInForm, setSelectedStudentIdsInForm] = useState<string[]>([]);
  const [studentGroupSearchQuery, setStudentGroupSearchQuery] = useState("");

  // --- PASSWORD RESET STATE ---
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState("");

  // --- SINGLE STUDENT REGISTRATION STATE ---
  const [showAddStudentForm, setShowAddStudentForm] = useState(false);
  const [singleStudentName, setSingleStudentName] = useState("");
  const [singleStudentCareer, setSingleStudentCareer] = useState("Ingeniería en Sistemas");
  const [singleStudentSemester, setSingleStudentSemester] = useState("6");
  const [singleStudentExpediente, setSingleStudentExpediente] = useState("");
  const [singleStudentPassword, setSingleStudentPassword] = useState("");
  const [singleStudentGroupId, setSingleStudentGroupId] = useState("");
  const [singleStudentStartDate, setSingleStudentStartDate] = useState("");
  const [singleStudentEndDate, setSingleStudentEndDate] = useState("");

  // --- NEW ADMINISTRATOR FORM STATE ---
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [showAdminsListModal, setShowAdminsListModal] = useState(false);
  const [newAdminName, setNewAdminName] = useState("");
  const [newAdminExpediente, setNewAdminExpediente] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [adminsList, setAdminsList] = useState<any[]>([]);

  // --- STUDENT DETAILED HISTORY ANALYSIS STATE ---
  const [selectedStudentForHistory, setSelectedStudentForHistory] = useState<Alumno | null>(null);
  const [infoStudent, setInfoStudent] = useState<Alumno | null>(null);
  const [infoStudentRepairs, setInfoStudentRepairs] = useState<number>(0);
  const [allLogs, setAllLogs] = useState<MaintenanceLog[]>([]);
  const [expandedLogIds, setExpandedLogIds] = useState<string[]>([]);
  const [zoomedPhoto, setZoomedPhoto] = useState<string | null>(null);

  // --- COLLAPSED SECTION STATES ---
  const [collapsedCharts, setCollapsedCharts] = useState(false);
  const [collapsedRoomsGroups, setCollapsedRoomsGroups] = useState(false);
  const [collapsedStudents, setCollapsedStudents] = useState(false);
  const [collapsedAssignments, setCollapsedAssignments] = useState(false);

  // Loading indicator for PDF or submit operations
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch all db resources
  const loadDashboardData = () => {
    setLoading(true);
    const cb = `?_t=${Date.now()}`;
    Promise.all([
      fetch("/api/rooms" + cb).then(res => res.json()),
      fetch("/api/pcs" + cb).then(res => res.json()),
      fetch("/api/groups" + cb).then(res => res.json()),
      fetch("/api/alumnos" + cb).then(res => res.json()),
      fetch("/api/inventory" + cb).then(res => res.json()),
      fetch(`/api/auth/admins${cb}&adminExpediente=${adminUser?.expediente || ""}`).then(res => res.json()).catch(() => []),
      fetch("/api/logs" + cb).then(res => res.json()).catch(() => [])
    ])
      .then(([roomsData, pcsData, groupsData, alumnosData, inventoryData, adminsData, logsData]) => {
        setRooms(roomsData);
        setPcs(pcsData);
        setGroups(groupsData);
        setAlumnos(alumnosData);
        setInventory(inventoryData);
        setAdminsList(adminsData || []);
        setAllLogs(logsData || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching admin dashboard data", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Calculate high-level bento stats
  const totalPcs = pcs.length;
  const repairedPcsCount = pcs.filter(p => p.state === "Reparado" || p.state === "Operativo").length;
  const activeMaintPcsCount = pcs.filter(p => p.state === "En mantenimiento").length;
  const totalRoomsCount = rooms.length;
  const totalStudentsCount = alumnos.length;
  const criticalPartsCount = inventory.filter(p => p.stock < p.minStock).length;

  const repairEfficacyRate = totalPcs > 0 
    ? Math.round((repairedPcsCount / totalPcs) * 100) 
    : 100;

  // Render SVG statistics dynamically (Swiss Minimalist design)
  // Chart 1 data: PC counts per room
  const maxPcCount = Math.max(...rooms.map(r => r.pcsCount), 10);

  // PC State distribution
  const countOperativos = pcs.filter(p => p.state === "Operativo" || p.state === "Reparado").length;
  const countMantenimiento = pcs.filter(p => p.state === "En mantenimiento").length;
  const countIrreparables = pcs.filter(p => p.state === "Irreparable").length;

  // --- ROOM SUBMIT HANDLER ---
  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName || isNaN(Number(newRoomPcCount))) return;

    setActionLoading(true);
    fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newRoomName,
        pcsCount: Number(newRoomPcCount)
      })
    })
      .then(res => {
        if (!res.ok) throw new Error("Error creating saloon");
        return res.json();
      })
      .then(() => {
        alert(`¡Salón ${newRoomName} creado exitosamente con sus computadoras!`);
        setNewRoomName("");
        setNewRoomPcCount("10");
        setShowAddRoom(false);
        loadDashboardData();
      })
      .catch(err => alert(err.message))
      .finally(() => setActionLoading(false));
  };

  // --- GROUP SUBMIT HANDLER (Formación de equipos utilizando alumnos ya existentes) ---
  const handleCreateGroupWithExistingStudents = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName || !newGroupSalonId) {
      alert("Por favor defina el nombre de grupo y asigne un laboratorio.");
      return;
    }

    if (selectedStudentIdsInForm.length === 0) {
      alert("Por favor seleccione al menos un alumno para formar el equipo.");
      return;
    }

    setActionLoading(true);
    fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newGroupName,
        salonId: newGroupSalonId,
        alumnoIds: selectedStudentIdsInForm
      })
    })
      .then(res => {
        if (!res.ok) {
          return res.json().then(data => {
            throw new Error(data.error || "Error al formar el equipo.");
          });
        }
        return res.json();
      })
      .then(() => {
        alert("¡Equipo de servicio social formado y registrado exitosamente! Se han asignado las computadoras de laboratorio equitativamente a los alumnos elegidos.");
        setNewGroupName("");
        setNewGroupSalonId("");
        setSelectedStudentIdsInForm([]);
        setStudentGroupSearchQuery("");
        setShowAddGroup(false);
        loadDashboardData();
      })
      .catch(err => alert(err.message))
      .finally(() => setActionLoading(false));
  };

  const handleCreateSingleStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleStudentName || !singleStudentExpediente || !singleStudentPassword) {
      alert("Por favor rellene el nombre, expediente y contraseña del alumno.");
      return;
    }

    setActionLoading(true);
    fetch("/api/alumnos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: singleStudentName,
        career: singleStudentCareer,
        semester: parseInt(singleStudentSemester, 10) || 1,
        expediente: singleStudentExpediente,
        password: singleStudentPassword,
        groupId: singleStudentGroupId || null,
        startDate: singleStudentStartDate || null,
        endDate: singleStudentEndDate || null
      })
    })
      .then(res => {
        if (!res.ok) {
          return res.json().then(data => {
            throw new Error(data.error || "Error al registrar alumno.");
          });
        }
        return res.json();
      })
      .then(() => {
        alert("¡Alumno registrado con éxito!");
        setSingleStudentName("");
        setSingleStudentExpediente("");
        setSingleStudentPassword("");
        setSingleStudentGroupId("");
        setSingleStudentStartDate("");
        setSingleStudentEndDate("");
        setShowAddStudentForm(false);
        loadDashboardData();
      })
      .catch(err => alert(err.message))
      .finally(() => setActionLoading(false));
  };

  // --- ALTER/RESET CUSTOM CREDENTIAL LAB PROCEDURES ---
  const handleResetStudentPassword = (studentId: string) => {
    if (!resetPasswordValue) {
      alert("Por favor especifique la nueva contraseña.");
      return;
    }

    fetch(`/api/alumnos/${studentId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: resetPasswordValue })
    })
      .then(res => {
        if (!res.ok) throw new Error("Error actualizando la credencial.");
        return res.json();
      })
      .then(() => {
        alert("¡Contraseña de acceso restablecida correctamente!");
        setEditingStudentId(null);
        setResetPasswordValue("");
        loadDashboardData();
      })
      .catch(err => alert(err.message));
  };

  const handleDeleteStudentRegistration = (studentId: string) => {
    if (!confirm("¿Está seguro de eliminar a este estudiante de servicio social? Se perderán las computadoras que tenga asignadas actualmente.")) return;

    fetch(`/api/alumnos/${studentId}`, { method: "DELETE" })
      .then(res => {
        if (!res.ok) throw new Error("Error borrando alumno.");
        return res.json();
      })
      .then(() => {
        alert("Estudiante desvinculado con éxito.");
        loadDashboardData();
      })
      .catch(err => alert(err.message));
  };

  const scrollToAlumnosSection = () => {
    setCollapsedStudents(false);
    setTimeout(() => {
      const el = document.getElementById("section-students-control");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 60);
  };

  const scrollToRoomsSection = () => {
    setCollapsedRoomsGroups(false);
    setTimeout(() => {
      const el = document.getElementById("section-rooms-groups");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 60);
  };

  const scrollToAssignmentsSection = () => {
    setCollapsedAssignments(false);
    setTimeout(() => {
      const el = document.getElementById("section-pcs-control");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 60);
  };

  const scrollToInventorySection = () => {
    // Para el inventario (que está dentro de la sección 7), hacemos scroll directo
    const el = document.getElementById("section-inventory");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleInspectRoomPcs = (roomId: string) => {
    // 1. Establecer el filtro de salones a este salón particular
    setRoomFilter(roomId);
    // 2. Por seguridad, limpiar el filtro de estado para que vean todos los estados del salón al principio
    setStateFilter("all");
    // 3. Abrir la sección si está colapsada
    setCollapsedAssignments(false);
    // 4. Scroll fluido con un pequeño timeout
    setTimeout(() => {
      const el = document.getElementById("section-pcs-control");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 60);
  };

  const handleDeleteGroup = (groupId: string) => {
    if (!confirm("¿Está seguro de eliminar este grupo / folio de servicio social? Los alumnos asociados quedarán sin grupo.")) return;

    fetch(`/api/groups/${groupId}`, { method: "DELETE" })
      .then(res => {
        if (!res.ok) throw new Error("Error al eliminar el grupo.");
        return res.json();
      })
      .then(() => {
        alert("Grupo eliminado exitosamente de la base de datos.");
        loadDashboardData();
      })
      .catch(err => alert(err.message));
  };

  const handleDeleteRoom = (roomId: string) => {
    if (!confirm("¿Está seguro de eliminar este laboratorio de cómputo? Se borrarán de forma PERMANENTE tanto el salón como todas sus computadoras registradas.")) return;

    fetch(`/api/rooms/${roomId}`, { method: "DELETE" })
      .then(res => {
        if (!res.ok) throw new Error("Error al eliminar el laboratorio.");
        return res.json();
      })
      .then(() => {
        alert("Laboratorio y sus computadoras eliminados con éxito.");
        loadDashboardData();
      })
      .catch(err => alert(err.message));
  };

  const handleDeletePC = (pcId: string) => {
    if (!confirm("¿Está seguro de eliminar esta computadora permanentemente?")) return;

    fetch(`/api/pcs/${pcId}`, { method: "DELETE" })
      .then(res => {
        if (!res.ok) throw new Error("Error eliminando equipo.");
        return res.json();
      })
      .then(() => {
        alert("Computadora eliminada con éxito.");
        loadDashboardData();
      })
      .catch(err => alert(err.message));
  };

  const handleDeleteInventoryItem = (itemId: string) => {
    if (!confirm("¿Está seguro de eliminar esta refacción / pieza del catálogo de refacciones?")) return;

    fetch(`/api/inventory/${itemId}`, { method: "DELETE" })
      .then(res => {
        if (!res.ok) throw new Error("Error eliminando pieza.");
        return res.json();
      })
      .then(() => {
        alert("Refacción eliminada del catálogo.");
        loadDashboardData();
      })
      .catch(err => alert(err.message));
  };

  const handleCreateNewAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminName || !newAdminExpediente || !newAdminPassword) {
      alert("Todos los campos para dar de alta un Administrador son obligatorios.");
      return;
    }

    setActionLoading(true);
    fetch("/api/auth/register-admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newAdminName,
        expediente: newAdminExpediente,
        password: newAdminPassword
      })
    })
      .then(res => {
        if (!res.ok) {
          return res.json().then(data => {
            throw new Error(data.error || "Error al crear nuevo administrador.");
          });
        }
        return res.json();
      })
      .then(() => {
        alert("¡Nuevo administrador registrado con éxito! Ahora puede iniciar sesión con estas credenciales.");
        setNewAdminName("");
        setNewAdminExpediente("");
        setNewAdminPassword("");
        setShowAddAdmin(false);
        loadDashboardData();
      })
      .catch(err => alert(err.message))
      .finally(() => setActionLoading(false));
  };

  // --- REASSIGNING INDIVIDUAL COMPUTER INTERACTIVE SELECTOR ---
  const handleReassignPC = (pcId: string, assignedId: string) => {
    fetch(`/api/pcs/${pcId}/assign`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignedAlumnoId: assignedId || null })
    })
      .then(res => {
        if (!res.ok) throw new Error("Error reasignando equipo.");
        return res.json();
      })
      .then(() => {
        loadDashboardData();
      })
      .catch(err => alert(err.message));
  };

  // --- FILTER PCS FROM SELECTORS ---
  const filteredPcs = pcs.filter(p => {
    const matchesSearch = p.tag.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.state.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesRoom = roomFilter === "all" || p.roomId === roomFilter;
    const matchesState = stateFilter === "all" || p.state === stateFilter;

    return matchesSearch && matchesRoom && matchesState;
  });

  // --- MASTER AUDIT MONTLY REPORT GENERATION (PDF) ---
  const generateMonthlyPDFReport = async () => {
    setActionLoading(true);
    try {
      // Fetch full history logs (or all logs seeded on backend)
      const logsResp = await fetch("/api/pcs"); // Using mock but let's query all completed repairs
      const allPcsList = pcs;
      
      // We will loop across every PC in database and query its logs to get full report lists
      const completedLogs: MaintenanceLog[] = [];
      for (const pc of allPcsList) {
        const histRes = await fetch(`/api/pcs/${pc.id}/history`);
        const pLogs = await histRes.json();
        completedLogs.push(...pLogs);
      }

      // Initialize jsPDF
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "letter"
      });

      // Cover Page / Header Block
      doc.setFillColor(154, 28, 60); // wine burgundy
      doc.rect(0, 0, 216, 44, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(22);
      doc.text("UESLAB - INFORME MENSUAL DE MANTENIMIENTO", 14, 18);
      
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(10);
      doc.text("Métricas Integradas de Servicio Social en Laboratorios Escolares", 14, 25);
      doc.text(`Periodo del Reporte: Junio 2026`, 14, 30);
      doc.text(`Fecha de Impresión: ${new Date().toLocaleDateString()}`, 14, 35);

      // Section 1: Dashboard Global Indicators
      doc.setTextColor(15, 23, 42);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(12);
      doc.text("1. RESUMEN EJECUTIVO DE RENDIMIENTO", 14, 54);
      doc.setFont("Helvetica", "normal");
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(14, 56, 202, 56);

      doc.setFillColor(248, 250, 252);
      doc.rect(14, 61, 188, 28, "F");
      doc.rect(14, 61, 188, 28, "S");

      doc.setFontSize(10);
      doc.text(`• Total Laboratorios Monitoreados: ${totalRoomsCount} salones`, 20, 68);
      doc.text(`• Parque Total de Cómputo Registrado: ${totalPcs} computadoras`, 20, 74);
      doc.text(`• Alumnos Integrantes Activos: ${totalStudentsCount} prestadores`, 20, 80);

      doc.text(`• Tasa General de Efectividad Operativa: ${repairEfficacyRate}%`, 110, 68);
      doc.text(`• Equipos Operantes / Reparados: ${countOperativos} PCs`, 110, 74);
      doc.text(`• Equipos en Cola de Mantenimiento: ${countMantenimiento} PCs`, 110, 80);

      // Section 2: Detailed PCs list of repairs in the month
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(12);
      doc.text("2. BITÁCORA DETALLADA DE EQUIPOS ATENDIDOS EN EL MES", 14, 102);
      doc.line(14, 104, 202, 104);

      let yCoord = 112;
      doc.setFontSize(8.5);

      if (completedLogs.length === 0) {
        doc.setFont("Helvetica", "oblique");
        doc.text("No se registran ordenes de reparación ejecutadas bajo folio en el mes actual.", 14, yCoord);
        yCoord += 10;
      } else {
        // Table Headers
        doc.setFont("Helvetica", "bold");
        doc.text("Ubicación / Lab", 16, yCoord);
        doc.text("Equipo", 65, yCoord);
        doc.text("Fecha", 85, yCoord);
        doc.text("Técnico Responsable", 108, yCoord);
        doc.text("Estatus Concluido", 165, yCoord);

        doc.line(14, yCoord + 2, 202, yCoord + 2);
        yCoord += 7;

        doc.setFont("Helvetica", "normal");
        completedLogs.forEach((log) => {
          if (yCoord > 240) {
            doc.addPage();
            yCoord = 20;
            // Write repeat headers
            doc.setFont("Helvetica", "bold");
            doc.text("Ubicación / Lab", 16, yCoord);
            doc.text("Equipo", 65, yCoord);
            doc.text("Fecha", 85, yCoord);
            doc.text("Técnico Responsable", 108, yCoord);
            doc.text("Estatus Concluido", 165, yCoord);
            doc.line(14, yCoord + 2, 202, yCoord + 2);
            yCoord += 7;
            doc.setFont("Helvetica", "normal");
          }

          const labNameTrunc = log.roomName.length > 26 ? log.roomName.substring(0, 24) + "..." : log.roomName;
          doc.text(labNameTrunc, 16, yCoord);
          doc.text(log.pcTag, 65, yCoord);
          doc.text(log.changeDate, 85, yCoord);
          doc.text(log.studentName, 108, yCoord);
          doc.text(log.type, 165, yCoord);

          yCoord += 6;
        });
      }

      // Section 3: Performance indicators individually by Alumno and Efficacy Formulas
      if (yCoord > 200) {
        doc.addPage();
        yCoord = 20;
      } else {
        yCoord += 12;
      }

      doc.setFont("Helvetica", "bold");
      doc.setFontSize(12);
      doc.text("3. DESGLOSE INDIVIDUAL DE DESEMPEÑO POR ALUMNO", 14, yCoord);
      doc.line(14, yCoord + 2, 202, yCoord + 2);
      yCoord += 10;

      // Alumno Stats headers
      doc.setFontSize(8.5);
      doc.text("Expediente", 16, yCoord);
      doc.text("Nombre Completo del Alumno", 40, yCoord);
      doc.text("Equipos Asignados", 100, yCoord);
      doc.text("Equipos Reparados", 136, yCoord);
      doc.text("Tasa de Efectividad (%)", 170, yCoord);

      doc.line(14, yCoord + 2, 202, yCoord + 2);
      yCoord += 7;

      doc.setFont("Helvetica", "normal");
      alumnos.forEach((al) => {
        // Count student PC breakdown
        const assignedPcsCount = pcs.filter(p => p.assignedAlumnoId === al.id).length;
        const studentRepairsCount = completedLogs.filter(l => l.studentId === al.id && l.type === "Reparado").length;
        
        // Efficacy Formula: Computadoras Reparadas / Totales Asignadas * 100
        const efficacy = assignedPcsCount > 0 
          ? Math.round((studentRepairsCount / assignedPcsCount) * 100)
          : 100; // default to 100 if they managed to do repairs and have 0 current assigned

        doc.text(al.expediente, 16, yCoord);
        doc.text(al.name, 40, yCoord);
        doc.text(`${assignedPcsCount} equipos`, 100, yCoord);
        doc.text(`${studentRepairsCount} reparados`, 136, yCoord);
        doc.text(`${efficacy}%`, 170, yCoord);

        yCoord += 6;
      });

      // Audit Validation Signature
      yCoord = Math.min(240, yCoord + 20);
      doc.setDrawColor(200, 200, 200);
      doc.line(68, yCoord, 148, yCoord);

      doc.setFontSize(9);
      doc.setFont("Helvetica", "bold");
      doc.text("Firma de Liberación y Dictamen Técnico", 78, yCoord + 5);
      
      doc.setFont("Helvetica", "normal");
      doc.text("Coordinación de Infraestructura Escolar", 79, yCoord + 9);

      // Save Monthly Audit Sheet
      doc.save("UesLab_Reporte_Mensual_Mantenimiento.pdf");

    } catch (err) {
      console.error(err);
      alert("Error consolidando bases para reporte PDF.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      
      {/* HEADER NAVIGATION */}
      <nav className="h-14 bg-vino-claro flex items-center sticky top-0 z-40 border-b border-vino-oscuro shrink-0 text-white shadow-md">
        <div className="w-full max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="bg-white/10 p-2 rounded-md shadow flex items-center justify-center">
              <Settings className="w-4 h-4 text-white" />
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
              id="btn-nav-alumnos-goto"
              onClick={scrollToAlumnosSection}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-white/10 backdrop-blur-md hover:bg-white/20 rounded-md border border-white/20 transition active:scale-95 shadow-sm inline-flex items-center gap-1.5"
              title="Ir a lista de alumnos de servicio social y analizar progreso"
            >
              <Users className="w-4 h-4 text-white" />
              Alumnos Asignados
            </button>

            <button
              id="btn-generate-reporte-pdf-admin"
              onClick={generateMonthlyPDFReport}
              disabled={actionLoading}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-white/10 backdrop-blur-md hover:bg-white/20 rounded-md border border-white/20 transition active:scale-95 shadow-sm inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <FileText className="w-3.5 h-3.5" />
              {actionLoading ? "Procesando..." : "Consolidar PDF Mensual"}
            </button>

            <button
              id="admin-logout-top"
              onClick={onLogout}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-white/10 backdrop-blur-md hover:bg-white/20 rounded-md border border-white/20 transition active:scale-95 shadow-sm"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>
      </nav>

      {/* ADMIN SUITE CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-6 space-y-6">

        {/* Dynamic Welcome & Admin Tools */}
        <div id="admin-welcome-section" className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Sesión Activa: Bienvenido, <span className="text-vino-claro font-extrabold">{adminUser?.name || "Coordinador de Laboratorios"}</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Consola de Administración de Soporte Técnico • Universidad Estatal de Sonora • Expediente: <span className="font-mono font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">{adminUser?.expediente || "admin"}</span>
            </p>
          </div>
          
          {isMainAdmin && (
            <div className="flex flex-col sm:items-end gap-2 text-right shrink-0">
              <button
                id="btn-trigger-add-admin-modal"
                onClick={() => {
                  setShowAddAdmin(!showAddAdmin);
                  setShowAdminsListModal(false);
                }}
                className="w-full sm:w-auto px-3.5 py-1.5 bg-slate-100/80 backdrop-blur-md hover:bg-slate-200/95 text-slate-700 rounded-md text-xs font-semibold shadow-sm transition inline-flex items-center justify-center gap-1.5 border border-slate-250 active:scale-95"
              >
                <Key className="w-3.5 h-3.5 text-slate-500" />
                {showAddAdmin ? "Ocultar Registro Admin" : "Registrar Nuevo Administrador"}
              </button>

              <button
                id="btn-trigger-view-admins"
                onClick={() => {
                  setShowAdminsListModal(!showAdminsListModal);
                  setShowAddAdmin(false);
                }}
                className="w-full sm:w-auto px-3.5 py-1.5 bg-slate-100/60 backdrop-blur-md hover:bg-slate-150/85 text-slate-600 rounded-md text-xs font-semibold shadow-xs transition inline-flex items-center justify-center gap-1.5 border border-slate-200 active:scale-95"
              >
                <Users className="w-3.5 h-3.5 text-slate-500" />
                {showAdminsListModal ? "Ocultar Administradores" : "Ver Administradores Secundarios"}
              </button>
            </div>
          )}
        </div>

        {/* Modal/Form inline to add new admin */}
        {showAdminsListModal && (
          <div
            id="panel-secondary-admins"
            className="p-5 bg-white rounded-xl border border-slate-200 shadow-md space-y-4 animate-fade-in"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-vino-claro" />
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-sans">
                  Administradores del Sistema (Coordinación y Apoyos)
                </h4>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">Total: {adminsList.length}</span>
            </div>

            {adminsList.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-4 font-sans">No hay administradores registrados.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50/75 text-[10px] uppercase font-semibold text-slate-500 font-sans border-b border-slate-100">
                    <tr>
                      <th className="p-2.5">Nombre</th>
                      <th className="p-2.5">Expediente</th>
                      <th className="p-2.5 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {adminsList.map((adm) => (
                      <tr key={adm.id} className="hover:bg-slate-50/50 transition">
                        <td className="p-2.5 font-medium text-slate-800 font-sans">👤 {adm.name}</td>
                        <td className="p-2.5 font-mono text-slate-500">{adm.expediente}</td>
                        <td className="p-2.5 text-center">
                          {adm.id === "admin-default" ? (
                            <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded font-bold font-sans">Principal</span>
                          ) : (
                            <button
                              type="button"
                              id={`btn-delete-admin-${adm.id}`}
                              onClick={async () => {
                                if (confirm(`¿Está seguro de eliminar al administrador ${adm.name}?`)) {
                                  try {
                                    const resp = await fetch(`/api/auth/admins/${adm.id}`, { method: "DELETE" });
                                    if (!resp.ok) {
                                      throw new Error("No se pudo eliminar al administrador.");
                                    }
                                    alert("Administrador secundario eliminado correctamente.");
                                    loadDashboardData();
                                  } catch (err: any) {
                                    alert(err.message);
                                  }
                                }
                              }}
                              className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded text-[10px] font-bold duration-150 transition active:scale-95"
                            >
                              Eliminar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Modal/Form inline to add new admin */}
        {showAddAdmin && (
          <form
            id="form-register-new-admin"
            onSubmit={handleCreateNewAdminSubmit}
            className="p-5 bg-white rounded-xl border border-slate-200 shadow-md space-y-4 animate-fade-in"
          >
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
              <UserPlus className="w-4.5 h-4.5 text-vino-claro" />
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Alta de Credenciales de Administrador (Coordinación)</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Nombre Completo del Admin *</label>
                <input
                  type="text"
                  value={newAdminName}
                  onChange={(e) => setNewAdminName(e.target.value)}
                  placeholder="Ej. Ing. Carlos Robles G."
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:border-vino-claro"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-sans">Expediente / Usuario de Acceso *</label>
                <input
                  type="text"
                  value={newAdminExpediente}
                  onChange={(e) => setNewAdminExpediente(e.target.value)}
                  placeholder="Ej. admin2, carlos.robles"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:border-vino-claro font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Contraseña de Acceso *</label>
                <input
                  type="password"
                  value={newAdminPassword}
                  onChange={(e) => setNewAdminPassword(e.target.value)}
                  placeholder="Escriba la clave"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:border-vino-claro"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowAddAdmin(false)}
                className="px-3.5 py-1.5 border border-slate-200 text-slate-600 font-medium rounded-md text-xs hover:bg-slate-50 transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="px-4 py-1.5 bg-vino-claro hover:bg-vino-claro-hover text-white font-semibold rounded-md text-xs shadow-sm transition disabled:opacity-50"
              >
                {actionLoading ? "Registrando..." : "Registrar y Guardar Admin"}
              </button>
            </div>
          </form>
        )}
        
        {/* SECTION 1: BENTO STATISTICS DEWEY TILES */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <button 
            type="button"
            id="tile-laboratorios-nav"
            onClick={scrollToRoomsSection}
            className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow hover:border-slate-350 hover:bg-slate-50/50 transition-all text-left focus:outline-none active:scale-98"
          >
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-sans block">LABORATORIOS</span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-2xl font-bold text-slate-800 leading-none">{totalRoomsCount}</span>
              <Laptop className="w-5 h-5 text-vino-claro" />
            </div>
            <p className="text-[10px] text-slate-400 mt-2 italic flex items-center gap-1 font-sans">Ver laboratorios ➜</p>
          </button>

          <button 
            type="button"
            id="tile-pcs-totales-nav"
            onClick={scrollToAssignmentsSection}
            className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow hover:border-slate-350 hover:bg-slate-50/50 transition-all text-left focus:outline-none active:scale-98"
          >
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-sans block">TOTAL PC GENERAL</span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-2xl font-bold text-slate-800 leading-none font-mono">{totalPcs}</span>
              <Layers className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-[10px] text-slate-400 mt-2 italic flex items-center gap-1 font-sans">Ver inventario de PCs ➜</p>
          </button>

          <button 
            type="button"
            id="tile-alumnos-asignados"
            onClick={scrollToAlumnosSection}
            className="bg-white/80 backdrop-blur-md p-4 rounded-xl border border-slate-200/80 shadow-sm hover:shadow hover:border-slate-350 hover:bg-white/90 transition-all text-left focus:outline-none active:scale-98"
          >
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-sans block">ALUMNOS ASIGNADOS</span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-2xl font-bold text-slate-800 leading-none">{totalStudentsCount}</span>
              <Users className="w-5 h-5 text-vino-claro" />
            </div>
            <p className="text-[10px] text-slate-400 mt-2 italic flex items-center gap-1 font-sans">Ver progresos ➜</p>
          </button>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm col-span-1">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-sans block">EFECTIVIDAD</span>
            <div className="flex items-end justify-between mt-1">
              <span className="text-xl font-bold text-emerald-600 leading-none">{repairEfficacyRate}%</span>
              <CheckCircle className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="w-full bg-slate-150 h-1.5 mt-2 rounded-full overflow-hidden">
              <div className="bg-emerald-500 h-full transition-all" style={{ width: `${repairEfficacyRate}%` }}></div>
            </div>
          </div>

          <button 
            type="button"
            id="tile-refacciones-alertas-nav"
            onClick={scrollToInventorySection}
            className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-350 hover:bg-slate-50/50 transition-all text-left focus:outline-none active:scale-98 col-span-1"
            title="Haga clic para ver catálogo detallado de refacciones críticas"
          >
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-sans block">ALERTAS DE STOCK</span>
            <div className="flex items-center justify-between mt-1">
              <span className={`text-2xl font-bold leading-none ${criticalPartsCount > 0 ? "text-rose-600 animate-pulse" : "text-slate-800"}`}>
                {criticalPartsCount}
              </span>
              <AlertTriangle className={`w-5 h-5 ${criticalPartsCount > 0 ? "text-rose-500" : "text-slate-400"}`} />
            </div>
            <p className="text-[10px] text-slate-400 mt-2 italic flex items-center gap-1 font-sans">Surtir crítitcos ➜</p>
          </button>
        </div>

        {/* SECTION 2: CHARTS GRAPHICS WRAPPERS */}
        <div className="bg-slate-50/50 rounded-2xl border border-slate-250 p-4 transition-all">
          <button
            type="button"
            id="heading-toggle-charts"
            onClick={() => setCollapsedCharts(!collapsedCharts)}
            className="w-full flex items-center justify-between py-1.5 text-left focus:outline-none group"
          >
            <div className="flex items-center gap-2">
              <BarChart className="w-5 h-5 text-vino-claro" />
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-sans">
                  Estadísticas Clínicas & Distribución de Infraestructura
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5 font-sans">
                  Visualice las PCs operativas, equipos en mantenimiento y asignación por laboratorio escolar.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 hover:border-slate-350 px-2.5 py-1 rounded-md shadow-xs group-hover:bg-slate-50 transition-all cursor-pointer">
              <span className="text-[10px] text-slate-500 font-semibold">{collapsedCharts ? "Desplegar" : "Colapsar"}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${!collapsedCharts ? "rotate-180 text-vino-claro" : ""}`} />
            </div>
          </button>

          {!collapsedCharts && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4 animate-fade-in">
              
              {/* Chart Card 1: PC Distribution per room */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3.5 flex items-center gap-1.5 font-sans">
                  <Layers className="w-4 h-4 text-slate-500" />
                  Equipos de Cómputo por Laboratorio Escolar
                </h3>
                
                <div className="space-y-4">
                  {rooms.map((room) => {
                    const percentage = Math.min((room.pcsCount / maxPcCount) * 100, 100);
                    return (
                      <div key={room.id} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium text-gray-700">{room.name}</span>
                          <span className="font-mono font-bold text-slate-900">{room.pcsCount} PCs totales</span>
                        </div>
                        {/* Horizontal Bar Chart */}
                        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-slate-900 rounded-full transition-all duration-300"
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Chart Card 2: PC distribution state ratios */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3.5 flex items-center gap-1.5 font-sans">
                  <BarChart className="w-4 h-4 text-slate-500" />
                  Estado Clínico Operativo de la Infraestructura
                </h3>

                {totalPcs === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">Inicie dando de alta laboratorios para calcular proporciones de estado.</p>
                ) : (
                  <div className="flex flex-col md:flex-row items-center gap-6 justify-between">
                    
                    {/* Concentric visual distribution layout */}
                    <div className="space-y-3 flex-1 w-full">
                      <div className="flex justify-between items-center text-xs">
                        <span className="flex items-center gap-1.5 text-gray-700 font-medium">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                          Operativas (Sin Falla / Reparadas)
                        </span>
                        <span className="font-mono font-bold text-slate-950">
                          {countOperativos} PCs ({Math.round(countOperativos / totalPcs * 100)}%)
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-xs">
                        <span className="flex items-center gap-1.5 text-gray-700 font-medium">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
                          En Cola de Servicio (Mantenimiento)
                        </span>
                        <span className="font-mono font-bold text-slate-950">
                          {countMantenimiento} PCs ({Math.round(countMantenimiento / totalPcs * 100)}%)
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-xs">
                        <span className="flex items-center gap-1.5 text-gray-700 font-medium">
                          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
                          Irreparables (Baja / Descarte)
                        </span>
                        <span className="font-mono font-bold text-slate-950">
                          {countIrreparables} PCs ({Math.round(countIrreparables / totalPcs * 100)}%)
                        </span>
                      </div>

                      {/* Horizontal Stacked Percentage Gauge */}
                      <div className="w-full h-4 bg-gray-150 rounded-full overflow-hidden flex mt-2.5">
                        <div className="h-full bg-emerald-500" style={{ width: `${(countOperativos/totalPcs)*100}%` }}></div>
                        <div className="h-full bg-amber-500 animate-pulse" style={{ width: `${(countMantenimiento/totalPcs)*100}%` }}></div>
                        <div className="h-full bg-rose-500" style={{ width: `${(countIrreparables/totalPcs)*100}%` }}></div>
                      </div>
                    </div>

                  </div>
                )}
              </div>

            </div>
          )}
        </div>


        {/* SECTION 5: CONTROL DE ALUMNOS (TABLA DE CREDENCIALES & RESETS) */}
        <div id="section-students-control" className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm scroll-mt-20">
          <button
            type="button"
            id="heading-toggle-students"
            onClick={() => setCollapsedStudents(!collapsedStudents)}
            className="w-full flex items-center justify-between border-b border-slate-100 pb-3 text-left focus:outline-none group mb-4"
          >
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-vino-claro" />
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-sans">
                  Control de Alumnos (Credenciales de Servicio Social)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-sans">
                  Consulte qué Expedientes y Contraseñas asignó a cada alumno. Realice restablecimientos de claves de forma inmediata.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 hover:border-slate-350 px-2.5 py-1 rounded-md shadow-xs group-hover:bg-slate-100 transition-all cursor-pointer shrink-0">
              <span className="text-[10px] text-slate-500 font-semibold">{collapsedStudents ? "Desplegar" : "Colapsar"}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${!collapsedStudents ? "rotate-180 text-vino-claro" : ""}`} />
            </div>
          </button>

          {!collapsedStudents && (
            <div className="animate-fade-in space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <div>
                  <span className="text-xs font-semibold text-slate-700">Listado de Estudiantes del Periodo</span>
                </div>
                
                <button
                  id="btn-show-add-student-form"
                  type="button"
                  onClick={() => setShowAddStudentForm(!showAddStudentForm)}
                  className="px-3 py-1.5 bg-vino-claro hover:bg-vino-claro-hover text-white rounded-md text-xs font-semibold shadow transition inline-flex items-center gap-1.5 active:scale-95"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  {showAddStudentForm ? "Ocultar Registro" : "Agregar Alumno Individual"}
                </button>
              </div>

          {showAddStudentForm && (
            <form 
              id="form-add-student-individual"
              onSubmit={handleCreateSingleStudent}
              className="mb-6 p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-4 animate-fade-in"
            >
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                <UserPlus className="w-4 h-4 text-vino-claro" />
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Nuevo Alumno de Servicio Social</h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Nombre Completo *</label>
                  <input
                    type="text"
                    value={singleStudentName}
                    onChange={(e) => setSingleStudentName(e.target.value)}
                    placeholder="Ej. Juan Pérez López"
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-300 bg-white rounded-md focus:outline-none focus:ring-1 focus:ring-vino-claro/10 focus:border-vino-claro"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Carrera Profesional</label>
                  <input
                    type="text"
                    value={singleStudentCareer}
                    onChange={(e) => setSingleStudentCareer(e.target.value)}
                    placeholder="Ej. Ing. en Sistemas"
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-300 bg-white rounded-md focus:outline-none focus:ring-1 focus:ring-vino-claro/10 focus:border-vino-claro"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Semestre</label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={singleStudentSemester}
                    onChange={(e) => setSingleStudentSemester(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-300 bg-white rounded-md focus:outline-none focus:ring-1 focus:ring-vino-claro/10 focus:border-vino-claro"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Expediente (ID de Acceso) *</label>
                  <input
                    type="text"
                    value={singleStudentExpediente}
                    onChange={(e) => setSingleStudentExpediente(e.target.value)}
                    placeholder="Ej. 22240102"
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-300 bg-white rounded-md focus:outline-none focus:ring-1 focus:ring-vino-claro/10 focus:border-vino-claro"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Contraseña de Acceso *</label>
                  <input
                    type="text"
                    value={singleStudentPassword}
                    onChange={(e) => setSingleStudentPassword(e.target.value)}
                    placeholder="Ej. d93jA9a"
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-300 bg-white rounded-md focus:outline-none focus:ring-1 focus:ring-vino-claro/10 focus:border-vino-claro"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Grupo Asignado (Opcional)</label>
                  <select
                    value={singleStudentGroupId}
                    onChange={(e) => setSingleStudentGroupId(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-300 bg-white rounded-md focus:outline-none focus:ring-1 focus:ring-vino-claro/10 focus:border-vino-claro"
                  >
                    <option value="">Ninguno / Sin grupo</option>
                    {groups.map(g => (
                      <option key={g.id} value={g.id}>{g.name} ({g.folio})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Inicio de Soporte *</label>
                  <input
                    type="date"
                    value={singleStudentStartDate}
                    onChange={(e) => setSingleStudentStartDate(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-300 bg-white rounded-md focus:outline-none focus:ring-1 focus:ring-vino-claro/10 focus:border-vino-claro"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Fin de Soporte *</label>
                  <input
                    type="date"
                    value={singleStudentEndDate}
                    onChange={(e) => setSingleStudentEndDate(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-300 bg-white rounded-md focus:outline-none focus:ring-1 focus:ring-vino-claro/10 focus:border-vino-claro"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddStudentForm(false)}
                  className="px-3.5 py-1.5 border border-slate-300 text-slate-600 font-medium rounded-md text-xs hover:bg-slate-100 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 bg-vino-claro hover:bg-vino-claro-hover text-white font-semibold rounded-md text-xs shadow transition disabled:opacity-50"
                >
                  {actionLoading ? "Registrando..." : "Registrar Alumno"}
                </button>
              </div>
            </form>
          )}

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table id="table-students-control" className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-600 font-semibold text-[11px] uppercase border-b border-slate-200">
                  <th className="p-3 font-sans">Expediente</th>
                  <th className="p-3 font-sans">Nombre Alumno</th>
                  <th className="p-3 font-sans">Carrera / Semestre</th>
                  <th className="p-3 font-sans">Contraseña Actual</th>
                  <th className="p-3 font-sans">Estación Directa</th>
                  <th className="p-3 text-right font-sans">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {alumnos.map((student) => {
                  const studentGroup = groups.find(g => g.id === student.groupId);
                  const isResettingThis = editingStudentId === student.id;

                  return (
                    <tr key={student.id} className="hover:bg-gray-55">
                      <td className="p-3.5 font-mono font-bold text-slate-900 bg-gray-55/40">{student.expediente}</td>
                      <td className="p-3.5 font-semibold text-gray-800">
                        <div className="flex items-center gap-1.5">
                          <span>{student.name}</span>
                          <button
                            id={`btn-info-student-${student.id}`}
                            type="button"
                            onClick={() => {
                              fetch(`/api/alumnos/${student.id}/repairs-count`)
                                .then(r => r.json())
                                .then(data => {
                                  setInfoStudentRepairs(data.count || 0);
                                  setInfoStudent(student);
                                })
                                .catch(() => {
                                  setInfoStudentRepairs(0);
                                  setInfoStudent(student);
                                });
                            }}
                            className="p-1 rounded-full text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition duration-150"
                            title="Ver información complementaria"
                          >
                            <Info className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                      <td className="p-3.5 text-gray-500">
                        {student.career}
                        <span className="block text-[10px] font-mono font-medium">Semestre: {student.semester}°</span>
                      </td>
                      <td className="p-3.5 font-mono">
                        {isResettingThis ? (
                          <div className="flex items-center gap-1.5 max-w-[150px] animate-fade-in">
                            <input
                              id={`input-reset-pass-${student.id}`}
                              type="text"
                              value={resetPasswordValue}
                              onChange={(e) => setResetPasswordValue(e.target.value)}
                              placeholder="Nueva Clave"
                              className="text-xs px-2 py-0.5 border border-blue-500 focus:outline-none rounded w-full"
                            />
                            <button
                              id={`btn-apply-reset-${student.id}`}
                              onClick={() => handleResetStudentPassword(student.id)}
                              className="text-[10px] font-bold text-white bg-emerald-600 px-1.5 py-0.5 rounded shadow"
                            >
                              Fijar
                            </button>
                            <button
                              id={`btn-cancel-reset-${student.id}`}
                              onClick={() => { setEditingStudentId(null); setResetPasswordValue(""); }}
                              className="text-[10px] text-gray-400"
                            >
                              X
                            </button>
                          </div>
                        ) : (
                          <span className="bg-gray-150 text-gray-700 font-bold px-2 py-0.5 rounded cursor-pointer select-element hover:bg-gray-200 transition" onClick={() => { setEditingStudentId(student.id); setResetPasswordValue(student.password); }}>
                            🔑 {student.password}
                          </span>
                        )}
                      </td>
                      <td className="p-3.5">
                        <span className="text-[10px] font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                          {studentGroup ? studentGroup.name : "Sin grupo"}
                        </span>
                      </td>
                      <td className="p-3.5 text-right space-x-1.5 flex items-center justify-end">
                        <button
                          id={`btn-student-progress-${student.id}`}
                          onClick={() => {
                            setSelectedStudentForHistory(student);
                          }}
                          className="px-2 py-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded inline-flex items-center gap-1 shrink-0 transition"
                          title="Ver progreso y reportes detallados de este alumno"
                        >
                          <Users className="w-3 h-3 text-emerald-600" />
                          Progreso & Reportes
                        </button>
                        <button
                          id={`btn-student-reset-trigger-${student.id}`}
                          onClick={() => { setEditingStudentId(student.id); setResetPasswordValue(student.password); }}
                          className="px-2 py-1 text-[10px] font-semibold text-blue-600 hover:bg-blue-50 rounded shrink-0"
                        >
                          Restablecer Clave
                        </button>
                        <button
                          id={`btn-student-delete-${student.id}`}
                          onClick={() => handleDeleteStudentRegistration(student.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition shrink-0"
                        >
                          <Trash className="w-3.5 h-3.5 inline" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {selectedStudentForHistory && (
            <div id="student-progress-extended-panel" className="mt-6 p-5 rounded-xl border border-emerald-200 bg-emerald-50/10 animate-fade-in space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2.5">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-emerald-700" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Progreso de Servicio Social: <span className="text-emerald-800 font-extrabold">{selectedStudentForHistory.name}</span>
                    </h4>
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                      Expediente: <strong className="text-slate-800">{selectedStudentForHistory.expediente}</strong> • Carrera: {selectedStudentForHistory.career} • Semestre: {selectedStudentForHistory.semester}°
                    </p>
                  </div>
                </div>
                
                <button
                  id="btn-close-student-progress"
                  onClick={() => setSelectedStudentForHistory(null)}
                  className="px-2.5 py-1 text-[11px] text-slate-600 hover:text-slate-900 font-medium border border-slate-200 bg-white hover:bg-slate-50 rounded shadow-sm transition"
                >
                  Cerrar Detalles de Alumno
                </button>
              </div>

              {/* Analysis high levels */}
              {(() => {
                const studentLogs = allLogs.filter(l => l.studentId === selectedStudentForHistory.id || l.studentName === selectedStudentForHistory.name);
                const countReparados = studentLogs.filter(l => l.type === "Reparado").length;
                const countMantenimiento = studentLogs.filter(l => l.type === "En mantenimiento").length;
                const countBajas = studentLogs.filter(l => l.type === "Irreparable").length;

                return (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-emerald-50/40 p-3 rounded-lg border border-emerald-100 text-center">
                        <span className="text-[9px] font-bold text-emerald-800 uppercase block tracking-wider font-sans">Equipos Reparados</span>
                        <span className="text-xl font-extrabold text-emerald-900 block mt-0.5">{countReparados}</span>
                      </div>
                      
                      <div className="bg-amber-50/40 p-3 rounded-lg border border-amber-100 text-center">
                        <span className="text-[9px] font-bold text-amber-800 uppercase block tracking-wider font-sans">En Mantenimiento</span>
                        <span className="text-xl font-extrabold text-amber-900 block mt-0.5">{countMantenimiento}</span>
                      </div>

                      <div className="bg-rose-50/40 p-3 rounded-lg border border-rose-100 text-center">
                        <span className="text-[9px] font-bold text-rose-800 uppercase block tracking-wider font-sans">Declarados de Baja</span>
                        <span className="text-xl font-extrabold text-rose-900 block mt-0.5">{countBajas}</span>
                      </div>
                    </div>

                    <div>
                      <h5 className="text-[10px] font-bold text-slate-800 uppercase tracking-widest block mb-2.5 font-sans">
                        📂 Reportes Generados e Historial de Actividades ({studentLogs.length} acciones)
                      </h5>

                      {studentLogs.length === 0 ? (
                        <div className="p-6 text-center rounded-lg border border-dashed border-slate-200 bg-white">
                          <p className="text-xs text-slate-400 italic font-sans">Este estudiante aún no ha guardado ningún reporte clínico de mantenimiento en este periodo.</p>
                        </div>
                      ) : (
                        <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1.5 scrollbar-thin">
                          {studentLogs.map((log) => {
                            const isExpanded = expandedLogIds.includes(log.id);
                            const partsCount = log.partsUsed?.length || 0;
                            const hasPhotos = !!(log.photoBefore || log.photoAfter);

                            return (
                              <div key={log.id} className="p-3.5 bg-slate-50/50 rounded-lg border border-slate-200 text-xs space-y-2.5 select-element scroll-mt-2">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                  <span className="font-semibold text-slate-900 font-sans flex items-center gap-1.5">
                                    🖥️ {log.roomName} • Equipo: <strong className="font-mono text-vino-claro">{log.pcTag}</strong>
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-mono text-slate-400">{log.changeDate}</span>
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                      log.type === "Reparado" ? "bg-emerald-100 text-emerald-800" :
                                      log.type === "En mantenimiento" ? "bg-amber-100 text-amber-800 border border-amber-250/50" :
                                      "bg-rose-100 text-rose-800"
                                    }`}>
                                      {log.type}
                                    </span>
                                    <button
                                      type="button"
                                      id={`btn-toggle-detail-${log.id}`}
                                      onClick={() => {
                                        if (expandedLogIds.includes(log.id)) {
                                          setExpandedLogIds(expandedLogIds.filter(id => id !== log.id));
                                        } else {
                                          setExpandedLogIds([...expandedLogIds, log.id]);
                                        }
                                      }}
                                      className="px-2 py-0.5 text-[10px] bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded font-bold transition flex items-center gap-1 ml-1"
                                      title="Ver reporte detallado con fotos y piezas de inventario"
                                    >
                                      {isExpanded ? <EyeOff className="w-3 h-3 text-slate-500" /> : <Eye className="w-3 h-3 text-vino-claro" />}
                                      {isExpanded ? "Ocultar" : "Ver Detalle"}
                                      {(partsCount > 0 || hasPhotos) && !isExpanded && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-vino-claro animate-pulse" />
                                      )}
                                    </button>
                                  </div>
                                </div>

                                <div className="bg-white p-2.5 rounded border border-slate-150 space-y-1.5 text-[11px]">
                                  {log.failureDesc && (
                                    <p className="text-slate-700 font-sans">
                                      <strong className="text-slate-900 font-semibold font-sans">Falla reportada:</strong> {log.failureDesc}
                                    </p>
                                  )}
                                  {log.solutionDesc && (
                                    <p className="text-slate-700 font-sans">
                                      <strong className="text-emerald-850 font-semibold font-sans">Solución técnica:</strong> {log.solutionDesc}
                                    </p>
                                  )}
                                  {log.techJustification && (
                                    <p className="text-slate-700 font-sans">
                                      <strong className="text-rose-850 font-semibold font-sans">Justificación técnica (Baja):</strong> {log.techJustification}
                                    </p>
                                  )}

                                  {/* Detailed Extended Info inside dropdown */}
                                  {isExpanded && (
                                    <div className="border-t border-slate-100 pt-2.5 mt-2.5 space-y-3 animate-fade-in text-[11px]">
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600 bg-slate-50/70 p-2 rounded border border-slate-100 text-[10px] font-sans">
                                        <div>
                                          <strong className="text-slate-800 font-sans">Fecha de Término / Registro:</strong> {log.changeDate}
                                        </div>
                                        <div>
                                          <strong className="text-slate-800 font-sans">Técnico de Servicio Social:</strong> {log.studentName}
                                        </div>
                                      </div>

                                      <div>
                                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block mb-1 font-sans">
                                          🧩 Refacciones de Inventario Utilizadas:
                                        </span>
                                        {log.partsUsed && log.partsUsed.length > 0 ? (
                                          <div className="flex flex-wrap gap-1.5 mt-1">
                                            {log.partsUsed.map((partName, idx) => (
                                              <span key={idx} className="bg-blue-50 text-blue-800 border border-blue-100 font-mono text-[10px] font-bold px-2 py-0.5 rounded">
                                                🧩 {partName}
                                              </span>
                                            ))}
                                          </div>
                                        ) : (
                                          <p className="text-slate-400 italic text-[10px] font-sans">Cero (0) refacciones de inventario fueron utilizadas.</p>
                                        )}
                                      </div>

                                      {/* Photo evidence slot */}
                                      {(log.photoBefore || log.photoAfter) ? (
                                        <div>
                                          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block mb-1.5 font-sans">
                                            📸 Evidencias de Mantenimiento (Clic para ampliar):
                                          </span>
                                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1.5">
                                            {log.photoBefore && (
                                              <div className="space-y-1">
                                                <span className="text-[9px] text-slate-400 font-semibold font-sans block">Estado inicial (Falla):</span>
                                                <div 
                                                  id={`photo-before-${log.id}`}
                                                  onClick={() => setZoomedPhoto(log.photoBefore || null)}
                                                  className="aspect-video w-full rounded-lg overflow-hidden border border-slate-200 bg-slate-50 hover:border-vino-claro hover:ring-2 hover:ring-vino-claro/10 transition cursor-zoom-in flex items-center justify-center relative group"
                                                >
                                                  <img 
                                                    referrerPolicy="no-referrer"
                                                    src={log.photoBefore} 
                                                    alt="Vista Inicial" 
                                                    className="w-full h-full object-cover"
                                                  />
                                                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                                                    <span className="text-white text-[9px] font-bold bg-black/75 px-2 py-1 rounded">Ampliar</span>
                                                  </div>
                                                </div>
                                              </div>
                                            )}

                                            {log.photoAfter && (
                                              <div className="space-y-1">
                                                <span className="text-[9px] text-slate-400 font-semibold font-sans block">Estado final (Resultado):</span>
                                                <div 
                                                  id={`photo-after-${log.id}`}
                                                  onClick={() => setZoomedPhoto(log.photoAfter || null)}
                                                  className="aspect-video w-full rounded-lg overflow-hidden border border-slate-200 bg-slate-50 hover:border-vino-claro hover:ring-2 hover:ring-vino-claro/10 transition cursor-zoom-in flex items-center justify-center relative group"
                                                >
                                                  <img 
                                                    referrerPolicy="no-referrer"
                                                    src={log.photoAfter} 
                                                    alt="Vista Final" 
                                                    className="w-full h-full object-cover"
                                                  />
                                                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                                                    <span className="text-white text-[9px] font-bold bg-black/75 px-2 py-1 rounded">Ampliar</span>
                                                  </div>
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      ) : (
                                        <p className="text-slate-405 italic text-[10px] font-sans">No se registraron imágenes de evidencia para este reporte.</p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
        )}
      </div>


        {/* SECTION 3 & 4: DUAL GESTION DE SALONES & GRUPOS DE ALTA */}
        <div id="section-rooms-groups" className="bg-slate-50/50 rounded-2xl border border-slate-250 p-4 transition-all scroll-mt-20">
          <button
            type="button"
            id="heading-toggle-rooms-groups"
            onClick={() => setCollapsedRoomsGroups(!collapsedRoomsGroups)}
            className="w-full flex items-center justify-between py-1.5 text-left focus:outline-none group mb-4"
          >
            <div className="flex items-center gap-2">
              <Laptop className="w-5 h-5 text-vino-claro" />
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-sans">
                  Gestión Escolar: Catálogos de Laboratorios y Grupos
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5 font-sans">
                  Dé de alta nuevos laboratorios, configure cantidades de PCs iniciales y defina folios o grupos para sus alumnos de servicio técnico.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 hover:border-slate-350 px-2.5 py-1 rounded-md shadow-xs group-hover:bg-slate-50 transition-all cursor-pointer">
              <span className="text-[10px] text-slate-500 font-semibold">{collapsedRoomsGroups ? "Desplegar" : "Colapsar"}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${!collapsedRoomsGroups ? "rotate-180 text-vino-claro" : ""}`} />
            </div>
          </button>

          {!collapsedRoomsGroups && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
          
          {/* 3.1 GESTIÓN DE SALÓN (ALTA DE SALÓN) */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2.5">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-sans">
                  Gestión y Registro de Laboratorios
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Defina salones nuevos; los equipos se estructuran y configuran de forma automatizada.</p>
              </div>
              <button
                id="btn-toggle-add-room"
                onClick={() => setShowAddRoom(!showAddRoom)}
                className="p-1.5 hover:bg-gray-150/60 text-slate-800 rounded-lg transition"
              >
                {showAddRoom ? <ChevronDown className="w-4 h-4 rotate-180" /> : <Plus className="w-5 h-5" />}
              </button>
            </div>

            {showAddRoom && (
              <form id="form-create-room" onSubmit={handleCreateRoom} className="space-y-4 animate-fade-in">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Nombre e Identificación del Laboratorio *</label>
                  <input
                    id="input-room-name"
                    type="text"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    placeholder="Ej. Laboratorio de Software (L-102)"
                    className="w-full text-xs px-3.5 py-2.5 border border-gray-250 bg-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/10"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Cantidad de computadoras de escritorio (PCs) *</label>
                  <input
                    id="input-room-pcs-count"
                    type="number"
                    value={newRoomPcCount}
                    onChange={(e) => setNewRoomPcCount(e.target.value)}
                    min="1"
                    max="50"
                    className="w-full text-xs px-3.5 py-2.5 border border-gray-250 bg-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/10"
                    required
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    id="btn-room-submit"
                    type="submit"
                    disabled={actionLoading}
                    className="text-xs font-bold px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow transition"
                  >
                    Crear Laboratorio (Computadoras Auto-generadas)
                  </button>
                </div>
              </form>
            )}

            {/* Configured saline list review */}
            <div className="mt-4 space-y-2 max-h-[220px] overflow-y-auto scrollbar-thin">
              {rooms.map(r => (
                <div key={r.id} className="flex justify-between items-center p-3 rounded-xl bg-gray-55 border border-gray-100 text-xs font-mono">
                  <span className="font-semibold text-slate-800 font-sans flex items-center gap-1.5">
                    🏢 {r.name}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="bg-slate-250 text-slate-700 px-2.5 py-0.5 rounded-full text-[10px] font-bold">{r.pcsCount} PCs</span>
                    <button
                      type="button"
                      id={`btn-view-more-room-${r.id}`}
                      onClick={() => handleInspectRoomPcs(r.id)}
                      className="px-2.5 py-1 bg-vino-claro hover:bg-vino-hueso hover:text-vino-claro text-white text-[10px] font-bold rounded duration-150 transition active:scale-95 flex items-center gap-1 shrink-0"
                      title="Ver PCs de este laboratorio y quién trabaja en ellas"
                    >
                      Ver más ➜
                    </button>
                    <button
                      id={`btn-delete-room-${r.id}`}
                      onClick={() => handleDeleteRoom(r.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                      title="Eliminar este laboratorio y todas sus computadoras"
                    >
                      <Trash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>


          {/* 3.2 MÓDULO ALTA GRUPOS Y INTEGRACIÓN CREDENCIALES (¡CRÍTICO!) */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2.5">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-sans">
                  Formación de Equipos de Servicio Social
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Defina un equipo vinculando alumnos pre-existentes al laboratorio donde laborarán.</p>
              </div>
              <button
                id="btn-toggle-add-group"
                onClick={() => setShowAddGroup(!showAddGroup)}
                className="p-1.5 hover:bg-gray-150/60 text-slate-800 rounded-lg transition"
              >
                {showAddGroup ? <ChevronDown className="w-4 h-4 rotate-180" /> : <Plus className="w-5 h-5" />}
              </button>
            </div>

            {showAddGroup && (
              <form id="form-create-group" onSubmit={handleCreateGroupWithExistingStudents} className="space-y-4 animate-fade-in max-h-[500px] overflow-y-auto pr-2 scrollbar-thin">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Nombre Descriptivo del Equipo *</label>
                    <input
                      id="input-group-name"
                      type="text"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      placeholder="Ej. Equipo L-101 Turno Matutino"
                      className="w-full text-xs px-3 py-2 border border-gray-250 bg-white rounded-lg focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Laboratorio Asignado *</label>
                    <select
                      id="select-group-room"
                      value={newGroupSalonId}
                      onChange={(e) => setNewGroupSalonId(e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-gray-250 bg-white rounded-lg focus:outline-none"
                      required
                    >
                      <option value="">Seleccione Laboratorio...</option>
                      {rooms.map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* BUSCADOR Y SELECCIONADOR DE ALUMNOS EXISTENTES */}
                <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-150 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-2">
                    <div>
                      <span className="text-[10px] font-bold text-slate-800 uppercase tracking-wider block font-mono">
                        👥 SELECCIONAR INTEGRANTES (Alumnos Registrados)
                      </span>
                      <span className="text-[9px] text-gray-500">
                        Marque los estudiantes que formarán este equipo.
                      </span>
                    </div>
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full font-mono text-[10px] font-bold">
                      {selectedStudentIdsInForm.length} elegidos
                    </span>
                  </div>

                  {/* Input de búsqueda interno */}
                  <div className="relative">
                    <input
                      type="text"
                      className="w-full text-xs px-2.5 py-1.5 border border-slate-300 bg-white rounded focus:outline-none placeholder-slate-400 font-sans"
                      placeholder="🔍 Filtrar alumnos por nombre o expediente..."
                      value={studentGroupSearchQuery}
                      onChange={(e) => setStudentGroupSearchQuery(e.target.value)}
                    />
                  </div>

                  {/* Listado interactivo con scrollbar */}
                  <div className="max-h-[160px] overflow-y-auto border border-gray-200 bg-white rounded divide-y divide-gray-100 scrollbar-thin">
                    {(() => {
                      const filtered = alumnos.filter(alumno => {
                        const query = studentGroupSearchQuery.toLowerCase();
                        return (
                          alumno.name.toLowerCase().includes(query) ||
                          alumno.expediente.toLowerCase().includes(query)
                        );
                      });

                      if (filtered.length === 0) {
                        return (
                          <div className="p-3 text-center text-xs text-gray-400 italic">
                            No se encontraron alumnos registrados con esa búsqueda.
                          </div>
                        );
                      }

                      return filtered.map(student => {
                        const isChecked = selectedStudentIdsInForm.includes(student.id);
                        const studentGroup = groups.find(g => g.id === student.groupId);
                        
                        return (
                          <label
                            key={student.id}
                            className={`flex items-start gap-2.5 p-2 text-xs transition-colors cursor-pointer select-none hover:bg-slate-50 ${
                              isChecked ? "bg-blue-50/40" : ""
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="mt-0.5 h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              checked={isChecked}
                              onChange={() => {
                                if (isChecked) {
                                  setSelectedStudentIdsInForm(selectedStudentIdsInForm.filter(id => id !== student.id));
                                } else {
                                  setSelectedStudentIdsInForm([...selectedStudentIdsInForm, student.id]);
                                }
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-center gap-2">
                                <strong className="text-gray-950 font-sans truncate block">{student.name}</strong>
                                <span className="text-[10px] font-mono text-gray-500 font-bold shrink-0">{student.expediente}</span>
                              </div>
                              <div className="flex items-center justify-between text-[9px] text-gray-500 mt-0.5">
                                <span className="truncate">{student.career} • {student.semester}° Semestre</span>
                                {studentGroup ? (
                                  <span className="bg-amber-100 text-amber-800 font-semibold px-1 py-0.5 rounded text-[8px] tracking-tight">
                                    En grupo: {studentGroup.name}
                                  </span>
                                ) : (
                                  <span className="bg-emerald-50 text-emerald-800 font-semibold px-1 py-0.5 rounded text-[8px] tracking-tight">
                                    Disponible / Sin Grupo
                                  </span>
                                )}
                              </div>
                            </div>
                          </label>
                        );
                      });
                    })()}
                  </div>
                  
                  {selectedStudentIdsInForm.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedStudentIdsInForm([])}
                      className="text-[9px] text-rose-600 hover:text-rose-800 font-bold underline block text-right ml-auto"
                    >
                      Deseleccionar todos
                    </button>
                  )}
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    id="btn-group-submit"
                    type="submit"
                    disabled={actionLoading}
                    className="text-xs font-bold px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white rounded-xl shadow transition"
                  >
                    Formar Equipo y Asignar Estaciones
                  </button>
                </div>

              </form>
            )}

            {/* List of registered groups */}
            <div className="mt-4 space-y-2 max-h-[220px] overflow-y-auto scrollbar-thin">
              {groups.map(g => {
                const assignedRoom = rooms.find(r => r.id === g.salonId);
                return (
                  <div key={g.id} className="flex justify-between items-center p-3 rounded-xl bg-gray-55 border border-gray-100 text-xs text-slate-800 font-sans">
                    <div>
                      <span className="font-semibold block">{g.name}</span>
                      <span className="text-[10px] font-mono text-gray-500">Salón: {assignedRoom ? assignedRoom.name : "N/A"} • Folio: <strong className="text-blue-750">{g.folio}</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        id={`btn-delete-group-${g.id}`}
                        onClick={() => handleDeleteGroup(g.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                        title="Eliminar este grupo"
                      >
                        <Trash className="w-3.5 h-3.5 animate-pulse-once" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
        )}
      </div>

        {/* SECTION 6: CONTROL DE ASIGNACIONES Y GESTIÓN GLOBAL DE COMPUTADORAS */}
        <div id="section-pcs-control" className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm scroll-mt-20">
          <button
            type="button"
            id="heading-toggle-assignments"
            onClick={() => setCollapsedAssignments(!collapsedAssignments)}
            className="w-full flex items-center justify-between border-b border-slate-100 pb-3 text-left focus:outline-none group mb-4"
          >
            <div className="flex items-center gap-2">
              <Laptop className="w-5 h-5 text-vino-claro" />
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-sans">
                  Consola General de Distribución Técnica de Equipos
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-sans">
                  Buscador general de computadoras escolares. Analice estados de diagnóstico, fallas recurrentes y quién está trabajando activamente en cada equipo.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 hover:border-slate-350 px-2.5 py-1 rounded-md shadow-xs group-hover:bg-slate-100 transition-all cursor-pointer shrink-0">
              <span className="text-[10px] text-slate-500 font-semibold">{collapsedAssignments ? "Desplegar" : "Colapsar"}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${!collapsedAssignments ? "rotate-180 text-vino-claro" : ""}`} />
            </div>
          </button>

          {!collapsedAssignments && (
            <div className="animate-fade-in space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
                <span className="text-xs font-semibold text-slate-700">Equipos de Cómputo y Estado de Servicio</span>
              </div>

            {/* FILTERS COLUMN GRID */}
            <div className="flex flex-wrap gap-2 items-center">
              {/* Salón Select */}
              <select
                id="select-pcs-room-filter"
                value={roomFilter}
                onChange={(e) => setRoomFilter(e.target.value)}
                className="text-xs px-2.5 py-1.5 border border-slate-300 bg-white rounded-md focus:outline-none"
              >
                <option value="all">Filtro: Todos los Salones</option>
                {rooms.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>

              {/* State select */}
              <select
                id="select-pcs-state-filter"
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className="text-xs px-2.5 py-1.5 border border-slate-300 bg-white rounded-md focus:outline-none"
              >
                <option value="all">Filtro: Cualquier Estado</option>
                <option value="Operativo">Operativo / Sin Falla</option>
                <option value="En mantenimiento">En Mantenimiento</option>
                <option value="Reparado">Reparado con Éxito</option>
                <option value="Irreparable">Baja / Irreparable</option>
              </select>

              {/* Specific tag text search */}
              <div className="relative">
                <input
                  id="input-search-pcs-global"
                  type="text"
                  placeholder="ID de equipo..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="text-xs pl-8 pr-3 py-1.5 border border-slate-300 rounded-md focus:outline-none"
                />
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
              </div>
            </div>

          {/* PC visual grid in admin console */}
          {filteredPcs.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">No hay computadoras que satisfagan estos filtros.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredPcs.map((pc) => {
                const pcRoom = rooms.find(r => r.id === pc.roomId);
                const assignedStudent = alumnos.find(a => a.id === pc.assignedAlumnoId);

                // State colors (more vibrant!)
                let pcBadgeClass = "bg-slate-200 text-slate-800";
                if (pc.state === "Operativo") pcBadgeClass = "bg-blue-600 text-white font-bold shadow-sm";
                else if (pc.state === "En mantenimiento") pcBadgeClass = "bg-amber-400 text-slate-900 font-bold border border-amber-300 shadow-sm";
                else if (pc.state === "Reparado") pcBadgeClass = "bg-emerald-500 text-white font-bold shadow-sm";
                else if (pc.state === "Irreparable") pcBadgeClass = "bg-rose-600 text-white font-bold shadow-sm";

                return (
                  <div key={pc.id} className="p-3.5 rounded-lg border border-slate-200/90 bg-white/70 backdrop-blur-md flex flex-col justify-between hover:border-vino-claro hover:shadow-md transition duration-150 shadow-sm">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-mono font-bold text-slate-800 text-xs flex items-center gap-1.5">
                          {pc.tag}
                          <button
                            id={`btn-delete-pc-${pc.id}`}
                            title="Eliminar computadora"
                            onClick={() => handleDeletePC(pc.id)}
                            className="p-0.5 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition"
                          >
                            <Trash className="w-3 h-3" />
                          </button>
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${pcBadgeClass}`}>
                          {pc.state}
                        </span>
                      </div>

                      <div className="space-y-1 mb-2">
                        <span className="text-[10px] text-gray-500 block line-clamp-1">{pcRoom ? pcRoom.name : "Salón N/A"}</span>
                        <span className="text-[9px] font-mono text-gray-400 block">Ult. Act: {pc.lastUpdate}</span>
                      </div>
                    </div>

                    {/* REASSIGNATION SELECTOR PANEL */}
                    <div className="mt-2 pt-2 border-t border-slate-100">
                      <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Encargado Directo:</label>
                      <select
                        id={`select-reassign-pc-${pc.id}`}
                        value={pc.assignedAlumnoId || ""}
                        onChange={(e) => handleReassignPC(pc.id, e.target.value)}
                        className="w-full text-[11px] p-1 border border-slate-250 bg-slate-50 rounded hover:bg-white focus:outline-none"
                      >
                        <option value="">-- Sin asignar --</option>
                        {alumnos.map(a => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Timeline logs modal quick trigger */}
                    <button
                      id={`btn-clinical-log-trigger-${pc.id}`}
                      onClick={() => setHistoryPc({ id: pc.id, tag: pc.tag, roomName: pcRoom ? pcRoom.name : "Salón" })}
                      className="mt-2.5 w-full py-1 text-[10px] font-medium text-center text-slate-700 bg-slate-100 hover:bg-slate-200 rounded"
                    >
                      Bitácora de Diagnóstico
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        )}
      </div>


        {/* SECTION 7: INVENTARIO DE REFACCIONES CRÍTICAS */}
        <div id="section-inventory" className="scroll-mt-20">
          <InventoryCatalog isAdmin={true} onInventoryChanged={loadDashboardData} />
        </div>

      </main>

      {/* History modal renderer inside admin */}
      {historyPc && (
        <ComputerHistoryModal
          pcId={historyPc.id}
          pcTag={historyPc.tag}
          roomName={historyPc.roomName}
          onClose={() => setHistoryPc(null)}
        />
      )}

      {/* Expanded photo lightbox backdrop modal */}
      {zoomedPhoto && (
        <div 
          id="log-photo-zoom-overlay"
          onClick={() => setZoomedPhoto(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in cursor-zoom-out"
          title="Haga clic en cualquier espacio vacío para cerrar la vista de evidencia"
        >
          <div className="relative max-w-4xl max-h-[85vh] bg-slate-900 p-2 rounded-2xl border border-slate-850 shadow-2xl flex flex-col cursor-default m-auto" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              id="btn-close-zoom-overlay"
              onClick={() => setZoomedPhoto(null)}
              className="absolute -top-3.5 -right-3.5 w-8 h-8 rounded-full bg-slate-800 text-white hover:bg-slate-705 flex items-center justify-center shadow-md transition-all border border-slate-700 font-bold hover:scale-105 active:scale-95"
            >
              ✕
            </button>
            <div className="overflow-hidden rounded-xl bg-black max-h-[75vh] flex items-center justify-center">
              <img
                referrerPolicy="no-referrer"
                src={zoomedPhoto}
                alt="Detalle de Evidencia Cargada"
                className="max-w-full max-h-[75vh] object-contain block mx-auto select-none"
              />
            </div>
            <div className="text-center text-xs text-slate-300 py-2.5 font-semibold font-sans tracking-tight">
              🔍 Evidencia Técnica Cargada por el Alumno
            </div>
          </div>
        </div>
      )}

      {/* Student credentials and detailed support date modal */}
      {infoStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
          <div className="bg-white border border-slate-250 rounded-xl max-w-sm w-full p-5 shadow-2xl relative text-slate-800 animate-slide-up">
            <button
              onClick={() => setInfoStudent(null)}
              className="absolute top-3.5 right-3.5 p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition duration-150"
            >
              ✕
            </button>

            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-150">
              <div className="w-9 h-9 bg-vino-claro/10 text-vino-claro rounded-lg flex items-center justify-center font-bold text-sm">
                {infoStudent.name.charAt(0)}
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Expediente Alumno</h3>
                <p className="text-sm font-extrabold text-slate-950 font-mono mt-0.5">{infoStudent.expediente}</p>
              </div>
            </div>

            <div className="space-y-3 font-sans text-xs">
              <div className="space-y-1">
                <span className="text-slate-500 font-medium">Nombre Completo:</span>
                <span className="block font-bold text-slate-900 bg-slate-50 px-2 py-1.5 rounded border border-slate-100">
                  {infoStudent.name}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <span className="text-slate-500 font-medium">Carrera Académica:</span>
                  <span className="block font-semibold text-slate-800 mt-1">{infoStudent.career}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Semestre:</span>
                  <span className="block font-semibold text-slate-800 mt-1">{infoStudent.semester}° Semestre</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5 pt-1.5 border-t border-slate-50">
                <div>
                  <span className="text-slate-500 font-medium">Inicio de Soporte:</span>
                  <span className="block font-mono font-bold text-emerald-600 bg-emerald-50 text-center py-1 rounded border border-emerald-100 mt-1 col-span-1">
                    {infoStudent.startDate || "No registrado"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Fin de Soporte:</span>
                  <span className="block font-mono font-bold text-rose-600 bg-rose-50 text-center py-1 rounded border border-rose-100 mt-1 col-span-1">
                    {infoStudent.endDate || "No registrado"}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <div className="flex justify-between items-center bg-blue-50/50 p-2.5 rounded-lg border border-blue-100 mt-1">
                  <div>
                    <span className="text-[10px] text-blue-800 font-bold block uppercase tracking-wider">Computadoras Reparadas</span>
                    <span className="text-xs text-slate-600">Total en este período</span>
                  </div>
                  <span className="text-lg font-black text-blue-900 font-mono bg-white w-8 h-8 rounded-full border border-blue-150 flex items-center justify-center shadow-xs">
                    {infoStudentRepairs}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 mt-5">
              <button
                onClick={() => setInfoStudent(null)}
                className="px-4 py-1.5 bg-vino-claro hover:bg-vino-claro-hover text-white rounded-md text-xs font-bold leading-snug transition duration-150 active:scale-95 shadow-sm"
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
          <span>Panel de Administración Central de Mantenimiento Preventivo</span>
        </div>
      </footer>

    </div>
  );
}
