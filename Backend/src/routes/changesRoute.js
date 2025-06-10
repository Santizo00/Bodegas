import express from "express";
import * as ChangeHistory from "../services/changesService.js";

const router = express.Router();


router.get("/", async (req, res) => {
  const cambios = await ChangeHistory.getCambios();
  res.json(cambios);
});


export default router;
