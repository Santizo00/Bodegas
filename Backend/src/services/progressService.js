import dbManager from "../config/db.js";

export const getProgressData = async () => {
  try {
    if (!dbManager.isLocalDBConfigured()) {
      console.warn("Base de datos local no configurada");
      return [];
    }

    const query = `
      SELECT p.IdPedidos, p.Estado, e.EstadoPedido, p.NombreEmpresa, p.Departamento 
      FROM pedidostienda_bodega p
      INNER JOIN estadopedidotiendabodega e ON p.Estado = e.IdEstado
      WHERE Estado IN (1, 2, 4, 5, 6);
    `;

    const rows = await dbManager.executeLocalQuery(query);

    if (!Array.isArray(rows)) {
      return [];
    }

    const data = rows.map((pedido) => ({
      idPedido: pedido.IdPedidos,
      sucursal: `${pedido.NombreEmpresa} (${pedido.Departamento || " "})`,
      estado: pedido.EstadoPedido,
      porcentaje: calcularPorcentaje(pedido.Estado),
    }));

    return data;
  } catch (error) {
    console.error("Error al obtener el progreso de los pedidos:", error.message);
    return [];  // Retornamos array vacío en lugar de lanzar error
  }
};

export const calcularPorcentaje = (estado) => {
  switch (estado) {
    case 1:
      return 20;
    case 2:
      return 40;
    case 4:
      return 60;
    case 5:
      return 80;
    case 6:
      return 100;
    default:
      return 0;
  }
};