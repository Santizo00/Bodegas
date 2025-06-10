import dbManager from "../config/db.js";

export const getCambios = async () => {
  try {
    if (!dbManager.isLocalDBConfigured()) {
      console.warn("Base de datos local no configurada");
      return [];
    }

    const query = `
      SELECT 
          h.IdPedidos, 
          pd.NombreSucursal AS Sucursal,
          u.NombreCompleto, 
          c.IdCambio, 
          c.Descripcion, 
          h.UPC AS UPC_Historial,
          pp.UPC AS UPC_ProductoPaquete,
          COALESCE(
              (SELECT p_paq.DescLarga FROM productos p_paq WHERE p_paq.UPC = pp.UPC LIMIT 1),
              p.DescLarga
          ) AS DescripcionProducto,
          CASE 
              WHEN h.IdCambio = 5 THEN e_anterior.EstadoPedido 
              ELSE CAST(h.ValorAnterior AS CHAR)
          END AS ValorAnterior,
          CASE 
              WHEN h.IdCambio = 5 THEN e_nuevo.EstadoPedido 
              ELSE CAST(h.ValorNuevo AS CHAR)
          END AS ValorNuevo,
          h.FechaHora
      FROM historialcambiospedidos h
      INNER JOIN cambiospedidos c ON h.IdCambio = c.IdCambio
      LEFT JOIN pedidostienda_bodega pd ON h.IdPedidos = pd.IdPedidos
      LEFT JOIN usuarios u ON h.IdUsuario = u.id
      LEFT JOIN estadopedidotiendabodega e_anterior ON h.IdCambio = 5 AND h.ValorAnterior = e_anterior.IdEstado 
      LEFT JOIN estadopedidotiendabodega e_nuevo ON h.IdCambio = 5 AND h.ValorNuevo = e_nuevo.IdEstado
      LEFT JOIN productospaquetes pp ON h.UPC = pp.UPCPaquete
      LEFT JOIN productos p ON h.UPC = p.UPC
      WHERE h.IdHistorial > (SELECT MAX(IdHistorial) - 1000 FROM historialcambiospedidos)
      ORDER BY h.IdHistorial DESC
      LIMIT 1000;
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