import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import TableComponent from "../components/Table";
import { Maximize2, Minimize2 } from "lucide-react";

interface OrdersProgressProps {
  data?: any[];
  isExpanded?: boolean;
  onToggle?: () => void;
}

interface Column {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (item: any) => JSX.Element;
}

const API_URL = import.meta.env.VITE_URL_BACKEND;
let socket: any = null; 

export const OrdersProgress = ({
  data: initialData,
  isExpanded = false,
  onToggle,
}: OrdersProgressProps) => {
  const [data, setData] = useState<any[]>(initialData || []);
  const [filteredData, setFilteredData] = useState<any[]>(data);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchId, setSearchId] = useState<string>("");
  const [searchBranch, setSearchBranch] = useState<string>("");
  const [percentageFilter, setPercentageFilter] = useState<string>("all");

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/progress/`);
      if (!response.ok) throw new Error("Error al obtener los datos");
      const result = await response.json();
      setData(result);
      applyFilters(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = (currentData: any[]) => {
    let filtered = [...currentData];

    if (searchId) {
      filtered = filtered.filter((item) =>
        item.idPedido.toString().toLowerCase().includes(searchId.toLowerCase())
      );
    }

    if (searchBranch) {
      filtered = filtered.filter((item) =>
        item.sucursal.toLowerCase().includes(searchBranch.toLowerCase())
      );
    }

    switch (percentageFilter) {
      case "0-25":
        filtered = filtered.filter((item) => item.porcentaje <= 25);
        break;
      case "26-50":
        filtered = filtered.filter(
          (item) => item.porcentaje > 25 && item.porcentaje <= 50
        );
        break;
      case "51-75":
        filtered = filtered.filter(
          (item) => item.porcentaje > 50 && item.porcentaje <= 75
        );
        break;
      case "76-100":
        filtered = filtered.filter((item) => item.porcentaje > 75);
        break;
    }

    setFilteredData(filtered);
  };

  useEffect(() => {
    fetchData();
  
    if (!socket) {
      socket = io(API_URL, {
        transports: ["websocket"],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 3000,
      });
    }
  
    socket.on("bodegaActualizada", () => {
      fetchData(); 
    });
    
    socket.on("pedidosActualizados", () => {
      console.log("📢 Evento recibido: pedidosActualizados");
      fetchData();
    });
  
    return () => {
      socket.off("bodegaActualizada");
    };
  }, []);
  
  useEffect(() => {
    applyFilters(data);
  }, [searchId, searchBranch, percentageFilter, data]);

  const columns: Column[] = [
    { key: "idPedido", label: "IdPedido", sortable: true },
    { key: "sucursal", label: "Sucursal", sortable: true },
    { key: "estado", label: "Estado", sortable: true },
    {
      key: "porcentaje",
      label: "Porcentaje",
      sortable: true,
      render: (item: { porcentaje: number }) => (
        <div className="flex items-center gap-2">
          <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
            <div
              className={`${
                item.porcentaje === 100 ? "bg-green-500" : "bg-blue-600"
              } h-2.5 rounded-full transition-all duration-500 ease-in-out`}
              style={{ width: `${item.porcentaje}%` }}
            ></div>
          </div>
          <span className="text-sm text-gray-600 min-w-[10px]">
            {item.porcentaje}%
          </span>
        </div>
      ),
    },
  ];

  if (loading) return <div className="text-center py-4">Cargando...</div>;
  if (error) return <div className="text-center py-4 text-red-500">Error: {error}</div>;

  return (
    <div
      className={`bg-white rounded-lg shadow-md p-3 border border-gray-400 ${
        isExpanded ? "h-full" : "h-1/2"
      } transition-all duration-300`}
    >
      <div className="flex justify-between items-center mb-1">
        <h2 className="font-medium text-gray-600">Progreso de los pedidos</h2>
        {onToggle && (
          <button
            onClick={onToggle}
            className="p-1.5 hover:bg-gray-600 rounded-lg transition-colors duration-200 flex items-center gap-2"
          >
            {isExpanded ? (
              <>
                <Minimize2 size={20} />
                <span className="text-sm">Minimizar</span>
              </>
            ) : (
              <>
                <Maximize2 size={20} />
                <span className="text-sm">Expandir</span>
              </>
            )}
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
          <input
            type="text"
            placeholder="Ingrese el ID a buscar"
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
            className="p-2 border rounded-lg text-black placeholder-black bg-white border border-gray-600"
          />
          <input
            type="text"
            placeholder="Ingrese la sucursal a buscar"
            value={searchBranch}
            onChange={(e) => setSearchBranch(e.target.value)}
            className="p-2 border rounded-lg text-black placeholder-black bg-white border border-gray-600"
          />
          <select
            value={percentageFilter}
            onChange={(e) => setPercentageFilter(e.target.value)}
            className="p-2 border rounded-lg text-black placeholder-black bg-white border border-gray-600"
          >
            <option value="all">Todos los porcentajes</option>
            <option value="0-25">0-25%</option>
            <option value="26-50">26-50%</option>
            <option value="51-75">51-75%</option>
            <option value="76-100">76-100%</option>
          </select>
        </div>
      )}

      <TableComponent
        data={filteredData}
        columns={columns}
        maxHeight={isExpanded ? "calc(100vh - 250px)" : "calc(100% - 30px)"}
        enableSorting={true}
      />
    </div>
  );
};
