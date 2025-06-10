import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { io } from "socket.io-client";
import { showSuccess, showError, showWarning, showCustomSuccess } from "../services/alertService";
import { showLoading, hideLoading } from "../services/loadingService";
import TableComponent from "../components/Table";
import dayjs ,{ Dayjs } from 'dayjs';
import { Calendar, Trash2 } from "lucide-react";

interface Pedido {
  IdPedidos: number;
  NombreEmpresa: string;
  Fecha: string;
  Estado: number;
  Departamento: string;
  TotalCantidad: string;
  ObservacionPedido: string;
  IdSucursal: number;
  NombreSucursal: string;
}

const API_URL = import.meta.env.VITE_URL_BACKEND;
let socket = io(API_URL, { transports: ["websocket"] });

export default function SyncOrders() {
  const navigate = useNavigate();
  const [dateTime, setDateTime] = useState(new Date());
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [nombreBodega, setNombreBodega] = useState<string>("Cargando...");
  const [ubicacion, setIdUbicacion] = useState<string>("Cargando...");
  const [reload, setReload] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Pedido[]>([]);
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
      setFilterEstado(filterEstado);
      setFilterFechaInicial(filterFechaInicial ? dayjs(filterFechaInicial) : null);
      setFilterFechaFinal(filterFechaFinal ? dayjs(filterFechaFinal) : null);
    }
  }, [location.state]);

  useEffect(() => {
    const timer = setInterval(() => setDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchPedidos = async () => {
    showLoading("Cargando Pedidos");
    try {
      const response = await fetch(`${API_URL}/pedidos`);
      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }

      const data = await response.json();

      setPedidos(data.length ? data : []);
    } catch (error) {
      console.error("Error al obtener pedidos:", error);
      setPedidos([]);
    } finally {
      hideLoading();
    }
  };

  useEffect(() => {    
    fetchPedidos();
    setSelectedRows([]);
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

  const limpiarFiltros = () => {
    setFilterId("");
    setFilterNombreEmpresa("");
    setFilterDepartamento("");
    setFilterEstado("");
    setFilterFechaInicial(null);
    setFilterFechaFinal(null);
  };

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

  function normalizeText(text: string): string {
    return text
        .toLowerCase()
        .normalize("NFD") // separa letras con tilde
        .replace(/[\u0300-\u036f]/g, "") // elimina tildes
        .replace(/\s+/g, " ") // reemplaza múltiples espacios por uno solo
        .trim();
  }

  function fuzzyMatch(text: string, input: string): boolean {
      const normalizedText = normalizeText(text);
      const normalizedInput = normalizeText(input);

      // Verifica coincidencia exacta o parcial (incluyendo espacios)
      if (normalizedText.includes(normalizedInput)) {
          return true;
      }

      // Verifica coincidencia de abreviación (letras en orden)
      let inputIndex = 0;
      for (let i = 0; i < normalizedText.length && inputIndex < normalizedInput.length; i++) {
          if (normalizedText[i] === normalizedInput[inputIndex]) {
              inputIndex++;
          }
      }

      return inputIndex === normalizedInput.length;
  }

  // Función para filtrar los pedidos
  const filteredPedidos = pedidos.filter((pedido) => {
    const pedidoFecha = dayjs(formatFecha(pedido.Fecha));
      // Filtro exacto para ID (búsqueda por coincidencia parcial en string)
      const matchesId = filterId 
          ? pedido.IdPedidos.toString().includes(filterId) 
          : true;
    
      // Filtro "fuzzy" para campos de texto (NombreEmpresa, Departamento)
      const matchesNombreEmpresa = filterNombreEmpresa
          ? fuzzyMatch(pedido.NombreEmpresa || "", filterNombreEmpresa)
          : true;
    
      const matchesDepartamento = filterDepartamento
          ? fuzzyMatch(pedido.Departamento || "", filterDepartamento)
          : true;
    
      // Filtro exacto para Estado (comparación directa)
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

  const sincronizarPedidos = async () => {
    try {
      showLoading("Sincronizando pedidos...");

      const response = await fetch(`${API_URL}/pedidos/pedidos-no-actualizados/${ubicacion}`);

      // Primero verificamos si la respuesta es JSON válido
      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        throw new Error(`Error al procesar la respuesta del servidor: ${jsonError instanceof Error ? jsonError.message : 'Unknown error'}. Estado HTTP: ${response.status}`);
      }

      // Luego verificamos si la respuesta HTTP fue exitosa
      if (!response.ok) {
        throw new Error(data.message || `Error HTTP: ${response.status}`);
      }

      hideLoading();

      if (data.success) {
        if (data.pedidos && data.pedidos.length > 0) {
          showSuccess(
            "Éxito",
            `Se sincronizaron ${data.pedidos.length} pedidos correctamente.`
          );
          setReload((prev) => !prev);
          socket.emit("pedidosActualizados");
        } else {
          showWarning("Atención", data.message || "No hay pedidos para sincronizar.");
        }
      } else {
        throw new Error(data.message || "Sincronización incompleta o con errores desconocidos.");
      }
    } catch (error) {
      hideLoading();
      const errorMessage = error instanceof Error
        ? error.message
        : "Error desconocido. Revise la consola para más detalles.";

      showError("Error", errorMessage);
      console.error("Error al sincronizar pedidos:", error);
    }
  };
  
  const handleRevisarPedido = async (pedido: Pedido) => {
    try {
      showLoading("Actualizando pedido...");
      
      // Primero actualizamos el estado del pedido
      const updateResponse = await fetch(`${API_URL}/pedidos/actualizar-estado`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idPedido: pedido.IdPedidos
        }),
      });
  
      if (!updateResponse.ok) {
        throw new Error(`Error al actualizar el pedido: ${updateResponse.status}`);
      }
  
      const updateData = await updateResponse.json();
      if (!updateData.success) {
        throw new Error(updateData.message || "No se pudo actualizar el pedido");
      }
  
      // Ahora actualizamos las existencias
      const existenciasResponse = await fetch(`${API_URL}/pedidos/actualizar-existencias/${pedido.IdPedidos}`);
      
      if (!existenciasResponse.ok) {
        console.warn(`Advertencia: No se pudieron actualizar las existencias: ${existenciasResponse.status}`);
        // Continuamos aunque haya error, porque ya actualizamos el estado del pedido
      } else {
        const existenciasData = await existenciasResponse.json();
        if (existenciasData.success) {
          console.log(`Existencias actualizadas: ${existenciasData.message}`);
        } else {
          console.warn(`Advertencia: ${existenciasData.message}`);
        }
      }
  
      hideLoading();
      setReload((prev) => !prev);

      console.log(ubicacion);
  
      // Navegamos a la página de detalle
      navigate(`/detalle/${pedido.IdPedidos}`, {
        state: {
          idPedido: pedido.IdPedidos,
          sucursal: pedido.NombreEmpresa || "N/A",
          fecha: formatFecha(pedido.Fecha),
          estado: "Pedido en Revisión",
          departamento: pedido.Departamento || "N/A",
          fardos: pedido.TotalCantidad,
          ObservacionPedido: pedido.ObservacionPedido || " ",
          nombreBodega: nombreBodega,
          ubicacion: ubicacion,
          // Filtros actuales
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
      const errorMessage = error instanceof Error ? error.message : "Error desconocido";
      showError("Error", errorMessage);
    }
  };
  
  const handleConsolidar = async (selectedIds: number[], selectedRows: Pedido[]) => {
    if (!selectedIds || selectedIds.length === 0) {
      showError("Error", "No hay pedidos seleccionados.");
      return;
    }
  
    // Filtrar para usar sólo los IDs que existen actualmente en la tabla
    const idsExistentes = pedidos.map(pedido => pedido.IdPedidos);
    const idsValidos = selectedIds.filter(id => idsExistentes.includes(id));
  
    // Si no quedan IDs válidos después de filtrar, mostrar un mensaje y salir
    if (idsValidos.length === 0) {
      showError("Error", "Ninguno de los pedidos seleccionados existe actualmente.");
      // Limpiar selecciones
      setSelectedRows([]);
      return;
    }
  
    // Si algunos IDs fueron eliminados pero quedan algunos válidos, continuar con los válidos
    if (idsValidos.length < selectedIds.length) {
      // Actualizar selectedRows para que solo contenga los pedidos existentes
      const rowsValidas = selectedRows.filter(row => idsExistentes.includes(row.IdPedidos));
      setSelectedRows(rowsValidas);
    }
  
    try {
      const response = await fetch(`${API_URL}/pedidos/validar-estados`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedidos: idsValidos }), // Usar solo los IDs válidos
      });
  
      const data = await response.json();
  
      if (!response.ok || !data.success) {
        // Si el mensaje contiene información sobre pedidos que necesitan revisión
        if (data.pedidosSinRevisar && data.pedidosSinRevisar.length > 0) {
          showError(
            "Error", 
            `Antes de consolidar debe revisar los siguientes pedidos: ${data.pedidosSinRevisar.join(", ")}`
          );
        } else {
          showError("Error", data.message || "Para consolidar debe revisar todos los pedidos antes.");
        }
        return;
      }
  
      // Obtener los pedidos completos según los IDs válidos
      const pedidosSeleccionados = selectedRows.filter(pedido => 
        idsValidos.includes(pedido.IdPedidos)
      );
      
      // Verificar que todos los pedidos son de la misma sucursal
      const primerPedido = pedidosSeleccionados[0];
      const nombreEmpresa = primerPedido?.NombreSucursal || "la sucursal seleccionada";
      
      // Verificar si todos los pedidos son de la misma sucursal
      const todosMismaSucursal = pedidosSeleccionados.every(
        pedido => pedido.IdSucursal === primerPedido.IdSucursal
      );
      
      if (!todosMismaSucursal) {
        showError(
          "Error de Consolidación", 
          "Solo se pueden consolidar pedidos de la misma sucursal."
        );
        return;
      }
      
      // Crear HTML para mostrar la información de los pedidos
      let htmlMessage = `<div style="color: #555; text-align: center; margin-bottom: 20px;">
        Desea consolidar los siguientes pedidos para <br> <strong>${nombreEmpresa}</strong>
      </div>`;
      
      // Crear la lista de pedidos en formato HTML
      htmlMessage += `<div style="text-align: center;">`;
      pedidosSeleccionados.forEach(pedido => {
        htmlMessage += `<div style="margin-bottom: 5px; color: #333;">
          ID: <strong>${pedido.IdPedidos}</strong> &nbsp;&nbsp; 
          Departamento: <strong>${pedido.Departamento || "N/A"}</strong>
        </div>`;
      });
      htmlMessage += `</div>`;
  
      // Usar el método showCustomSuccess
      showCustomSuccess(
        "Confirmación de Consolidación",
        htmlMessage,
        "Sí, consolidar",
        () => {
          consolidarPedidos(idsValidos);
          setSelectedRows([]);
        }
      );
    } catch (error) {
      showError("Error", "Hubo un problema con la validación de los pedidos.");
      setSelectedRows([]);
    }
  };

  const consolidarPedidos = async (selectedIds: number[]) => {
    showLoading("Consolidando pedidos...");
  
    try {
      const response = await fetch(`${API_URL}/pedidos/consolidar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedidos: selectedIds }),
      });
  
      const data = await response.json();
      hideLoading();
  
      if (!response.ok || !data.success) {
        switch (data.errorCode) {
          case "NO_PEDIDOS":
            showError(
              "Selección inválida",
              "No hay pedidos seleccionados para consolidar."
            );
            break;
  
          case "DIFERENTES_SUCURSALES":
            showError(
              "Consolidación Fallida",
              "Los pedidos seleccionados pertenecen a diferentes sucursales. Solo se pueden consolidar pedidos de la misma sucursal."
            );
            break;
  
          case "PEDIDOS_NO_ENCONTRADOS":
            showError(
              "Datos no encontrados",
              "No se pudo obtener la información de los pedidos seleccionados."
            );
            break;
  
          default:
            showError(
              "Error",
              data.message || "No se pudieron consolidar los pedidos por un problema desconocido."
            );
        }
      } else {
        showSuccess("Éxito", "Los pedidos fueron consolidados correctamente.");
      }
  
      // IMPORTANTE: Limpiar el array de selección después de cualquier resultado
      setSelectedRows([]);
      
      // Recargar la tabla de pedidos
      setReload(prev => !prev);
  
    } catch (error) {
      hideLoading();
      showError("Error de conexión", "Hubo un problema al conectar con el servidor. Verifique su conexión e intente nuevamente.");
      
      setSelectedRows([]);
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

  return (
    <div className="w-full flex flex-col">
      <div className="w-full flex flex-col items-center p-1">
        <div className="w-full bg-white rounded-lg shadow-md p-3 mb-4 flex justify-between items-center border border-gray-600">
          <h1 className="text-xl font-semibold text-black">Sincronizar Pedidos ({nombreBodega})</h1>
          <span className="text-black">
            {dateTime.toLocaleDateString()} {dateTime.toLocaleTimeString()}
          </span>

          <button
            className="bg-blue-600 text-white px-4 py-2 rounded-lg"
            onClick={sincronizarPedidos}>
            Sincronizar
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center w-full p-1">
        <div className="w-full max-w-10xl bg-white rounded-lg shadow-md p-2 flex flex-col border border-gray-600">
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
                  { key: "IdPedidos", label: "ID Pedido", sortable: true , editable :true },
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
                    editable :true,
                    render: (pedidos) => <>{pedidos.Departamento || "N/A"}</>,
                  },
                  { key: "TotalCantidad", label: "Cantidad", sortable: true, editable :true },
                  {
                    key: "Fecha",
                    label: "Fecha",
                    sortable: true,
                    editable :true,
                    render: (pedido) => <>{formatFecha(pedido.Fecha)}</>,
                  },
                  { key: "Estado", label: "Estado", sortable: true ,editable :true},
                  {
                    label: "Acción",
                    editable :true,
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
                rowsPerPage={200}
                multiSelect={true}
                maxHeight="calc(100vh - 330px)"
                customHeaderContent={
                  <button
                    className="bg-blue-500 text-white px-4 py-1 rounded"
                    onClick={() => {
                      const selectedIds = selectedRows.map((pedido) => pedido.IdPedidos);
                      handleConsolidar(selectedIds, selectedRows);
                    }}
                  >
                    Consolidar
                  </button>
                }
                onSelectionChange={(selectedItems) => {
                  setSelectedRows(selectedItems);
                }}
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