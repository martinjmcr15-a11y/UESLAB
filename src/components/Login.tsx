import React, { useState } from "react";
import { Laptop, Key, User, ShieldAlert, Sparkles, LogIn } from "lucide-react";

interface LoginProps {
  onLoginSuccess: (role: "admin" | "alumno", data: any) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMessage("Por favor, introduzca su expediente o usuario y contraseña.");
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Credenciales incorrectas.");
      }

      const data = await response.json();
      onLoginSuccess(data.role, data);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Error al conectar con el servidor de autenticación.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Premium Decorative Blur Backdrops */}
      <div className="absolute top-1/4 -left-16 w-80 h-80 bg-vino-claro/15 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 -right-16 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>
      
      <div 
        id="login-card"
        className="w-full max-w-sm bg-white/80 backdrop-blur-md rounded-xl shadow-xl border border-slate-200/80 overflow-hidden relative z-10"
      >
        {/* Top visual accent bar */}
        <div className="h-1.5 bg-vino-claro w-full"></div>

        {/* Brand Banner */}
        <div className="pt-6 pb-4 px-6 text-center bg-slate-50 border-b border-slate-200 flex flex-col items-center">
          <div className="w-10 h-10 bg-vino-claro rounded-lg flex items-center justify-center shadow-md mb-2">
            <Laptop className="w-5 h-5 text-white" />
          </div>
          
          <span className="text-[9px] font-bold text-vino-claro tracking-widest font-mono uppercase">
            Universidad Estatal de Sonora
          </span>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight font-sans mt-0.5">
            UesLab
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-[260px] font-sans">
            Mantenimiento correctivo y preventivo de laboratorios gestionado por alumnos de servicio social.
          </p>
        </div>

        {/* Input Form Area */}
        <div className="p-6">
          {errorMessage && (
            <div 
              id="login-error"
              className="mb-4 p-3 rounded bg-rose-50 border border-rose-100 text-xs text-rose-700 font-medium flex items-start gap-2 animate-pulse"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form id="login-auth-form" onSubmit={handleLogin} className="space-y-4">
            
            {/* Input 1: Username/Expediente */}
            <div>
              <label 
                htmlFor="username-input"
                className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-sans"
              >
                Expediente / Identificación *
              </label>
              <div className="relative">
                <input
                  id="username-input"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ej: 22040123 / admin"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-vino-claro/10 focus:border-vino-claro transition duration-150"
                  required
                />
                <User className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
              </div>
            </div>

            {/* Input 2: Password */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label 
                  htmlFor="password-input"
                  className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-sans"
                >
                  Clave de Acceso *
                </label>
                <span className="text-[9px] text-slate-400 font-mono italic font-medium">Caso sensible</span>
              </div>
              <div className="relative">
                <input
                  id="password-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Contraseña asignada"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-vino-claro/10 focus:border-vino-claro transition duration-150"
                  required
                />
                <Key className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
              </div>
            </div>

            {/* Submit Button */}
            <button
              id="login-submit-button"
              type="submit"
              disabled={loading}
              className="w-full py-2 px-3 bg-vino-claro hover:bg-vino-claro-hover text-white rounded-md text-xs font-semibold transition duration-150 active:scale-[0.98] shadow flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  Verificando...
                </>
              ) : (
                <>
                  <LogIn className="w-3.5 h-3.5" />
                  Iniciar Sesión
                </>
              )}
            </button>

          </form>

          {/* Quick Admin instructions note */}
          <div className="mt-6 pt-4 border-t border-slate-100 flex items-start gap-2 text-[10px] text-slate-400 leading-relaxed font-sans">
            <span className="text-yellow-600 text-xs shrink-0">💡</span>
            <p>
              <strong>Acceso de Prueba Coordinador:</strong> Use <code className="bg-slate-100 text-slate-800 font-mono px-1 rounded font-bold">admin</code> tanto de ID como contraseña.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
