import express from "express";
import * as progressService from "../services/progressService.js";

const router = express.Router();

// Ruta para obtener el progreso de los pedidos
router.get("/", async (req, res) => {
  try {
    const data = await progressService.getProgressData();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;