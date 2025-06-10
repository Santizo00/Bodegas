import { Link, useNavigate } from "react-router-dom";
import { Menu, Home, RefreshCw, User, LogOut, Printer  , FileClock, MapPinHouse } from "lucide-react";
import { useState } from "react";

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(true);
  const navigate = useNavigate();

  const storedUser = localStorage.getItem("user");
  const user = storedUser ? JSON.parse(storedUser) : null;
  
  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    navigate("/login");
    window.location.reload();
  };

  return (
    <aside
      className={`${
        isOpen ? "w-64" : "w-15"
      } bg-gradient-to-b from-blue-800 to-blue-700 text-white min-h-screen flex flex-col transition-all duration-300 shadow-xl`}
    >
      {/* Header del Sidebar */}
      <div className="flex items-center justify-between p-4 border-b border-white-600/30">
        <span className={`${isOpen ? "block" : "hidden"} text-xl font-semibold`}>
          BODEGAS
        </span>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 hover:bg-blue-600/20 rounded-full transition-colors duration-200 bg-black"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Opciones del Sidebar */}
      <nav className="flex-1">
        <Link
          to="/"
          className={`flex items-center ${isOpen ? 'space-x-3' : 'justify-center'} p-4 hover:bg-blue-600/20 transition-all duration-200`}
        >
          <Home className="w-6 h-6 text-white" />
          {isOpen && (
            <span className="text-sm font-medium text-white">
              Menu
            </span>
          )}
        </Link>

        <Link
          to="/sincronizar-pedidos"
          className={`flex items-center ${isOpen ? 'space-x-3' : 'justify-center'} p-4 hover:bg-blue-600/20 transition-all duration-200`}
        >
          <RefreshCw className="w-6 h-6 text-white" />
          {isOpen && (
            <span className="text-sm font-medium text-white">
              Pedidos
            </span>
          )}
        </Link>
        
        <Link
          to="/ver-pedidos"
          className={`flex items-center ${isOpen ? 'space-x-3' : 'justify-center'} p-4 hover:bg-blue-600/20 transition-all duration-200`}
        >
          <Printer  className="w-6 h-6 text-white" />
          {isOpen && (
            <span className="text-sm font-medium text-white">
              Impimir Pedidos
            </span>
          )}
        </Link>
        
        <Link
          to="/ubicaciones"
          className={`flex items-center ${isOpen ? 'space-x-3' : 'justify-center'} p-4 hover:bg-blue-600/20 transition-all duration-200`}
        >
          <MapPinHouse  className="w-6 h-6 text-white" />
          {isOpen && (
            <span className="text-sm font-medium text-white">
              Ubicaciones
            </span>
          )}
        </Link>

        <Link
          to="/historial-cambios"
          className={`flex items-center ${isOpen ? 'space-x-3' : 'justify-center'} p-4 hover:bg-blue-600/20 transition-all duration-200`}
        >
          <FileClock className="w-6 h-6 text-white" />
          {isOpen && (
            <span className="text-sm font-medium text-white">
              Historial Cambios
            </span>
          )}
        </Link>
      </nav>

      {/* Sección del Usuario y Logout */}
      <div className="p-4 border-t border-white-600/30">
        <div className="flex items-center justify-between space-x-2">
          {isOpen && (
            <div className="flex items-center space-x-2 min-w-0">
              <User className="w-6 h-6 text-white flex-shrink-0" />
              <span className="text-sm font-medium text-white break-words line-clamp-2">
                {user.NombreCompleto || "Usuario"}
              </span>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center p-2 hover:bg-blue-600/20 rounded-lg transition-all duration-200 flex-shrink-0 bg-black"
          >
            <LogOut className="w-6 h-6 text-white" />
          </button>
        </div>
      </div>
    </aside>
  );
}