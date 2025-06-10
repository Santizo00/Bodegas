import dbManager from "../config/db.js";

export const getCronogramOrders = async (dia = null) => {
  try {
    const diaActual = dia || obtenerDiaDeLaSemana(); // Usar el día proporcionado o el día actual

    const queryCronograma = `
      SELECT c.IdSucursal, c.NombreSucursal, e.Descripcion , "${diaActual}" as diaDeLaSemana
      FROM cronogramapedidos c 
      LEFT JOIN estadocronograma e ON e.Tipo = c.${diaActual}
      WHERE c.${diaActual} = 2;
    `;

    const rowsCronograma = await dbManager.executeLocalQuery(queryCronograma);

    if (!Array.isArray(rowsCronograma)) {
      return [];
    }

    const idsSucursales = rowsCronograma.map((row) => row.IdSucursal);

    const queryPedidos = `
      SELECT IdSucursales, COUNT(*) AS cantidadPedidos
      FROM pedidostienda_bodega
      WHERE IdSucursales IN (${idsSucursales.join(",")})
      AND Estado <= 2
      GROUP BY IdSucursales;
    `;

    const rowsPedidos = await dbManager.executeLocalQuery(queryPedidos);

    const pedidosPorSucursal = new Map();
    rowsPedidos.forEach((row) => {
      pedidosPorSucursal.set(row.IdSucursales, row.cantidadPedidos);
    });

    const data = rowsCronograma.map((row) => ({
      idSucursal: row.IdSucursal,
      nombreSucursal: row.NombreSucursal,
      descripcion: row.Descripcion,
      cantidad: pedidosPorSucursal.get(row.IdSucursal) || 0,
    }));

    return data;
  } catch (error) {
    console.error("Error al obtener el cronograma de pedidos:", error.message);
    throw error;
  }
};

const obtenerDiaDeLaSemana = () => {
  const diasSemana = [
    "Domingo",
    "Lunes",
    "Martes",
    "Miercoles",
    "Jueves",
    "Viernes",
    "Sabado",
  ];
  const hoy = new Date();
  return diasSemana[hoy.getDay()];
};