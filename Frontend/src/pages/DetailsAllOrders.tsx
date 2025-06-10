import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { showLoading, hideLoading } from "../services/loadingService";
import { showError } from "../services/alertService";
import TableComponent from "../components/Table";
import ModalImpresion from "../components/ModalImpresion";
import { exportToExcel } from "../services/exportToExcel";
import { Upload, Trash2 } from "lucide-react";

interface DetallePedido {
  id: number;
  idpedidos: number;
  upc: string;
  descripcion: string;
  cantidad: number;
  existencia: number;
  existenciafardos: number;
  iddepartamentos: number;
  Ubicacion: string;
  Departamento: string;
  confirmacion: number;
  reservadopedido: number;
  UPCProducto: string;
  UnidadesFardo: number;
  Observaciones: string;
  Proveedor: string;
  Variedad: string;
  MalEstado: number;
  Categoria: string;
}

const API_URL = import.meta.env.VITE_URL_BACKEND;

export default function DetallePedido() {
  const { idPedido } = useParams<{ idPedido: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [detallesPedido, setDetallesPedido] = useState<DetallePedido[]>([]);
  const [detallesFiltrados, setDetallesFiltrados] = useState<DetallePedido[]>([]);

  const [filtroUPC, setFiltroUPC] = useState("");
  const [filtroDescripcion, setFiltroDescripcion] = useState("");
  const { sucursal, estado, departamento, fardos, ubicacion, ubicacionOriginal } = location.state || {};
  const [filtroUPCUnidad, setFiltroUPCUnidad] = useState("");

  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printData, setPrintData] = useState<DetallePedido[]>([]);

  // Función para preparar datos para impresión
  const preparePrintData = () => {
    setPrintData(detallesFiltrados);
    setShowPrintModal(true);
  };
  
  // Función para imprimir
  const handlePrint = () => {
  };

  useEffect(() => {
    if (!sucursal || !estado) {
      navigate("/ver-pedidos", { replace: true });
      return;
    }

    const fetchDetallesPedido = async () => {
      try {
        showLoading("Cargando detalles del pedido...");

        const response = await fetch(`${API_URL}/allorders/detalles/${idPedido}`);
        if (!response.ok) {
          throw new Error(`Error HTTP: ${response.status}`);
        }

        const data = await response.json();
        const detalles = Array.isArray(data.detalles) ? data.detalles : [];

        const detallesProcesados: DetallePedido[] = [];

        detalles.forEach((detalle: DetallePedido) => {
          const variedad = detalle.Variedad?.trim();

          if (variedad) {
            // Separar por coma, luego por ":"
            const partes = variedad.split(",").map((v) => v.trim());
            partes.forEach((item) => {
              const [color, cantidadStr] = item.split(":").map((v) => v.trim());
              const cantidad = parseInt(cantidadStr);
              if (color && !isNaN(cantidad)) {
                detallesProcesados.push({
                  ...detalle,
                  descripcion: `${detalle.descripcion} (${color})`,
                  cantidad,
                });
              }
            });
          } else {
            detallesProcesados.push(detalle);
          }
        });

        setDetallesPedido(detallesProcesados);
setDetallesFiltrados(detallesProcesados);

      } catch (error) {
        showError("Error", "No se pudieron cargar los detalles.");
      } finally {
        hideLoading();
      }
    };
    fetchDetallesPedido();
  }, [idPedido, sucursal, estado, navigate]);

  useEffect(() => {
    const filtrar = () => {
      let resultado = [...detallesPedido];

      if (filtroUPC.trim() !== "") {
        resultado = resultado.filter(item =>
          item.upc.toLowerCase().includes(filtroUPC.toLowerCase())
        );
      }

      if (filtroDescripcion.trim() !== "") {
        resultado = resultado.filter(item =>
          item.descripcion.toLowerCase().includes(filtroDescripcion.toLowerCase())
        );
      }

      if (filtroUPCUnidad.trim() !== "") {
        resultado = resultado.filter(item =>
          item.UPCProducto.toLowerCase().includes(filtroUPCUnidad.toLowerCase())
        );
      }

      setDetallesFiltrados(resultado);
    };

    filtrar();
  }, [filtroUPC, filtroDescripcion, filtroUPCUnidad, detallesPedido]);

  const limpiarFiltros = () => {
    setFiltroUPC("");
    setFiltroDescripcion("");
    setFiltroUPCUnidad("");
  };
  
  const handleExportarExcel = () => {
    const columnas = {
      upc: "UPC Fardo",
      UPCProducto: "UPC Unidad",
      descripcion: "Descripción",
      cantidad: "Cantidad",
      UnidadesFardo: "Unidades Fardo",
      existencia: "Existencia U",
      existenciafardos: "Existencia F",
      Observaciones: "Observación"
    };
  
    exportToExcel(`detalle_pedido_${idPedido}`, "DetallePedido", detallesFiltrados, columnas);
  };

  return (
    <div className="w-full max-w-1xl mx-auto bg-white rounded-lg shadow-md p-0">
      <div className="p-4 rounded-lg border border-gray-600 mb-5">
        <h2 className="text-xl font-semibold text-black">Detalle del Pedido - {idPedido || "N/A"}-</h2>
        <div className="flex flex-wrap items-center justify-between">
          <h2 className="font-semibold text-black">Sucursal: {sucursal}</h2>
          <h2 className="font-semibold text-black">Estado: {estado}</h2>
          <h2 className="font-semibold text-black">Departamento: {departamento || "No especificado"}</h2>
          <h2 className="font-semibold text-black">Cantidad: {fardos}</h2>
          <div className="flex space-x-2">
            <button 
              className="bg-blue-600 text-white px-3 py-2 rounded-lg"
              onClick={() => navigate("/ver-pedidos", { state: { savedFilters: location.state?.currentFilters } })}
            >
              Regresar
            </button>
            <button
              className="bg-green-700 text-white px-3 py-2 rounded-lg"
              onClick={preparePrintData}>
              Imprimir
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4 mb-4">
        {/* Filtro por UPC */}
        <div className="flex flex-col">
          <label className="text-xs md:text-sm font-medium text-gray-700">Filtrar por UPCFardo</label>
          <input
            type="text"
            placeholder="UPC del Fardo"
            value={filtroUPC}
            onChange={(e) => setFiltroUPC(e.target.value)}
            className="mt-1 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black w-72"
          />
        </div>

        {/* Filtro por UPCUnidad */}
        <div className="flex flex-col">
          <label className="text-xs md:text-sm font-medium text-gray-700">Filtrar por UPCUnidad</label>
          <input
            type="text"
            placeholder="UPC de Unidad"
            value={filtroUPCUnidad}
            onChange={(e) => setFiltroUPCUnidad(e.target.value)}
            className="mt-1 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black w-72"
          />
        </div>

        {/* Filtro por Descripción */}
        <div className="flex flex-col">
          <label className="text-xs md:text-sm font-medium text-gray-700">Filtrar por Descripción</label>
          <input
            type="text"
            placeholder="Descripción del Producto"
            value={filtroDescripcion}
            onChange={(e) => setFiltroDescripcion(e.target.value)}
            className="mt-1 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black w-72"
          />
        </div>
        <button
            onClick={handleExportarExcel}
            className="mt-1 p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none"
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

      <div className="border border-gray-300 rounded-lg overflow-hidden">
        <TableComponent
          data={detallesFiltrados}
          columns={[
            { key: "upc", label: "UPCFardo", sortable: true, editable: true },
            { key: "UPCProducto", label: "UPCUnidad", sortable: true, editable: true },
            { key: "descripcion", label: "Descripción", sortable: true, editable: true },
            { key: "cantidad", label: "Cantidad", sortable: true, editable: true },
            { key: "UnidadesFardo", label: "Unidades Fardo", sortable: true, editable: true },
            { key: "existencia", label: "ExistenciaU", sortable: true, editable: true },
            {
              key: "existenciafardos",
              label: "ExistenciaF",
              editable: true,
              sortable: true,
              render: (item) => {
                return <span>{Math.floor(item.existenciafardos)}</span>;
              }
            },
            { key: "Ubicacion", label: "Ubicacion", sortable: true, editable: true },
          ]}
          enableSorting={true}
          multiSelect={false}
          enablePagination={true}
          rowsPerPage={1000}
          maxHeight="calc(100vh - 280px)"
        />
      </div>

      {/* Usar el componente ModalImpresion */}
      <ModalImpresion
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        printData={printData}
        idPedido={idPedido || ""}
        sucursal={sucursal || ""}
        estado={estado || ""}
        departamento={departamento}
        fardos={fardos}
        ubicacion={ubicacion} 
        ubicacionOriginal={ubicacionOriginal}
        onPrint={handlePrint}
      />
    </div>
  );
}