import multiDBManager from "../config/dbMulti.js";
import dotenv from "dotenv";

dotenv.config({ override: true });

class GeneralService {
  static async obtenerSucursalPorIP() {
    try {
      dotenv.config({ override: true }); 

      const localIP = process.env.DB_LOCAL_HOST;
      if (!localIP) {
        throw new Error("No se encontró la IP local en el archivo .env");
      }

      const query = "SELECT nombresucursal, idubicacion FROM sucursales WHERE serverr = ? AND TipoSucursal = 3 Order By nombresucursal asc";
      const sucursal = await multiDBManager.executeQuery("sucursalesDB", query, [localIP]);

      if (sucursal.length === 0) {
        throw new Error(`No se encontró una sucursal asociada a esta IP (${localIP})`);
      }

      return sucursal[0];
    } catch (error) {
      console.error("Error obteniendo sucursal por IP:", error.message);
      throw new Error("No se pudo obtener la sucursal asociada a esta IP.");
    }
  }
}

export default GeneralService;
