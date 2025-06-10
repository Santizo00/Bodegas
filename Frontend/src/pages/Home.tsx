import { useState, useEffect } from "react";
import { OrdersCalendar } from "../components/OrdersCalendar";

const DashboardHome = () => {
  const [dateTime, setDateTime] = useState(new Date()); 
  const [nombreBodega, setNombreBodega] = useState("Cargando...");
  const [, setIdUbicacion] = useState<string>("Cargando...");
  const [expandedPanel, ] = useState<string | null>(null);

  const API_URL = import.meta.env.VITE_URL_BACKEND;

  useEffect(() => {
    const fetchDatosSucursal = async () => {
      try {
        const response = await fetch(`${API_URL}/get-name-sucursal`);
        if (!response.ok) {
          throw new Error(`Error HTTP: ${response.status}`);
        }
  
        const data = await response.json();
        
        if (data.success) {
          setNombreBodega(data.nombreSucursal);
          setIdUbicacion(data.idUbicacion);
        } else {
          setNombreBodega("Sucursal Desconocida");
          setIdUbicacion("");
        }
      } catch (error) {
        console.error("Error obteniendo datos de la sucursal:", error);
        setNombreBodega("Error al obtener bodega");
        setIdUbicacion("");
      }
    };
    fetchDatosSucursal();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setDateTime(new Date());
    }, 1000);

    return () => clearInterval(interval); 
  }, []);

  const dateOptions: Intl.DateTimeFormatOptions = {
    weekday: "long", 
    year: "numeric",
    month: "long",
    day: "numeric",
  };

  const capitalizeFirstLetter = (str: string) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  const formattedDate = capitalizeFirstLetter(dateTime.toLocaleDateString("es-ES", dateOptions));

  return (
    <div className="dashboard-container">
      <div className="w-full bg-white rounded-lg shadow-md p-3 mb-4 flex justify-between items-center border border-gray-400">
        <h1 className="text-xl font-semibold  text-black">Menu de ({nombreBodega})</h1>
        
        <div className="flex items-center space-x-3">
        <span className="text-black">
          {formattedDate} 
          <br />
          {dateTime.toLocaleTimeString()}
        </span>
        </div>
      </div>
      <div className="flex gap-4 h-[calc(100vh-140px)]">
        {(!expandedPanel || expandedPanel === "calendar" || expandedPanel === "progress") && (
          <div className={`${expandedPanel ? "w-full" : "w-full"} space-y-2`}>
            {(!expandedPanel || expandedPanel === "calendar") && (
              <OrdersCalendar />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardHome;