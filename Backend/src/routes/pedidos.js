import express from "express";
import * as orderService from "../services/orderService.js";

const router = express.Router();

router.get("/", async (req, res) => {
  const pedidos = await orderService.getPedidos();
  res.json(pedidos);
});

router.get("/pedidos-no-actualizados/:idUbicacion", async (req, res) => {
  try {
    const idUbicacion = parseInt(req.params.idUbicacion);

    if (isNaN(idUbicacion)) {
      return res.status(400).json({ 
        success: false, 
        message: "Ubicación inválida. Debe ser un número." 
      });
    }

    const resultado = await orderService.sincronizarPedidosYDetalles(idUbicacion);

    res.json(resultado);
  } catch (error) {
    console.error("Error en endpoint pedidos-no-actualizados:", error);
    
    // Identificar tipos específicos de errores para mensajes más útiles
    let statusCode = 500;
    let errorMessage = error.message;
    
    if (errorMessage.includes("Ubicación no válida")) {
      statusCode = 400;
    } else if (errorMessage.includes("conexión") || errorMessage.includes("connection")) {
      errorMessage = "Error de conexión con la base de datos. Intente nuevamente más tarde.";
    }
    
    res.status(statusCode).json({ 
      success: false, 
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

router.put("/actualizar-estado", async (req, res) => {
  try {
    const { idPedido } = req.body;

    if (!idPedido) {
      return res.status(400).json({ success: false, message: "Datos incompletos" });
    }

    const resultado = await orderService.actualizarEstadoPedido(idPedido);

    if (!resultado.success) {
      return res.status(400).json(resultado);
    }

    res.json({ success: true, message: "Pedido actualizado correctamente." });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/detalles/:idPedido", async (req, res) => {
  try {
    const idPedido = parseInt(req.params.idPedido, 10);

    if (isNaN(idPedido)) {
      return res.status(400).json({ success: false, message: "ID de pedido inválido" });
    }

    const detalles = await orderService.obtenerDetallesPedido(idPedido);
    res.json({ success: true, detalles });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/buscar-producto", async (req, res) => {
  try {
    const { upc, descripcion } = req.query;
 
    if (!upc && !descripcion) {
      return res.status(400).json({ success: false, message: "Debe ingresar un UPC o una descripción." });
    }
 
    const productos = await orderService.buscarProducto(upc, descripcion);
 
    if (productos.length > 0) {
      return res.json({ success: true, productos });
    } else {
      return res.status(404).json({ success: false, message: "No se encontraron productos para la búsqueda." });
    }
  } catch (error) {
    console.error("Error al buscar producto:", error.message);
    res.status(500).json({ success: false, message: "Error interno del servidor." });
  }
});

router.post("/buscar-reemplazo", async (req, res) => {
  try {
    const { descripcion, cantidadSolicitada } = req.body;

    if (!descripcion) {
      return res.status(400).json({ success: false, message: "Debe proporcionar una descripción." });
    }

    const resultado = await orderService.buscarProductosReemplazo(descripcion, cantidadSolicitada);

    if (resultado.success) {
      return res.json({ success: true, productos: resultado.productos });
    } else {
      return res.status(404).json({ success: false, message: resultado.message });
    }
  } catch (error) {
    console.error("Error en la búsqueda de reemplazos:", error);
    res.status(500).json({ success: false, message: "Error interno del servidor." });
  }
});

router.post("/agregar-detalle", async (req, res) => {
  try {
    const {
      idPedido,
      upc,                    // UPCUnidad (clave principal)
      descripcion,
      existencia,
      existenciaFardos,
      idDepartamento,
      idUbicacionBodega,
      cantidad,
      upcproducto,           // UPC del producto original (puede ser igual al upc)
      unidadesfardo,
      esReemplazo
    } = req.body;

    // Validar campos obligatorios
    if (
      !idPedido || !upc || !descripcion ||
      existencia === undefined || existenciaFardos === undefined ||
      !idDepartamento || cantidad === undefined ||
      !upcproducto || unidadesfardo === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: "Datos incompletos para agregar el producto."
      });
    }

    // Valores por defecto seguros
    const ubicacionBodega = idUbicacionBodega ?? 0;
    const unidadesFardoFinal = unidadesfardo || 1;
    const esReemplazoFinal = esReemplazo || false;

    // Insertar usando el servicio
    const resultado = await orderService.agregarProductoDetalle(
      idPedido,
      upc,
      descripcion,
      existencia,
      existenciaFardos,
      idDepartamento,
      ubicacionBodega,
      cantidad,
      upcproducto,
      unidadesFardoFinal,
      esReemplazoFinal
    );

    if (resultado.success) {
      return res.json({ success: true, message: resultado.message });
    } else {
      return res.status(400).json({ success: false, message: resultado.message });
    }
  } catch (error) {
    console.error("❌ Error al agregar el producto:", error);
    res.status(500).json({ success: false, message: "Error interno del servidor." });
  }
});


router.put("/actualizar-cantidad", async (req, res) => {
  try {
    const { idPedido, upc, cantidad } = req.body;

    if (!upc || !idPedido || cantidad === undefined) {
      return res.status(400).json({ 
        success: false, 
        message: "Datos incompletos. Se requiere UPC, ID de Pedido y cantidad." 
      });
    }

    const resultado = await orderService.actualizarCantidadProducto(upc, idPedido, cantidad);

    if (resultado.success) {
      return res.json({ success: true, message: resultado.message });
    } else {
      return res.status(404).json({ success: false, message: resultado.message });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: "Error al actualizar la cantidad del producto", 
      error: error.message 
    });
  }
});

router.delete("/eliminar-detalle", async (req, res) => {
  try {
    const { upc, idDetalle, idPedido, esReemplazo } = req.body;

    if (!upc || !idPedido) {
      return res.status(400).json({ success: false, message: "Datos incompletos. Se requiere UPC y ID de Pedido." });
    }

    const resultado = await orderService.eliminarProductoDetalle(upc, idDetalle, idPedido, esReemplazo);

    if (resultado.success) {
      return res.json({ success: true, message: resultado.message });
    } else {
      return res.status(404).json({ success: false, message: resultado.message });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: "Error al eliminar el producto", error: error.message });
  }
});

router.put("/actualizar-fardos", async (req, res) => {
  try {
    const { idPedido, nuevaCantidad } = req.body;

    if (!idPedido || nuevaCantidad === undefined) {
      return res.status(400).json({ 
        success: false, 
        message: "Datos incompletos. Se requiere IdPedido y NuevaCantidad." 
      });
    }

    const resultado = await orderService.actualizarCantidadFardos(idPedido, nuevaCantidad);

    if (resultado.success) {
      return res.json({ success: true, message: resultado.message });
    } else {
      return res.status(404).json({ success: false, message: resultado.message });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: "Error al actualizar la cantidad de fardos", 
      error: error.message 
    });
  }
});

router.put("/actualizar-observacion", async (req, res) => {
  try {
    const { idPedido, upc, observacion } = req.body;

    if (!idPedido || !upc || observacion === undefined) {
      return res.status(400).json({ 
        success: false, 
        message: "Datos incompletos. Se requiere IdPedido, UPC y Observación." 
      });
    }

    const resultado = await orderService.actualizarObservacion(idPedido, upc, observacion);

    if (resultado.success) {
      return res.json({ success: true, message: resultado.message });
    } else {
      return res.status(404).json({ success: false, message: resultado.message });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: "Error al actualizar la observación del producto", 
      error: error.message 
    });
  }
});

router.put("/confirmar-pedido", async (req, res) => {
  try {
    const { idPedido } = req.body;

    if (!idPedido) {
      return res.status(400).json({ success: false, message: "Debe proporcionar un ID de pedido." });
    }

    const resultado = await orderService.confirmarPedido(idPedido);

    if (resultado.success) {
      return res.json({ success: true, message: resultado.message });
    } else {
      return res.status(400).json(resultado);
    }
  } catch (error) {
    console.error("Error al confirmar el pedido:", error.message);
    res.status(500).json({ success: false, message: "Error interno del servidor." });
  }
});

router.put("/actualizar-reservados", async (req, res) => {
  try {
    const { upcsPaquete } = req.body;

    if (!Array.isArray(upcsPaquete) || upcsPaquete.length === 0) {
      console.error("No hay UPCPaquete válidos para actualizar.");
      return res.status(400).json({
        success: false,
        message: "El listado de upcsPaquete está vacío o no es válido.",
      });
    }

    const resultado = await orderService.actualizarReservados(upcsPaquete);

    if (resultado.success) {
      res.json({
        success: true,
        message: "Existencias reservadas actualizadas correctamente",
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Error al actualizar existencias reservadas",
      });
    }
  } catch (error) {
    console.error("Error al actualizar reservados:", error);
    res.status(500).json({
      success: false,
      message: "Error interno al actualizar existencias reservadas",
    });
  }
});

router.post("/validar-estados", async (req, res) => {
  try {
    const { pedidos } = req.body;

    if (!Array.isArray(pedidos) || pedidos.length === 0) {
      return res.status(400).json({ success: false, message: "No hay pedidos válidos para validar." });
    }

    const resultado = await orderService.validarPedidos(pedidos);

    if (!resultado.valid) {
      return res.status(400).json({ success: false, message: resultado.message });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error en validación de estados:", error.message);
    res.status(500).json({ success: false, message: "Error interno al validar los pedidos." });
  }
});

router.post("/consolidar", async (req, res) => {
  try {
    const { pedidos } = req.body;

    if (!pedidos || pedidos.length === 0) {
      return res.status(400).json({ success: false, message: "No hay pedidos seleccionados." });
    }

    const resultado = await orderService.consolidarPedidos(pedidos);

    if (!resultado.success) {
      return res.status(400).json(resultado);
    }

    res.json(resultado);
  } catch (error) {
    console.error("Error en consolidación:", error.message);
    res.status(500).json({ success: false, message: "Error interno del servidor." });
  }
});

router.put("/actualizar-departamento", async (req, res) => {
  try {
    const { idPedido, departamento } = req.body;

    if (!idPedido || !departamento) {
      return res.status(400).json({ success: false, message: "Datos incompletos." });
    }

    const resultado = await orderService.actualizarDepartamento(idPedido, departamento);

    if (!resultado) {
      return res.status(400).json({ success: false, message: "No se pudo actualizar el departamento." });
    }

    res.json({ success: true, message: "Departamento actualizado correctamente." });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error interno del servidor." });
  }
});

router.put("/anular", async (req, res) => {
  try {
    const { idPedido } = req.body;

    if (!idPedido) {
      return res.status(400).json({ success: false, message: "ID de pedido requerido." });
    }

    const actualizado = await orderService.anularPedido(idPedido);

    if (!actualizado) {
      return res.status(400).json({ success: false, message: "No se pudo anular el pedido." });
    }

    res.json({ success: true, message: "Pedido anulado correctamente." });
  } catch (error) {
    console.error("Error anulando pedido:", error.message);
    res.status(500).json({ success: false, message: "Error interno del servidor." });
  }
});


router.put("/actualizar-sucursal", async (req, res) => {
  try {
    const { idPedido, sucursal } = req.body;

    if (!idPedido || sucursal === undefined) {
      return res.status(400).json({ 
        success: false, 
        message: "Datos incompletos. Se requiere IdPedido y Sucursal." 
      });
    }

    const resultado = await orderService.actualizarSucursal(idPedido, sucursal);

    if (resultado.success) {
      return res.json({ success: true, message: resultado.message });
    } else {
      return res.status(404).json({ success: false, message: resultado.message });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: "Error al actualizar la sucursal del pedido", 
      error: error.message 
    });
  }
});

router.get("/actualizar-existencias/:idPedido", async (req, res) => {
  try {
    const idPedido = parseInt(req.params.idPedido);
    
    if (isNaN(idPedido)) {
      return res.status(400).json({ 
        success: false, 
        message: "ID de pedido inválido" 
      });
    }
    
    // Llamamos al servicio que actualizará las existencias
    const resultado = await orderService.actualizarExistencias(idPedido);
    
    res.json(resultado);
  } catch (error) {
    console.error("Error al actualizar existencias:", error);
    res.status(500).json({ 
      success: false, 
      message: `Error al actualizar existencias: ${error.message}` 
    });
  }
});

router.put("/actualizar-variedad", async (req, res) => {
  try {
    const { idPedido, upcProducto, variedad } = req.body;

    if (!idPedido || !upcProducto || !variedad) {
      return res.status(400).json({
        success: false,
        message: "Faltan datos: idPedido, upcProducto o variedad.",
      });
    }

    const resultado = await orderService.actualizarVariedad(idPedido, upcProducto, variedad);
    res.json(resultado);

  } catch (error) {
    console.error("Error en /actualizar-variedad:", error.message);
    res.status(500).json({
      success: false,
      message: `Error interno: ${error.message}`,
    });
  }
});

router.get("/obtener-variedad/:idPedido/:upcProducto", async (req, res) => {
  const { idPedido, upcProducto } = req.params;

  try {
    const resultado = await orderService.obtenerVariedad(idPedido, upcProducto);
    res.json(resultado);
  } catch (error) {
    console.error("Error al obtener variedad:", error.message);
    res.status(500).json({
      success: false,
      message: "Error interno al obtener variedad",
    });
  }
});



export default router;