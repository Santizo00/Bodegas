import express from "express";
import * as Location from "../services/locationService.js";

const router = express.Router();

router.get("/products", async (req, res) => {
  const cambios = await Location.getProducts();
  res.json(cambios);
});

router.get("/ubication", async (req, res) => {
    const cambios = await Location.getUbications();
    res.json(cambios);
});

router.put("/update", async (req, res) => {
    const { IdUbicacion, UPCUnidad } = req.body;

    if (!IdUbicacion || !UPCUnidad) {
        return res.status(400).json({ success: false, message: "Campos requeridos faltantes" });
    }

    try {
        const result = await Location.updateLocation(IdUbicacion, UPCUnidad);
        res.json({ success: true, message: "Ubicación actualizada correctamente", result });
    } catch (error) {
        console.error("Error al actualizar ubicación:", error.message);
        res.status(500).json({ success: false, message: "Error al actualizar ubicación" });
    }
});  

router.put("/updateMalEstado", async (req, res) => {
    const { UPCUnidad, MalEstado } = req.body;

    if (!UPCUnidad || !MalEstado) {
        return res.status(400).json({ success: false, message: "Campos requeridos faltantes" });
    }


    try {
        const result = await Location.updateMalEstado(UPCUnidad, Number(MalEstado));
        res.json({ success: true, message: "Mal estado actualizada correctamente", result });
    } catch (error) {
        console.error("Error al actualizar mal estado:", error.message);
        res.status(500).json({ success: false, message: "Error al actualizar mal estado" });
    }
});

export default router;
