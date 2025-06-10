import React, { useState, useRef } from "react";
import { User, Lock, CircleUserRound, LogIn, Eye, EyeOff } from "lucide-react";
import BackgroundGradient from "../components/BackgroundGradient";
import { showWarning } from "../services/alertService";
import { useNavigate } from "react-router-dom";

const LoginPage: React.FC = () => {
  const [credentials, setCredentials] = useState({
    username: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);

  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const API_URL = import.meta.env.VITE_URL_BACKEND;
  
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
  
    if (!credentials.username && !credentials.password) {
      showWarning(
        "Campos vacíos",
        "Por favor, ingrese su usuario y contraseña para continuar."
      );
      usernameRef.current?.focus();
      return;
    }
  
    try {
      const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(credentials),
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        showWarning("Error de autenticación", errorData.message);
        return;
      }
  
      const data = await response.json();
      if (data.success) {
        localStorage.setItem("user", JSON.stringify(data.user));
        navigate("/");
      }
    } catch (error) {
      console.error("Error inesperado:", error);
      showWarning(
        "Error de conexión",
        "Hubo un problema al conectar con el servidor. Inténtalo más tarde."
      );
    }
  };

  return (
    <BackgroundGradient>
      <div className="w-[400px] p-6">
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-8 space-y-8">
          <div className="w-full flex justify-center">
            <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center">
              <CircleUserRound className="h-16 w-16 text-white" />
            </div>
          </div>

          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-800 mb-2">
              Iniciar Sesión
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-gray-500" />
              </div>
              <input
                ref={usernameRef}
                type="text"
                className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-none bg-white text-black placeholder-gray-500"
                placeholder="Usuario"
                value={credentials.username}
                onChange={(e) =>
                  setCredentials({ ...credentials, username: e.target.value })
                }
              />
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-500" />
              </div>
              <input
                ref={passwordRef}
                type={showPassword ? "text" : "password"}
                className="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-none bg-white text-black placeholder-gray-500"
                placeholder="Contraseña"
                value={credentials.password}
                onChange={(e) =>
                  setCredentials({ ...credentials, password: e.target.value })
                }
              />
              {credentials.password && (
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center bg-transparent border-none outline-none focus:outline-none focus:ring-0 focus:border-none hover:bg-transparent active:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ WebkitTapHighlightColor: "transparent" }}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-500" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-500" />
                  )}
                </button>
              )}
            </div>

            <div className="flex justify-center">
              <button
                type="submit"
                className="flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition duration-200 cursor-pointer"
              >
                <span>Ingresar</span>
                <LogIn className="h-5 w-5" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </BackgroundGradient>
  );
};

export default LoginPage;