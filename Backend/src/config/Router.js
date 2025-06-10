// routes/configRouter.js
import express from "express";
import fs from "fs";
import dotenv from "dotenv";
import dbManager from "../config/db.js";
import multiDBManager from "../config/dbMulti.js";

const router = express.Router();

// Ruta modificada para obtener tanto nombre como ID de la sucursal
router.get("/get-name-sucursal", async (req, res) => {
  try {
    // Leer los datos de la sucursal del .env
    const nombreSucursal = process.env.NOMBRE_SUCURSAL || "";
    const idUbicacion = process.env.ID_UBICACION || "";
    
    // Si ambos valores existen en el .env, los devolvemos directamente
    if (nombreSucursal) {
      return res.json({ 
        success: true, 
        nombreSucursal: nombreSucursal,
        idUbicacion: idUbicacion
      });
    } else {
      // Si no existe en el .env, intentamos obtenerlo de la base de datos
      try {
        // Obtener los valores del .env para la consulta
        const serverr = process.env.DB_LOCAL_HOST;
        const databasee = process.env.DB_LOCAL_NAME;
        
        if (!serverr || !databasee) {
          return res.json({ 
            success: false, 
            nombreSucursal: "Sucursal sin configurar",
            message: "No se pudo obtener la configuración de la base de datos"
          });
        }
        
        // Consulta a la base de datos para obtener el nombre y ID de la sucursal
        if (!multiDBManager.isDBConfigured("sucursalesDB")) {
          console.warn("sucursalesDB no está configurada. Intentando inicializar...");
          const success = await multiDBManager.initializeSucursalesDB();
          if (!success) {
            return res.status(500).json({ 
              success: false, 
              nombreSucursal: "Error de conexión",
              error: "No se pudo conectar a sucursalesDB" 
            });
          }
        }
        
        const query = `
          SELECT NombreSucursal, IdUbicacion 
          FROM sucursales 
          WHERE TipoSucursal = 3 
          AND serverr = ? 
          AND databasee = ?
        `;
        
        const results = await multiDBManager.executeQuery("sucursalesDB", query, [serverr, databasee]);
        
        if (results && results.length > 0) {
          const sucursalName = results[0].NombreSucursal;
          const sucursalId = results[0].IdUbicacion;
          
          // Guardar los valores en el .env para futuras consultas
          let envContent = fs.readFileSync(".env", "utf8").split("\n");
          let nombreSucursalExists = false;
          let idUbicacionExists = false;
          
          envContent = envContent.map(line => {
            if (line.startsWith("NOMBRE_SUCURSAL=")) {
              nombreSucursalExists = true;
              return `NOMBRE_SUCURSAL=${sucursalName}`;
            }
            if (line.startsWith("ID_UBICACION=")) {
              idUbicacionExists = true;
              return `ID_UBICACION=${sucursalId}`;
            }
            return line;
          });
          
          if (!nombreSucursalExists) {
            envContent.push(`NOMBRE_SUCURSAL=${sucursalName}`);
          }
          
          if (!idUbicacionExists) {
            envContent.push(`ID_UBICACION=${sucursalId}`);
          }
          
          fs.writeFileSync(".env", envContent.join("\n"));
          dotenv.config(); // Recargar variables de entorno
          
          return res.json({ 
            success: true, 
            nombreSucursal: sucursalName,
            idUbicacion: sucursalId
          });
        } else {
          return res.json({ 
            success: false, 
            nombreSucursal: "Sucursal no encontrada",
            message: "No se encontró una sucursal con la configuración actual"
          });
        }
      } catch (dbError) {
        console.error("Error al obtener datos de la sucursal:", dbError);
        return res.status(500).json({ 
          success: false, 
          nombreSucursal: "Error de consulta",
          error: "Error al obtener datos de la sucursal: " + dbError.message
        });
      }
    }
  } catch (error) {
    console.error("Error al leer datos de la sucursal:", error);
    return res.status(500).json({ 
      success: false, 
      error: "Error interno del servidor: " + error.message
    });
  }
});

