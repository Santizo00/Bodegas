import express from "express";
import * as loginService from "../services/loginService.js";
import jwt from "jsonwebtoken";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Usuario y contraseña son requeridos.",
      });
    }

    const result = await loginService.authenticateUser(username, password);

    if (result.success) {
      const token = jwt.sign({ userId: result.user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
      return res.status(200).json({ ...result, token });
    } else {
      return res.status(401).json(result);
    }
  } catch (error) {
    console.error("Error en loginRoute:", error.message);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor.",
      error: error.message,
    });
  }
});

export default router;