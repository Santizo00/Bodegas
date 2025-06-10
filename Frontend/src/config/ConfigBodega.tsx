import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@mui/material";

type Sucursal = {
  idSucursal: number;
  NombreSucursal: string;
  serverr: string;
  databasee: string;
  Uid: string;
  Pwd: string;
  IdUbicacion: string; // Añadimos este campo
};

export default function ConfigBodega() {
  const [open, setOpen] = useState(false);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [selectedSucursal, setSelectedSucursal] = useState<Sucursal | null>(null);  
  const [mensaje, setMensaje] = useState("");

  const API_URL = import.meta.env.VITE_URL_BACKEND;

  useEffect(() => {
    const fetchSucursales = async () => {
      try {
        const response = await fetch(`${API_URL}/get-sucursales`);
        const data = await response.json();

        if (data.success) {
          setSucursales(data.sucursales);
        } else {
          setMensaje("Error al cargar las sucursales");
        }
      } catch (error) {
        setMensaje("Error de conexión con el servidor");
      }
    };

    fetchSucursales();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey && event.ctrlKey && event.code === "KeyP") {
        setOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSave = async () => {
    if (!selectedSucursal) {
      setMensaje("Por favor selecciona una sucursal.");
      return;
    }
  
    if (
      !selectedSucursal.serverr ||
      !selectedSucursal.databasee ||
      !selectedSucursal.Uid ||
      !selectedSucursal.Pwd ||
      !selectedSucursal.NombreSucursal
    ) {
      setMensaje("Error: Faltan datos en la configuración.");
      return;
    }
  
    try {
      const response = await fetch(`${API_URL}/set-config`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          DB_LOCAL_HOST: selectedSucursal.serverr,
          DB_LOCAL_USER: selectedSucursal.Uid,
          DB_LOCAL_PASS: selectedSucursal.Pwd,
          DB_LOCAL_NAME: selectedSucursal.databasee,
          NOMBRE_SUCURSAL: selectedSucursal.NombreSucursal,
          ID_UBICACION: selectedSucursal.IdUbicacion,
        }),
      });
  
      const result = await response.json();
      if (response.ok) {
        setMensaje("Conexión con la sucursal establecida con éxito.");
        setTimeout(() => {
          setOpen(false);
          // Recargar la página para que se reflejen los cambios
          window.location.reload();
        }, 2000);
      } else {
        setMensaje("Error: " + result.error);
      }
    } catch (error) {
      setMensaje("Error de conexión con el servidor.");
    }
  };
  
  return (
    <Dialog open={open} onClose={() => setOpen(false)}>
      <DialogTitle>Configuración de Sucursal</DialogTitle>
      <DialogContent>
        <div className="flex flex-col gap-2 p-4">
        <select
          className="border p-2 rounded bg-white"
          onChange={(e) => {
            const sucursalSeleccionada = sucursales.find(
              (s) => s.idSucursal.toString() === e.target.value
            );
            setSelectedSucursal(sucursalSeleccionada || null);
          }}>
            
          <option value="">Seleccionar sucursal</option>
          {sucursales.map((sucursal) => (
            <option key={sucursal.idSucursal} value={sucursal.idSucursal}>
              {sucursal.NombreSucursal}
            </option>
          ))}
        </select>

          <button className="bg-blue-600 text-white p-2 rounded" onClick={handleSave}>
            Guardar
          </button>
          {mensaje && <p className="text-green-600">{mensaje}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}