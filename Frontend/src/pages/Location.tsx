import { useState, useEffect } from "react";
import TableComponent from "../components/Table";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import Swal from "sweetalert2";
import { Trash2, Upload } from "lucide-react";

import { showError, showSuccess} from "../services/alertService";
import { hideLoading, showLoading } from "../services/loadingService";

interface Ubicacion {
  IdUbicacion: string;
  NombreUbicacion: string; 
}

interface Producto {
  UPCFardo: number;
  UPCUnidad: number;
  Descripcion: string;
  UnidadesFardo: number;
  Existencia: number;
  Ubicacion: string;
  MalEstado: Number;
}

const API_URL = import.meta.env.VITE_URL_BACKEND;

export default function Location() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [nombreBodega, setNombreBodega] = useState<string>("Cargando...");
  const [dateTime, setDateTime] = useState(new Date());
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([]);
  const [, setIdUbicacion] = useState<string>("Cargando...");
  const [reload, ] = useState(false);
  const [filterUPCFardo, setFilterUPCFardo] = useState<string>("");
  const [filterUPCUnidad, setFilterUPCUnidad] = useState<string>("");
  const [filterDescripcion, setFilterDescripcion] = useState<string>("");
  const [filterUbicacion, setFilterUbicacion] = useState<string>("");

  useEffect(() => {
    const timer = setInterval(() => setDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchPedidos = async () => {
    showLoading("Cargando Productos");
    try {
      const response = await fetch(`${API_URL}/location/products`);
      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }

      const data = await response.json();
      setProductos(data.length ? data : []);
    } catch (error) {
      console.error("Error al obtener pedidos:", error);
      setProductos([]);
    }finally{
      hideLoading();
    }
  };

  useEffect(() => {
    fetchUbicaciones();
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

  const limpiarFiltros = () => {
    setFilterUPCFardo("");
    setFilterUPCUnidad("");
    setFilterDescripcion("");
    setFilterUbicacion("");
  };

  // Extraer estados únicos
  const ubicacionesUnicas = [
    ...new Set(
      productos
        .map((producto) => producto.Ubicacion)
        .filter((ubicacion): ubicacion is string => ubicacion !== null && ubicacion !== undefined)
        .map((ubicacion) => ubicacion.toString())
    )
  ];
  
  function normalizeText(text: string): string {
    return text
      .toLowerCase()
      .normalize("NFD") // Separa caracteres acentuados (é → e + ´)
      .replace(/[\u0300-\u036f]/g, "") // Elimina tildes
      .replace(/\s+/g, " ") // Reduce múltiples espacios a uno solo
      .trim();
  }

  function fuzzyMatch(text: string, input: string): boolean {
    const normalizedText = normalizeText(text);
    const normalizedInput = normalizeText(input);

    if (!normalizedInput) return true; // Si no hay filtro, retorna true

    // 1. Coincidencia exacta o parcial (ej: "lap" → "Lápiz")
    if (normalizedText.includes(normalizedInput)) {
        return true;
    }

    // 2. Coincidencia por palabras separadas (ej: "lap azul" → "Lápiz Azul")
    const inputWords = normalizedInput.split(" ");
    if (inputWords.every(word => normalizedText.includes(word))) {
        return true;
    }

    // 3. Coincidencia por iniciales (ej: "la" → "Lápiz Azul")
    const textWords = normalizedText.split(" ");
    const textInitials = textWords.map(word => word[0]).join("");
    if (textInitials.includes(normalizedInput.replace(/\s/g, ""))) {
        return true;
    }

    return false;
  } 

  // Función para filtrar los pedidos
  const filteredProductos = productos.filter((producto) => {
    // 1. Filtro por UPC Fardo (búsqueda exacta o parcial)
    const matchesUPCFardo = filterUPCFardo
        ? (producto.UPCFardo ?? "").toString().includes(filterUPCFardo)
        : true;

    // 2. Filtro por UPC Unidad (búsqueda exacta o parcial)
    const matchesUPCUnidad = filterUPCUnidad
        ? producto.UPCUnidad.toString().includes(filterUPCUnidad)
        : true;

    // 3. Filtro por Descripción (flexible pero controlado)
    const matchesDescripcion = filterDescripcion
        ? fuzzyMatch(producto.Descripcion || "", filterDescripcion)
        : true;

    // 4. Filtro por Ubicación (exacto, pero manejando nulls)
    const matchesUbicacion = filterUbicacion
        ? (producto.Ubicacion ?? "").toString() === filterUbicacion
        : true;

    return matchesUPCFardo && matchesUPCUnidad && matchesDescripcion && matchesUbicacion;
  });

  const exportarExcel = () => {
    const datosExportar = filteredProductos.map((producto) => ({
      "UPC Fardo": String(producto.UPCFardo ?? ""),
      "UPC Unidad": String(producto.UPCUnidad ?? ""), 
      "Descripción": producto.Descripcion ?? "",
      "Existencia": Number(producto.Existencia ?? 0), 
      "Mal Estado": Number(producto.MalEstado ?? 0), 
      "Ubicación": producto.Ubicacion ?? "N/A"
    }));
    
  
    const hoja = XLSX.utils.json_to_sheet(datosExportar);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Productos");
  
    const excelBuffer = XLSX.write(libro, { bookType: "xlsx", type: "array" });
    const archivo = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(archivo, `productos_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const fetchUbicaciones = async () => {
    try {
      const response = await fetch(`${API_URL}/location/ubication`);
      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }
  
      const data: Ubicacion[] = await response.json();
      setUbicaciones(data);
    } catch (error) {
      console.error("Error al obtener ubicaciones:", error);
      setUbicaciones([]);
    }
  };

  const handleModificarProducto = async (producto: Producto) => {
    await fetchUbicaciones(); // 👈 Importante: esperá a que termine
  
    // Si no hay ubicaciones disponibles, no sigas
    if (!ubicaciones || ubicaciones.length === 0) {
      Swal.fire({
        icon: "error",
        title: "Sin ubicaciones",
        text: "No se pudieron cargar las ubicaciones disponibles.",
      });
      return;
    }
  
    // Ahora podés generar el modal con opciones cargadas
    const { value: nuevaUbicacion } = await Swal.fire({
      title: "Confirmar modificación",
      html: `
        <p class="text-left mb-2">¿Desea actualizar la ubicación del siguiente producto?</p>
        <div class="text-left mb-3" style="line-height: 1.8;">
          <p><strong>UPC Fardo:</strong> ${producto.UPCFardo ?? "N/A"}</p>
          <p><strong>UPC Unidad:</strong> ${producto.UPCUnidad ?? "N/A"}</p>
          <p><strong>Descripción:</strong> ${producto.Descripcion ?? "N/A"}</p>
          <p><strong>Unidades Fardo:</strong> ${producto.UnidadesFardo ?? "0"}</p>
          <p><strong>Ubicación Actual:</strong> ${producto.Ubicacion ?? "N/A"}</p>
        </div>
        <select id="ubicacion-select" class="swal2-select" style="
          width: 70%;
          padding: 8px;
          border-radius: 6px;
          border: 1px solid #ccc;
          font-size: 18px;
        ">
          <option value="" disabled selected>Seleccione nueva ubicación</option>
          ${ubicaciones
            .map(
              (u) =>
                `<option value="${u.IdUbicacion}">${u.NombreUbicacion}</option>`
            )
            .join("")}
        </select>
      `,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Aceptar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#02a90d",
      cancelButtonColor: "#f24c4c",
      preConfirm: () => {
        const select = document.getElementById("ubicacion-select") as HTMLSelectElement;
        return select?.value || null;
      },
    });
  
    if (nuevaUbicacion) {
      const ok = await updateUbicacion(producto.UPCUnidad, nuevaUbicacion);
      if (ok) {
        fetchPedidos();
        showSuccess("Éxito", "Ubicación actualizada correctamente");
      } else {
        showError("Error", "No se pudo actualizar la ubicacion.");
      }
    }
  };  

  const updateUbicacion = async (upcUnidad: number, idUbicacion: string) => {
    try {
      const response = await fetch(`${API_URL}/location/update`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ IdUbicacion: idUbicacion, UPCUnidad: upcUnidad }),
      });
  
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Error desconocido");
      }

      return true;
    } catch (error) {
      console.error("Error al actualizar ubicación:", error);
      return false;
    }
  };
  
  const actualizarCantidad = async (upc: string, nuevoValor: number) => {
    showLoading("Actualizando estado...");
    try {
      const response = await fetch(`${API_URL}/location/updateMalEstado`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          UPCUnidad: upc,
          MalEstado: nuevoValor 
        }),
      });
  
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Error al actualizar");
      }
  
      // Actualizar el estado local (convertimos upc a number para comparar si es necesario)
      setProductos(prev => prev.map(p => 
        p.UPCUnidad.toString() === upc ? {...p, MalEstado: nuevoValor} : p
      ));
      
      showSuccess("Éxito", "Estado actualizado correctamente");
      return true;
    } catch (error) {
      console.error("Error al actualizar estado:", error);
      showError("Error", "No se pudo actualizar el estado");
      return false;
    }
  };

  return (
    <div className="w-full flex flex-col">
      <div className="w-full flex flex-col items-center p-1">
        <div className="w-full bg-white rounded-lg shadow-md p-3 mb-4 flex justify-between items-center border border-gray-600">
          <h1 className="text-xl font-semibold text-black">Ubicaciones de Productos ({nombreBodega})</h1>
          <span className="text-black">
            {dateTime.toLocaleDateString()} {dateTime.toLocaleTimeString()}
          </span>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center w-full p-1">
        <div className="w-full max-w-10xl bg-white rounded-lg shadow-md p-2 flex flex-col border border-gray-600 ">
          <h2 className="text-lg font-medium text-black mb-3">Listado de Producto</h2>

          {/* Mostrar filtros solo si hay datos en la tabla */}
          {productos.length > 0 && (
            <div className="w-full overflow-x-auto">
              <div className="flex flex-wrap items-end gap-2 md:gap-4 mb-4">
                {/* Filtro por Upc Fardo */}
                <div className="flex flex-col">
                  <label className="text-xs md:text-sm font-medium text-gray-700">Filtrar por Upc Fardo</label>
                  <input
                    type="text"
                    placeholder="ID"
                    value={filterUPCFardo}
                    onChange={(e) => setFilterUPCFardo(e.target.value)}
                    className="mt-1 p-1 md:p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black min-w-[120px] md:min-w-[150px]"
                  />
                </div>

                {/* Filtro por Upc Unidad */}
                <div className="flex flex-col">
                  <label className="text-xs md:text-sm font-medium text-gray-700">Filtrar por Upc Unidad</label>
                  <input
                    type="text"
                    placeholder="Sucursal"
                    value={filterUPCUnidad}
                    onChange={(e) => setFilterUPCUnidad(e.target.value)}
                    className="mt-1 p-1 md:p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black min-w-[140px] md:min-w-[180px]"
                  />
                </div>

                {/* Filtro por Descripcion */}
                <div className="flex flex-col">
                  <label className="text-xs md:text-sm font-medium text-gray-700">Filtrar por Descripcion</label>
                  <input
                    type="text"
                    placeholder="Departamento"
                    value={filterDescripcion}
                    onChange={(e) => setFilterDescripcion(e.target.value)}
                    className="mt-1 p-1 md:p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black min-w-[140px] md:min-w-[180px]"
                  />
                </div>

                {/* Filtro por ubicacion */}
                <div className="flex flex-col">
                  <label className="text-xs md:text-sm font-medium text-gray-700">Filtrar por Ubicacion</label>
                  <select
                    value={filterUbicacion}
                    onChange={(e) => setFilterUbicacion(e.target.value)}
                    className="mt-1 p-1 md:p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black min-w-[140px] md:min-w-[180px]"
                  >
                    <option value="">Todos las ubicaciones</option>
                    {ubicacionesUnicas.map((ubicacion) => (
                      <option key={ubicacion} value={ubicacion}>{ubicacion}</option>
                    ))}
                  </select>
                </div>

                {/* Botón de Exportar */}
                <div className="flex flex-col justify-end">
                  <button
                    onClick={exportarExcel}
                    className="mt-1 p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none"
                    title="Exportar a Excel"
                  >
                    <Upload className="w-5 h-5 text-white" />
                  </button>
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
          {productos.length > 0 ? (
            <>
              <TableComponent
                data={filteredProductos}
                columns={[
                  { key: "UPCFardo", 
                    label: "UPC Fardo", 
                    sortable: true,
                    editable :true, 
                    render: (producto) => <>{producto.UPCFardo || "N/A"}</>,
                  },
                  { key: "UPCUnidad", label: "UPC Unidad", sortable: true, editable :true  },
                  { key: "Descripcion", label: "Descripcion", sortable: true, editable :true  },
                  { key: "UnidadesFardo", 
                    label: "Unidades Fardo", 
                    sortable: true,
                    editable :true, 
                    render: (producto) => <>{producto.UnidadesFardo || "0"}</>,
                  },
                  { key: "Existencia", label: "Existencia", sortable: true, editable :true  },
                  { key: "Ubicacion", 
                    label: "Ubicacion", 
                    sortable: true,
                    editable :true, 
                    render: (producto) => <>{producto.Ubicacion || "N/A"}</>,
                  },
                  { 
                    key: "MalEstado", 
                    label: "Mal Estado", 
                    sortable: true, 
                    editable :false,
                    onEditComplete: (nuevoValor, item) => {
                      const upc = String(item.UPCUnidad);

                      actualizarCantidad(upc, nuevoValor);
                    },
                  },
                  {
                    label: "Modificar",
                    editable :true,
                    render: (producto) => (
                      <button
                        className="bg-blue-600 text-white px-2 py-1 rounded"
                        onClick={() => handleModificarProducto(producto)}
                      >
                        Modificar
                      </button>
                    ),
                  },
                ]}
                enableSorting={true}
                enablePagination={true}
                rowsPerPage={500}
                multiSelect={false}
                maxHeight="calc(100vh - 320px)"
              />
              {filteredProductos.length === 0 && (
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