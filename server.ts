import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const app = express();
const PORT = 3000;

// Enable JSON bodies with higher size limit for base64 images
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Prevent caching for all API responses to ensure real-time data persistence in Serverless deployments
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  res.set("Surrogate-Control", "no-store");
  next();
});

const DB_FILE = process.env.VERCEL 
  ? "/tmp/db.json" 
  : path.join(process.cwd(), "db.json");

// PostgreSQL Setup for Neon
const PostgreSQLPool = pg.Pool;
const DB_URL = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_kVTNW5Ge3hCH@ep-broad-bar-atk7zcar-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require";

const pool = new PostgreSQLPool({
  connectionString: DB_URL,
  max: 3,                 // Reducido para evitar el agotamiento de conexiones en entornos Serverless
  idleTimeoutMillis: 1000, // Liberar conexiones inactivas de inmediato para evitar bloqueos por expiración de sockets
  connectionTimeoutMillis: 5000,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.on("error", (err) => {
  console.error("⚠️ Error imprevisto en cliente inactivo de Neon:", err);
});

let cachedDb: any = null;
let clientInitialized = false;

// Middleware to block requests until database is pre-loaded from cloud
app.use(async (req, res, next) => {
  // Pass health check instantly to avoid startup failure
  if (req.path === "/api/health") {
    return next();
  }
  if (!clientInitialized) {
    try {
      await initPostgres();
    } catch (err) {
      console.error("Delayed postgres init failed, fallback is on", err);
    }
  }
  next();
});

// Lazy Gemini API Client
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    console.warn("⚠️ GEMINI_API_KEY not correctly set. Fallback diagnosis will be used.");
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// Initial/Seed Database
const DEFAULT_DB = {
  rooms: [
    { id: "room-1", name: "Laboratorio de Sistemas (L-101)", pcsCount: 8 },
    { id: "room-2", name: "Laboratorio de Multimedia (L-102)", pcsCount: 6 },
    { id: "room-3", name: "Laboratorio de Telecomunicaciones (L-201)", pcsCount: 5 }
  ],
  pcs: [
    // Room 1 PCs
    { id: "pc-1-1", tag: "PC-01", roomId: "room-1", state: "Reparado", assignedAlumnoId: "student-1", lastUpdate: "2026-06-15" },
    { id: "pc-1-2", tag: "PC-02", roomId: "room-1", state: "En mantenimiento", assignedAlumnoId: "student-1", lastUpdate: "2026-06-20" },
    { id: "pc-1-3", tag: "PC-03", roomId: "room-1", state: "Operativo", assignedAlumnoId: null, lastUpdate: "2026-06-10" },
    { id: "pc-1-4", tag: "PC-04", roomId: "room-1", state: "Irreparable", assignedAlumnoId: "student-2", lastUpdate: "2026-06-18" },
    { id: "pc-1-5", tag: "PC-05", roomId: "room-1", state: "Operativo", assignedAlumnoId: null, lastUpdate: "2026-06-21" },
    { id: "pc-1-6", tag: "PC-06", roomId: "room-1", state: "Operativo", assignedAlumnoId: null, lastUpdate: "2026-06-21" },
    { id: "pc-1-7", tag: "PC-07", roomId: "room-1", state: "Operativo", assignedAlumnoId: null, lastUpdate: "2026-06-21" },
    { id: "pc-1-8", tag: "PC-08", roomId: "room-1", state: "Operativo", assignedAlumnoId: null, lastUpdate: "2026-06-21" },
    // Room 2 PCs
    { id: "pc-2-1", tag: "PC-01", roomId: "room-2", state: "Operativo", assignedAlumnoId: null, lastUpdate: "2026-06-10" },
    { id: "pc-2-2", tag: "PC-02", roomId: "room-2", state: "En mantenimiento", assignedAlumnoId: null, lastUpdate: "2026-06-19" },
    { id: "pc-2-3", tag: "PC-03", roomId: "room-2", state: "Operativo", assignedAlumnoId: null, lastUpdate: "2026-06-10" },
    { id: "pc-2-4", tag: "PC-04", roomId: "room-2", state: "Operativo", assignedAlumnoId: null, lastUpdate: "2026-06-10" },
    { id: "pc-2-5", tag: "PC-05", roomId: "room-2", state: "Operativo", assignedAlumnoId: null, lastUpdate: "2026-06-10" },
    { id: "pc-2-6", tag: "PC-06", roomId: "room-2", state: "Operativo", assignedAlumnoId: null, lastUpdate: "2026-06-10" },
    // Room 3 PCs
    { id: "pc-3-1", tag: "PC-01", roomId: "room-3", state: "Operativo", assignedAlumnoId: null, lastUpdate: "2026-06-12" },
    { id: "pc-3-2", tag: "PC-02", roomId: "room-3", state: "Operativo", assignedAlumnoId: null, lastUpdate: "2026-06-12" },
    { id: "pc-3-3", tag: "PC-03", roomId: "room-3", state: "Operativo", assignedAlumnoId: null, lastUpdate: "2026-06-12" },
    { id: "pc-3-4", tag: "PC-04", roomId: "room-3", state: "Operativo", assignedAlumnoId: null, lastUpdate: "2026-06-12" },
    { id: "pc-3-5", tag: "PC-05", roomId: "room-3", state: "Operativo", assignedAlumnoId: null, lastUpdate: "2026-06-12" }
  ],
  groups: [
    { id: "group-1", folio: "FOL-M4091", name: "Servicio Social Matutino A", salonId: "room-1" }
  ],
  alumnos: [
    {
      id: "student-1",
      name: "Juan Antonio Pérez Montaño",
      career: "Ingeniería en Sistemas Computacionales",
      semester: 7,
      expediente: "22040123",
      password: "alumno123",
      groupId: "group-1"
    },
    {
      id: "student-2",
      name: "María Fernanda López Galindo",
      career: "Ingeniería en Sistemas Computacionales",
      semester: 8,
      expediente: "22040456",
      password: "alumno456",
      groupId: "group-1"
    }
  ],
  logs: [
    {
      id: "log-1",
      pcId: "pc-1-1",
      pcTag: "PC-01",
      roomName: "Laboratorio de Sistemas (L-101)",
      changeDate: "2026-06-15",
      type: "Reparado" as const,
      studentId: "student-1",
      studentName: "Juan Antonio Pérez Montaño",
      failureDesc: "La computadora no pasaba del logotipo de BIOS y daba un pitido corto continuo.",
      solutionDesc: "Se realizó una limpieza interna del polvo acumulado, se extrajeron los módulos de memoria RAM y se limpiaron sus contactos con borrador suave de migajón. El pitido desapareció y el sistema inició de forma normal.",
      photoBefore: null,
      photoAfter: null,
      partsUsed: []
    },
    {
      id: "log-2",
      pcId: "pc-1-4",
      pcTag: "PC-04",
      roomName: "Laboratorio de Sistemas (L-101)",
      changeDate: "2026-06-18",
      type: "Irreparable" as const,
      studentId: "student-2",
      studentName: "María Fernanda López Galindo",
      failureDesc: "El equipo presenta falla grave. No enciende en absoluto tras caída de tensión eléctrica en la toma interna.",
      techJustification: "Se descartaron módulos de fuente de poder, se probó motherboard aislada y presenta un cortocircuito quemando pistas internas multicapa cerca del puente sur, inviable su reparación a nivel componente por falta de refacciones y herramientas de micro-soldadura.",
      photoBefore: null,
      photoAfter: null
    }
  ],
  inventory: [
    { id: "part-1", name: "Memoria RAM DDR4 8GB", stock: 12, minStock: 3 },
    { id: "part-2", name: "Disco Duro SSD Kingston 480GB", stock: 8, minStock: 3 },
    { id: "part-3", name: "Fuente de Poder 500W Genericia", stock: 2, minStock: 3 }, // Alert trigger < 3!
    { id: "part-4", name: "Cable SATA III", stock: 15, minStock: 3 },
    { id: "part-5", name: "Pasta Térmica Artic MX-4 4g", stock: 5, minStock: 3 }
  ],
  admins: [
    { id: "admin-default", name: "Coordinador de Laboratorios", expediente: "admin", password: "admin" }
  ]
};

// Helper to initialize and load database state from Postgres with high speed and full safety
async function initPostgres() {
  if (clientInitialized) return;
  try {
    // 1. Create table if not exists with a schema storing structured json document
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ueslab_db (
        key VARCHAR(50) PRIMARY KEY,
        data JSONB
      )
    `);

    // 2. Load the data
    const res = await pool.query("SELECT data FROM ueslab_db WHERE key = 'main'");
    if (res.rows.length > 0) {
      cachedDb = res.rows[0].data;
      console.log("💚 Successfully loaded and synchronized database state from Neon PostgreSQL.");
    } else {
      // Seed the cloud database
      let initialData = DEFAULT_DB;
      const localDbPath = path.join(process.cwd(), "db.json");
      if (fs.existsSync(localDbPath)) {
        try {
          initialData = JSON.parse(fs.readFileSync(localDbPath, "utf8"));
        } catch (e) {
          console.error("Failed to parse local db.json for seed", e);
        }
      }
      
      // Auto-populate default admin if missing
      if (!initialData.admins) {
        initialData.admins = [
          { id: "admin-default", name: "Coordinador de Laboratorios", expediente: "admin", password: "admin" }
        ];
      }

      await pool.query("INSERT INTO ueslab_db (key, data) VALUES ('main', $1) ON CONFLICT (key) DO NOTHING", [JSON.stringify(initialData)]);
      cachedDb = initialData;
      console.log("🌱 Seeded initial database state to Neon PostgreSQL.");
    }
    clientInitialized = true;
  } catch (err) {
    console.error("⚠️ Failed to load database from Postgres. Falling back to local flat-file.", err);
    // Let readDb() handle local loading if database connection fails
  }
}

// Quick helper for reading database from cloud dynamically
async function readDb() {
  if (clientInitialized) {
    try {
      const res = await pool.query("SELECT data FROM ueslab_db WHERE key = 'main'");
      if (res.rows.length > 0) {
        cachedDb = res.rows[0].data;
        return cachedDb;
      }
    } catch (err) {
      console.error("⚠️ Error reading from Neon PostgreSQL in readDb:", err);
    }
  }

  if (cachedDb) {
    return cachedDb;
  }

  // Fallback local filesystem access (for offline development or fallback mode)
  try {
    if (!fs.existsSync(DB_FILE)) {
      let initialData = DEFAULT_DB;
      const localDbFile = path.join(process.cwd(), "db.json");
      if (fs.existsSync(localDbFile)) {
        try {
          initialData = JSON.parse(fs.readFileSync(localDbFile, "utf8"));
        } catch (e) {
          console.error("Failed to parse local db.json", e);
        }
      }
      if (!initialData.admins) {
        initialData.admins = [
          { id: "admin-default", name: "Coordinador de Laboratorios", expediente: "admin", password: "admin" }
        ];
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), "utf8");
      cachedDb = initialData;
      return initialData;
    }
    const data = fs.readFileSync(DB_FILE, "utf8");
    const db = JSON.parse(data);
    if (!db.admins) {
      db.admins = [
        { id: "admin-default", name: "Coordinador de Laboratorios", expediente: "admin", password: "admin" }
      ];
      fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf8");
    }
    cachedDb = db;
    return db;
  } catch (err) {
    console.error("Error reading database file fallback", err);
    return DEFAULT_DB;
  }
}

async function writeDb(data: typeof DEFAULT_DB) {
  cachedDb = data;
  
  // 1. Write to local file as backup
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.error("Error writing fallback local database file", err);
  }

  // 2. Synchronize to Neon PostgreSQL database and await completion (critical for Serverless)
  try {
    await pool.query("INSERT INTO ueslab_db (key, data) VALUES ('main', $1) ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data", [JSON.stringify(data)]);
    console.log("💾 Database successfully saved & synchronized to PostgreSQL.");
  } catch (err) {
    console.error("⚠️ Failed to synchronize database state to PostgreSQL.", err);
  }
}

// Initialize Postgres trigger immediately on load
initPostgres().catch(err => console.error("Immediate Postgres connect failed:", err));

/* 
=============================================
  API Endpoints
=============================================
*/

// Auth Endpoint
app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: "Expediente / Usuario y Contraseña obligatorios" });
  }

  // Check Admin
  const db = await readDb();
  
  // Custom admins list check
  const customAdmin = db.admins?.find(
    (adm) => String(adm.expediente).toLowerCase() === username.toLowerCase() && adm.password === password
  );

  if (customAdmin) {
    return res.json({
      role: "admin",
      user: {
        id: customAdmin.id,
        name: customAdmin.name,
        expediente: customAdmin.expediente
      }
    });
  }

  if (username.toLowerCase() === "admin" && password === "admin") {
    return res.json({
      role: "admin",
      user: {
        id: "admin",
        name: "Coordinador de Laboratorios",
        expediente: "admin"
      }
    });
  }

  // Check Alumno
  const student = db.alumnos.find(
    (a) => a.expediente === username && a.password === password
  );

  if (student) {
    const group = db.groups.find((g) => g.id === student.groupId);
    const room = group ? db.rooms.find((r) => r.id === group.salonId) : null;

    return res.json({
      role: "alumno",
      user: student,
      group: group || null,
      room: room || null
    });
  }

  return res.status(401).json({ error: "Credenciales de acceso incorrectas. Verifique expediente y contraseña." });
});

// Neon Postgres State / Status indicator API
app.get("/api/db-status", async (req, res) => {
  try {
    const start = Date.now();
    await pool.query("SELECT 1");
    const latency = Date.now() - start;
    res.json({
      status: "connected",
      engine: "Neon PostgreSQL (AWS East 1)",
      host: "ep-broad-bar-atk7zcar-pooler.c-9.us-east-1.aws.neon.tech",
      database: "neondb",
      latency: `${latency}ms`,
      initialized: clientInitialized,
      cached: !!cachedDb,
      error: null
    });
  } catch (err: any) {
    res.json({
      status: "disconnected",
      engine: "Local Fallback State (db.json)",
      host: "ep-broad-bar-atk7zcar-pooler.c-9.us-east-1.aws.neon.tech",
      database: "neondb",
      latency: null,
      initialized: clientInitialized,
      cached: !!cachedDb,
      error: err.message || "No se pudo conectar al servidor de base de datos Neon."
    });
  }
});

// Retrieve completed repairs count for a specific student easily
app.get("/api/alumnos/:id/repairs-count", async (req, res) => {
  const { id } = req.params;
  const db = await readDb();
  const studentLogs = (db.logs || []).filter((l: any) => l.studentId === id && l.type === "Reparado");
  res.json({ count: studentLogs.length });
});

// Rooms Endpoints
app.get("/api/rooms", async (req, res) => {
  const db = await readDb();
  res.json(db.rooms);
});

app.post("/api/rooms", async (req, res) => {
  const { name, pcsCount } = req.body;
  if (!name || isNaN(pcsCount)) {
    return res.status(400).json({ error: "Nombre y cantidad de computadoras inválidas." });
  }

  const db = await readDb();
  const newRoomId = `room-${Date.now()}`;
  const newRoom = { id: newRoomId, name, pcsCount: Number(pcsCount) };
  
  db.rooms.push(newRoom);

  // Auto-generate PCs
  for (let i = 1; i <= Number(pcsCount); i++) {
    const pcNum = i < 10 ? `0${i}` : `${i}`;
    db.pcs.push({
      id: `${newRoomId}-pc-${i}`,
      tag: `PC-${pcNum}`,
      roomId: newRoomId,
      state: "Operativo",
      assignedAlumnoId: null,
      lastUpdate: new Date().toISOString().split("T")[0]
    });
  }

  await writeDb(db);
  res.status(201).json({ room: newRoom, pcsCount });
});

// PCs Endpoints
app.get("/api/pcs", async (req, res) => {
  const db = await readDb();
  res.json(db.pcs);
});

// Assign a Specific PC to a specific student
app.put("/api/pcs/:id/assign", async (req, res) => {
  const { id } = req.params;
  const { assignedAlumnoId } = req.body; // Can be string or null

  const db = await readDb();
  const pc = db.pcs.find((p) => p.id === id);
  if (!pc) {
    return res.status(404).json({ error: "Computadora no encontrada" });
  }

  pc.assignedAlumnoId = assignedAlumnoId || null;
  pc.lastUpdate = new Date().toISOString().split("T")[0];

  await writeDb(db);
  res.json(pc);
});

// Get Clinical history logs of a certain PC
app.get("/api/pcs/:id/history", async (req, res) => {
  const { id } = req.params;
  const db = await readDb();
  const pcLogs = db.logs.filter((l) => l.pcId === id);
  res.json(pcLogs);
});

// Groups Endpoints (CRITICAL MODULE: register students & credentials)
app.get("/api/groups", async (req, res) => {
  const db = await readDb();
  res.json(db.groups);
});

app.post("/api/groups", async (req, res) => {
  const { name, salonId, alumnos, alumnoIds } = req.body;
  
  if (!name || !salonId) {
    return res.status(400).json({ error: "Debe rellenar el nombre del grupo y asignar un salón." });
  }

  const db = await readDb();
  const groupId = `group-${Date.now()}`;
  const folio = `FOL-SS${Math.floor(1000 + Math.random() * 9000)}`;

  // Create Group
  const newGroup = {
    id: groupId,
    folio: folio,
    name: name,
    salonId: salonId
  };

  db.groups.push(newGroup);

  let targetAlumnos: any[] = [];

  if (Array.isArray(alumnoIds) && alumnoIds.length > 0) {
    // Form group with existing students
    db.alumnos.forEach((student: any) => {
      if (alumnoIds.includes(student.id)) {
        student.groupId = groupId;
        targetAlumnos.push(student);
      }
    });
  } else if (Array.isArray(alumnos) && alumnos.length > 0) {
    // Fallback registry for on-the-fly created students
    const registeredAlumnos = alumnos.map((studentInput: any, index: number) => {
      const studentId = `student-${Date.now()}-${index}`;
      return {
        id: studentId,
        name: studentInput.name,
        career: studentInput.career,
        semester: parseInt(studentInput.semester, 10) || 1,
        expediente: studentInput.expediente, // Assigned manually by admin
        password: studentInput.password, // Assigned manually by admin
        groupId: groupId
      };
    });
    db.alumnos.push(...registeredAlumnos);
    targetAlumnos = registeredAlumnos;
  } else {
    return res.status(400).json({ error: "Debe seleccionar alumnos existentes para formar el equipo de servicio social." });
  }

  // Automatically assign PCs in that room to these students evenly
  const roomPcs = db.pcs.filter(p => p.roomId === salonId);
  roomPcs.forEach((pc, idx) => {
    if (targetAlumnos.length > 0) {
      // Round-robin assignment of PCs to registered/associated students
      const assignedStudent = targetAlumnos[idx % targetAlumnos.length];
      pc.assignedAlumnoId = assignedStudent.id;
    }
  });

  await writeDb(db);
  res.status(201).json({ group: newGroup, alumnos: targetAlumnos });
});

// Alumnos Endpoints
app.get("/api/alumnos", async (req, res) => {
  const db = await readDb();
  res.json(db.alumnos);
});

// Register individual student
app.post("/api/alumnos", async (req, res) => {
  const { name, career, semester, expediente, password, groupId, startDate, endDate } = req.body;
  if (!name || !expediente || !password) {
    return res.status(400).json({ error: "Nombre, expediente y contraseña son obligatorios de registrar." });
  }

  const db = await readDb();
  const exists = db.alumnos.some(a => String(a.expediente).trim().toLowerCase() === String(expediente).trim().toLowerCase());
  if (exists) {
    return res.status(400).json({ error: `El expediente "${expediente}" ya se encuentra registrado.` });
  }

  const studentId = `student-${Date.now()}`;
  const newStudent = {
    id: studentId,
    name,
    career: career || "Ingeniería en Sistemas",
    semester: parseInt(semester, 10) || 1,
    expediente: expediente,
    password: password,
    groupId: groupId || null,
    startDate: startDate || null,
    endDate: endDate || null
  };

  db.alumnos.push(newStudent);
  await writeDb(db);
  res.status(201).json(newStudent);
});

// Reset or change student credentials
app.put("/api/alumnos/:id", async (req, res) => {
  const { id } = req.params;
  const { name, career, semester, expediente, password, startDate, endDate } = req.body;

  const db = await readDb();
  const student = db.alumnos.find((a) => a.id === id);
  if (!student) {
    return res.status(404).json({ error: "Alumno no encontrado" });
  }

  if (name !== undefined) student.name = name;
  if (career !== undefined) student.career = career;
  if (semester !== undefined) student.semester = Number(semester);
  if (expediente !== undefined) student.expediente = expediente;
  if (password !== undefined) student.password = password;
  if (startDate !== undefined) student.startDate = startDate;
  if (endDate !== undefined) student.endDate = endDate;

  await writeDb(db);
  res.json(student);
});

// Delete student registration
app.delete("/api/alumnos/:id", async (req, res) => {
  const { id } = req.params;
  const db = await readDb();
  db.alumnos = db.alumnos.filter((a) => a.id !== id);
  
  // Clean PC assignments of this student
  db.pcs.forEach((pc) => {
    if (pc.assignedAlumnoId === id) {
      pc.assignedAlumnoId = null;
    }
  });

  await writeDb(db);
  res.json({ success: true });
});

// Maintenance workflows (En mantenimiento, Reparado, Irreparable)
app.post("/api/maintenance/submit", async (req, res) => {
  const {
    pcId,
    state,
    studentId,
    studentName,
    failureDesc,
    solutionDesc,
    techJustification,
    photoBefore,
    photoAfter,
    partsUsed
  } = req.body;

  if (!pcId || !state || !studentId) {
    return res.status(400).json({ error: "Faltan datos obligatorios para registrar el reporte de mantenimiento." });
  }

  const db = await readDb();
  const pc = db.pcs.find((p) => p.id === pcId);
  if (!pc) {
    return res.status(404).json({ error: "Computadora no encontrada" });
  }

  const room = db.rooms.find((r) => r.id === pc.roomId);
  const roomName = room ? room.name : "Salón Desconocido";

  // Change PC state
  pc.state = state;
  pc.lastUpdate = new Date().toISOString().split("T")[0];

  // If spare parts used, decrement stock and prevent going below 0
  if (Array.isArray(partsUsed) && partsUsed.length > 0) {
    partsUsed.forEach((partId: string) => {
      const part = db.inventory.find(item => item.id === partId);
      if (part && part.stock > 0) {
        part.stock -= 1;
      }
    });
  }

  // Insert Clinical History record
  const newLog = {
    id: `log-${Date.now()}`,
    pcId: pcId,
    pcTag: pc.tag,
    roomName: roomName,
    changeDate: new Date().toISOString().split("T")[0],
    type: state,
    studentId: studentId,
    studentName: studentName || "Alumno",
    failureDesc: failureDesc || "",
    solutionDesc: solutionDesc,
    techJustification: techJustification,
    photoBefore: photoBefore || null,
    photoAfter: photoAfter || null,
    partsUsed: partsUsed || []
  };

  db.logs.push(newLog);
  await writeDb(db);

  res.json({ success: true, pc, log: newLog });
});

// GET all maintenance logs for history & progress analysis
app.get("/api/logs", async (req, res) => {
  const db = await readDb();
  res.json(db.logs || []);
});

// Spare Parts inventory api
app.get("/api/inventory", async (req, res) => {
  const db = await readDb();
  res.json(db.inventory);
});

app.post("/api/inventory", async (req, res) => {
  const { name, stock, minStock } = req.body;
  if (!name || isNaN(stock)) {
    return res.status(400).json({ error: "Debe proveer nombre y stock válido." });
  }

  const db = await readDb();
  const newPart = {
    id: `part-${Date.now()}`,
    name: name,
    stock: parseInt(stock, 10),
    minStock: parseInt(minStock, 10) || 3
  };

  db.inventory.push(newPart);
  await writeDb(db);
  res.status(201).json(newPart);
});

app.put("/api/inventory/:id", async (req, res) => {
  const { id } = req.params;
  const { stock, minStock, name } = req.body;

  const db = await readDb();
  const part = db.inventory.find((i) => i.id === id);
  if (!part) {
    return res.status(404).json({ error: "Pieza de inventario no encontrada." });
  }

  if (stock !== undefined) part.stock = parseInt(stock, 10);
  if (minStock !== undefined) part.minStock = parseInt(minStock, 10);
  if (name !== undefined) part.name = name;

  await writeDb(db);
  res.json(part);
});

// Delete spare part from inventory
app.delete("/api/inventory/:id", async (req, res) => {
  const { id } = req.params;
  const db = await readDb();
  db.inventory = db.inventory.filter((item) => item.id !== id);
  await writeDb(db);
  res.json({ success: true });
});

// Delete room/laboratory and all its PCs
app.delete("/api/rooms/:id", async (req, res) => {
  const { id } = req.params;
  const db = await readDb();
  db.rooms = db.rooms.filter((r) => r.id !== id);
  db.pcs = db.pcs.filter((pc) => pc.roomId !== id);
  await writeDb(db);
  res.json({ success: true });
});

// Delete digital group / folio and clean assigned alumnos
app.delete("/api/groups/:id", async (req, res) => {
  const { id } = req.params;
  const db = await readDb();
  db.groups = db.groups.filter((g) => g.id !== id);
  db.alumnos.forEach((alumno) => {
    if (alumno.groupId === id) {
      alumno.groupId = null;
    }
  });
  await writeDb(db);
  res.json({ success: true });
});

// Delete computer entirely
app.delete("/api/pcs/:id", async (req, res) => {
  const { id } = req.params;
  const db = await readDb();
  db.pcs = db.pcs.filter((pc) => pc.id !== id);
  await writeDb(db);
  res.json({ success: true });
});

// Endpoint to Register and obtain admins list (securely sanitizing sensitive credentials)
app.get("/api/auth/admins", async (req, res) => {
  const adminExpediente = String(req.query.adminExpediente || "");
  if (adminExpediente !== "admin") {
    // Secondary admins or other users cannot view our admin list
    return res.json([]);
  }

  const db = await readDb();
  const rawList = db.admins || [];
  const sanitizedList = rawList.map((adm: any) => ({
    id: adm.id,
    name: adm.name,
    // Hide default coordinator (main admin) username to avoid security leak
    expediente: adm.id === "admin-default" ? "Coordinación Principal" : adm.expediente
    // Completely omit password field!
  }));
  res.json(sanitizedList);
});

app.delete("/api/auth/admins/:id", async (req, res) => {
  const adminExpediente = String(req.query.adminExpediente || "");
  if (adminExpediente !== "admin") {
    return res.status(403).json({ error: "No autorizado. Solo el administrador principal puede eliminar administradores." });
  }

  const { id } = req.params;
  if (id === "admin-default") {
    return res.status(400).json({ error: "No se puede eliminar el administrador principal por motivos de seguridad escolar." });
  }

  const db = await readDb();
  if (!db.admins) db.admins = [];
  const idx = db.admins.findIndex(adm => adm.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: "Administrador no encontrado." });
  }

  db.admins.splice(idx, 1);
  await writeDb(db);
  res.json({ success: true });
});

app.post("/api/auth/register-admin", async (req, res) => {
  const adminExpediente = String(req.query.adminExpediente || "");
  if (adminExpediente !== "admin") {
    return res.status(403).json({ error: "No autorizado. Solo el administrador principal puede registrar nuevos administradores." });
  }

  const { name, expediente, password } = req.body;
  if (!name || !expediente || !password) {
    return res.status(400).json({ error: "Nombre, expediente y contraseña son obligatorios de registrar para un Administrador." });
  }

  const db = await readDb();
  if (!db.admins) {
    db.admins = [];
  }

  const exists = db.admins.some(adm => String(adm.expediente).trim().toLowerCase() === String(expediente).trim().toLowerCase());
  if (exists) {
    return res.status(400).json({ error: `El expediente "${expediente}" ya está registrado como administrador.` });
  }

  const newAdmin = {
    id: `admin-${Date.now()}`,
    name,
    expediente,
    password
  };

  db.admins.push(newAdmin);
  await writeDb(db);
  res.status(201).json(newAdmin);
});

// AI Diagnostic integration with Gemini API (gemini-3.5-flash)
app.post("/api/ai/diagnosis", async (req, res) => {
  const { failureDesc } = req.body;
  if (!failureDesc) {
    return res.status(400).json({ error: "Debe escribir la falla del equipo para recibir un diagnóstico." });
  }

  const client = getGeminiClient();
  
  if (!client) {
    // Robust, beautiful local logic suggestions based on terms
    const lower = failureDesc.toLowerCase();
    let suggestions = {
      causes: [
        "Falta de mantenimiento preventivo (polvo en disipador, pasta térmica seca).",
        "Problemas lógicos leves de inicio de sistema tras desenergización repentina."
      ],
      solutions: [
        "Sopletear disipadores y aplicar pasta térmica fresca en procesador (Pasta de alta conductividad).",
        "Asegurar conexiones de discos de almacenamiento SATA/M.2.",
        "Reestablecer valores predeterminados de la CMOS (Quitar batería de botón CR2032 por 2 minutos)."
      ]
    };

    if (lower.includes("pantalla") || lower.includes("video") || lower.includes("monitor") || lower.includes("pitido") || lower.includes("pitar")) {
      suggestions = {
        causes: [
          "Módulos de memoria RAM con sulfatación o polvo acumulado en ranuras DIMM.",
          "Falla o desconexión en cable de alimentación o de interconexión HDMI/VGA del monitor.",
          "Estática residual retenida en la tarjeta madre."
        ],
        solutions: [
          "Limpiar bornes dorados de la RAM con goma de borrar suave de migajón y reinsertas.",
          "Hacer drenado de energía (Desconectar de toma, presionar botón encendido durante 30 segundos).",
          "Probar el monitor y cable por separado con otra computadora funcional."
        ]
      };
    } else if (lower.includes("lenta") || lower.includes("trabada") || lower.includes("congel") || lower.includes("demora") || lower.includes("lento")) {
      suggestions = {
        causes: [
          "Gran saturación de archivos temporales o sobrecarga de procesos ejecutándose en segundo plano.",
          "Estado de salud degradado del disco duro mecánico principal (HDD).",
          "Temperaturas excesivas provocando estrangulamiento térmico (thermal throttling)."
        ],
        solutions: [
          "Hacer actualización tecnológica de disco mecánico HDD por unidad de estado sólido (SSD).",
          "Limpieza de ventiladores internos y cambio de pasta térmica seca.",
          "Realizar mantenimiento lógico del Software (deshabilitar aplicaciones de inicio innecesarias)."
        ]
      };
    } else if (lower.includes("prende") || lower.includes("encend") || lower.includes("corriente") || lower.includes("muer")) {
      suggestions = {
        causes: [
          "Fallo de la Fuente de Alimentación principal (fusible interno quemado, capacitores inflados).",
          "Botón de encendido (Front Panel conector) dañado físicamente o desconectado en motherboard.",
          "Protección de corto de la tarjeta madre activa."
        ],
        solutions: [
          "Usar multímetro o clip puenteador para verificar voltajes de la fuente (Línea de 12V y 5V).",
          "Hacer puente manual directo con un desarmador plano en Pines del POWER_SW para descartar botón.",
          "Probar instalando una Fuente de Poder del catálogo de refacciones para confirmar descarte."
        ]
      };
    }

    return res.json({
      success: true,
      source: "local-intelligent-database",
      diagnosis: suggestions
    });
  }

  try {
    const prompt = `Como experto ingeniero de servicio de soporte de TI, analiza la siguiente descripción de falla reportada de una computadora escolar de laboratorio:
"${failureDesc}"

Por favor, genera un objeto JSON en formato español con el diagnóstico sugerido detallando dos arreglos de strings: "causes" (Causas posibles de la falla, listando máximo 3 causas concretas) y "solutions" (Soluciones sugeridas y procedimientos recomendados, listando máximo 3 soluciones prácticas).

Estructura de respuesta JSON requerida:
{
  "causes": ["...", "..."],
  "solutions": ["...", "..."]
}
Responde únicamente el JSON puro sin bloques de código markdown, para que pueda ser parseado directamente.`;

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    const responseText = response.text || "";
    // Clean up potential markdown formatting
    let cleanJson = responseText.trim();
    if (cleanJson.startsWith("```json")) {
      cleanJson = cleanJson.substring(7);
    }
    if (cleanJson.endsWith("```")) {
      cleanJson = cleanJson.substring(0, cleanJson.length - 3);
    }
    cleanJson = cleanJson.trim();

    try {
      const parsed = JSON.parse(cleanJson);
      return res.json({
        success: true,
        source: "gemini-ai",
        diagnosis: parsed
      });
    } catch (parseErr) {
      console.error("Failed to parse Gemini JSON, falling back.", responseText, parseErr);
      throw new Error("Invalid json format returned from API");
    }

  } catch (err: any) {
    console.error("Gemini API Error:", err);
    return res.status(500).json({
      error: "Error consultando el recomendador IA de Gemini. Detalle: " + err.message
    });
  }
});


/* 
=============================================
  Vite Support & Static Files Serving
=============================================
*/

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 UesLab Server running on port ${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