// También necesitamos actualizar la función set-config
router.post("/set-config", async (req, res) => {
  const { DB_LOCAL_HOST, DB_LOCAL_USER, DB_LOCAL_PASS, DB_LOCAL_NAME, NOMBRE_SUCURSAL, ID_UBICACION } = req.body;

  if (!DB_LOCAL_HOST || !DB_LOCAL_USER || !DB_LOCAL_NAME || !NOMBRE_SUCURSAL) {
    return res.status(400).json({ error: "Faltan datos en la configuración" });
  }

  try {
    let envContent = fs.readFileSync(".env", "utf8").split("\n");

    // Verificar si ya existen las variables en el archivo .env
    let nombreSucursalExists = false;
    let idUbicacionExists = false;

    envContent = envContent.map(line => {
      if (line.startsWith("DB_LOCAL_HOST=")) return `DB_LOCAL_HOST=${DB_LOCAL_HOST}`;
      if (line.startsWith("DB_LOCAL_USER=")) return `DB_LOCAL_USER=${DB_LOCAL_USER}`;
      if (line.startsWith("DB_LOCAL_PASS=")) return `DB_LOCAL_PASS=${DB_LOCAL_PASS}`;
      if (line.startsWith("DB_LOCAL_NAME=")) return `DB_LOCAL_NAME=${DB_LOCAL_NAME}`;
      if (line.startsWith("NOMBRE_SUCURSAL=")) {
        nombreSucursalExists = true;
        return `NOMBRE_SUCURSAL=${NOMBRE_SUCURSAL}`;
      }
      if (line.startsWith("ID_UBICACION=")) {
        idUbicacionExists = true;
        return `ID_UBICACION=${ID_UBICACION || ''}`;
      }
      return line;
    });

    // Si no existen, añadirlos al final del archivo
    if (!nombreSucursalExists) {
      envContent.push(`NOMBRE_SUCURSAL=${NOMBRE_SUCURSAL}`);
    }
    
    if (!idUbicacionExists && ID_UBICACION) {
      envContent.push(`ID_UBICACION=${ID_UBICACION}`);
    }

    fs.writeFileSync(".env", envContent.join("\n"));
    
    // Recargar variables de entorno
    dotenv.config();

    const success = await dbManager.reconfigureLocalDB({
      host: DB_LOCAL_HOST,
      user: DB_LOCAL_USER,
      password: DB_LOCAL_PASS,
      database: DB_LOCAL_NAME,
    });

    if (!success) {
      return res.status(500).json({ error: "No se pudo establecer la conexión" });
    }

    if (req.io) {
      req.io.emit("bodegaActualizada", { 
        nombreSucursal: NOMBRE_SUCURSAL,
        idUbicacion: ID_UBICACION 
      });

      if (req.io.engine.clientsCount === 0) {
        console.warn("No hay clientes conectados. Reintentando en 3 segundos...");
        setTimeout(() => {
          req.io.emit("bodegaActualizada", { 
            nombreSucursal: NOMBRE_SUCURSAL,
            idUbicacion: ID_UBICACION
          });
        }, 3000);
      }
    } else {
      console.warn("Advertencia: req.io no está definido");
    }

    res.json({ 
      message: "Configuración guardada y conexión actualizada exitosamente",
      success: true,
      nombreSucursal: NOMBRE_SUCURSAL,
      idUbicacion: ID_UBICACION
    });

    // ===== CREAR BACKUP DEL .env en BodegasConfig =====
    try {
      const os = await import('os'); // Import dinámico si no está arriba
      const path = await import('path');
      
      const ENV_BACKUP_DIR = path.join(os.default.homedir(), 'AppData', 'Local', 'BodegasConfig');
      const ENV_BACKUP_PATH = path.join(ENV_BACKUP_DIR, 'env.backup');

      if (!fs.existsSync(ENV_BACKUP_DIR)) {
        fs.mkdirSync(ENV_BACKUP_DIR, { recursive: true });
      }

      const envContent = fs.readFileSync(".env", "utf8");
      if (envContent.includes("DB_LOCAL_HOST") && envContent.includes("NOMBRE_SUCURSAL")) {
        fs.writeFileSync(ENV_BACKUP_PATH, envContent);
        console.log("✅ Respaldo .env guardado en:", ENV_BACKUP_PATH);
      } else {
        console.warn("⚠️ .env no tiene configuración local suficiente, no se creó backup");
      }
    } catch (backupErr) {
      console.error("❌ Error al generar respaldo .env:", backupErr.message);
    }
  } catch (error) {
    console.error("Error al actualizar la configuración:", error.message);
    return res.status(500).json({ 
      error: "Error al guardar la configuración: " + error.message 
    });
  }
});

// Mantenemos el resto igual
router.get("/get-sucursales", async (req, res) => {
  try {
    const query = `
      SELECT idSucursal, NombreSucursal, serverr, databasee, Uid, Pwd, IdUbicacion
      FROM sucursales
      WHERE TipoSucursal = 3 AND Activo = 1
      ORDER BY idSucursal ASC;
    `;

    if (!multiDBManager.isDBConfigured("sucursalesDB")) {
      console.warn("sucursalesDB no está configurada. Intentando inicializar...");
      const success = await multiDBManager.initializeSucursalesDB();
      if (!success) {
        return res.status(500).json({ success: false, error: "No se pudo conectar a sucursalesDB" });
      }
    }

    const sucursales = await multiDBManager.executeQuery("sucursalesDB", query);

    res.json({ success: true, sucursales });
  } catch (error) {
    console.error("Error al obtener sucursales:", error.message);
    res.status(500).json({ success: false, error: "Error al obtener sucursales" });
  }
});

export default router;