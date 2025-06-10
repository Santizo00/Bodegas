import React, { useState, useEffect } from "react";
import { X, Trash2 } from "lucide-react";
import { showError, showSuccess } from "../services/alertService";

interface VariedadItem {
  color: string;
  cantidad: number;
}

interface VariedadModalProps {
  isOpen: boolean;
  onClose: () => void;
  upc: string;
  descripcion: string;
  idPedido: number;
}

const VariedadModal: React.FC<VariedadModalProps> = ({
  isOpen,
  onClose,
  upc,
  descripcion,
  idPedido,
}) => {
  const [variedades, setVariedades] = useState<VariedadItem[]>([{ color: "", cantidad: 0 }]);

  useEffect(() => {
    if (!isOpen) {
      setVariedades([{ color: "", cantidad: 0 }]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      // Solo buscar variedad si está abierto
      const fetchVariedad = async () => {
        try {
          const response = await fetch(
            `${import.meta.env.VITE_URL_BACKEND}/pedidos/obtener-variedad/${idPedido}/${upc}`
          );
          const data = await response.json();
  
          if (response.ok && data.success && data.variedad) {
            // Parsear "ROJO: 5, VERDE: 3"
            const parsed = data.variedad.split(",").map((item: string) => {
              const [color, cantidad] = item.split(":").map((s) => s.trim());
              return {
                color,
                cantidad: parseInt(cantidad) || 0,
              };
            });
  
            setVariedades(parsed);
          } else {
            setVariedades([{ color: "", cantidad: 0 }]);
          }
        } catch (error) {
          console.error("❌ Error al obtener variedad:", error);
          setVariedades([{ color: "", cantidad: 0 }]); // fallback
        }
      };
  
      fetchVariedad();
    }
  }, [isOpen, idPedido, upc]);
  

  const agregarFila = () => {
    setVariedades([...variedades, { color: "", cantidad: 0 }]);
  };

  const actualizarValor = (index: number, field: keyof VariedadItem, value: string | number) => {
    const copia = [...variedades];
    if (field === "cantidad") {
      copia[index].cantidad = Number(value);
    } else {
      copia[index].color = String(value);
    }
    setVariedades(copia);
  };

  const agregarVariedad = async () => {
    const coloresFormateados = variedades
      .filter((v) => v.color.trim() !== "" && v.cantidad > 0)
      .map((v) => `${v.color.trim().toUpperCase()}: ${v.cantidad}`)
      .join(", ");
  
    try {
      const response = await fetch(`${import.meta.env.VITE_URL_BACKEND}/pedidos/actualizar-variedad`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idPedido,
          upcProducto: upc,
          variedad: coloresFormateados,
        }),
      });
  
      const data = await response.json();
  
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Error al actualizar variedad.");
      }
  
      console.log("✅ Variedad actualizada correctamente.");
      showSuccess("Éxito", "La variedad se agrego correctamente.");
      onClose(); // cerrar el modal si todo sale bien
    } catch (error) {
      showError("Error", "No se pudo agregar la variedad.");
    }
  };

  const eliminarFila = (index: number) => {
    const nuevas = [...variedades];
    nuevas.splice(index, 1);
    setVariedades(nuevas.length > 0 ? nuevas : [{ color: "", cantidad: 0 }]);
  };


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white p-6 rounded-lg w-full max-w-lg shadow-lg relative">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-white bg-red-600 hover:bg-red-700"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-bold mb-4 text-center text-black">Agregar Variedad</h2>
        <div className="mb-4">
          <p className="text-black">
            <strong>UPC:</strong> {upc}
          </p>
          <p className="text-black">
            <strong>Descripción:</strong> {descripcion}
          </p>
        </div>

        <div className="space-y-3 max-h-64 overflow-y-auto py-2">
            {variedades.map((item, index) => (
                <div key={index} className="flex gap-3 items-center">
                <input
                    type="text"
                    placeholder="Color"
                    value={item.color}
                    onChange={(e) => actualizarValor(index, "color", e.target.value)}
                    className="w-1/2 p-2 border rounded bg-white text-black placeholder-gray-600"
                />
                <input
                    type="number"
                    placeholder="Cantidad"
                    value={item.cantidad}
                    onChange={(e) => actualizarValor(index, "cantidad", e.target.value)}
                    className="w-1/2 p-2 border rounded bg-white text-black placeholder-gray-600"
                />
                {variedades.length > 1 && (
                    <button
                    onClick={() => eliminarFila(index)}
                    className="text-white bg-red-600 hover:bg-red-700 p-1"
                    title="Eliminar fila"
                    >
                    <Trash2 className="w-5 h-5" />
                    </button>
                )}
                </div>
            ))}
            </div>

        <div className="mt-4 flex justify-between">
          <button
            onClick={agregarFila}
            className="bg-blue-600 text-white px-4 rounded hover:bg-blue-700"
          >
            + Agregar fila
          </button>

          <button
            onClick={agregarVariedad}
            className="bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
};

export default VariedadModal;
