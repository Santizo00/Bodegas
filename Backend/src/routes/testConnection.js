import express from "express";
import mysql from "mysql2/promise";

const router = express.Router();

router.post("/test-connection", async (req, res) => {
  const { DB_LOCAL_HOST, DB_LOCAL_USER, DB_LOCAL_PASS, DB_LOCAL_NAME } = req.body;

  try {
    const connection = await mysql.createConnection({
      host: DB_LOCAL_HOST,
      user: DB_LOCAL_USER,
      password: DB_LOCAL_PASS,
      database: DB_LOCAL_NAME,
    });

    await connection.ping();
    await connection.end();

    res.json({ success: true, message: "Conexión exitosa" });
  } catch (error) {
    console.error("Error en la conexión:", error);
    res.json({ success: false, message: "Error en la conexión" });
  }
});

export default router;
