import dbManager from "../config/db.js";
import multiDBManager from "../config/dbMulti.js";
import { idUsuario } from "../services/loginService.js";

export const getPedidos = async () => {
  try {
    if (!dbManager.isLocalDBConfigured()) {
      console.warn("Base de datos local no configurada");
      return [];
    }

    const query = `
      SELECT 
        p.IdPedidos, 
        p.NombreEmpresa AS NombreEmpresa, 
        p.Fecha, 
        e.EstadoPedido AS Estado, 
        d.Nombre AS Departamento, 
        p.TotalCantidad, 
        p.observaciones AS ObservacionPedido,
        p.IdSucursales AS IdSucursal,
        p.NombreSucursal
      FROM pedidostienda_bodega p 
      INNER JOIN estadopedidotiendabodega e ON p.Estado = e.IdEstado 
      LEFT JOIN departamentos d ON p.Departamento = d.Id
      WHERE Estado <= 2
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

// Función para registrar cambios en pedidos
const registrarCambioPedido = async (idPedido, idUsuario, idCambio, upc, valorAnterior, valorNuevo) => {
  try {
    const query = `
      INSERT INTO historialcambiospedidos(IdPedidos, IdUsuario, IdCambio, UPC, ValorAnterior, ValorNuevo, FechaHora) 
      VALUES (?, ?, ?, ?, ?, ?, NOW());
    `;

    await dbManager.executeLocalQuery(query, [
      idPedido, idUsuario, idCambio, upc, valorAnterior, valorNuevo
    ]);
  } catch (error) {
    console.error("Error al registrar el historial de cambios:", error);
  }
};

// Función para sincronizar los pedidos (encabezados)
export const syncOrder = async (ubicacion) => {
  try {
    const columnasWhere = {
      1: "Actualizado1",
      2: "Actualizado2",
      3: "Actualizado3",
      5: "Actualizado5",
      8: "Actualizado8",
      12: "Actualizado12",
    };

    const columna = columnasWhere[ubicacion];
    if (!columna) {
      throw new Error("Ubicación no válida para sincronización.");
    }

    const pedidosQuery = `
      SELECT p.nombreusuario, p.fecha, p.fechahora, p.estado, p.observaciones, 
             p.nombreempresa, p.totalcantidad, p.idpedidos, p.Vendedor
      FROM pedidostienda p
      INNER JOIN detallepedidostienda d ON p.idpedidos = d.idpedidos
      WHERE ?? = 0
      GROUP BY p.idpedidos
      HAVING COUNT(CASE WHEN d.idubicaciones = ? THEN 1 END) >= COUNT(*)/2
    `;

    const pedidos = await multiDBManager.executeQuery("centralDB", pedidosQuery, [columna, ubicacion]);

    if (!Array.isArray(pedidos) || pedidos.length === 0) {
      console.log("No hay pedidos no actualizados.");
      return [];
    }

    const nuevosPedidos = [];

    for (const pedido of pedidos) {
      const insertPedidoQuery = `
        INSERT INTO pedidostienda_bodega 
        (NombreUsuario, Fecha, FechaHora, Estado, Observaciones, NombreEmpresa, TotalCantidad, 
         IdPedidoSucursal, IdSucursales, NombreSucursal, Paginado, Nohojas)
        VALUES (?, NOW(), NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `;

      const result = await dbManager.executeLocalQuery(insertPedidoQuery, [
        pedido.nombreusuario,
        "1", 
        pedido.observaciones,
        pedido.Vendedor,
        pedido.totalcantidad || 0,
        pedido.idpedidos, 
        0,  
        pedido.Vendedor,
        0, 
        0, 
      ]);

      const nuevoIdPedido = result.insertId;
      nuevosPedidos.push({ ...pedido, nuevoIdPedido });
    }

    return nuevosPedidos;
  } catch (error) {
    console.error("Error sincronizando pedidos:", error.message);
    throw new Error(`Error al sincronizar pedidos: ${error.message}`);
  }
};

// Función para sincronizar los detalles de pedidos
export const syncDetails = async (pedidosInsertados) => {
  try {
    if (!Array.isArray(pedidosInsertados) || pedidosInsertados.length === 0) {
      return [];
    }

    const idsPedidos = pedidosInsertados.map(p => p.idpedidos);
    
    const detallesQuery = `
      SELECT idpedidos, upc, descripcion, cantidad
      FROM detallepedidostienda
      WHERE idpedidos IN (${idsPedidos.map(() => "?").join(",")})
    `;

    const detalles = await multiDBManager.executeQuery("centralDB", detallesQuery, idsPedidos);

    if (!Array.isArray(detalles) || detalles.length === 0) {
      console.log("No hay detalles para los pedidos seleccionados.");
      return [];
    }

    const detallesConNuevosIds = detalles.map((detalle) => {
      const pedidoAsociado = pedidosInsertados.find((pedido) => pedido.idpedidos === detalle.idpedidos);
      return {
        ...detalle,
        nuevoIdPedido: pedidoAsociado ? pedidoAsociado.nuevoIdPedido : null,
      };
    });

    const detallesValidos = detallesConNuevosIds.filter(detalle => detalle.nuevoIdPedido !== null);

    if (detallesValidos.length === 0) {
      console.log("No hay detalles válidos para insertar.");
      return [];
    }

    const queryInsertDetalles = `
      INSERT INTO detallepedidostienda_bodega 
      (idpedidos, upc, descripcion, cantidad, upcproducto, faltante) 
      VALUES ?;
    `;

    const valoresDetalles = detallesValidos.map((detalle) => [
      detalle.nuevoIdPedido,
      detalle.upc,
      detalle.descripcion,
      detalle.cantidad,
      detalle.upc,
      0,
    ]);

    await dbManager.executeLocalQuery(queryInsertDetalles, [valoresDetalles]);

    return detallesValidos;
  } catch (error) {
    console.error("Error sincronizando detalles:", error.message);
    throw new Error(`Error al sincronizar detalles: ${error.message}`);
  }
};

// Función para actualizar la información de sucursales en los pedidos
export const updateSucursal = async (pedidosInsertados) => {
  try {
    if (!Array.isArray(pedidosInsertados) || pedidosInsertados.length === 0) {
      return pedidosInsertados;
    }

    const vendedores = [...new Set(pedidosInsertados.map(p => p.Vendedor).filter(Boolean))];
    
    if (vendedores.length === 0) {
      console.log("No hay vendedores en los pedidos.");
      return pedidosInsertados;
    }

    const sucursalesQuery = `
      SELECT IdSucursal, NombreSucursal 
      FROM sucursales 
      WHERE NombreSucursal IN (${vendedores.map(() => "?").join(",")})
    `;

    const sucursales = await multiDBManager.executeQuery("sucursalesDB", sucursalesQuery, vendedores);
    
    if (!Array.isArray(sucursales) || sucursales.length === 0) {
      console.log("No se encontraron sucursales para los vendedores.");
      return pedidosInsertados;
    }

    const sucursalesMap = new Map(sucursales.map(s => [s.NombreSucursal, { IdSucursal: s.IdSucursal, NombreSucursal: s.NombreSucursal }]));

    for (const pedido of pedidosInsertados) {
      const sucursalInfo = sucursalesMap.get(pedido.Vendedor);
      
      if (sucursalInfo) {
        const updateQuery = `
          UPDATE pedidostienda_bodega
          SET IdSucursales = ?, NombreSucursal = ?, NombreEmpresa = ?
          WHERE IdPedidos = ?
        `;
        
        await dbManager.executeLocalQuery(updateQuery, [
          sucursalInfo.IdSucursal,
          sucursalInfo.NombreSucursal,
          sucursalInfo.NombreSucursal, // Usar como NombreEmpresa también
          pedido.nuevoIdPedido
        ]);
        
        // Actualizar el objeto para reflejar los cambios
        pedido.IdSucursales = sucursalInfo.IdSucursal;
        pedido.NombreSucursal = sucursalInfo.NombreSucursal;
        pedido.NombreEmpresa = sucursalInfo.NombreSucursal;
      }
    }

    return pedidosInsertados;
  } catch (error) {
    console.error("Error actualizando información de sucursales:", error.message);
    // No lanzamos error para que pueda continuar el proceso
    return pedidosInsertados;
  }
};

// Función dividida para actualizar datos adicionales en los detalles
export const updateData = async (detalles) => {
  try {
    if (!Array.isArray(detalles) || detalles.length === 0) {
      return detalles;
    }

    // PARTE 1: Actualizar UPCProducto y UnidadesFardo desde productospaquetes
    await actualizarDatosFardo(detalles);
    
    // PARTE 2: Actualizar el resto de datos basados en UPCProducto desde productos
    await actualizarDatosProducto(detalles);

    return detalles;
  } catch (error) {
    console.error("Error actualizando datos adicionales en detalles:", error.message);
    // No lanzamos error para que pueda continuar el proceso
    return detalles;
  }
};

// PARTE 1: Función para actualizar UPCProducto y UnidadesFardo
const actualizarDatosFardo = async (detalles) => {
  try {
    const upcs = [...new Set(detalles.map(detalle => detalle.upc).filter(Boolean))];
    
    if (upcs.length === 0) {
      return;
    }

    const upcPlaceholders = upcs.map(() => "?").join(",");

    // Solo obtenemos UPC y Cantidad de productospaquetes
    const fardosQuery = `
      SELECT pp.UPCPaquete AS upc, pp.UPC AS UPCProducto, pp.Cantidad AS UnidadesFardo
      FROM productospaquetes pp
      WHERE pp.UPCPaquete IN (${upcPlaceholders})
    `;

    const datosFardos = await dbManager.executeLocalQuery(fardosQuery, upcs);

    if (!Array.isArray(datosFardos) || datosFardos.length === 0) {
      console.log("No se encontraron datos de fardos para los UPCs.");
      return;
    }

    const fardosMap = new Map(datosFardos.map(d => [d.upc, d]));

    // Actualizar solo UPCProducto y UnidadesFardo
    for (const detalle of detalles) {
      const datoFardo = fardosMap.get(detalle.upc);
      
      if (datoFardo && detalle.nuevoIdPedido) {
        const updateQuery = `
          UPDATE detallepedidostienda_bodega
          SET UPCProducto = ?, UnidadesFardo = ?, faltante = 1
          WHERE idpedidos = ? AND upc = ?
        `;
        
        await dbManager.executeLocalQuery(updateQuery, [
          datoFardo.UPCProducto || null,
          datoFardo.UnidadesFardo || null,
          detalle.nuevoIdPedido,
          detalle.upc
        ]);
        
        // Actualizar el objeto para reflejar los cambios
        detalle.UPCProducto = datoFardo.UPCProducto || null;
        detalle.UnidadesFardo = datoFardo.UnidadesFardo || null;
        detalle.faltante = 1; // Marcar como encontrado
      }
    }
  } catch (error) {
    console.error("Error actualizando datos de fardo:", error.message);
  }
};

// PARTE 2: Función para actualizar resto de datos usando UPCProducto
const actualizarDatosProducto = async (detalles) => {
  try {
    // En lugar de usar el objeto actualizado, necesitamos consultar lo que hay en la DB
    // porque puede ser que los objetos en memoria no tengan actualizado el UPCProducto
    const detallesIds = detalles
      .filter(d => d.nuevoIdPedido)
      .map(d => d.nuevoIdPedido);
      
    if (detallesIds.length === 0) {
      console.log("No hay IDs de pedidos para buscar detalles.");
      return;
    }
    
    // Consultar desde la base de datos los UPCProducto actuales
    const detallesQuery = `
      SELECT idpedidos, upc, UPCProducto, UnidadesFardo 
      FROM detallepedidostienda_bodega
      WHERE idpedidos IN (${detallesIds.map(() => "?").join(",")})
    `;
    
    const detallesActualizados = await dbManager.executeLocalQuery(detallesQuery, detallesIds);
    console.log("Detalles obtenidos de la DB:", detallesActualizados);
    
    // Filtramos solo los que tienen UPCProducto
    const detallesConUPC = detallesActualizados.filter(d => d.UPCProducto);
    
    console.log("Detalles con UPC después de filtrar:", detallesConUPC);
    
    if (detallesConUPC.length === 0) {
      console.log("No hay detalles con UPCProducto para actualizar en la base de datos.");
      return;
    }

    const upcsProducto = [...new Set(detallesConUPC.map(detalle => detalle.UPCProducto).filter(Boolean))];
    console.log("UPCs de producto a buscar:", upcsProducto);
    
    const upcPlaceholders = upcsProducto.map(() => "?").join(",");

    // Consulta para obtener datos de la tabla productos
    const productosQuery = `
      SELECT p.Upc AS UPCProducto, p.Existencia, p.IdDepartamentos, 
             p.IdUbicacionBodega, p.DescLarga AS Descripcion
      FROM productos p
      WHERE p.Upc IN (${upcPlaceholders})
    `;

    const datosProductos = await dbManager.executeLocalQuery(productosQuery, upcsProducto);

    if (!Array.isArray(datosProductos) || datosProductos.length === 0) {
      console.log("No se encontraron datos de productos para los UPCs.");
      return;
    }

    const productosMap = new Map(datosProductos.map(p => [p.UPCProducto, p]));

    // Actualizar el resto de campos con la información del producto
    for (const detalle of detallesConUPC) {
      const datosProducto = productosMap.get(detalle.UPCProducto);
      
      if (datosProducto) {
        // Calcular existenciaFardos solo si tenemos UnidadesFardo
        let existenciaFardos = 0;
        if (detalle.UnidadesFardo && detalle.UnidadesFardo > 0) {
          existenciaFardos = Math.round((datosProducto.Existencia || 0) / detalle.UnidadesFardo * 100) / 100;
        }
        
        const updateQuery = `
          UPDATE detallepedidostienda_bodega
          SET existencia = ?, existenciaFardos = ?, IdDepartamento = ?, 
              IdUbicacionBodega = ?, Descripcion = ?, faltante = 1
          WHERE idpedidos = ? AND upc = ?
        `;
        
        await dbManager.executeLocalQuery(updateQuery, [
          datosProducto.Existencia || 0,
          existenciaFardos,
          datosProducto.IdDepartamentos || null,
          datosProducto.IdUbicacionBodega || null,
          datosProducto.Descripcion || null,
          detalle.idpedidos,
          detalle.upc
        ]);
      } else {
        console.log(`No se encontraron datos de producto para UPC: ${detalle.UPCProducto}`);
      }
    }
  } catch (error) {
    console.error("Error actualizando datos de producto:", error.message);
  }
};

// Función para actualizar el departamento más frecuente en los pedidos
export const updateDepartamento = async (pedidosInsertados) => {
  try {
    if (!Array.isArray(pedidosInsertados) || pedidosInsertados.length === 0) {
      return pedidosInsertados;
    }

    for (const pedido of pedidosInsertados) {
      const obtenerDepartamentosQuery = `
        SELECT IdDepartamento 
        FROM detallepedidostienda_bodega 
        WHERE IdPedidos = ?
      `;

      const departamentos = await dbManager.executeLocalQuery(obtenerDepartamentosQuery, [pedido.nuevoIdPedido]);

      if (departamentos.length > 0) {
        const departamentoConteo = {};
        departamentos.forEach(({ IdDepartamento }) => {
          if (IdDepartamento !== null) {
            departamentoConteo[IdDepartamento] = (departamentoConteo[IdDepartamento] || 0) + 1;
          }
        });

        if (Object.keys(departamentoConteo).length > 0) {
          const departamentoMasFrecuente = Object.entries(departamentoConteo).reduce(
            (max, current) => (current[1] > max[1] ? current : max),
            [null, 0]
          )[0];

          if (departamentoMasFrecuente !== null) {
            const actualizarDepartamentoQuery = `
              UPDATE pedidostienda_bodega 
              SET Departamento = ? 
              WHERE IdPedidos = ?
            `;
            
            await dbManager.executeLocalQuery(actualizarDepartamentoQuery, [
              departamentoMasFrecuente, 
              pedido.nuevoIdPedido
            ]);
            
            // Actualizar el objeto para reflejar los cambios
            pedido.Departamento = departamentoMasFrecuente;
          }
        }
      }
    }

    return pedidosInsertados;
  } catch (error) {
    console.error("Error actualizando departamento en pedidos:", error.message);
    // No lanzamos error para que pueda continuar el proceso
    return pedidosInsertados;
  }
};

// Función para marcar pedidos como actualizados en la base central
export const updateActualizado = async (ubicacion, pedidosInsertados) => {
  try {
    if (!Array.isArray(pedidosInsertados) || pedidosInsertados.length === 0) {
      console.log("No hay pedidos para marcar como actualizados.");
      return 0;
    }

    const columnasWhere = {
      1: "Actualizado1",
      2: "Actualizado2",
      3: "Actualizado3",
      5: "Actualizado5",
      8: "Actualizado8",
      12: "Actualizado12",
    };

    const columna = columnasWhere[ubicacion];
    if (!columna) {
      throw new Error("Ubicación no válida para sincronización.");
    }

    const idsPedidos = pedidosInsertados.map(p => p.idpedidos);

    const placeholders = idsPedidos.map(() => "?").join(",");

    const query = `
      UPDATE pedidostienda 
      SET ${columna} = 1 
      WHERE idpedidos IN (${placeholders})
    `;

    const result = await multiDBManager.executeQuery("centralDB", query, idsPedidos);
    return result.affectedRows || 0;
  } catch (error) {
    console.error("Error marcando pedidos como actualizados:", error.message);
    throw new Error(`Error al marcar pedidos como actualizados: ${error.message}`);
  }
};

// Función para actualizar la cantidad total en pedidostienda_bodega
export const updateCantidadTotalPedido = async (pedidosInsertados) => {
  try {
    if (!Array.isArray(pedidosInsertados) || pedidosInsertados.length === 0) {
      return pedidosInsertados;
    }

    for (const pedido of pedidosInsertados) {
      const querySuma = `
        SELECT SUM(cantidad) AS totalCantidad
        FROM detallepedidostienda_bodega
        WHERE IdPedidos = ?
      `;

      const [resultado] = await dbManager.executeLocalQuery(querySuma, [pedido.nuevoIdPedido]);
      const totalCantidad = resultado?.totalCantidad || 0;

      const updateQuery = `
        UPDATE pedidostienda_bodega
        SET TotalCantidad = ?
        WHERE IdPedidos = ?
      `;

      await dbManager.executeLocalQuery(updateQuery, [totalCantidad, pedido.nuevoIdPedido]);

      // Reflejar el cambio en el objeto
      pedido.TotalCantidad = totalCantidad;
    }

    return pedidosInsertados;
  } catch (error) {
    console.error("Error actualizando TotalCantidad:", error.message);
    return pedidosInsertados;
  }
};


// Función principal de sincronización
export const sincronizarPedidosYDetalles = async (ubicacion) => {
  try {
    // Variables para almacenar resultados y errores
    let pedidosInsertados = [];
    let detallesInsertados = [];
    let errores = [];
    
    // 1. Sincronizar pedidos (encabezados)
    try {
      pedidosInsertados = await syncOrder(ubicacion);
      
      if (pedidosInsertados.length === 0) {
        return { 
          success: true, 
          message: "No hay pedidos para sincronizar.",
          pedidos: [] 
        };
      }
    } catch (errorPedidos) {
      console.error("Error crítico sincronizando pedidos:", errorPedidos.message);
      throw new Error(`Error al sincronizar pedidos: ${errorPedidos.message}`);
    }

    // 2. Sincronizar detalles
    try {
      detallesInsertados = await syncDetails(pedidosInsertados);
    } catch (errorDetalles) {
      console.error("Error sincronizando detalles:", errorDetalles.message);
      errores.push(`Error en detalles: ${errorDetalles.message}`);
      // Continuamos con un array vacío para los siguientes pasos
      detallesInsertados = [];
    }
    
    // 3. Actualizar información de sucursales (continúa incluso si falla)
    try {
      await updateSucursal(pedidosInsertados);
    } catch (errorSucursal) {
      console.warn("Advertencia: No se pudo actualizar la información de sucursales.", errorSucursal.message);
      errores.push(`Error en sucursales: ${errorSucursal.message}`);
    }
    
    // 4. Actualizar datos adicionales en detalles (continúa incluso si falla)
    try {
      if (detallesInsertados.length > 0) {
        await updateData(detallesInsertados);
      }
    } catch (errorData) {
      console.warn("Advertencia: No se pudieron actualizar los datos adicionales de los detalles.", errorData.message);
      errores.push(`Error en datos adicionales: ${errorData.message}`);
    }

    // 4.1 Actualizar TotalCantidad en pedidos con base a los detalles reales
    try {
      await updateCantidadTotalPedido(pedidosInsertados);
    } catch (errorCantidadTotal) {
      console.warn("Advertencia: No se pudo actualizar TotalCantidad del pedido.", errorCantidadTotal.message);
      errores.push(`Error en TotalCantidad: ${errorCantidadTotal.message}`);
    }

    // 5. Actualizar departamento más frecuente en pedidos (continúa incluso si falla)
    try {
      await updateDepartamento(pedidosInsertados);
    } catch (errorDepartamento) {
      console.warn("Advertencia: No se pudo actualizar el departamento más frecuente.", errorDepartamento.message);
      errores.push(`Error en departamentos: ${errorDepartamento.message}`);
    }
    
    // 6. Marcar pedidos como actualizados (continúa incluso si falla)
    try {
      await updateActualizado(ubicacion, pedidosInsertados);
    } catch (errorActualizado) {
      console.error("Error al marcar pedidos como actualizados:", errorActualizado.message);
      errores.push(`Error en actualización: ${errorActualizado.message}`);
    }

    // 7. Registrar cambios (continúa incluso si falla)
    try {
      for (const pedidoInsertado of pedidosInsertados) {
        try {
          await registrarCambioPedido(
            pedidoInsertado.nuevoIdPedido,
            idUsuario,
            6,
            null,
            pedidoInsertado.idpedidos,    
            pedidoInsertado.nuevoIdPedido
          );
        } catch (errorIndividual) {
          console.warn(`Advertencia: No se pudo registrar cambio para el pedido ${pedidoInsertado.nuevoIdPedido}:`, errorIndividual.message);
          // Continuamos con el siguiente pedido
        }
      }
    } catch (errorRegistro) {
      console.warn("Advertencia: No se pudieron registrar los cambios de pedidos.", errorRegistro.message);
      errores.push(`Error en registro de cambios: ${errorRegistro.message}`);
    }

    // Mensaje de éxito o advertencia según los errores
    let mensaje = `Sincronización completada. Se sincronizaron ${pedidosInsertados.length} pedidos`;
    if (detallesInsertados.length > 0) {
      mensaje += ` con ${detallesInsertados.length} detalles`;
    }
    
    if (errores.length > 0) {
      mensaje += `. Hubo ${errores.length} advertencias durante el proceso.`;
    } else {
      mensaje += ` correctamente.`;
    }

    return { 
      success: true, 
      message: mensaje,
      pedidos: pedidosInsertados,
      advertencias: errores.length > 0 ? errores : undefined
    };
  } catch (error) {
    console.error("Error crítico durante la sincronización:", error);
    throw new Error(`Error en sincronización: ${error.message}`);
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

    if (estadoAnterior !=2){
      const nuevoEstado = 2; 

      const queryActualizarEstado = `
        UPDATE pedidostienda_bodega 
        SET estado = ? 
        WHERE idpedidos = ?`;
  
      const resultEstado = await dbManager.executeLocalQuery(queryActualizarEstado, [nuevoEstado, idPedido]);
        
      if (!resultEstado || resultEstado.affectedRows === 0) {
        return { success: false, message: `No se pudo actualizar el estado del pedido con ID: ${idPedido}.` };
      }
      
      await registrarCambioPedido(idPedido, idUsuario, 5, null, estadoAnterior, nuevoEstado);
    }
    return { success: true, message: `Estado del pedido ${idPedido} actualizado correctamente ` };

  } catch (error) {
    console.error("Error actualizando pedido:", error.message);
    return { success: false, message: "Error al actualizar el estado del pedido." };
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

    const query = `
      SELECT dp.id, dp.idpedidos, dp.upc, dp.descripcion, dp.cantidad, dp.existencia, dp.existenciafardos, 
             d.Nombre AS Departamento, dp.UnidadesFardo, dp.UPCProducto, dp.Observaciones as ObservacionProducto, dp.Faltante
      FROM detallepedidostienda_bodega dp
      LEFT JOIN departamentos d ON dp.iddepartamento = d.id
      WHERE dp.idpedidos = ?;
    `;

    const detalles = await dbManager.executeLocalQuery(query, [idPedido]);

    if (!Array.isArray(detalles)) {
      console.error(`Error al obtener los detalles del pedido con ID: ${idPedido}`);
      throw new Error("Error inesperado al obtener detalles del pedido.");
    }

    return detalles.map(detalle => ({
      ...detalle,
      id: Number(detalle.id),
      idpedidos: Number(detalle.idpedidos),
      cantidad: Number(detalle.cantidad),
      existencia: Number(detalle.existencia),
      existenciafardos: Number(detalle.existenciafardos),
      UnidadesFardo: Number(detalle.UnidadesFardo) || 0, 
      UPCPaquete: detalle.UPCProducto, 
    }));
  } catch (error) {
    console.error("Error al obtener los detalles del pedido:", error.message);
    throw new Error("Error al obtener los detalles del pedido.");
  }
};

export const buscarProducto = async (upc, descripcion) => {
  try {
    let query = `
                SELECT 
                    p.upc, 
                    p.desclarga AS descripcion, 
                    p.iddepartamentos, 
                    p.idubicacionbodega, 
                    ROUND(p.existencia, 2) AS existencia,
                    COALESCE(p.reservadopedido, 0) AS reservadopedido, 
                    pp.UPCPaquete, 
                    FLOOR(COALESCE(pp.cantidad, 1)) AS UnidadesFardo, -- Truncar a entero
                    FLOOR(p.existencia / COALESCE(NULLIF(pp.cantidad, 0), 1)) AS existenciafardos -- Truncar a entero
                FROM productos p
                LEFT JOIN productospaquetes pp ON p.UPC = pp.UPC
                `;
 
    const params = [];
 
    if (upc) {
      const upcNormalizado = String(upc).padStart(13, "0");
      query += " WHERE p.upc = ?";
      params.push(upcNormalizado);
    } else if (descripcion) {
      const palabras = descripcion.split(' ').filter(p => p);
      const condiciones = palabras.map(() => "p.desclarga LIKE ?");
      query += ` WHERE ${condiciones.join(" AND ")}`;
      params.push(...palabras.map(p => `%${p}%`));
    }
 
    return await dbManager.executeLocalQuery(query, params);
  } catch (error) {
    console.error("Error al buscar producto:", error.message);
    throw new Error("Error al buscar producto.");
  }
 };

/**
 * @param {string} descripcion
 * @param {number} cantidadSolicitada
 * @returns {Promise<{ success: boolean, productos?: Array, message?: string }>}
 */
export const buscarProductosReemplazo = async (descripcion, cantidadSolicitada) => {
  try {
    if (!descripcion || typeof descripcion !== "string") {
      throw new Error("Descripción inválida.");
    }

    if (!cantidadSolicitada || !Number.isFinite(cantidadSolicitada) || cantidadSolicitada <= 0) {
      throw new Error("Cantidad solicitada inválida.");
    }

    const query = `
                  SELECT 
                  p.upc, 
                  p.desclarga AS descripcion, 
                  p.iddepartamentos, 
                  p.idubicacionbodega, 
                  ROUND(p.existencia, 2) AS existencia,
                  COALESCE(p.reservadopedido, 0) AS reservadopedido, 
                  pp.UPCPaquete, 
                  FLOOR(COALESCE(pp.cantidad, 1)) AS UnidadesFardo, -- Truncar a entero
                  FLOOR(p.existencia / COALESCE(NULLIF(pp.cantidad, 0), 1)) AS existenciafardos, 
                  MATCH(p.desclarga) AGAINST(?) AS relevancia

                  FROM productos p
                  LEFT JOIN productospaquetes pp ON p.upc = pp.Upc
                  WHERE MATCH(p.desclarga) AGAINST(? IN NATURAL LANGUAGE MODE)
                  ORDER BY relevancia DESC
                  LIMIT 10;
    `;

    const productos = await dbManager.executeLocalQuery(query, [descripcion, descripcion, cantidadSolicitada]);

    if (!Array.isArray(productos) || productos.length === 0) {
      return { success: false, message: "No se encontraron productos con suficiente existencia en fardos." };
    }

    return { success: true, productos };
  } catch (error) {
    console.error("Error buscando productos de reemplazo:", error);
    return { success: false, message: "Error en la consulta de productos." };
  }
};

/**
 * Agrega un producto al detalle del pedido y registra el cambio en el historial.
 * @param {number} idPedido
 * @param {string} upc - UPCUnidad
 * @param {string} descripcion
 * @param {number} existencia - ExistenciaUnidad
 * @param {number} existenciaFardos
 * @param {number} idDepartamento
 * @param {number} idUbicacionBodega
 * @param {number} cantidad
 * @param {string} upcproducto - UPCFardo
 * @param {number} unidadesfardo
 * @param {boolean} esReemplazo
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export const agregarProductoDetalle = async (
  idPedido,
  upc,
  descripcion,
  existencia,
  existenciaFardos,
  idDepartamento,
  idUbicacionBodega,
  cantidad,
  upcproducto,
  unidadesfardo,
  esReemplazo = false
) => {
  try {
    existencia = parseFloat(existencia);
    existenciaFardos = parseFloat(existenciaFardos);
    cantidad = parseFloat(cantidad);
    unidadesfardo = parseInt(unidadesfardo || 1);
    idUbicacionBodega = parseInt(idUbicacionBodega || 0);

    if (!idPedido || !Number.isInteger(idPedido) || idPedido <= 0) {
      throw new Error("ID de pedido inválido.");
    }
    if (!upc || typeof upc !== "string") {
      throw new Error("UPC inválido.");
    }
    if (!descripcion || typeof descripcion !== "string") {
      throw new Error("Descripción inválida.");
    }
    if (!Number.isFinite(existencia)) {
      throw new Error("Existencia inválida.");
    }
    if (!Number.isFinite(existenciaFardos)) {
      throw new Error("Existencia en fardos inválida.");
    }
    if (!Number.isInteger(idDepartamento) || idDepartamento < 0) {
      throw new Error("ID de departamento inválido.");
    }
    if (!Number.isInteger(idUbicacionBodega) || idUbicacionBodega < 0) {
      throw new Error("ID de ubicación en bodega inválido.");
    }
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      throw new Error("Cantidad inválida.");
    }
    if (!Number.isFinite(unidadesfardo) || unidadesfardo <= 0) {
      throw new Error("UnidadesFardo inválida.");
    }

    // Fallback: si no hay upcproducto, usar el upc del detalle
    const upcFinal = upcproducto || upc;

    const query = `
      INSERT INTO detallepedidostienda_bodega 
      (idpedidos, upc, descripcion, existencia, existenciaFardos, iddepartamento, idubicacionbodega, cantidad, UPCProducto, UnidadesFardo, Faltante) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1);
    `;

    const result = await dbManager.executeLocalQuery(query, [
      idPedido,
      upc,
      descripcion,
      existencia,
      existenciaFardos,
      idDepartamento,
      idUbicacionBodega,
      cantidad,
      upcFinal,
      unidadesfardo
    ]);

    if (!result || result.affectedRows === 0) {
      return { success: false, message: "No se pudo agregar el producto." };
    }
    
    const idCambio = esReemplazo ? 4 : 1;

    await registrarCambioPedido(idPedido, idUsuario, idCambio, upc, 0, cantidad);

    return { success: true, message: "Producto agregado con éxito." };
  } catch (error) {
    console.error("Error agregando producto al pedido:", error.message);
    return { success: false, message: "Error al agregar el producto." };
  }
};


/**
 * @param {string} upc 
 * @param {number} idPedido 
 * @param {number} cantidad
 * @returns {Promise<{ success: boolean, message: string }> }
 */
export const actualizarCantidadProducto = async (upc, idPedido, cantidad) => {
  try {
    if (!idPedido || !Number.isInteger(idPedido) || idPedido <= 0) {
      throw new Error("ID de pedido inválido.");
    }

    if (!upc || typeof upc !== "string") {
      throw new Error("UPC inválido.");
    }

    if (cantidad === undefined || isNaN(Number(cantidad)) || Number(cantidad) <= 0) {
      throw new Error("Cantidad inválida. Debe ser un número mayor que cero.");
    }

    const cantidadNum = Number(cantidad);

    const querySelect = `SELECT cantidad FROM detallepedidostienda_bodega WHERE upc = ? AND idpedidos = ?;`;
    const resultado = await dbManager.executeLocalQuery(querySelect, [upc, idPedido]);

    if (resultado.length === 0) {
      return { success: false, message: "El producto no existe en el pedido." };
    }

    const cantidadAnterior = resultado[0].cantidad;

    const queryUpdate = `
      UPDATE detallepedidostienda_bodega 
      SET cantidad = ? 
      WHERE upc = ? AND idpedidos = ?;
    `;

    const result = await dbManager.executeLocalQuery(queryUpdate, [cantidadNum, upc, idPedido]);

    if (!result || result.affectedRows === 0) {
      return { 
        success: false, 
        message: "No hubo cambios en la cantidad." 
      };
    }

    await registrarCambioPedido(idPedido, idUsuario, 2, upc, cantidadAnterior,cantidadNum);

    return { 
      success: true, 
      message: "Cantidad actualizada con éxito." 
    };

  } catch (error) {
    return { 
      success: false, 
      message: `Error al actualizar la cantidad: ${error.message}` 
    };
  }
};

/**
 * @param {string} upc
 * @param {number} idPedido
 * @param {number} idDetalle
 * @param {boolean} esReemplazo
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export const eliminarProductoDetalle = async (upc, idDetalle, idPedido, esReemplazo = false) => {
  try {
    const querySelect = `SELECT cantidad FROM detallepedidostienda_bodega WHERE idpedidos = ? AND Id = ?`;
    const resultado = await dbManager.executeLocalQuery(querySelect, [idPedido, idDetalle]);

    if (resultado.length === 0) {
        return { success: false, message: "El producto no existe en el pedido." };
    }

    const cantidadAnterior = resultado[0].cantidad;

    const queryDelete = `DELETE FROM detallepedidostienda_bodega WHERE idpedidos = ? AND Id = ?`;
    const result = await dbManager.executeLocalQuery(queryDelete, [idPedido, idDetalle]);

    if (result.affectedRows === 0) {
        return { success: false, message: "No se pudo eliminar el producto." };
    }

    const idCambio = esReemplazo ? 4 : 3;

    await registrarCambioPedido(idPedido, idUsuario, idCambio, upc, cantidadAnterior, 0);

    return { success: true, message: "Producto eliminado correctamente." };
} catch (error) {
    console.error("Error al eliminar producto:", error);
    return { success: false, message: "Error al eliminar el producto." };
}
};

/**
 * Actualiza la cantidad total de fardos en un pedido
 * @param {number} idPedido 
 * @param {number} nuevaCantidad 
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export const actualizarCantidadFardos = async (idPedido, nuevaCantidad) => {
  try {
    if (!idPedido || !Number.isInteger(idPedido) || idPedido <= 0) {
      throw new Error("ID de pedido inválido.");
    }

    if (nuevaCantidad === undefined || isNaN(Number(nuevaCantidad)) || Number(nuevaCantidad) < 0) {
      throw new Error("Cantidad inválida. Debe ser un número mayor o igual a cero.");
    }

    const query = `UPDATE pedidostienda_bodega SET TotalCantidad = ? WHERE IdPedidos = ?;`;
    const result = await dbManager.executeLocalQuery(query, [nuevaCantidad, idPedido]);

    if (!result || result.affectedRows === 0) {
      return { success: false, message: "No hubo cambios en la cantidad de fardos." };
    }

    return { success: true, message: "Cantidad de fardos actualizada con éxito." };
  } catch (error) {
    return { success: false, message: `Error al actualizar la cantidad de fardos: ${error.message}` };
  }
};

/**
 * Actualiza la observación de un producto en un pedido.
 * @param {number} idPedido 
 * @param {string} upc 
 * @param {string} observacion 
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export const actualizarObservacion = async (idPedido, upc, observacion) => {
  try {
    if (!idPedido || !Number.isInteger(idPedido) || idPedido <= 0) {
      throw new Error("ID de pedido inválido.");
    }

    if (!upc || typeof upc !== "string") {
      throw new Error("UPC inválido.");
    }

    if (observacion === undefined || typeof observacion !== "string") {
      throw new Error("Observación inválida.");
    }

    const query = `
      UPDATE detallepedidostienda_bodega 
      SET Observaciones = ? 
      WHERE Upc = ? AND IdPedidos = ?;
    `;

    const result = await dbManager.executeLocalQuery(query, [observacion, upc, idPedido]);

    if (!result || result.affectedRows === 0) {
      return { success: false, message: "No hubo cambios en la observación." };
    }

    return { success: true, message: "Observación actualizada con éxito." };

  } catch (error) {
    return { success: false, message: `Error al actualizar la observación: ${error.message}` };
  }
};

/**
 * @param {number} idPedido
 * @returns {Promise<{ success: boolean, message: string }> }
 */
export const confirmarPedido = async (idPedido) => {
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
    const nuevoEstado = 4; 

    const queryActualizarEstado = `
      UPDATE pedidostienda_bodega 
      SET estado = ? 
      WHERE idpedidos = ?`;

    const resultEstado = await dbManager.executeLocalQuery(queryActualizarEstado, [nuevoEstado, idPedido]);

    if (!resultEstado || resultEstado.affectedRows === 0) {
      return { success: false, message: `No se pudo actualizar el estado del pedido con ID: ${idPedido}.` };
    }

    const queryActualizarConsolidado = `
      UPDATE detallepedidostienda_bodega 
      SET IdConsolidado = ? 
      WHERE idpedidos = ?`;

    const resultConsolidado = await dbManager.executeLocalQuery(queryActualizarConsolidado, [idPedido, idPedido]);

    if (!resultConsolidado || resultConsolidado.affectedRows === 0) {
      return { success: false, message: `No se pudo actualizar los detalles del pedido con ID: ${idPedido}.` };
    }

    await registrarCambioPedido(idPedido, idUsuario, 5, null, estadoAnterior, nuevoEstado);

    return { success: true, message: `Pedido ${idPedido} confirmado correctamente.` };

  } catch (error) {
    console.error("Error al confirmar el pedido:", error.message);
    return { success: false, message: "Error al confirmar el pedido." };
  }
};

export const actualizarReservados = async (upcsPaquete) => {
  try {
    if (!Array.isArray(upcsPaquete) || upcsPaquete.length === 0) {
      throw new Error("Lista de UPCPaquete inválida.");
    }

    const query = `
      UPDATE productos 
      SET ReservadoPedido = COALESCE(ReservadoPedido, 0) + 1 
      WHERE UPC = ?;
    `;

    const queries = upcsPaquete.map((upc) => dbManager.executeLocalQuery(query, [upc]));

    await Promise.all(queries);

    return { success: true, message: "Existencias reservadas actualizadas correctamente." };
  } catch (error) {
    console.error("Error al actualizar existencias reservadas:", error.message);
    return { success: false, message: "Error al actualizar existencias reservadas." };
  }
};


export const validarPedidos = async (selectedIds) => {
  try {
    if (!Array.isArray(selectedIds) || selectedIds.length === 0) {
      throw new Error("Lista de pedidos inválida.");
    }

    const placeholders = selectedIds.map(() => "?").join(",");
    const query = `SELECT IdPedidos, Estado FROM pedidostienda_bodega WHERE IdPedidos IN (${placeholders})`;

    const pedidos = await dbManager.executeLocalQuery(query, selectedIds);

    if (!pedidos || pedidos.length === 0) {
      return { valid: false, message: "No se encontraron los pedidos en la base de datos." };
    }

    const pedidosInvalidos = pedidos.filter(pedido => pedido.Estado !== 2);

    if (pedidosInvalidos.length > 0) {
      const idsInvalidos = pedidosInvalidos.map(p => p.IdPedidos).join(", ");
      return { valid: false, message: `Antes de consolidar debe revisar los siguientes pedidos: ${idsInvalidos}` };
    }

    return { valid: true };
  } catch (error) {
    console.error("Error al validar pedidos:", error.message);
    throw new Error("No se pudo validar los pedidos.");
  }
};

export const consolidarPedidos = async (idPedidos) => {
  try {
    if (!idPedidos || idPedidos.length === 0) {
      return {
        success: false,
        errorCode: "NO_PEDIDOS",
        message: "No hay pedidos seleccionados para consolidar."
      };
    }

    const sucursalQuery = `
      SELECT DISTINCT NombreSucursal, IdSucursales 
      FROM pedidostienda_bodega
      WHERE IdPedidos IN (${idPedidos.join(",")})
    `;

    const sucursalResult = await dbManager.executeLocalQuery(sucursalQuery);

    if (sucursalResult.length === 0) {
      return {
        success: false,
        errorCode: "PEDIDOS_NO_ENCONTRADOS",
        message: "No se pudo obtener la información de los pedidos."
      };
    }

    if (sucursalResult.length > 1) {
      return {
        success: false,
        errorCode: "DIFERENTES_SUCURSALES",
        message: "Solo se pueden consolidar pedidos de la misma sucursal."
      };
    }

    const { NombreSucursal, IdSucursales } = sucursalResult[0];
    const NombreEmpresa = `${NombreSucursal} (CONSOLIDADO)`;

    const cantidadQuery = `
      SELECT SUM(Cantidad) AS totalCantidad 
      FROM detallepedidostienda_bodega
      WHERE idpedidos IN (${idPedidos.join(",")})
    `;
    const cantidadResult = await dbManager.executeLocalQuery(cantidadQuery);
    const totalCantidad = cantidadResult[0]?.totalCantidad || 0;

    const insertQuery = `
      INSERT INTO pedidostienda_bodega 
      (NombreUsuario, Fecha, FechaHora, Estado, NombreEmpresa, TotalCantidad, Departamento, NombreSucursal, IdSucursales)
      VALUES (?, NOW(), NOW(), ?, ?, ?, ?, ?, ?)
    `;

    const insertResult = await dbManager.executeLocalQuery(insertQuery, [
      "Consolidado en sistema",
      4,
      NombreEmpresa,
      totalCantidad,
      1,
      NombreSucursal,
      IdSucursales,
    ]);

    const idPedidoConsolidado = insertResult.insertId;

    await registrarCambioPedido(idPedidoConsolidado, idUsuario, 5, null, 3, 4);

    const updateQuery = `
      UPDATE pedidostienda_bodega 
      SET Estado = 3 
      WHERE IdPedidos IN (${idPedidos.join(",")})
    `;
    await dbManager.executeLocalQuery(updateQuery);

    for (const idPedido of idPedidos) {
      await registrarCambioPedido(idPedido, idUsuario, 5, null, 2, 3);
    }

    const updateDetallesQuery = `
      UPDATE detallepedidostienda_bodega 
      SET IdConsolidado = ? 
      WHERE idpedidos IN (${idPedidos.join(",")})
    `;
    await dbManager.executeLocalQuery(updateDetallesQuery, [idPedidoConsolidado]);

    return {
      success: true,
      message: "Pedido consolidado con éxito. Se actualizaron los pedidos a estado 3 y se vinculó el consolidado.",
      idPedido: idPedidoConsolidado,
    };
  } catch (error) {
    console.error("Error al consolidar pedidos:", error.message);
    return { 
      success: false, 
      errorCode: "ERROR_INTERNO",
      message: "No se pudo consolidar los pedidos."
    };
  }
};

export const actualizarDepartamento = async (idPedido, departamento) => {
  try {
    const query = `UPDATE pedidostienda_bodega SET Departamento = ? WHERE idpedidos = ?`;
    const result = await dbManager.executeLocalQuery(query, [departamento, idPedido]);

    return result.affectedRows > 0;
  } catch (error) {
    console.error("Error al actualizar el departamento del pedido:", error);
    return false;
  }
};

export const anularPedido = async (idPedido) => {
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
    const nuevoEstado = 8; 

    const queryActualizarEstado = `
      UPDATE pedidostienda_bodega 
      SET estado = ? 
      WHERE idpedidos = ?`;

    const resultEstado = await dbManager.executeLocalQuery(queryActualizarEstado, [nuevoEstado, idPedido]);

    if (!resultEstado || resultEstado.affectedRows === 0) {
      return { success: false, message: `No se pudo anular el pedido con ID: ${idPedido}.` };
    }

    await registrarCambioPedido(idPedido, idUsuario, 5, null, estadoAnterior, nuevoEstado);

    return { success: true, message: `Pedido ${idPedido} anulado correctamente.` };

  } catch (error) {
    console.error("Error anulando pedido:", error.message);
    return { success: false, message: "Error al anular el pedido." };
  }
};

/**
 * Actualiza la observación de un producto en un pedido.
 * @param {number} idPedido 
 * @param {string} sucursal 
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export const actualizarSucursal = async (idPedido, sucursal) => {
  try {
    if (!idPedido || !Number.isInteger(idPedido) || idPedido <= 0) {
      throw new Error("ID de pedido inválido.");
    }

    if (sucursal === undefined || typeof sucursal !== "string") {
      throw new Error("Observación inválida.");
    }

    const query = `
      UPDATE pedidostienda_bodega 
      SET NombreEmpresa = ? 
      WHERE IdPedidos = ?;
    `;

    const result = await dbManager.executeLocalQuery(query, [sucursal, idPedido]);

    if (!result || result.affectedRows === 0) {
      return { success: false, message: "No hubo cambios en la observación." };
    }

    return { success: true, message: "Observación actualizada con éxito." };

  } catch (error) {
    return { success: false, message: `Error al actualizar la observación: ${error.message}` };
  }
};

export const actualizarExistencias = async (idPedido) => {
  try {
    // 1. Corregir UPCProducto si viene vacío, nulo o 0
    const queryDetallesSinUPCProducto = `
      SELECT idpedidos, upc
      FROM detallepedidostienda_bodega
      WHERE idpedidos = ?
        AND (UPCProducto IS NULL OR UPCProducto = '' OR UPCProducto = '0')
    `;
    
    const detallesSinUPC = await dbManager.executeLocalQuery(queryDetallesSinUPCProducto, [idPedido]);

    for (const detalle of detallesSinUPC) {
      const upcPaquete = detalle.upc;

      const resultado = await dbManager.executeLocalQuery(
        `SELECT upc FROM productospaquetes WHERE upcpaquete = ? LIMIT 1`,
        [upcPaquete]
      );

      const nuevoUPC = resultado.length > 0 ? resultado[0].upc : upcPaquete;

      await dbManager.executeLocalQuery(`
        UPDATE detallepedidostienda_bodega
        SET UPCProducto = ?
        WHERE idpedidos = ? AND upc = ?
      `, [nuevoUPC, detalle.idpedidos, upcPaquete]);
    }

    // 2. Obtener los productos del detalle
    const queryDetalles = `
      SELECT idpedidos, upc, UPCProducto, UnidadesFardo
      FROM detallepedidostienda_bodega
      WHERE idpedidos = ?
    `;
    
    const detalles = await dbManager.executeLocalQuery(queryDetalles, [idPedido]);

    if (!detalles || detalles.length === 0) {
      return {
        success: false,
        message: "No se encontraron detalles para el pedido especificado"
      };
    }

    // 3. Obtener todos los UPCProducto distintos
    const upcs = detalles
      .map(d => d.UPCProducto)
      .filter(Boolean); // Remueve null, undefined, ''

    if (upcs.length === 0) {
      return {
        success: false,
        message: "No hay UPCProducto válidos para actualizar existencias"
      };
    }

    // 4. Buscar existencias por UPCProducto directamente
    const queryExistencias = `
      SELECT UPC, Existencia
      FROM productos
      WHERE UPC IN (${upcs.map(() => '?').join(',')})
    `;
    const existencias = await dbManager.executeLocalQuery(queryExistencias, upcs);

    // 5. Crear un mapa para fácil acceso
    const existenciasMap = new Map();
    existencias.forEach(prod => {
      existenciasMap.set(prod.UPC, prod.Existencia);
    });

    // 6. Actualizar existencias por cada detalle
    for (const detalle of detalles) {
      const existenciaUnidad = existenciasMap.get(detalle.UPCProducto) || 0;
      const existenciaFardo = detalle.UnidadesFardo > 0
        ? parseFloat((existenciaUnidad / detalle.UnidadesFardo).toFixed(2))
        : 0;

      await dbManager.executeLocalQuery(`
        UPDATE detallepedidostienda_bodega
        SET existencia = ?, existenciaFardos = ?
        WHERE idpedidos = ? AND upc = ?
      `, [existenciaUnidad, existenciaFardo, idPedido, detalle.upc]);
    }

    return {
      success: true,
      message: `Se actualizaron existencias de ${detalles.length} productos`,
      idPedido
    };

  } catch (error) {
    console.error("Error actualizando existencias:", error.message);
    return {
      success: false,
      message: `Error al actualizar existencias: ${error.message}`
    };
  }
};


export const actualizarVariedad = async (idPedido, upcProducto, variedad) => {
  try {
    const query = `
      UPDATE detallepedidostienda_bodega
      SET Variedad = ?
      WHERE idpedidos = ? AND upcproducto = ?
    `;

    const result = await dbManager.executeLocalQuery(query, [variedad, idPedido, upcProducto]);

    if (result.affectedRows === 0) {
      return {
        success: false,
        message: "No se encontró un producto con ese IDPedido y UPCProducto.",
      };
    }

    return {
      success: true,
      message: "Variedad actualizada correctamente.",
    };
  } catch (error) {
    console.error("Error en orderService.actualizarVariedad:", error.message);
    return {
      success: false,
      message: `Error al actualizar la variedad: ${error.message}`,
    };
  }
};

export const obtenerVariedad = async (idPedido, upcProducto) => {
  try {
    const query = `
      SELECT Variedad
      FROM detallepedidostienda_bodega
      WHERE idpedidos = ? AND upcproducto = ?
      LIMIT 1
    `;
    const result = await dbManager.executeLocalQuery(query, [idPedido, upcProducto]);

    if (!result || result.length === 0 || !result[0].Variedad) {
      return { success: true, variedad: "" }; // vacío si no hay
    }

    return {
      success: true,
      variedad: result[0].Variedad,
    };
  } catch (error) {
    return {
      success: false,
      message: error.message,
    };
  }
};

