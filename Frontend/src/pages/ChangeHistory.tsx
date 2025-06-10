import { useState, useEffect } from "react";
import TableComponent from "../components/Table";
import { hideLoading, showLoading } from "../services/loadingService";
import { exportToExcel } from "../services/exportToExcel";
import { Trash2, Upload } from "lucide-react";

interface Cambio {
  IdPedidos: number;
  Sucursal: string;
  Departamento: string;
  NombreCompleto: string;
  IdCambio: number;
  Descripcion: string;
  UPC_Historial: string;
  UPC_ProductoPaquete: string;
  DescripcionProducto: string | null;
  ValorAnterior: string;
  ValorNuevo: string;
  FechaHora: string;
}

const API_URL = import.meta.env.VITE_URL_BACKEND;

export default function ChangeHistory() {
  const [dateTime, setDateTime] = useState(new Date());
  const [cambios, setCambios] = useState<Cambio[]>([]);
  const [nombreBodega, setNombreBodega] = useState<string>("Cargando...");
  const [, setIdUbicacion] = useState<string>("Cargando...");
  const [reload] = useState(false);
  const [filterId, setFilterId] = useState<string>("");
  const [filterNombreCompleto, setFilterNombreCompleto] = useState<string>("");
  const [filterDescripcionCambio, setFilterDescripcionCambio] = useState<string>("");
  const [filterDescripcionProducto, setFilterDescripcionProducto] = useState<string>("");
  const [filterSucursal, setFilterSucursal] = useState<string>("");
  const [filterDepartamento, setFilterDepartamento] = useState<string>("");
  // Nuevos estados para los filtros de UPC
  const [filterUPCUnidad, setFilterUPCUnidad] = useState<string>("");
  const [filterUPCFardo, setFilterUPCFardo] = useState<string>("");

  useEffect(() => {
    const timer = setInterval(() => setDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    showLoading("Cargando Historial");
    const fetchCambios = async () => {
      try {
        const response = await fetch(`${API_URL}/changes`);
        if (!response.ok) {
          throw new Error(`Error HTTP: ${response.status}`);
        }

        const data = await response.json();
        setCambios(data.length ? data : []);
      } catch (error) {
        console.error("Error al obtener cambios:", error);
        setCambios([]);
      }finally{
        hideLoading();
      }
    };

    fetchCambios();
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
    setFilterNombreCompleto("");
    setFilterDescripcionCambio("");
    setFilterDescripcionProducto("");
    setFilterSucursal("");
    setFilterDepartamento("");
    setFilterUPCUnidad(""); // Limpiar filtro UPC Unidad
    setFilterUPCFardo(""); // Limpiar filtro UPC Fardo
  };

  // Extraer tipos de cambio únicos
  const tiposCambio = [...new Set(cambios.map((cambio) => cambio.Descripcion))];

  const filteredCambios = cambios.filter((cambio) => {
    // 1. Filtro por ID
    const matchesId = filterId 
        ? (cambio.IdPedidos ?? "").toString().includes(filterId)
        : true;

    // 2. Filtro por NombreCompleto
    const matchesNombreCompleto = filterNombreCompleto
        ? (cambio.NombreCompleto ?? "").toLowerCase().includes(filterNombreCompleto.toLowerCase())
        : true;

    // 3. Filtro por Descripción del Cambio
    const matchesDescripcionCambio = filterDescripcionCambio
        ? (cambio.Descripcion ?? "").toLowerCase().includes(filterDescripcionCambio.toLowerCase())
        : true;

    // 4. Filtro por Descripción del Producto
    const matchesDescripcionProducto = filterDescripcionProducto
        ? (cambio.DescripcionProducto ?? "").toLowerCase().includes(filterDescripcionProducto.toLowerCase())
        : true;

    // 5. Filtro por Sucursal
    const matchesSucursal = filterSucursal
        ? (cambio.Sucursal ?? "").toLowerCase().includes(filterSucursal.toLowerCase())
        : true;

    // 6. Filtro por Departamento
    const matchesDepartamento = filterDepartamento
        ? (cambio.Departamento ?? "").toLowerCase().includes(filterDepartamento.toLowerCase())
        : true;
        
    // 7. Filtro por UPC Unidad
    const matchesUPCUnidad = filterUPCUnidad
        ? (cambio.UPC_Historial ?? "").toLowerCase().includes(filterUPCUnidad.toLowerCase())
        : true;
        
    // 8. Filtro por UPC Fardo
    const matchesUPCFardo = filterUPCFardo
        ? (cambio.UPC_ProductoPaquete ?? "").toLowerCase().includes(filterUPCFardo.toLowerCase())
        : true;

    return matchesId && matchesNombreCompleto && matchesDescripcionCambio && 
            matchesDescripcionProducto && matchesSucursal && matchesDepartamento &&
            matchesUPCUnidad && matchesUPCFardo;
  });

  const formatFechaHora = (fechaHora: string) => {
    const date = new Date(fechaHora);
    return date.toLocaleString();
  };

  const handleExportExcel = () => {
    const columnas = {
      IdPedidos: "ID Pedido",
      Sucursal: "Sucursal",
      Departamento: "Departamento",
      NombreCompleto: "Usuario",
      Descripcion: "Descripción del Cambio",
      UPC_Historial: "UPC Unidad",
      UPC_ProductoPaquete: "UPC Fardo",
      DescripcionProducto: "Producto",
      ValorAnterior: "Valor Anterior",
      ValorNuevo: "Valor Nuevo",
      FechaHora: "Fecha y Hora"
    };
    
    exportToExcel(
      `historial_cambios_${new Date().toISOString().slice(0, 10)}`,
      "HistorialCambios",
      filteredCambios,
      columnas
    );
  };

  return (
    <div className="w-full flex flex-col">
      <div className="w-full flex flex-col items-center p-1">
        <div className="w-full bg-white rounded-lg shadow-md p-3 mb-4 flex justify-between items-center border border-gray-600">
          <h1 className="text-xl font-semibold text-black">Historial de Cambios ({nombreBodega})</h1>
          <span className="text-gray-500">
            {dateTime.toLocaleDateString()} {dateTime.toLocaleTimeString()}
          </span>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center w-full p-1">
        <div className="w-full max-w-10xl bg-white rounded-lg shadow-md p-2 flex flex-col border border-gray-600">
          <h2 className="text-lg font-medium text-black mb-3">Detalle de Historial</h2>

          {/* Mostrar filtros solo si hay datos en la tabla */}
          {cambios.length > 0 && (
            <div className="flex flex-wrap items-end gap-4 mb-4">
              {/* Filtrar por ID */}
              <div className="flex flex-col">
                <label className="text-xs md:text-sm font-medium text-gray-700">Filtrar por ID</label>
                <input style={{ width: '120px' }}
                  type="text"
                  placeholder="ID del Pedido"
                  value={filterId}
                  onChange={(e) => setFilterId(e.target.value)}
                  className="mt-1 p-1.5 md:p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black w-52 md:w-60"
                />
              </div>

              {/* Filtrar por Usuario */}
              <div className="flex flex-col">
                <label className="text-xs md:text-sm font-medium text-gray-700">Filtrar por Usuario</label>
                <input style={{ width: '160px' }}
                  type="text"
                  placeholder="Usuario"
                  value={filterNombreCompleto}
                  onChange={(e) => setFilterNombreCompleto(e.target.value)}
                  className="mt-1 p-1.5 md:p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black w-52 md:w-60"
                />
              </div>

              {/* Filtrar por Tipo de Cambio */}
              <div className="flex flex-col">
                <label className="text-xs md:text-sm font-medium text-gray-700">Filtrar por Tipo de Cambio</label>
                <select style={{ width: '180px' }}
                  value={filterDescripcionCambio}
                  onChange={(e) => setFilterDescripcionCambio(e.target.value)}
                  className="mt-1 p-1.5 md:p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black w-52 md:w-60"
                >
                  <option value="">Todos los cambio</option>
                  {tiposCambio.map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {tipo}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filtrar por UPC Unidad - NUEVO */}
              <div className="flex flex-col">
                <label className="text-xs md:text-sm font-medium text-gray-700">Filtrar por UPCFardo</label>
                <input style={{ width: '150px' }}
                  type="text"
                  placeholder="UPC Fardo"
                  value={filterUPCUnidad}
                  onChange={(e) => setFilterUPCUnidad(e.target.value)}
                  className="mt-1 p-1.5 md:p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black w-52 md:w-60"
                />
              </div>

              {/* Filtrar por UPC Fardo - NUEVO */}
              <div className="flex flex-col">
                <label className="text-xs md:text-sm font-medium text-gray-700">Filtrar por UPCUnidad</label>
                <input style={{ width: '140px' }}
                  type="text"
                  placeholder="UPC Unidad"
                  value={filterUPCFardo}
                  onChange={(e) => setFilterUPCFardo(e.target.value)}
                  className="mt-1 p-1.5 md:p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black w-52 md:w-60"
                />
              </div>

              {/* Filtrar por Producto */}
              <div className="flex flex-col">
                <label className="text-xs md:text-sm font-medium text-gray-700">Filtrar por Producto</label>
                <input style={{ width: '150px' }}
                  type="text"
                  placeholder="Descripcion"
                  value={filterDescripcionProducto}
                  onChange={(e) => setFilterDescripcionProducto(e.target.value)}
                  className="mt-1 p-1.5 md:p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black w-52 md:w-60"
                />
              </div>

              {/* Filtrar por Sucursal */}
              <div className="flex flex-col">
                <label className="text-xs md:text-sm font-medium text-gray-700">Filtrar por Sucursal</label>
                <input style={{ width: '150px' }}
                  type="text"
                  placeholder="Sucursal"
                  value={filterSucursal}
                  onChange={(e) => setFilterSucursal(e.target.value)}
                  className="mt-1 p-1.5 md:p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black w-52 md:w-60"
                />
              </div>

              {/* Botón Exportar Excel */}
              <button
                onClick={handleExportExcel}
                className="p-2 bg-green-600 hover:bg-green-700 text-white rounded-lg"
                title="Exportar a Excel"
              >
                <Upload className="w-5 h-5 text-white" />
              </button>

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
          )}

          {/* Mostrar tabla o mensaje de "No hay datos" */}
          {cambios.length > 0 ? (
            <TableComponent
              data={filteredCambios}
              columns={[
                { key: "IdPedidos", label: "ID Pedido", sortable: true , editable: true },
                { key: "Sucursal", label: "Sucursal", sortable: true , editable: true },
                { key: "NombreCompleto", 
                  label: "Usuario", 
                  sortable: true,
                  render: (cambio) => <>{cambio.NombreCompleto || "N/A"}</>,},
                { key: "Descripcion", label: "Descripción del Cambio", sortable: true, editable: true  },
                { key: "UPC_Historial", label: "UPC Fardo", sortable: true , editable: true },
                { key: "UPC_ProductoPaquete", label: "UPC Unidad", sortable: true , editable: true },
                {
                  key: "DescripcionProducto",
                  label: "Producto",
                  sortable: true,
                  render: (cambio) => <>{cambio.DescripcionProducto || "N/A"}</>,
                },
                { key: "ValorAnterior", label: "Valor Anterior", sortable: true, editable: true  },
                { key: "ValorNuevo", label: "Valor Nuevo", sortable: true, editable: true  },
                {
                  key: "FechaHora",
                  label: "Fecha y Hora",
                  sortable: true,
                  render: (cambio) => <>{formatFechaHora(cambio.FechaHora)}</>,
                },
              ]}
              enableSorting={true}
              enablePagination={true}
              rowsPerPage={25}
              multiSelect={false}
              maxHeight="calc(100vh - 300px)"
            />
          ) : (
            <p className="text-gray-500 text-center py-10 border border-dashed border-gray-300 rounded-lg w-full">
              No hay cambios disponibles por el momento.
            </p>
          )}

          {/* Mostrar mensaje si no hay resultados después de filtrar */}
          {cambios.length > 0 && filteredCambios.length === 0 && (
            <p className="text-gray-500 text-center py-10 border border-dashed border-gray-300 rounded-lg w-full">
              No se encontraron resultados con los filtros aplicados.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}