import { useState, useEffect } from "react";
import { useNavigate, useLocation} from "react-router-dom";
import { showError } from "../services/alertService";
import TableComponent from "../components/Table";
import dayjs, { Dayjs } from 'dayjs';
import { Calendar, Trash2 } from "lucide-react";
import { hideLoading, showLoading } from "../services/loadingService";

interface Pedido {
  IdPedidos: number;
  NombreEmpresa: string;
  Fecha: string;
  Estado: number;
  Departamento: string;
  TotalCantidad: string;
  IdEstado: number;
}

const API_URL = import.meta.env.VITE_URL_BACKEND;

export default function AllOrders() {
  const navigate = useNavigate();
  const [dateTime, setDateTime] = useState(new Date());
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [nombreBodega, setNombreBodega] = useState<string>("Cargando...");
  const [ubicacion, setIdUbicacion] = useState<string>("Cargando...");
  const [reload, setReload] = useState(false);
  const [filterId, setFilterId] = useState<string>("");
  const [filterNombreEmpresa, setFilterNombreEmpresa] = useState<string>("");
  const [filterDepartamento, setFilterDepartamento] = useState<string>("");
  const [filterEstado, setFilterEstado] = useState<string>("");
  const [filterFechaInicial, setFilterFechaInicial] = useState<Dayjs | null>(null);
  const [filterFechaFinal, setFilterFechaFinal] = useState<Dayjs | null>(null);

  const location = useLocation();

  useEffect(() => {
    if (location.state?.savedFilters) {
      const { filterId, filterNombreEmpresa, filterDepartamento, filterFechaInicial, filterFechaFinal, filterEstado } = location.state.savedFilters;
      setFilterId(filterId);
      setFilterNombreEmpresa(filterNombreEmpresa);
      setFilterDepartamento(filterDepartamento);
      setFilterFechaInicial(filterFechaInicial ? dayjs(filterFechaInicial) : null);
      setFilterFechaFinal(filterFechaFinal ? dayjs(filterFechaFinal) : null);
      setFilterEstado(filterEstado);
    }
  }, [location.state]);

  useEffect(() => {
    const timer = setInterval(() => setDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchPedidos = async () => {
    showLoading("Cargando Pedidos");
    try {
      const response = await fetch(`${API_URL}/allorders`);
      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }

      const data = await response.json();
      setPedidos(data.length ? data : []);
    } catch (error) {
      console.error("Error al obtener pedidos:", error);
      setPedidos([]);
    }finally{
      hideLoading();
    }
  };

  useEffect(() => {
    fetchPedidos();
  }, [reload]);

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

  // Extraer estados únicos
  const estadosUnicos = [...new Set(pedidos.map((pedido) => pedido.Estado.toString()))];

  // Función para formatear la fecha
  const formatFecha = (fecha: string) => {
    const date = new Date(fecha);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`; // Formato YYYY-MM-DD
  };

  const limpiarFiltros = () => {
    setFilterId("");
    setFilterNombreEmpresa("");
    setFilterDepartamento("");
    setFilterFechaInicial(null);
    setFilterFechaFinal(null);
    setFilterEstado("");
  };

  function normalizeText(text: string): string {
    return text
        .toLowerCase()
        .normalize("NFD") // Separa caracteres acentuados (é → e + ´)
        .replace(/[\u0300-\u036f]/g, "") // Elimina tildes
        .replace(/\s+/g, " ") // Reduce múltiples espacios a uno solo
        .trim(); // Elimina espacios al inicio/final
   }

   function fuzzyMatch(text: string, input: string): boolean {
    const normalizedText = normalizeText(text);
    const normalizedInput = normalizeText(input);

    // Si el input está vacío, no hay coincidencia
    if (!normalizedInput) return false;

    // 1. Coincidencia exacta (incluye búsqueda parcial)
    if (normalizedText.includes(normalizedInput)) {
        return true;
    }

    // 2. Coincidencia por abreviación (letras en orden, no necesariamente juntas)
    let inputIndex = 0;
    for (const char of normalizedText) {
        if (char === normalizedInput[inputIndex]) {
            inputIndex++;
            if (inputIndex === normalizedInput.length) return true; // Todas las letras encontradas
        }
    }

    return false; // No hubo coincidencia
  }  

  // Función para filtrar los pedidos con lógica de rango de fechas
  const filteredPedidos = pedidos.filter((pedido) => {
    const pedidoFecha = dayjs(formatFecha(pedido.Fecha));
    
    const matchesId = filterId
        ? pedido.IdPedidos.toString().includes(filterId)
        : true;
  
    const matchesNombreEmpresa = filterNombreEmpresa
        ? fuzzyMatch(pedido.NombreEmpresa || "", filterNombreEmpresa)
        : true;
  
    const matchesDepartamento = filterDepartamento
        ? fuzzyMatch(pedido.Departamento || "", filterDepartamento)
        : true;
  
    const matchesEstado = filterEstado
        ? pedido.Estado.toString() === filterEstado
        : true;
  
    // Nueva lógica para el filtro de rango de fechas
    let matchesFecha = true;
    
    if (filterFechaInicial && filterFechaFinal) {
      // Si ambas fechas están presentes, verificar si está en el rango
      matchesFecha = (pedidoFecha.isAfter(filterFechaInicial.startOf('day')) || 
                   pedidoFecha.format('YYYY-MM-DD') === filterFechaInicial.format('YYYY-MM-DD')) && 
                  (pedidoFecha.isBefore(filterFechaFinal.endOf('day')) || 
                   pedidoFecha.format('YYYY-MM-DD') === filterFechaFinal.format('YYYY-MM-DD'));
    } else if (filterFechaInicial) {
      // Si solo hay fecha inicial, verificar que sea exactamente esa fecha
      matchesFecha = pedidoFecha.format('YYYY-MM-DD') === filterFechaInicial.format('YYYY-MM-DD');
    } else if (filterFechaFinal) {
      // Si solo hay fecha final, verificar que sea exactamente esa fecha
      matchesFecha = pedidoFecha.format('YYYY-MM-DD') === filterFechaFinal.format('YYYY-MM-DD');
    }
    return matchesId && matchesNombreEmpresa && matchesDepartamento && matchesFecha && matchesEstado;
  });

  const handleRevisarPedido = async (pedido: Pedido) => {
    try {
      showLoading("Actualizando información...");
      const response = await fetch(`${API_URL}/allorders/actualizar-informacion/${pedido.IdPedidos}`);
      
      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }
  
      const data = await response.json();
      if (!data.success) {
        console.warn(`Advertencia: ${data.message}`);
      }
  
      hideLoading();
      setReload(prev => !prev);
      
      const ubicacionFinal = [2, 3, 5, 8].includes(Number(ubicacion)) ? 3 : ubicacion;


      navigate(`/detalleall/${pedido.IdPedidos}`, {
        state: {
          // Datos del pedido
          idPedido: pedido.IdPedidos,
          sucursal: pedido.NombreEmpresa || "N/A",
          fecha: formatFecha(pedido.Fecha),
          estado: pedido.Estado,
          departamento: pedido.Departamento || "N/A",
          fardos: pedido.TotalCantidad,
          bodega: nombreBodega,
          ubicacionOriginal: ubicacion,
          ubicacion: ubicacionFinal,
          // Filtros actuales actualizados para incluir rango de fechas
          currentFilters: {
            filterId,
            filterNombreEmpresa,
            filterDepartamento,
            filterFechaInicial: filterFechaInicial?.format('YYYY-MM-DD'),
            filterFechaFinal: filterFechaFinal?.format('YYYY-MM-DD'),
            filterEstado
          }
        },
      });
  
    } catch (error) {
      hideLoading();
      showError("Error", error instanceof Error ? error.message : "Error desconocido");
    }
  }; 

  const actualizarSucursal = async (idPedido: number, sucursal: string) => {
    try {
      showLoading("Actualizando observación...");
  
      const response = await fetch(`${API_URL}/pedidos/actualizar-sucursal`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idPedido, sucursal }),
      });
  
      if (!response.ok) {
        throw new Error(`Error al actualizar: ${response.status}`);
      }
  
      const data = await response.json();
  
      if (data.success) {
        hideLoading();
        fetchPedidos();
      } else {
        throw new Error(data.message || "No se pudo actualizar la observación.");
      }
    } catch (error) {
      showError("Error", `No se pudo actualizar la observación: ${error}`);
    }
  };

  const getRowStyle = (pedido: Pedido): React.CSSProperties => {
    if (pedido.IdEstado === 8) {
      return { backgroundColor: "#fc4b4b", color: "white" };
    }
    if (pedido.IdEstado === 3 || (pedido.IdEstado >= 5 && pedido.IdEstado <= 7)) {
      return { backgroundColor: "#1cad34", color: "white" };
    }
    return {};
  };
  

  return (
    <div className="w-full flex flex-col">
      <div className="w-full flex flex-col items-center p-1">
        <div className="w-full bg-white rounded-lg shadow-md p-3 mb-4 flex justify-between items-center border border-gray-600">
          <h1 className="text-xl font-semibold text-black">Menú de Pedidos ({nombreBodega})</h1>
          <span className="text-black">
            {dateTime.toLocaleDateString()} {dateTime.toLocaleTimeString()}
          </span>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center w-full p-1">
        <div className="w-full max-w-10xl bg-white rounded-lg shadow-md p-2 flex flex-col border border-gray-600 ">
          <h2 className="text-lg font-medium text-black mb-3">Listado de Pedidos</h2>

          {/* Mostrar filtros solo si hay datos en la tabla */}
          {pedidos.length > 0 && (
            <div className="w-full overflow-x-auto">
              <div className="flex flex-wrap items-end gap-2 md:gap-4 mb-4">
                {/* Filtro por ID */}
                <div className="flex flex-col">
                  <label className="text-xs md:text-sm font-medium text-gray-700">Filtrar por ID</label>
                  <input
                    style={{ width: '130px' }}
                    type="text"
                    placeholder="ID"
                    value={filterId}
                    onChange={(e) => setFilterId(e.target.value)}
                    className="mt-1 p-1 md:p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black min-w-[120px] md:min-w-[150px]"
                  />
                </div>

                {/* Filtro por Sucursal */}
                <div className="flex flex-col">
                  <label className="text-xs md:text-sm font-medium text-gray-700">Filtrar por Sucursal</label>
                  <input
                    style={{ width: '150px' }}
                    type="text"
                    placeholder="Sucursal"
                    value={filterNombreEmpresa}
                    onChange={(e) => setFilterNombreEmpresa(e.target.value)}
                    className="mt-1 p-1 md:p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black min-w-[140px] md:min-w-[180px]"
                  />
                </div>

                {/* Filtro por Departamento */}
                <div className="flex flex-col">
                  <label className="text-xs md:text-sm font-medium text-gray-700">Filtrar por Departamento</label>
                  <input
                    style={{ width: '150px' }}
                    type="text"
                    placeholder="Departamento"
                    value={filterDepartamento}
                    onChange={(e) => setFilterDepartamento(e.target.value)}
                    className="mt-1 p-1 md:p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black min-w-[140px] md:min-w-[180px]"
                  />
                </div>

                {/* Filtro por Fecha Inicial */}
                <div 
                  className="relative flex flex-col min-w-[140px] md:min-w-[180px]"
                  onClick={() => {
                    const input = document.querySelector('input[name="fechaInicial"]');
                    if (input) (input as HTMLInputElement).showPicker();
                  }}
                >
                  <label className="text-xs md:text-sm font-medium text-gray-700">Fecha Inicial</label>
                  <input
                    type="date"
                    name="fechaInicial"
                    value={filterFechaInicial ? filterFechaInicial.format("YYYY-MM-DD") : ""}
                    onChange={(e) => {
                      const selectedDate = e.target.value ? dayjs(e.target.value) : null;
                      setFilterFechaInicial(selectedDate);
                    }}
                    className="mt-1 p-1 md:p-2 pr-8 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black w-full cursor-pointer"
                  />
                  <Calendar className="absolute right-2 md:right-3 top-8 w-4 md:w-5 h-4 md:h-5 text-gray-800 cursor-pointer" />
                </div>

                {/* Filtro por Fecha Final */}
                <div 
                  className="relative flex flex-col min-w-[140px] md:min-w-[180px]"
                  onClick={() => {
                    const input = document.querySelector('input[name="fechaFinal"]');
                    if (input) (input as HTMLInputElement).showPicker();
                  }}
                >
                  <label className="text-xs md:text-sm font-medium text-gray-700">Fecha Final</label>
                  <input
                    type="date"
                    name="fechaFinal"
                    value={filterFechaFinal ? filterFechaFinal.format("YYYY-MM-DD") : ""}
                    onChange={(e) => {
                      const selectedDate = e.target.value ? dayjs(e.target.value) : null;
                      setFilterFechaFinal(selectedDate);
                    }}
                    className="mt-1 p-1 md:p-2 pr-8 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black w-full cursor-pointer"
                  />
                  <Calendar className="absolute right-2 md:right-3 top-8 w-4 md:w-5 h-4 md:h-5 text-gray-800 cursor-pointer" />
                </div>

                {/* Filtro por Estado */}
                <div className="flex flex-col">
                  <label className="text-xs md:text-sm font-medium text-gray-700">Filtrar por Estado</label>
                  <select
                    style={{ width: '150px' }}
                    value={filterEstado}
                    onChange={(e) => setFilterEstado(e.target.value)}
                    className="mt-1 p-1 md:p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black min-w-[140px] md:min-w-[180px]"
                  >
                    <option value="">Todos los estados</option>
                    {estadosUnicos.map((estado) => (
                      <option key={estado} value={estado}>{estado}</option>
                    ))}
                  </select>
                </div>

                 {/* Botón para limpiar filtros */}
                 <div className="flex flex-col justify-end">
                 <button
                    onClick={limpiarFiltros}
                    className="mt-1 p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 focus:outline-none"
                    title="Limpiar todos los filtros"
                  >
                    <Trash2 className="w-5 h-5 text-white" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Mostrar tabla o mensaje de "No hay datos" */}
          {pedidos.length > 0 ? (
            <>
              <TableComponent
                data={filteredPedidos}
                columns={[
                  { key: "IdPedidos", label: "ID Pedido", sortable: true, editable :true  },
                  {
                    key: "NombreEmpresa",
                    label: "Sucursal",
                    sortable: true,
                    editable: false, 
                    onEditComplete: (newValue, item) => {
                      const nuevaSucursal = newValue.trim(); 
                      const id = Number(item.IdPedidos);
                      actualizarSucursal(id, nuevaSucursal);  
                    },
                  },
                  { key: "Departamento", 
                    label: "Departamento", 
                    sortable: true,
                    render: (pedidos) => <>{pedidos.Departamento || "N/A"}</>, 
                  },
                  { key: "TotalCantidad", label: "Cantidad", sortable: true , editable :true },
                  {
                    key: "Fecha",
                    label: "Fecha",
                    sortable: true, 
                    editable :true ,
                    render: (pedido) => <>{formatFecha(pedido.Fecha)}</>,
                  },
                  { key: "Estado", label: "Estado", sortable: true, editable :true },
                  {
                    label: "Acción",
                    render: (pedido) => (
                      <button
                        className="bg-blue-600 text-white px-2 py-1 rounded"
                        onClick={() => handleRevisarPedido(pedido)}
                      >
                        Revisar
                      </button>
                    ),
                  },
                ]}
                enableSorting={true}
                enablePagination={true}
                rowsPerPage={50}
                multiSelect={false}
                maxHeight="calc(100vh - 320px)"
                getRowStyle={getRowStyle}
              />
              {filteredPedidos.length === 0 && (
                <p className="text-gray-500 text-center py-10 border border-dashed border-gray-300 rounded-lg w-full">
                  No se encontraron resultados con los filtros aplicados.
                </p>
              )}
            </>
          ) : (
            <p className="text-gray-500 text-center py-10 border border-dashed border-gray-300 rounded-lg w-full">
              No hay pedidos disponibles por el momento.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}