import React, { useState, useEffect } from "react";
import Login from "./components/Login";
import AdminDashboard from "./components/AdminDashboard";
import StudentWorkspace from "./components/StudentWorkspace";

export default function App() {
  const [session, setSession] = useState<{
    role: "admin" | "alumno";
    user: any;
    group: any | null;
    room: any | null;
  } | null>(null);
  
  const [loading, setLoading] = useState(true);

  // Restore session from localStorage on mount
  useEffect(() => {
    const cached = localStorage.getItem("ueslab-session");
    if (cached) {
      try {
        setSession(JSON.parse(cached));
      } catch (err) {
        console.error("Failed to restore session cache.", err);
      }
    }
    setLoading(false);
  }, []);

  const handleLoginSuccess = (role: "admin" | "alumno", data: any) => {
    const newSession = {
      role,
      user: data.user,
      group: data.group || null,
      room: data.room || null
    };
    setSession(newSession);
    localStorage.setItem("ueslab-session", JSON.stringify(newSession));
  };

  const handleLogout = () => {
    setSession(null);
    localStorage.removeItem("ueslab-session");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center font-sans">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-900 border-t-white mb-3"></div>
        <p className="text-xs text-gray-500 font-mono">Restaurando sesión UesLab...</p>
      </div>
    );
  }

  // Session routing
  if (!session) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  if (session.role === "admin") {
    return <AdminDashboard adminUser={session.user} onLogout={handleLogout} />;
  }

  return (
    <StudentWorkspace
      alumno={session.user}
      group={session.group}
      room={session.room}
      onLogout={handleLogout}
    />
  );
}

