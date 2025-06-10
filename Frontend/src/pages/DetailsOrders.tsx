import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { showLoading, hideLoading } from "../services/loadingService";
import { showError, showSuccess, showAlert, showConfirm , showConfirmWithQuantity , showConfirmWithHTML } from "../services/alertService";
import Swal from "sweetalert2";
import TableComponent from "../components/Table";
import { Repeat2 , Trash2, Plus, CirclePlus } from "lucide-react";
import ProductoModal from "../components/ProductModal";
import { exportToExcel } from "../services/exportToExcel";
import VariedadModal from "../components/VariedadModal";

interface DetallePedido {
  id: number;
  idpedidos: number;
  upc: string;
  descripcion: string;
  cantidad: number;
  existencia: number;
  existenciafardos: number;
  iddepartamentos: number;
  idubicacionbodega: number;
  Departamento: string;
  reservadopedido: number;
  UPCPaquete: string;
  UnidadesFardo: number;
  ObservacionProducto: string;
  Faltante: number;
}

interface Producto {
  upc: string;
  descripcion: string;
  iddepartamentos: number;
  idubicacionbodega: number;
  existencia: number;
  reservadopedido: number;
  upcpaquete?: string;
  unidadesFardo?: number;
  existenciafardos?: number;
}

const API_URL = import.meta.env.VITE_URL_BACKEND;

export default function DetallePedido() {
  const { idPedido } = useParams<{ idPedido: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [detallesPedido, setDetallesPedido] = useState<DetallePedido[]>([]);
  const [detallesFiltrados, setDetallesFiltrados] = useState<DetallePedido[]>([]);
  const [productoSeleccionado, setProductoSeleccionado] = useState<DetallePedido | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isModalAgregarOpen, setIsModalAgregarOpen] = useState(false);
  const [productosBusqueda, setProductosBusqueda] = useState<any[]>([]);
  const [productosReemplazo, setProductosReemplazo] = useState([]);
  const [showUPC, setShowUPC] = useState(false);
  const [, ] = useState("");
  const [showExportDropdown, setShowExportDropdown] = useState(false);

  // Para la primera tabla (filtrado en tiempo real)
  const [filtroUPC, setFiltroUPC] = useState("");
  const [filtroDescripcion, setFiltroDescripcion] = useState("");
  
  const [filtroUPCUnidad, setFiltroUPCUnidad] = useState("");
  const [filtroFaltante, setFiltroFaltante] = useState<string>("");
  
  // Para el modal de búsqueda (segunda tabla)
  const [modalUpcValue, setModalUpcValue] = useState("");
  const [modalDescripcionValue, setModalDescripcionValue] = useState("");
  
  // Para edición de cantidad
  const [, setCantidadOriginal] = useState<number | null>(null);
  const [, setProductoEditando] = useState<DetallePedido | null>(null);

  const [modalVariedadOpen, setModalVariedadOpen] = useState(false);
  const [productoSeleccionadoVariedad, setProductoSeleccionadoVariedad] = useState<{ idPedido: Number, upc: string, descripcion: string } | null>(null);

  
  const { sucursal, estado, departamento , ObservacionPedido, ubicacion} = location.state || {}; 
  const totalFardos = detallesFiltrados.reduce((sum, item) => sum + item.cantidad, 0);
  const totalSKUs = detallesFiltrados.length;
  const [, setEstado] = useState("");

  useEffect(() => {
    if (!sucursal || !estado) {
      navigate("/sincronizar-pedidos", { replace: true });
      return;
    }
    fetchDetallesPedido();
  }, [idPedido, sucursal, estado, navigate]);
  
  const fetchDetallesPedido = async () => {
    try {
      showLoading("Cargando detalles del pedido...");

      const response = await fetch(`${API_URL}/pedidos/detalles/${idPedido}`);
      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }

      const data = await response.json();

      if (!data || !Array.isArray(data.detalles)) {
        throw new Error("Formato de respuesta inesperado");
      }

      const detallesConUnidades = data.detalles.map((detalle: DetallePedido) => ({
        ...detalle,
        cantidad: Number(detalle.cantidad),
        existencia: Number(detalle.existencia),
        existenciafardos: Number(detalle.existenciafardos),
        UnidadesFardo: Number(detalle.UnidadesFardo) || 0,
        UPCPaquete: detalle.UPCPaquete ?? "",
      }));

      setDetallesPedido(detallesConUnidades);
      setDetallesFiltrados(detallesConUnidades);
    } catch (error) {
      console.error("Error al cargar los detalles del pedido:", error);
      showError("Error", "No se pudieron cargar los detalles.");
    } finally {
      hideLoading();
    }
  };

  useEffect(() => {
    const filtrar = () => {
      let resultado = [...detallesPedido];
  
      if (filtroUPC.trim() !== "") {
        resultado = resultado.filter(item =>
          item.upc.toLowerCase().includes(filtroUPC.toLowerCase())
        );
      }
  
      if (filtroUPCUnidad.trim() !== "") {
        resultado = resultado.filter(item =>
          (item.UPCPaquete || "").toLowerCase().includes(filtroUPCUnidad.toLowerCase())
        );
      }
  
      if (filtroDescripcion.trim() !== "") {
        resultado = resultado.filter(item =>
          item.descripcion.toLowerCase().includes(filtroDescripcion.toLowerCase())
        );
      }
  
      // Nuevo filtro por Faltante
      if (filtroFaltante !== "") {
        const valor = filtroFaltante === "inexistente" ? 0 : 1;
        resultado = resultado.filter(item => item.Faltante === valor);
      }
  
      setDetallesFiltrados(resultado);
    };
  
    filtrar();
  }, [filtroUPC, filtroUPCUnidad, filtroDescripcion, filtroFaltante, detallesPedido]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.relative')) {
        setShowExportDropdown(false);
      }
    };
  
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  const limpiarFiltros = () => {
    setFiltroUPC("");
    setFiltroDescripcion("");
    setFiltroUPCUnidad("");
    setFiltroFaltante("");
  };

  const actualizarCantidadFardo = async (idPedido: number, detallesActualizados: DetallePedido[]) => {
    try {
      const totalFardosActualizado = detallesActualizados.reduce((sum, item) => sum + item.cantidad, 0);
  
      const response = await fetch(`${API_URL}/pedidos/actualizar-fardos`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idPedido, nuevaCantidad: totalFardosActualizado }),
      });
  
      if (!response.ok) {
        throw new Error(`Error al actualizar: ${response.status}`);
      }
  
      const data = await response.json();
  
      if (!data.success) {
        throw new Error(data.message || "No se pudo actualizar la cantidad de fardos.");
      }
    } catch (error) {
      showError("Error", `No se pudo actualizar la cantidad de fardos: ${error}`);
    }
  };
  
  const cerrarModal = () => {
    setIsModalOpen(false);
    setProductoSeleccionado(null);
    setModalUpcValue("");
    setModalDescripcionValue("");
  };
  
  const buscarRemplazo = async (item: DetallePedido) => {
    try {
      showLoading("Buscando productos de reemplazo...");
  
      const response = await fetch(`${API_URL}/pedidos/buscar-reemplazo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          descripcion: item.descripcion,
          cantidadSolicitada: item.cantidad,
        }),
      });
  
      const data = await response.json();
  
      if (!data.success || data.productos.length === 0) {
        showError("Sin resultados", "No se encontraron productos con suficiente existencia.");
        return;
      }
  
      const productosFormateados = data.productos.map((producto: Producto) => ({
        ...producto,
        existencia: Number(producto.existencia).toFixed(2),
        existenciafardos: Number(producto.existenciafardos), 
        reservadopedido: Number(producto.reservadopedido),
        cantidad: Number(producto.unidadesFardo), 
      }));
  
      setProductosReemplazo(productosFormateados);
      setProductoSeleccionado(item);
      setIsModalOpen(true);
    } catch (error) {
      showError("Error", "No se pudo obtener los productos de reemplazo.");
    } finally {
      hideLoading();
    }
  };
  
  const seleccionarProductoReemplazo = async (productoB: DetallePedido) => {
    if (!productoSeleccionado) return;
  
    try {
      const upcUnidad = productoB.UPCPaquete?.toString().padStart(13, "0");
      if (!upcUnidad) {
        showError("Error", "El producto seleccionado no tiene UPCUnidad válido.");
        return;
      }
  
      const esMismoProducto = productoSeleccionado.upc === upcUnidad;
  
      if (esMismoProducto) {
        showAlert({
          type: "info",
          title: "Mismo producto",
          text: "Has seleccionado el mismo producto. No se realizará ningún cambio."
        });
        cerrarModal();
        return;
      }
  
      const productoExistente = detallesPedido.find(detalle =>
        detalle.upc === upcUnidad &&
        detalle.descripcion === productoB.descripcion &&
        detalle.upc !== productoSeleccionado.upc
      );
  
      if (productoExistente) {
        const nuevaCantidad = productoExistente.cantidad + productoSeleccionado.cantidad;
  
        showConfirmWithHTML(
          "Producto Existente",
          `
            <div style="text-align: left;">
              <p>El producto <b>${productoB.descripcion}</b> ya está en el detalle del pedido.</p>
              <p><b>Cantidad actual:</b> ${productoExistente.cantidad}</p>
              <p><b>Nueva cantidad (SI SUMAR):</b> ${nuevaCantidad}</p>
              <p><b>Nueva cantidad (NO SUMAR):</b> ${productoSeleccionado.cantidad}</p>
              <p>¿Desea sumar la cantidad del producto a reemplazar a la existente?</p>
            </div>
          `,
          "Sí, sumar cantidad",
          async () => {
            showLoading("Procesando reemplazo...");
            await actualizarCantidad(upcUnidad, nuevaCantidad);
            await eliminarProductoDetalle(productoSeleccionado, true);
            const response = await fetch(`${API_URL}/pedidos/detalles/${productoSeleccionado.idpedidos}`);
            const data = await response.json();
            setDetallesPedido(data.detalles);
            setDetallesFiltrados(data.detalles);
            hideLoading();
            cerrarModal();
          },
          async () => {
            showLoading("Procesando reemplazo...");
            await actualizarCantidad(upcUnidad, productoSeleccionado.cantidad);
            await eliminarProductoDetalle(productoSeleccionado, true);
            const response = await fetch(`${API_URL}/pedidos/detalles/${productoSeleccionado.idpedidos}`);
            const data = await response.json();
            setDetallesPedido(data.detalles);
            setDetallesFiltrados(data.detalles);
            hideLoading();
            cerrarModal();
          }
        );
        return;
      }
  
      const resultado = await Swal.fire({
        title: "Confirmación de reemplazo",
        html: `
          <div class="text-left">
            <p class="font-bold mb-2">Producto actual:</p>
            <p>UPC: ${productoSeleccionado.upc}</p>
            <p>Descripción: ${productoSeleccionado.descripcion}</p>
            <p>Cantidad: ${productoSeleccionado.cantidad}</p>
            <hr class="my-3">
            <p class="font-bold mb-2">Producto de reemplazo:</p>
            <p>UPC: ${upcUnidad}</p>
            <p>Descripción: ${productoB.descripcion}</p>
            <p>Existencia: ${productoB.existenciafardos}</p>
          </div>
        `,
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Confirmar reemplazo",
        cancelButtonText: "Cancelar",
        confirmButtonColor: "#6487f4",
        cancelButtonColor: "#f24c4c"
      });
  
      if (resultado.isConfirmed) {
        showLoading("Procesando reemplazo...");
        await agregarProducto(productoB, productoSeleccionado.cantidad, true);
        await eliminarProductoDetalle(productoSeleccionado, true);
        const response = await fetch(`${API_URL}/pedidos/detalles/${productoSeleccionado.idpedidos}`);
        const data = await response.json();
        setDetallesPedido(data.detalles);
        setDetallesFiltrados(data.detalles);
        hideLoading();
        cerrarModal();
      }
    } catch (error) {
      hideLoading();
      console.error("Error completo:", error);
      showError("Error", "No se pudo realizar el reemplazo");
    }
  };
  
  
  const handleBuscarProducto = () => {
    setIsModalAgregarOpen(true);
    setProductosBusqueda([]); 
  };

  const handleBuscar = async (esReemplazo = false) => {
    try {
      if (!modalUpcValue && !modalDescripcionValue) {
        showAlert({
          type: "error",
          title: "Error",
          text: "Por favor, ingrese UPC o descripción para buscar."
        });
        return;
      }
  
      const params = new URLSearchParams();
  
      if (modalUpcValue) {
        const upcNormalizado = modalUpcValue.padStart(13, "0");
        params.append("upc", upcNormalizado);
      }
  
      if (modalDescripcionValue) {
        params.append("descripcion", modalDescripcionValue);
      }
  
      const response = await fetch(`${API_URL}/pedidos/buscar-producto?${params.toString()}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
  
      const data = await response.json();
  
      if (response.status === 404) {
        showAlert({
          type: "info",
          title: "Sin resultados",
          text: data.message
        });
  
        if (esReemplazo) {
          setProductosReemplazo([]);
        } else {
          setProductosBusqueda([]);
        }
        return;
      }
  
      if (!response.ok) {
        throw new Error(data.message || "Error al buscar el producto");
      }
  
      if (data.productos.length > 0) {
        const productosProcesados = data.productos.map((producto: Producto) => ({
          ...producto,
          existencia: Number(producto.existencia).toFixed(2), 
          existenciafardos: Number(producto.existenciafardos),
          reservadopedido: Number(producto.reservadopedido),
          cantidad: Number(producto.unidadesFardo), 
        }));
  
        if (esReemplazo) {
          setProductosReemplazo(productosProcesados);
        } else {
          setProductosBusqueda(productosProcesados);
        }
      }
    } catch (error) {
      showError("Error", "Hubo un error al realizar la búsqueda");
      if (esReemplazo) {
        setProductosReemplazo([]);
      } else {
          setProductosBusqueda([]);
      }
    }
  };

  const seleccionarProductoParaAgregar = async (producto: any) => {
    showConfirmWithQuantity(
      "Agregar Producto",
      `¿Está seguro de agregar el producto? <br> <b>${producto.descripcion}</b> <br>
      <b>Existencia en fardos:</b> ${producto.existenciafardos}`,
      "Cantidad de fardos a agregar",
      async (cantidad) => {
        await agregarProducto(producto, cantidad, false);
        cerrarModalAgregar();
      }
    );
  };  

  const agregarProducto = async (producto: DetallePedido, cantidad: number, esReemplazo: boolean = false) => {
    const idPedidoNumerico = Number(idPedido);
    try {
      const upcUnidad = producto.UPCPaquete?.toString().padStart(13, "0");
      if (!upcUnidad) {
        throw new Error("El producto no tiene UPCUnidad definido.");
      }
  
      const productoExistente = detallesPedido.find(detalle =>
        detalle.upc === upcUnidad &&
        detalle.descripcion === producto.descripcion
      );
  
      if (!esReemplazo && productoExistente) {
        const nuevaCantidad = productoExistente.cantidad + cantidad;
  
        showConfirmWithHTML(
          "Producto Existente",
          `
            <div style="text-align: left;">
              <p>El producto <b>${producto.descripcion}</b> ya está en el detalle del pedido.</p>
              <p><b>Cantidad actual:</b> ${productoExistente.cantidad}</p>
              <p><b>Nueva cantidad (SI SUMAR):</b> ${nuevaCantidad}</p>
              <p><b>Nueva cantidad (NO SUMAR):</b> ${cantidad}</p>
              <p>¿Desea sumar la cantidad ingresada a la existente?</p>
            </div>
          `,
          "Sí, sumar cantidad",
          async () => {
            actualizarCantidad(upcUnidad, nuevaCantidad);
          },
          () => {
            actualizarCantidad(upcUnidad, cantidad);
          }
        );
        return;
      }
  
      const datosEnviados = {
        idPedido: idPedidoNumerico,
        upc: upcUnidad,
        descripcion: producto.descripcion,
        existencia: Number(producto.existencia) || 0,
        existenciaFardos: Number(producto.existenciafardos) || 0,
        idDepartamento: producto.iddepartamentos ?? 1,
        idUbicacionBodega: producto.idubicacionbodega ?? 0,
        cantidad,
        upcproducto: producto.upc ?? upcUnidad,
        unidadesfardo: producto.UnidadesFardo ?? 1,
        esReemplazo
      };
  
      console.log("Datos enviados al servidor:", datosEnviados);
  
      const response = await fetch(`${API_URL}/pedidos/agregar-detalle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(datosEnviados)
      });
  
      const responseText = await response.text();
      console.log(`Respuesta del servidor (${response.status}):`, responseText);
  
      if (!response.ok) {
        throw new Error(`Error al agregar (${response.status}): ${responseText}`);
      }
  
      const data = JSON.parse(responseText);
      if (!data.success) {
        throw new Error(data.message);
      }
      fetchDetallesPedido();
  
      showSuccess("Éxito", esReemplazo ? "Producto reemplazado correctamente" : "Producto agregado correctamente");
  
      const nuevoProducto = {
        ...producto,
        cantidad,
        idpedidos: idPedidoNumerico,
        upc: upcUnidad,
        UPCPaquete: producto.upc,
      };
  
      setDetallesPedido(prevDetalles => {
        const detallesActualizados = [...prevDetalles, nuevoProducto];
        setDetallesFiltrados(detallesActualizados);
        setTimeout(() => {
          actualizarCantidadFardo(idPedidoNumerico, detallesActualizados);
        }, 500);
        return detallesActualizados;
      });
    } catch (error) {
      console.error("Error completo:", error);
      showError("Error", `No se pudo agregar el producto: ${error}`);
    }
  };
  
  
  const actualizarCantidad = async (upc: string, nuevaCantidadNum: number) => {
    const UPC = String(upc);
  
    const producto = {
      upc: UPC,
      idpedidos: Number(idPedido),
      cantidad: nuevaCantidadNum
    };
  
    try {
      showLoading("Actualizando cantidad...");
  
      const response = await fetch(`${API_URL}/pedidos/actualizar-cantidad`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idPedido: producto.idpedidos,
          upc: producto.upc,
          cantidad: nuevaCantidadNum
        })
      });
  
      if (!response.ok) {
        throw new Error(`Error al actualizar: ${response.status}`);
      }
  
      const data = await response.json();
  
      if (data.success) {
        const actualizarDetalles = (detalles: DetallePedido[]) =>
          detalles.map(detalle =>
            detalle.upc === UPC ? { ...detalle, cantidad: nuevaCantidadNum } : detalle
          );
  
        setDetallesPedido(prevDetalles => {
          const detallesActualizados = actualizarDetalles(prevDetalles);
          setDetallesFiltrados(detallesActualizados);
  
          setTimeout(() => {
            actualizarCantidadFardo(producto.idpedidos, detallesActualizados);
          }, 500); 
  
          return detallesActualizados;
        });
  
        hideLoading();
        showSuccess(
          "Actualizado",
          `La cantidad del producto ha sido actualizada correctamente.`
        );
  
        setProductoEditando(null);
        setCantidadOriginal(null);
      } else {
        throw new Error(data.message || "No se pudo actualizar la cantidad del producto.");
      }
    } catch (error) {
      showError("Error", `No se pudo actualizar la cantidad: ${error}`);
    }
  };
  
  const confirmarEliminacion = (item: DetallePedido) => {
    showConfirm(
      "¿Está seguro?",
      `¿Desea eliminar el producto "${item.descripcion} ${item.UPCPaquete}" del detalle del pedido?`,
      () => eliminarProductoDetalle(item, false),
      "Sí, eliminar"
    );
  };
  
  const eliminarProductoDetalle = async (item: DetallePedido, esReemplazo: boolean = false) => {
    const idpedidos = Number(idPedido);
    try {
      showLoading("Eliminando producto...");
  
      const response = await fetch(`${API_URL}/pedidos/eliminar-detalle`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          upc: item.UPCPaquete,
          idDetalle: item.id,  
          idPedido: idpedidos,
          esReemplazo: esReemplazo  
        }),
      });
  
      if (!response.ok) {
        throw new Error(`Error al eliminar: ${response.status}`);
      }
  
      const data = await response.json();
      if (data.success) {
        // CORRECCIÓN: Filtrar por ID en lugar de UPC para la actualización visual
        setDetallesPedido((prevDetalles) => {
          // Filtramos por ID para asegurar que solo eliminamos el producto específico
          const detallesActualizados = prevDetalles.filter(detalle => detalle.id !== item.id);
  
          // Actualizamos también los detalles filtrados
          setDetallesFiltrados(detallesFiltrados.filter(detalle => detalle.id !== item.id));
  
          hideLoading();
          showSuccess("Eliminado", `El producto "${item.descripcion}" ha sido eliminado del pedido.`);
  
          setTimeout(() => {
            actualizarCantidadFardo(idpedidos, detallesActualizados);
          }, 500);
  
          return detallesActualizados;
        });
  
      } else {
        throw new Error(data.message || "No se pudo eliminar el producto.");
      }
    } catch (error) {
      hideLoading();
      showError("Error", `No se pudo eliminar el producto: ${error}`);
    }
  };

  const actualizarObservacion = async (idPedido: number, upc: string, observacion: string) => {
    try {
      showLoading("Actualizando observación...");
  
      const response = await fetch(`${API_URL}/pedidos/actualizar-observacion`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idPedido, upc, observacion }),
      });
  
      if (!response.ok) {
        throw new Error(`Error al actualizar: ${response.status}`);
      }
  
      const data = await response.json();
  
      if (data.success) {
        hideLoading();
      } else {
        throw new Error(data.message || "No se pudo actualizar la observación.");
      }
    } catch (error) {
      showError("Error", `No se pudo actualizar la observación: ${error}`);
    }
  };

  const handleConfirmar = () => {
    showConfirm(
      "Confirmación",
      "¿Desea confirmar el pedido?",
      () => confirmarPedido(),
      "Aceptar"
    );
  };

  const confirmarPedido = async () => {
    showLoading("Confirmando pedido, porfavor espere")
    try {
      const response = await fetch(`${API_URL}/pedidos/confirmar-pedido`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ idPedido }),
      });

      const data = await response.json();

      actualizarExistencia();

      if (!response.ok) {
        throw new Error(data.message || "Error al confirmar el pedido.");
      }

      return data;
    } catch (error) {
      console.error("Error al confirmar el pedido");
    }
  };

  const actualizarExistencia = async () => {
    try {
      const upcsPaquete = detallesPedido
        .filter((detalle) => detalle.UPCPaquete && detalle.UPCPaquete.trim() !== "") 
        .map((detalle) => detalle.UPCPaquete); 
        
      if (upcsPaquete.length === 0) {
        console.warn("⚠ No hay UPCPaquete válidos para actualizar existencias.");
        return;
      }
  
      const response = await fetch(`${API_URL}/pedidos/actualizar-reservados`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upcsPaquete }), 
      });
  
      if (!response.ok) {
        throw new Error("Error al actualizar existencias reservadas.");
      }
      showSuccess("Éxito", "Pedido finalizado correctamente");

      setTimeout(() => {
        
        navigate("/sincronizar-pedidos", { 
          state: { 
            savedFilters: location.state?.currentFilters 
          } 
        });
      }, 1000);
    } catch (error) {
      console.error("Error al actualizar existencias:", error);
      showError("Error", "No se pudo actualizar la existencia.");
    }
  };

  const toggleSearchFields = () => {
    setModalUpcValue("");
    setModalDescripcionValue("");
    setShowUPC(!showUPC);
  };

  const handleAnular = () => {
    showConfirm(
      "ALERTA",
      `¿Desea anular el pedido con ID: ${idPedido}?`,
      async () => {
        try {
          showLoading("Anulando pedido...");

          const response = await fetch(`${API_URL}/pedidos/anular`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idPedido }),
          });

          const data = await response.json();

          if (!response.ok || !data.success) {
            throw new Error(data.message || "No se pudo anular el pedido.");
          }

          showSuccess("Éxito", "El pedido ha sido anulado correctamente.");
          setEstado("Anulado");

          navigate("/sincronizar-pedidos", { 
            state: { 
              savedFilters: location.state?.currentFilters 
            } 
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Error desconocido";
          showError("Error", errorMessage);
        } finally {
          hideLoading();
        }
      },
      "Sí, Anular",
      "error"
    );
  };
  
  const cerrarModalAgregar = () => {
    setIsModalAgregarOpen(false);
    setModalUpcValue("");
    setModalDescripcionValue("");
  };

  const getRowStyle = (row: DetallePedido): React.CSSProperties | string => {
    // Verificar si estamos en una ubicación especial (3 o 5)
    const esUbicacionEspecial = ubicacion === '2' || ubicacion === '3' || ubicacion === '5' || ubicacion === '8'|| ubicacion === 2 || ubicacion === 3 || ubicacion === 5 || ubicacion === 8;
    
    // Usar existencia o existenciafardos según la ubicación
    if (esUbicacionEspecial) {
      if (row.existencia < row.cantidad) {
        return { backgroundColor: "#fc4b4b", color: "#fc4b4b" }; // Rojo - No hay suficiente existencia
      } else if (row.existencia === row.cantidad) {
        return { backgroundColor: "#fab244", color: "#fab244" }; // Amarillo - Existencia justa
      } else {
        return { backgroundColor: "#1cad34", color: "#1cad34" }; // Verde - Existencia suficiente
      }
    } else {
      // Para otras ubicaciones, usar existenciafardos como estaba originalmente
      if (row.existenciafardos < row.cantidad) {
        return { backgroundColor: "#fc4b4b", color: "#fc4b4b" }; // Rojo
      } else if (row.existenciafardos === row.cantidad) {
        return { backgroundColor: "#fab244", color: "#fab244" }; // Amarillo
      } else {
        return { backgroundColor: "#1cad34", color: "#1cad34" }; // Verde
      }
    }
  };

  const getMotivoFaltante = (item: DetallePedido) => {
    const esUbicacionEspecial =
      ubicacion === '2' || ubicacion === '3' || ubicacion === '5' || ubicacion === '8' ||
      ubicacion === 2 || ubicacion === 3 || ubicacion === 5 || ubicacion === 8;
  
    const existencia = esUbicacionEspecial ? item.existencia : item.existenciafardos;
    let faltante = Math.max(0, item.cantidad - existencia);
  
    // Ajuste según tipo de ubicación
    faltante = esUbicacionEspecial
      ? parseFloat(faltante.toFixed(2))     // Máximo 2 decimales
      : Math.floor(faltante);              // Entero
  
    return faltante > 0 ? `Faltante: ${faltante}` : "";
  };
  
  
  const handleExportarExcel = () => {
    const datosParaExportar = detallesFiltrados.map(item => ({
      ...item,
      MotivoFaltante: getMotivoFaltante(item)
    }));
  
    const columnas = {
      upc: "UPC Fardo",
      UPCPaquete: "UPC Unidad",
      descripcion: "Descripción",
      cantidad: "Cantidad",
      UnidadesFardo: "Unidades Fardo",
      existencia: "Existencia U",
      existenciafardos: "Existencia F",
      MotivoFaltante: "Motivo Faltante",
      ObservacionProducto: "Observación"
    };
  
    exportToExcel(`detalle_pedido_${idPedido}`, "DetallePedido", datosParaExportar, columnas);
  };

  const handleExportarFaltantes = () => {
    // Verificar si estamos en una ubicación especial
    const esUbicacionEspecial = ubicacion === '2' || ubicacion === '3' || ubicacion === '5' || ubicacion === '8'|| ubicacion === 2 || ubicacion === 3 || ubicacion === 5 || ubicacion === 8;
    
    // Filtrar productos faltantes y sin existencia
    const productosFaltantes = detallesFiltrados.filter(item => {
      const existenciaValor = esUbicacionEspecial ? item.existencia : item.existenciafardos;
      return item.Faltante === 0 || existenciaValor <= 0 || existenciaValor < item.cantidad;
    }).map(item => ({
      ...item,
      MotivoFaltante: getMotivoFaltante(item)
    }));
    
    const columnas = {
      upc: "UPC Fardo",
      UPCPaquete: "UPC Unidad",
      descripcion: "Descripción",
      cantidad: "Cantidad",
      UnidadesFardo: "Unidades Fardo",
      existencia: "Existencia U",
      existenciafardos: "Existencia F",
      MotivoFaltante: "Motivo Faltante",
      ObservacionProducto: "Observación"
    };
  
    exportToExcel(`faltantes_pedido_${idPedido}`, "ProductosFaltantes", productosFaltantes, columnas);
    setShowExportDropdown(false);
  };

  const abrirModalVariedad = (idPedido: number, upc: string, descripcion: string) => {
    setProductoSeleccionadoVariedad({ idPedido, upc, descripcion });
    setModalVariedadOpen(true);
  };
  
    
  return (
    <div className="w-full max-w-1xl mx-auto bg-white rounded-lg shadow-md p-0">
      <div className="p-3 rounded-lg border border-gray-600 mb-2">
        <h2 className="text-xl font-semibold text-black">Detalle del Pedido - {idPedido || "N/A"} - {sucursal} -</h2>
        <div className="flex flex-wrap items-center justify-between">
          <h2 className="font-semibold text-black">Estado: {estado}</h2>
          <h2 className="font-semibold text-black">Departamento: {departamento || "No especificado"}</h2>
          <h2 className="font-semibold text-black">CantidadTotal: {totalFardos}</h2>
          <h2 className="font-semibold text-black">SKUs: {totalSKUs}</h2>
          <div className="flex space-x-2">
            <button 
              className="bg-blue-600 text-white px-3 py-2 rounded-lg"
              onClick={() => navigate("/sincronizar-pedidos", { state: { savedFilters: location.state?.currentFilters } })}
            >
              Regresar
            </button>
  
            <button className="bg-green-700 text-white px-3 py-2 rounded-lg"
              onClick={handleConfirmar}>
              Finalizar
            </button>
  
            <button className="bg-red-700 text-white px-3 py-2 rounded-lg"
              onClick={handleAnular}>
              Anular
            </button>
          </div>
        </div>
      </div>
  
      <div className="flex justify-between items-center mb-2">
        <div className="flex flex-wrap items-end gap-4">
          {/* Filtro por UPC */}
          <div className="flex flex-col">
            <label className="text-xs md:text-sm font-medium text-gray-700">Filtrar por UPC Fardo</label>
            <input
              style={{ width: '170px' }}
              type="text"
              placeholder="UPC del paquete"
              value={filtroUPC}
              onChange={(e) => setFiltroUPC(e.target.value)}
              className="mt-1 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black w-72"
            />
          </div>

          {/* Filtro por UPC Unidad */}
          <div className="flex flex-col">
            <label className="text-xs md:text-sm font-medium text-gray-700">Filtrar por UPC Unidad</label>
            <input
              style={{ width: '170px' }}
              type="text"
              placeholder="UPC de la unidad"
              value={filtroUPCUnidad}
              onChange={(e) => setFiltroUPCUnidad(e.target.value)}
              className="mt-1 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black w-72"
            />
          </div>

          {/* Filtro por Descripción */}
          <div className="flex flex-col">
            <label className="text-xs md:text-sm font-medium text-gray-700">Filtrar por Descripción</label>
            <input
              style={{ width: '200px' }}
              type="text"
              placeholder="Descripción del Producto"
              value={filtroDescripcion}
              onChange={(e) => setFiltroDescripcion(e.target.value)}
              className="mt-1 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black w-72"
            />
          </div>

          {/* Filtro por Faltante */}
          <div className="flex flex-col">
            <label className="text-xs md:text-sm font-medium text-gray-700">Filtrar por Faltante</label>
            <select
              style={{ width: '180px' }}
              value={filtroFaltante}
              onChange={(e) => setFiltroFaltante(e.target.value)}
              className="mt-1 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black w-56"
            >
              <option value="">Todos</option>
              <option value="inexistente">Inexistentes</option>
              <option value="existente">Existentes</option>
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

          <div className="flex gap-2">
            <button
              onClick={handleBuscarProducto}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
            >
              <Plus className="text-xl" />
              Agregar
            </button>

            
            <div className="relative">
              <button
                className="bg-green-700 text-white px-3 py-2 rounded-lg flex items-center gap-2"
                onClick={() => setShowExportDropdown(!showExportDropdown)}
              >
                Exportar
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {showExportDropdown && (
                <div className="absolute right-0 w-48  rounded-md shadow-lg z-50 border border-gray-200">
                  <ul className="">
                    <li>
                      <button
                        onClick={() => {
                          handleExportarExcel();
                          setShowExportDropdown(false);
                        }}
                        className="block w-full px-4 py-2 hover:bg-green-800 bg-green-700 text-white border border-gray-200"
                      >
                        Exportar Pedido
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => {
                          handleExportarFaltantes();
                          setShowExportDropdown(false);
                        }}
                        className="block w-full px-4 py-2 hover:bg-green-800 bg-green-700 text-white border border-gray-200"
                      >
                        Exportar Faltantes
                      </button>
                    </li>
                  </ul>
                </div>
              )}
            </div>


          </div>
        </div>
      </div>
  
      <div className="border border-gray-300 rounded-lg overflow-hidden">
        <TableComponent
          data={detallesFiltrados}
          columns={[
            { key: "upc", label: "UPCFardo", sortable: true, editable :true },
            { key: "UPCPaquete", label: "UPCUnidad", sortable: true , editable :true},
            {
              key: "descripcion",
              label: "Descripción",
              sortable: true,
              editable: true,
              render: (item) => {
                const contieneVariedad = item.descripcion.toLowerCase().includes("variedad");
            
                return (
                  <div className="flex items-start gap-2">
                    <span className="whitespace-pre-line">{item.descripcion}</span>
                    {contieneVariedad && (
                      <button
                        onClick={() => abrirModalVariedad(item.idpedidos, item.upc, item.descripcion)}
                        className="p-[2px] bg-transparent  rounded-md hover:bg-gray-700 transition"
                        title="Agregar variedad"
                      >
                        <CirclePlus  className="text-black" /> 
                      </button>
                    )}
                  </div>
                );
              },
            },
            {
              key: "cantidad",
              label: "Cantidad",
              sortable: true,
              editable: false,
              onEditComplete: (newValue, item) => {
                const nuevaCantidadNum = Number(newValue);
                const cantidadOriginal = item.cantidad;
                const descripcion = item.descripcion;
                const upc = item.upc;

                if (nuevaCantidadNum == cantidadOriginal){
                }else{
                  if (nuevaCantidadNum <= 0){
                    showAlert({
                      type: "error",
                      title: "Error",
                      text: "Por favor, ingrese una cantidad valida."
                    });
                    return;
                  }else{
                    Swal.fire({
                      title: "Confirmar modificación",
                      html: `
                        <div class="text-left">
                          <p>¿Está seguro que desea modificar la cantidad del producto?</p>
                          <br> 
                          <p><strong>UPC:</strong> ${upc}</p>
                          <p><strong>Descripción:</strong> ${descripcion}</p>
                          <p><strong>Cantidad original:</strong> ${cantidadOriginal}</p>
                          <p><strong>Nueva cantidad:</strong> ${nuevaCantidadNum}</p>
                        </div>
                      `,
                      icon: "warning",
                      showCancelButton: true,
                      confirmButtonText: "Aceptar",
                      cancelButtonText: "Cancelar",
                      confirmButtonColor: "#15803D",
                      cancelButtonColor: "#f24c4c",
                    }).then((result) => {
                      if (result.isConfirmed) {
                        actualizarCantidad(upc, nuevaCantidadNum);
                      }
                    });
                  }

                }
              },
            },
            { key: "UnidadesFardo", label: "Unidades Fardo", sortable: true, editable :true },
            { key: "existencia", label: "ExistenciaU", sortable: true, editable :true },
            {
              key: "existenciafardos",
              label: "ExistenciaF",
              sortable: true,
              render: (item) => {
                return <span>{Math.floor(item.existenciafardos)}</span>;
              }
            },       
            {
              key: "Faltante",
              label: "Faltante",
              sortable: true,
              editable: true,
              compare: (a, b) => {
                const getFaltante = (item: DetallePedido) => {
                  const esUbicacionEspecial =
                    ubicacion === '2' || ubicacion === '3' || ubicacion === '5' || ubicacion === '8' ||
                    ubicacion === 2 || ubicacion === 3 || ubicacion === 5 || ubicacion === 8;
              
                  const existencia = esUbicacionEspecial ? item.existencia : item.existenciafardos;
                  let faltante = Math.max(0, item.cantidad - existencia);
              
                  return esUbicacionEspecial
                    ? parseFloat(faltante.toFixed(2))
                    : Math.floor(faltante);
                };
              
                return getFaltante(a) - getFaltante(b);
              },              
              render: (item) => {
                const esUbicacionEspecial =
                  ubicacion === '2' || ubicacion === '3' || ubicacion === '5' || ubicacion === '8' ||
                  ubicacion === 2 || ubicacion === 3 || ubicacion === 5 || ubicacion === 8;
              
                const existenciaReal = esUbicacionEspecial ? item.existencia : item.existenciafardos;
                let faltante = Math.max(0, item.cantidad - existenciaReal);
              
                faltante = esUbicacionEspecial
                  ? parseFloat(faltante.toFixed(2))
                  : Math.floor(faltante);
              
                return faltante > 0 ? <span>Faltante:.{faltante}</span> : <></>;
              }                          
            },   
            {
              label: "Remplazar",
              sortable: false,
              render: (item) => (
                <div className="flex justify-center space-x-2">
                  <button
                    className="bg-orange-400 text-white p-2 rounded-lg hover:bg-orange-300 transition-colors border border-white"
                    onClick={() => buscarRemplazo(item)}
                  >
                    <Repeat2  className="text-white" /> 
                  </button>
                  <button
                    className="bg-red-400 text-white p-2 rounded-lg hover:bg-red-300 transition-colors border border-white"
                    onClick={() => {
                      confirmarEliminacion(item);
                    }}
                  >
                    <Trash2  className="text-white" />
                  </button>
                </div>
              ),
            },     
            {
              key: "ObservacionProducto",
              label: "Observacion",
              sortable: true,
              editable: false, 
              onEditComplete: (newValue, item) => {
                const nuevaObservacion = newValue.trim(); 
                const upc = item.upc;
                const id = Number(idPedido);
                actualizarObservacion(id, upc, nuevaObservacion);  
              },
            },
          ]}
          enableSorting={true}
          enablePagination={false}
          multiSelect={false}
          maxHeight="calc(100vh - 360px)"
          getRowStyle={getRowStyle}
        />
      </div>

      {productoSeleccionadoVariedad && (
        <VariedadModal
          isOpen={modalVariedadOpen}
          onClose={() => setModalVariedadOpen(false)}
          upc={productoSeleccionadoVariedad.upc}
          descripcion={productoSeleccionadoVariedad.descripcion}
          idPedido={Number(productoSeleccionadoVariedad.idPedido)} 
        />
      )}



      <div className="w-full max-w-1xl mx-auto bg-white rounded-lg shadow-md p-2 ">
        <label className="text-xs md:text-sm font-medium text-gray-700">Observaciones</label>
        <textarea
          className="w-full h-[100px] p-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black resize-none"
          placeholder="Escribe aquí las observaciones..."
          value={ObservacionPedido.replace(/\s{2,}/g, "\n")}
          readOnly 
        />
      </div>

  
      <ProductoModal
        isOpen={isModalOpen}
        onClose={cerrarModal}
        onBuscar={() => handleBuscar(true)} 
        productos={productosReemplazo}
        onSeleccionar={seleccionarProductoReemplazo}
        modo="reemplazo"
        productoSeleccionado={productoSeleccionado}
        showUPC={showUPC}
        toggleSearchFields={toggleSearchFields}
        modalUpcValue={modalUpcValue}
        setModalUpcValue={setModalUpcValue}
        modalDescripcionValue={modalDescripcionValue}
        setModalDescripcionValue={setModalDescripcionValue}
      />

      <ProductoModal
        isOpen={isModalAgregarOpen}
        onClose={cerrarModalAgregar}
        onBuscar={() => handleBuscar(false)}
        productos={productosBusqueda}  
        onSeleccionar={seleccionarProductoParaAgregar}
        modo="agregar"
        showUPC={showUPC}
        toggleSearchFields={toggleSearchFields}
        modalUpcValue={modalUpcValue}
        setModalUpcValue={setModalUpcValue}
        modalDescripcionValue={modalDescripcionValue}
        setModalDescripcionValue={setModalDescripcionValue}
      />
    </div>
  );
}