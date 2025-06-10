import dbManager from "../config/db.js";

export const getProducts = async () => {
  try {
    if (!dbManager.isLocalDBConfigured()) {
      console.warn("Base de datos local no configurada");
      return [];
    }

    const query = `
        SELECT 
        pp.UPCPaquete as UPCFardo, p.UPC as UPCUnidad, p.DescLarga as Descripcion, pp.Cantidad as UnidadesFardo, p.MalEstado,
        p.Existencia, u.Descripcion as Ubicacion
        FROM 
        productos p
        LEFT JOIN productospaquetes pp on p.Upc = pp.Upc
        LEFT JOIN ubicacionesbodega u on p.IdUbicacionBodega = u.Id
    `;

    const rows = await dbManager.executeLocalQuery(query);

    if (!Array.isArray(rows)) {
      console.error("Respuesta inesperada de la base de datos al obtener cambios.");
      throw new Error("Error inesperado al obtener cambios.");
    }

    if (rows.length === 0) {
      return [];
    }

    return rows;
  } catch (error) {
    console.error("Error al obtener los cambios:", error.message);
    throw new Error("Error al obtener los cambios de la base de datos.");
  }
};

export const getUbications = async () => {
    try {
      if (!dbManager.isLocalDBConfigured()) {
        console.warn("Base de datos local no configurada");
        return [];
      }
  
      const query = `
          SELECT 
          Id as IdUbicacion, Descripcion as NombreUbicacion
          FROM 
          ubicacionesbodega
      `;
  
      const rows = await dbManager.executeLocalQuery(query);
  
      if (!Array.isArray(rows)) {
        console.error("Respuesta inesperada de la base de datos al obtener cambios.");
        throw new Error("Error inesperado al obtener cambios.");
      }
  
      if (rows.length === 0) {
        return [];
      }
  
      return rows;
    } catch (error) {
      console.error("Error al obtener los cambios:", error.message);
      throw new Error("Error al obtener los cambios de la base de datos.");
    }
  };

  export const updateLocation = async (IdUbicacion, UPCUnidad) => {
    try {
      if (!dbManager.isLocalDBConfigured()) {
        throw new Error("Base de datos local no configurada");
      }
  
      const query = `
        UPDATE productos 
        SET IdUbicacionBodega = ? 
        WHERE UPC = ?
      `;
  
      const params = [IdUbicacion, UPCUnidad];
  
      const result = await dbManager.executeLocalQuery(query, params);
      return result;
    } catch (error) {
      console.error("Error al actualizar ubicación:", error.message);
      throw error;
    }
  };

  export const updateMalEstado = async (UPCUnidad, MalEstado) => {
    try {
      if (!dbManager.isLocalDBConfigured()) {
        throw new Error("Base de datos local no configurada");
      }
  
      const query = `
        UPDATE productos 
        SET MalEstado = ? 
        WHERE UPC = ?
      `;
  
      const params = [MalEstado, UPCUnidad];
  
      const result = await dbManager.executeLocalQuery(query, params);
      return result;
    } catch (error) {
      console.error("Error al actualizar mal estado:", error.message);
      throw error;
    }
  };
  