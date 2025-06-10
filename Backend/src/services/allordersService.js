import dbManager from "../config/db.js";

export const getPedidos = async () => {
  try {
    if (!dbManager.isLocalDBConfigured()) {
      console.warn("Base de datos local no configurada");
      return [];
    }

    const query = `
      SELECT p.IdPedidos, p.NombreEmpresa, p.Fecha, p.Estado as IdEstado, e.EstadoPedido AS Estado, d.Nombre as Departamento, p.TotalCantidad
      FROM pedidostienda_bodega p 
      INNER JOIN estadopedidotiendabodega e ON p.Estado = e.IdEstado 
      LEFT JOIN departamentos d on p.Departamento = d.Id
      ORDER BY p.IdPedidos DESC, p.NombreSucursal ASC
    `;

    const rows = await dbManager.executeLocalQuery(query);

    if (!Array.isArray(rows)) {
      console.error("Respuesta inesperada de la base de datos al obtener pedidos.");
      throw new Error("Error inesperado al obtener pedidos.");
    }

    if (rows.length === 0) {
      return [];
    }

    return rows;
  } catch (error) {
    console.error("Error al obtener los pedidos:", error.message);

    throw new Error("Error al obtener los pedidos de la base de datos.");
  }
};

/**
 * @param {number} idPedido
 * @returns {Promise<Array>}
 */
export const obtenerDetallesPedido = async (idPedido) => {
  try {
    idPedido = Number(idPedido);

    if (!idPedido || !Number.isInteger(idPedido) || idPedido <= 0) {
      throw new Error("ID de pedido inválido.");
    }

    const estadoQuery = `SELECT estado FROM pedidostienda_bodega WHERE IdPedidos = ?`;
    const estadoResult = await dbManager.executeLocalQuery(estadoQuery, [idPedido]);

    if (!estadoResult || estadoResult.length === 0) {
      throw new Error(`No se encontró el pedido con ID: ${idPedido}`);
    }

    const estadoPedido = estadoResult[0].estado;

    const whereCondition = estadoPedido >= 4 && estadoPedido <= 7 ? "dp.IdConsolidado" : "dp.idpedidos";

    const query = `
      SELECT
          dp.upc,
          dp.UPCProducto,
          dp.descripcion,
          SUM(dp.cantidad) AS cantidad,
          MAX(dp.existencia) AS existencia,
          MAX(dp.existenciafardos) AS existenciafardos,
          d.Nombre AS Departamento,
          MAX(dp.UnidadesFardo) AS UnidadesFardo,
          MAX(dp.Observaciones) AS Observaciones,
          u.Descripcion AS Ubicacion,
          dp.Faltante,
          dp.Variedad,
          dp.IdProveedor,
          p.Nombre AS Proveedor,
          c.Nombre AS Categoria,
          dp.Variedad,
          pr.MalEstado
      FROM
          detallepedidostienda_bodega dp
      LEFT JOIN
          departamentos d ON dp.IdDepartamento = d.Id
      LEFT JOIN
          ubicacionesbodega u ON dp.IdUbicacionBodega = u.Id
      LEFT JOIN
          proveedores p ON dp.IdProveedor = p.Id
      LEFT JOIN
          productos pr ON dp.UPCProducto = pr.UPC
      LEFT JOIN
          categorias c ON pr.IdCategorias = c.Id
      WHERE ${whereCondition} = ?
      GROUP BY
          dp.upc, dp.UPCProducto, dp.descripcion, d.Nombre, u.Descripcion
      ORDER BY
          u.Nivel ASC, u.Rack ASC, u.Descripcion ASC, dp.descripcion ASC, dp.IdProveedor asc, c.Nombre ASC;
    `;

    const detalles = await dbManager.executeLocalQuery(query, [idPedido]);

    if (!Array.isArray(detalles)) {
      console.error(`Error al obtener los detalles del pedido con ID: ${idPedido}`);
      throw new Error("Error inesperado al obtener detalles del pedido.");
    }

    return detalles;
  } catch (error) {
    console.error("Error al obtener los detalles del pedido:", error.message);
    throw new Error("Error al obtener los detalles del pedido.");
  }
};

