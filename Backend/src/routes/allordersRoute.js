import express from "express";
import * as allOrders from "../services/allordersService.js";

const router = express.Router();


router.get("/", async (req, res) => {
  const pedidos = await allOrders.getPedidos();
  res.json(pedidos);
});

router.get("/detalles/:idPedido", async (req, res) => {
  try {
    const idPedido = parseInt(req.params.idPedido, 10);

    if (isNaN(idPedido)) {
      return res.status(400).json({ success: false, message: "ID de pedido inválido" });
    }

    const detalles = await allOrders.obtenerDetallesPedido(idPedido);
    res.json({ success: true, detalles });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/actualizar-informacion/:idPedido", async (req, res) => {
  try {
    const idPedido = parseInt(req.params.idPedido);
    
    if (isNaN(idPedido)) {
      return res.status(400).json({ 
        success: false, 
        message: "ID de pedido inválido" 
      });
    }
    
    // Llamamos al servicio que actualizará las existencias
    const resultado = await allOrders.actualizarInformacion(idPedido);
    
    res.json(resultado);
  } catch (error) {
    console.error("Error al actualizar existencias:", error);
    res.status(500).json({ 
      success: false, 
      message: `Error al actualizar existencias: ${error.message}` 
    });
  }
});

router.put("/actualizar-estado", async (req, res) => {
  try {
    const { idPedido } = req.body;

    if (!idPedido) {
      return res.status(400).json({ success: false, message: "Datos incompletos" });
    }

    const resultado = await allOrders.actualizarEstadoPedido(idPedido);

    if (!resultado.success) {
      return res.status(400).json(resultado);
    }

    res.json({ success: true, message: "Pedido actualizado correctamente." });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
