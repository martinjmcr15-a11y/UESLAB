export type PCState = 'Operativo' | 'En mantenimiento' | 'Reparado' | 'Irreparable';

export interface Room {
  id: string;
  name: string;
  pcsCount: number;
}

export interface PC {
  id: string; // e.g., "room1-pc1"
  tag: string; // e.g., "PC-01"
  roomId: string;
  state: PCState;
  assignedAlumnoId: string | null; // specific student ID assigned (from the group)
  lastUpdate: string;
}

export interface Group {
  id: string;
  folio: string;
  name: string; // Group Name/Semester
  salonId: string; // specific Room ID assigned
}

export interface Alumno {
  id: string;
  name: string;
  career: string;
  semester: number;
  expediente: string;
  password: string;
  groupId: string | null;
  startDate?: string;
  endDate?: string;
}

export interface MaintenanceLog {
  id: string;
  pcId: string;
  pcTag: string;
  roomName: string;
  changeDate: string;
  type: PCState;
  studentId: string;
  studentName: string;
  failureDesc: string;
  solutionDesc?: string;
  photoBefore?: string | null;
  photoAfter?: string | null;
  partsUsed?: string[];
  techJustification?: string | null;
}

export interface SparePart {
  id: string;
  name: string;
  stock: number;
  minStock: number;
}

export interface AppState {
  rooms: Room[];
  pcs: PC[];
  groups: Group[];
  alumnos: Alumno[];
  logs: MaintenanceLog[];
  inventory: SparePart[];
}
