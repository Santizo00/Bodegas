import express from "express";
import { getCronogramOrders } from "../services/cronogramService.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const dia = req.query.dia;
    const data = await getCronogramOrders(dia);
    res.status(200).json(data);
  } catch (error) {
    console.error("Error al obtener cronograma de pedidos:", error.message);
    res.status(500).json({ message: "Error al obtener cronograma de pedidos" });
  }
});

export default router;