export const actualizarInformacion = async (idPedido) => {
  try {
    idPedido = Number(idPedido);

    if (!idPedido || !Number.isInteger(idPedido) || idPedido <= 0) {
      throw new Error("ID de pedido inválido.");
    }

    // 1. Obtener el estado del pedido
    const estadoQuery = `SELECT estado FROM pedidostienda_bodega WHERE IdPedidos = ?`;
    const estadoResult = await dbManager.executeLocalQuery(estadoQuery, [idPedido]);

    if (!estadoResult || estadoResult.length === 0) {
      throw new Error(`No se encontró el pedido con ID: ${idPedido}`);
    }

    const estadoPedido = estadoResult[0].estado;
    const whereColumn = estadoPedido >= 4 && estadoPedido <= 7 ? "IdConsolidado" : "idpedidos";

    // 2. Obtener los UPCProducto y UnidadesFardo del detalle
    const queryDetalles = `
      SELECT UPCProducto, UnidadesFardo
      FROM detallepedidostienda_bodega
      WHERE ${whereColumn} = ? AND UPCProducto IS NOT NULL
    `;

    const detalles = await dbManager.executeLocalQuery(queryDetalles, [idPedido]);

    if (!detalles || detalles.length === 0) {
      return {
        success: false,
        message: "No se encontraron productos válidos para actualizar"
      };
    }

    const upcs = detalles.map(d => d.UPCProducto);

    // 3. Obtener existencias e IdUbicacionBodega desde la tabla productos
    const queryExistencias = `
      SELECT UPC, Existencia, IdUbicacionBodega, IdProveedores
      FROM productos
      WHERE UPC IN (${upcs.map(() => '?').join(',')})
    `;

    const productos = await dbManager.executeLocalQuery(queryExistencias, upcs);

    const mapaExistencias = new Map();
    productos.forEach(p => {
      mapaExistencias.set(p.UPC, {
        existencia: p.Existencia,
        ubicacion: p.IdUbicacionBodega,
        proveedor: p.IdProveedores
      });
    });

    // 4. Actualizar los productos en el detalle
    let actualizaciones = 0;

    for (const detalle of detalles) {
      const producto = mapaExistencias.get(detalle.UPCProducto);
      if (!producto) continue;

      const existenciaUnidad = producto.existencia;
      const existenciaFardo = detalle.UnidadesFardo > 0
        ? parseFloat((existenciaUnidad / detalle.UnidadesFardo).toFixed(2))
        : 0;

      const updateQuery = `
        UPDATE detallepedidostienda_bodega
        SET existencia = ?, existenciaFardos = ?, IdUbicacionBodega = ?, IdProveedor = ?
        WHERE ${whereColumn} = ? AND UPCProducto = ?
      `;

      const result = await dbManager.executeLocalQuery(updateQuery, [
        existenciaUnidad,
        existenciaFardo,
        producto.ubicacion || 0,
        producto.proveedor || 0,
        idPedido,
        detalle.UPCProducto
      ]);

      if (result.affectedRows > 0) actualizaciones++;
    }

    return {
      success: true,
      message: `Actualizados ${actualizaciones} productos (existencia + ubicación)`,
      idPedido
    };
  } catch (error) {
    console.error("❌ Error actualizando información:", error.message);
    return {
      success: false,
      message: `Error al actualizar información: ${error.message}`
    };
  }
};

/**
 * @param {number} idPedido
 * @returns {Promise<{ success: boolean, message: string }>} 
 */
export const actualizarEstadoPedido = async (idPedido) => {
  try {
    idPedido = Number(idPedido);

    if (!idPedido || !Number.isInteger(idPedido) || idPedido <= 0) {
      throw new Error("ID de pedido inválido.");
    }

    const queryObtenerEstado = `SELECT estado FROM pedidostienda_bodega WHERE idpedidos = ?`;
    const resultEstadoActual = await dbManager.executeLocalQuery(queryObtenerEstado, [idPedido]);

    if (!resultEstadoActual || resultEstadoActual.length === 0) {
      return { success: false, message: `No se encontró el pedido con ID: ${idPedido}.` };
    }

    const estadoAnterior = resultEstadoActual[0].estado; 

    if (estadoAnterior === 3 || estadoAnterior === 4) {
      const nuevoEstado = 5; 

      const queryActualizarEstado = `
        UPDATE pedidostienda_bodega 
        SET estado = ? 
        WHERE idpedidos = ?`;
  
      const resultEstado = await dbManager.executeLocalQuery(queryActualizarEstado, [nuevoEstado, idPedido]);
        
      if (!resultEstado || resultEstado.affectedRows === 0) {
        return { success: false, message: `No se pudo actualizar el estado del pedido con ID: ${idPedido}.` };
      }
    }
    return { success: true, message: `Estado del pedido ${idPedido} actualizado correctamente ` };

  } catch (error) {
    console.error("Error actualizando pedido:", error.message);
    return { success: false, message: "Error al actualizar el estado del pedido." };
  }
};