import express from "express";
import GeneralService from "../services/generalService.js";

const router = express.Router();

router.get("/sucursal-por-ip", async (req, res) => {
  try {
    const sucursal = await GeneralService.obtenerSucursalPorIP();
    res.json({ success: true, sucursal });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
