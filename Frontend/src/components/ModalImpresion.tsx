import React, { memo, useState, useEffect, useRef } from 'react';
import { Info, Printer, X, Package, Upload } from 'lucide-react';
import { useDrag, useDrop, DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

interface DetallePedido {
  id: number;
  idpedidos: number;
  upc: string;
  descripcion: string;
  cantidad: number;
  existencia: number;
  existenciafardos: number;
  iddepartamentos: number;
  Ubicacion: string;
  Departamento: string;
  confirmacion: number;
  reservadopedido: number;
  UPCProducto: string;
  UnidadesFardo: number;
  Observaciones: string;
  Proveedor: string;
  Variedad: string;
  MalEstado: number;
  Categoria: string;
}

// Interface actualizada para ModalImpresion
interface ModalImpresionProps {
  isOpen: boolean;
  onClose: () => void;
  printData: DetallePedido[];
  idPedido: string;
  sucursal: string;
  estado: string;
  departamento?: string;
  fardos?: string;
  ubicacion?: string | number;
  ubicacionOriginal?: string | number;
  onPrint: () => void;
}

// Componente de información del pedido
const InfoPedido = memo(({ sucursal, estado, departamento, fardos }: { 
  sucursal: string;
  estado: string;
  departamento: string;
  fardos: string;
}) => (
  <div className="grid grid-cols-4 gap-4 rounded-lg mb-3">        
    <h2 className="font-semibold text-black text-sm">Sucursal: {sucursal}</h2>
    <h2 className="font-semibold text-black text-sm">Estado: {estado}</h2>
    <h2 className="font-semibold text-black text-sm">Departamento: {departamento || "No especificado"}</h2>
    <h2 className="font-semibold text-black text-sm">Cantidad: {fardos}</h2>
  </div>
));

// Componente Draggable para los items
const DraggableItem = memo(({ 
  item, 
  index, 
  moveItem,
  ubicacion,
  sucursalUbicacion // Nueva prop para la ubicación de la sucursal
}: { 
  item: DetallePedido;
  index: number;
  moveItem: (dragIndex: number, hoverIndex: number, fromUbicacion: string, toUbicacion: string) => void;
  ubicacion: string;
  sucursalUbicacion?: string | number; // Nueva prop
}) => {
  const ref = useRef<HTMLDivElement>(null);

  // Determinar si se trata de una ubicación especial (3 o 5)
  const esUbicacionEspecial = 
    sucursalUbicacion === '2' || 
    sucursalUbicacion === '3' || 
    sucursalUbicacion === '5' || 
    sucursalUbicacion === '8' || 
    sucursalUbicacion === 2 || 
    sucursalUbicacion === 3 || 
    sucursalUbicacion === 5 ||
    sucursalUbicacion === 8;

  const [{ isDragging }, drag] = useDrag({
    type: 'ITEM',
    item: { index, ubicacion, id: item.id },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [{ isOver }, drop] = useDrop({
    accept: 'ITEM',
    hover: (draggedItem: { index: number; ubicacion: string; id: number }, monitor) => {
      if (!ref.current) return;
      
      const dragIndex = draggedItem.index;
      const hoverIndex = index;
      const fromUbicacion = draggedItem.ubicacion;
      const toUbicacion = ubicacion;
      
      // No reordenar si estamos en la misma posición
      if (dragIndex === hoverIndex && fromUbicacion === toUbicacion) return;
      
      // Determinar el rectángulo en la pantalla
      const hoverBoundingRect = ref.current.getBoundingClientRect();
      
      // Obtener la posición vertical del medio
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      
      // Determinar la posición del ratón
      const clientOffset = monitor.getClientOffset();
      
      // Obtener píxeles hasta la parte superior
      const hoverClientY = clientOffset!.y - hoverBoundingRect.top;
      
      // Solo realizar la acción si cruzamos la mitad del elemento
      // para reducir el "ruido" del movimiento
      if (fromUbicacion === toUbicacion) {
        // Si moviendo en la misma ubicación, requerir cruzar el medio
        if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
          return;
        }
        if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
          return;
        }
      }
      
      // Realizar el movimiento
      moveItem(dragIndex, hoverIndex, fromUbicacion, toUbicacion);
      
      // Actualizar el índice para el elemento arrastrado
      if (fromUbicacion === toUbicacion) {
        draggedItem.index = hoverIndex;
      } else {
        // Si estamos en una ubicación diferente, ahora estamos en el final
        draggedItem.index = hoverIndex;
        draggedItem.ubicacion = toUbicacion;
      }
    },
    collect: (monitor) => ({
      isOver: !!monitor.isOver(),
    }),
  });

  drag(drop(ref));

  return (
    
    <div 
      ref={ref}
      className={`bg-white p-3 border-x border-b last:rounded-b-md flex items-center ${
        isDragging ? 'opacity-50 bg-gray-100' : 'opacity-100'
      } ${isOver ? 'border-blue-500 border-2' : ''}`}
      style={{ cursor: 'move' }}
    >
      <div className="grid grid-cols-12 gap-2 w-full items-center">
        <div className="col-span-2 font-medium text-black">
          {esUbicacionEspecial ? (item.UPCProducto || item.upc) : item.upc}
          <span className="text-gray-500 text-xs ml-1">(x{item.UnidadesFardo || 1})</span>
        </div>

        <div className={`col-span-3 font-medium text-gray-700`}>
          {item.descripcion}
        </div>

        <div className="col-span-1 text-center text-black">{item.cantidad}</div>
        <div className="col-span-1 text-center text-black">
          {esUbicacionEspecial 
            ? Math.floor(item.existencia || 0) 
            : Math.floor(item.existenciafardos || 0)}
        </div>

          <div className="col-span-1 text-center text-black">{item.MalEstado ?? "0"}</div>

          <div className="col-span-2 text-black">{item.Proveedor || "N/A"}</div>

          <div className="col-span-2 text-black">{item.Categoria || "N/A"}</div>

      </div>


    </div>
  );
});

// Componente para áreas de ubicación donde se pueden soltar elementos
const UbicacionDropArea = memo(({ 
  ubicacion,
  items,
  moveItem,
  sucursalUbicacion, // Ubicación de la sucursal
  soloConExistencia // Nueva prop para filtrar por existencia
}: {
  ubicacion: string;
  items: DetallePedido[];
  moveItem: (dragIndex: number, hoverIndex: number, fromUbicacion: string, toUbicacion: string) => void;
  sucursalUbicacion?: string | number;
  soloConExistencia: boolean; // Nueva prop
}) => {
  // Determinar si es una ubicación especial (3 o 5)
  const esUbicacionEspecial = 
    sucursalUbicacion === '3' || 
    sucursalUbicacion === '5' || 
    sucursalUbicacion === 3 || 
    sucursalUbicacion === 5;
  
  // Filtrar items según la existencia si el checkbox está activo
  const filteredItems = soloConExistencia 
    ? items.filter(item => {
        // Verificar la existencia según el tipo de ubicación
        const existencia = esUbicacionEspecial
          ? Math.floor(item.existencia || 0)
          : Math.floor(item.existenciafardos || 0);
        
        // Mostrar solo si hay existencia
        return existencia > 0;
      })
    : items;
  
  return (
    <div className="mb-4">
      {/* Encabezado de ubicación */}
      <div className="bg-gray-200 p-2 rounded-t-md flex items-center">
        <Package size={16} className="mr-2 text-black" />
        <span className="font-medium text-gray-700">
          {ubicacion}
        </span>
        <span className="ml-2 text-xs text-gray-500">
          ({filteredItems.length} productos)
        </span>
      </div>
      
      {/* Productos draggables de esta ubicación */}
      {filteredItems.map((item, index) => (
        <DraggableItem
          key={`${ubicacion}-${item.id}-${index}`}
          item={item}
          index={index}
          moveItem={moveItem}
          ubicacion={ubicacion}
          sucursalUbicacion={sucursalUbicacion}
        />
      ))}
      
      {/* Área vacía para permitir soltar cuando no hay elementos */}
      {filteredItems.length === 0 && (
        <div className="bg-white p-4 border-x border-b rounded-b-md text-center text-gray-400">
          {soloConExistencia 
            ? "No hay productos con existencia en esta ubicación" 
            : "Arrastra productos a esta ubicación"}
        </div>
      )}
    </div>
  );
});

// Componente principal - ModalImpresion
const ModalImpresion: React.FC<ModalImpresionProps> = ({
  isOpen,
  onClose,
  printData,
  idPedido,
  sucursal,
  estado,
  departamento = "No especificado",
  fardos = "0",
  ubicacion, 
  ubicacionOriginal, 
}) => {
  const [groupedItems, setGroupedItems] = useState<Record<string, DetallePedido[]>>({});
  const [, setOriginalGroupedItems] = useState<Record<string, DetallePedido[]>>({});
  const [, setItemsMap] = useState<Map<number, DetallePedido>>(new Map());
  const [soloConExistencia, setSoloConExistencia] = useState<boolean>(false); // Estado para el checkbox
  const [mostrarProveedor, setMostrarProveedor] = useState<boolean>(true);
  const [mostrarMalEstado, setMostrarMalEstado] = useState<boolean>(true);
  const [mostrarCategoria, setMostrarCategoria] = useState<boolean>(true);
  const API_URL = import.meta.env.VITE_URL_BACKEND;
  const [sortField, setSortField] = useState<keyof DetallePedido | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const handleSort = (field: keyof DetallePedido) => {
    setGroupedItems(prev => {
      const newGroupedItems: Record<string, DetallePedido[]> = {};
  
      Object.entries(prev).forEach(([ubicacion, items]) => {
        const sortedItems = [...items];
        const isNumeric = ["cantidad", "existencia", "existenciafardos", "MalEstado"].includes(String(field));
  
        sortedItems.sort((a, b) => {
          const aVal = a[field];
          const bVal = b[field];
  
          if (isNumeric) {
            const aNum = Number(aVal ?? 0);
            const bNum = Number(bVal ?? 0);
            return sortOrder === "asc" ? aNum - bNum : bNum - aNum;
          }
  
          const aStr = String(aVal ?? '');
          const bStr = String(bVal ?? '');
          return sortOrder === "asc"
            ? aStr.localeCompare(bStr)
            : bStr.localeCompare(aStr);
        });
  
        newGroupedItems[ubicacion] = sortedItems;
      });
  
      return newGroupedItems;
    });
  
    // Alternar la dirección o setear el nuevo campo
    if (sortField === field) {
      setSortOrder(prev => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };
  

  const getSortIcon = (field: keyof DetallePedido) => {
    if (sortField !== field) return null;
    return sortOrder === "asc" ? " ▲" : " ▼";
  };

  // Verificar si es una ubicación especial (3 o 5)
  const esUbicacionEspecial = 
    ubicacion === '3' || 
    ubicacion === '5' || 
    ubicacion === 3 || 
    ubicacion === 5;

  // Función personalizada para manejar el cierre del modal
  const handleClose = () => {
    // Restaurar datos sin ordenamientos (en el mismo orden original)
    const freshGroupedItems: Record<string, DetallePedido[]> = {};
  
    printData.forEach((item) => {
      const ubicacion = item.Ubicacion || "Sin Ubicación";
      if (!freshGroupedItems[ubicacion]) freshGroupedItems[ubicacion] = [];
      freshGroupedItems[ubicacion].push(item);
    });
  
    // Reset completo de estado
    setGroupedItems(freshGroupedItems);
    setOriginalGroupedItems(JSON.parse(JSON.stringify(freshGroupedItems)));
    setSortField(null);
    setSortOrder("asc");
    setSoloConExistencia(false);   // igual acá
    onClose();
  };
  

  useEffect(() => {
    // Inicializar los datos agrupados y mapa de items
    const initialGroupedData: Record<string, DetallePedido[]> = {};
    const itemMap = new Map<number, DetallePedido>();
    
    printData.forEach(item => {
      const ubicacion = item.Ubicacion || "Sin Ubicación";
      if (!initialGroupedData[ubicacion]) initialGroupedData[ubicacion] = [];
      initialGroupedData[ubicacion].push(item); // orden original se mantiene
    });
    
    setGroupedItems(initialGroupedData);
    // Guardar una copia de los datos originales
    setOriginalGroupedItems(JSON.parse(JSON.stringify(initialGroupedData)));
    setItemsMap(itemMap);
  }, [printData]);

  useEffect(() => {
    if (ubicacionOriginal === '8' || ubicacionOriginal === 8) {
      setMostrarMalEstado(true);
      setMostrarProveedor(false);
      setMostrarCategoria(false); 
    } else if (ubicacionOriginal === '2' || ubicacionOriginal === 2) {
      setMostrarMalEstado(false);
      setMostrarProveedor(true);
      setMostrarCategoria(true);
    } else {
      setMostrarMalEstado(false);
      setMostrarProveedor(false);
      setMostrarCategoria(false);
    }
  }, [ubicacion]);
  
  
  // Función principal para mover elementos entre o dentro de ubicaciones
  const moveItem = (dragIndex: number, hoverIndex: number, fromUbicacion: string, toUbicacion: string) => {
    setGroupedItems(prev => {
      const newGroupedItems = { ...prev };
      
      // Si la ubicación de origen no existe, creamos un array vacío
      if (!newGroupedItems[fromUbicacion]) {
        newGroupedItems[fromUbicacion] = [];
      }
      
      // Si la ubicación de destino no existe, creamos un array vacío
      if (!newGroupedItems[toUbicacion]) {
        newGroupedItems[toUbicacion] = [];
      }
      
      // Obtenemos el array de la ubicación de origen
      const sourceItems = [...newGroupedItems[fromUbicacion]];
      
      // Removemos el elemento arrastrado de la ubicación de origen
      const [draggedItem] = sourceItems.splice(dragIndex, 1);
      
      // Si estamos moviendo a una ubicación diferente
      if (fromUbicacion !== toUbicacion) {
        // Actualizamos la ubicación del elemento
        const updatedItem = { ...draggedItem, Ubicacion: toUbicacion };
        
        // Obtenemos el array de la ubicación de destino
        const destinationItems = [...newGroupedItems[toUbicacion]];
        
        // Insertamos el elemento en la nueva ubicación
        destinationItems.splice(hoverIndex, 0, updatedItem);
        
        // Actualizamos ambos arrays
        newGroupedItems[fromUbicacion] = sourceItems;
        newGroupedItems[toUbicacion] = destinationItems;
        
        // También actualizamos el mapa de elementos
        setItemsMap(prevMap => {
          const newMap = new Map(prevMap);
          newMap.set(draggedItem.id, updatedItem);
          return newMap;
        });
      } else {
        // Si estamos moviendo dentro de la misma ubicación
        // simplemente reordenamos
        sourceItems.splice(hoverIndex, 0, draggedItem);
        newGroupedItems[fromUbicacion] = sourceItems;
      }
      
      return newGroupedItems;
    });
  };

  // Función para filtrar los datos según la existencia
  const getFilteredData = () => {
    const filteredData: Record<string, DetallePedido[]> = {};
  
    Object.entries(groupedItems).forEach(([ubicacion, items]) => {
      const finalItems = soloConExistencia
        ? items.filter(item => {
            const existencia = esUbicacionEspecial
              ? safeNumber(item.existencia)
              : safeNumber(item.existenciafardos);
            return existencia > 0;
          })
        : items;
  
      if (finalItems.length > 0) {
        filteredData[ubicacion] = finalItems;
      }
    });
  
    return filteredData;
  };
  

  const safeNumber = (val: any): number => {
    if (val === undefined || val === null || val === '') return 0;
    const num = Number(val);
    return isNaN(num) ? 0 : num;
  };

  // Función para imprimir directamente sin mostrar la ventana
  const handlePrint = () => {
    // Obtener los datos filtrados si es necesario
    const dataToPrint = getFilteredData();
    
    // Crear un iframe oculto
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    document.body.appendChild(printFrame);
    
    // Filtrar ubicaciones vacías o inválidas
    const groupedData = Object.entries(dataToPrint).reduce((acc, [ubicacion, items]) => {
      // Verificamos que items exista, sea un array, y tenga elementos
      if (items && Array.isArray(items) && items.length > 0) {
        acc[ubicacion] = items;
      }
      return acc;
    }, {} as Record<string, DetallePedido[]>);
    
    // Obtenemos las ubicaciones que realmente tienen productos
    const sortedLocations = Object.keys(groupedData);

    // Obtener la fecha actual
    const today = new Date();
    const dateStr = today.toLocaleDateString('es-MX');
    
    // Definir filas máximas por página (títulos + productos)
    const maxRowsPerPage = 40;  // Límite máximo absoluto
    const safeRowsPerPage = 38; // Límite seguro recomendado
    
    // Planificar todas las filas 
    const allRows: Array<{ 
      isLocation: boolean; 
      locationName?: string; 
      productsCount?: number; 
      item?: DetallePedido;
      locationGroup?: string; 
    }> = [];
    
    // Agregar todas las filas, tanto títulos como productos
    sortedLocations.forEach(ubicacion => {
      const items = groupedData[ubicacion]; // Usamos groupedData que ya está filtrado
      
      // Verificar que items exista y tenga elementos
      if (items && items.length > 0) {
        // Agregar la ubicación como una fila
        allRows.push({
          isLocation: true,
          locationName: ubicacion,
          productsCount: items.length,
          locationGroup: ubicacion
        });
        
        // Agregar los productos de esta ubicación
        items.forEach(item => {
          allRows.push({ 
            isLocation: false, 
            item,
            locationGroup: ubicacion
          });
        });
      }
    });
    
    // Estrategia de distribución de páginas
    const pages: Array<Array<typeof allRows[0]>> = [];
    let currentPageRows: Array<typeof allRows[0]> = [];
    let currentPageRowCount = 0;
    
    // Recorrer todas las filas y distribuirlas en páginas
    for (let i = 0; i < allRows.length; i++) {
      const row = allRows[i];
      
      // Verificar si agregar esta fila excedería el límite seguro
      const wouldExceedSafeLimit = currentPageRowCount >= safeRowsPerPage;
      
      // Verificar si estamos cerca del límite máximo y la siguiente es un título
      const nearMaxLimitAndNextIsLocation = currentPageRowCount >= safeRowsPerPage && 
                                        i < allRows.length - 1 && 
                                        allRows[i + 1].isLocation;
      
      // Si excede el límite seguro o está cerca del máximo con título siguiente
      if (wouldExceedSafeLimit || nearMaxLimitAndNextIsLocation) {
        // Solo forzar nueva página si estamos en o sobre el límite seguro
        if (currentPageRowCount >= safeRowsPerPage) {
          pages.push(currentPageRows);
          currentPageRows = [];
          currentPageRowCount = 0;
          
          // Repetir título de ubicación si es necesario
          if (!row.isLocation && row.locationGroup) {
            // Verificar si groupedData tiene esta ubicación
            if (groupedData[row.locationGroup]) {
              const locationItems = groupedData[row.locationGroup];
              currentPageRows.push({
                isLocation: true,
                locationName: row.locationGroup,
                productsCount: locationItems.length,
                locationGroup: row.locationGroup
              });
              currentPageRowCount++;
            }
          }
        }
      }
      
      // Agregar la fila actual a la página
      currentPageRows.push(row);
      currentPageRowCount++;
      
      // Forzar nueva página si llegamos al máximo absoluto
      if (currentPageRowCount >= maxRowsPerPage) {
        pages.push(currentPageRows);
        currentPageRows = [];
        currentPageRowCount = 0;
      }
    }
    
    // Agregar la última página si tiene contenido
    if (currentPageRows.length > 0) {
      pages.push(currentPageRows);
    }

    const colspan = 4 + (mostrarMalEstado ? 1 : 0) + (mostrarProveedor ? 1 : 0) + (mostrarCategoria ? 1 : 0);

    // Generar el HTML para impresión con estilos optimizados
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>­</title>
        <style>
          @page {
            margin: 0.6cm;
            size: portrait;
          }
          
          @media print {
            @page {
              margin: 0.6cm;
              size: portrait;
            }
            
            body {
              margin: 0;
              padding: 0;
              font-size: 9.5px;
            }
            
            thead {
              display: table-header-group;
            }
            
            tfoot {
              display: table-footer-group;
            }
          }
          
          body {
            font-family: Arial, sans-serif;
            font-size: 9.5px;
            line-height: 1.15;
            margin: 0;
            padding: 0;
          }
          
          .page-header {
            display: flex;
            justify-content: space-between;
            border-bottom: 1px solid #000;
            padding-bottom: 3px;
            margin-bottom: 6px;
            font-size: 9.5px;
            page-break-after: avoid;
          }
          
          .header-col-left {
            width: 25%;
          }
          
          .header-col-center {
            width: 80%;
            text-align: center;
          }
          
          .header-col-right {
            width: 15%;
            text-align: right;
          }
          
          .sucursal-name {
            font-size: 19px;
            font-weight: bold;
            display: inline;
          }
          
          .departamento-name {
            font-size: 15px;
            font-weight: normal;
            display: inline;
          }
          
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9.5px;
            margin-bottom: 18px;
            page-break-inside: avoid;
            table-layout: fixed;
          }
          
          th {
            background-color: #000;
            font-weight: bold;
            border: 1px solid #000;
            padding: 2.5px 3px;
            text-align: left;
            height: 15px;
          }
          
          td {
            border: 1px solid #000;
            padding: 2.5px 3px;
            text-align: left;
            height: 15px;
            max-height: 15px;
          }
          
          .location-row {
            background-color: #e0e0e0;
            font-weight: bold;
            page-break-after: avoid;
            page-break-inside: avoid;
            font-size: 13px;
          }
          
          .location-row td {
            border: 2px solid #000;
            font-size: 13px;
            text-align: center;
          }
          
          /* Estilos para filas alternadas */
          .product-row {
            background-color: #ffffff;
          }
          
          .product-row-alt {
            background-color: #f5f5f5;
          }
          
          .footer-container {
            display: block;
            width: 100%;
            text-align: center;
            position: absolute;
            bottom: 0.6cm;
            left: 0;
            right: 0;
            height: 18px;
            clear: both;
          }
          
          .page-footer {
            font-size: 15px;
            font-weight: bold;
            background-color: white;
            padding: 2px 4px;
            display: inline-block;
          }
          
          .col-upc {
            height: 16px;
            width: 10.5%;
            font-size: 13px;
          }
          
          .col-desc {
            width: 36%;
            white-space: normal;
            overflow: visible;
            text-overflow: clip;
            font-size: 12.5px;
          }
          
          .col-cant {
            width: 1.8%;
            text-align: center;
            font-size: 13px;
          }
          
          .col-exist {
            width: 2.5%;
            text-align: center;
            font-size: 13px;
          }

          .col-malestado {
            width: 1.5%;
            text-align: center;
            font-size: 13px;
          }

          .col-upc-small {
            height: 16px;
            width: 10%;
            font-size: 11px;
          }

          .col-desc-small {
            height: 16px;
            width: 50%;
            white-space: normal;
            overflow: visible;
            text-overflow: clip;
            font-size: 11px;
          }

          .col-cant-small {
            height: 16px;
            width: 2.5%;
            text-align: center;
            font-size: 11px;
          }
            
          .col-exist-small {
            height: 16px;
            width: 2.5%;
            text-align: center;
            font-size: 11px;
          }

          .col-malestado-small {
            height: 16px;
            width: 3%;
            text-align: center;
            font-size: 9.5px;
          }
            
          .col-proveedor {
            width: 10%;
            text-align: left;
            font-size: 7px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
            
          .col-categoria {
            width: 6%;
            text-align: left;
            font-size: 7px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .page-container {
            position: relative;
            page-break-after: always;
            padding-bottom: 18px;
            min-height: 97.5%;
          }
          
          .page-container:last-child {
            page-break-after: auto;
          }
          
          /* Nuevas reglas para control de saltos */
          .section-start {
            page-break-before: always;
          }
          
          .keep-together {
            page-break-inside: avoid;
          }
        </style>
      </head>
      <body>
    `;
    
    // Generar el contenido de cada página
    let htmlContent = printContent;
    const totalPages = pages.length;
    
    pages.forEach((pageContent, pageIndex) => {
      const currentPage = pageIndex + 1;
      const isFirstPage = pageIndex === 0;

      // Calcular SKUs y fardos para esta página
      const pageSKUs = pageContent.filter(row => !row.isLocation).length;
      const pageFardos = pageContent
        .filter(row => !row.isLocation && row.item)
        .reduce((sum, row) => sum + Number(row.item?.cantidad || 0), 0);
      
      htmlContent += `
        <div class="page-container ${isFirstPage ? '' : 'section-start'}">
          <!-- Encabezado en cada página -->
          <div class="page-header keep-together">
            <div class="header-col-left">
              <div>COLABORADOR C.C. __________</div>
              <div>HORA INICIAL: ________________</div>
              <div>HORA FINAL: _________________</div>
            </div>
            <div class="header-col-center">
              <div>
                <span class="sucursal-name">${sucursal}</span>
                <br>
                <span class="departamento-name">IdPedido: ${idPedido}  ---  Departamento: ${departamento}  </span>
              </div>
            </div>
            <div class="header-col-right">
              <div>FECHA: ${dateStr}</div>
              <div>SKUs: ${pageSKUs}</div>
              <div>Fardos: ${pageFardos}</div>
            </div>
          </div>
          
          <!-- Tabla de productos para esta página -->
          <table class="keep-together">
            <thead>
              <tr>
                <th class="${mostrarProveedor ? 'col-upc-small' : 'col-upc'}">${esUbicacionEspecial ? "UPC Unidad" : "UPC Fardo"}</th>
                <th class="${mostrarProveedor ? 'col-desc-small' : 'col-desc'}">Descripción</th>
                <th class="${mostrarProveedor ? 'col-cant-small' : 'col-cant'}">Cant</th>
                <th class="${mostrarProveedor ? 'col-exist-small' : 'col-exist'}">Exis</th>
                ${mostrarMalEstado ? `<th class="${mostrarProveedor ? 'col-malestado-small' : 'col-malestado'}">M E</th>` : ``}
                ${mostrarProveedor ? `<th class="col-proveedor">Proveedor</th>` : ``}
                ${mostrarCategoria ? `<th class="col-categoria">Categoría</th>` : ``}
              </tr>
            </thead>
            <tbody>
      `;
      
      // Agregar filas de esta página con alternancia de colores
      let currentLocation = '';
      let rowCounter = 0; // Contador para alternar colores
      
      pageContent.forEach(row => {
        if (row.isLocation) {
          currentLocation = row.locationName || '';
          rowCounter = 0; // Reiniciar contador al cambiar de ubicación
          htmlContent += `
            <tr class="location-row keep-together">
              <td colspan="${colspan}">${currentLocation} (${row.productsCount} productos)</td>
            </tr>
          `;
        } else if (row.item) {
          const item = row.item;
          rowCounter++;
          const rowClass = rowCounter % 2 === 0 ? 'product-row-alt' : 'product-row';
          
          // Determinar qué UPC y existencia mostrar según la ubicación
          const upcToShow = esUbicacionEspecial ? (item.UPCProducto || item.upc) : item.upc;
          const existenciaToShow = esUbicacionEspecial 
            ? Math.floor(item.existencia || 0) 
            : Math.floor(item.existenciafardos || 0);
          
          htmlContent += `
            <tr class="keep-together ${rowClass}">
              <td class="${mostrarProveedor ? 'col-upc-small' : 'col-upc'}">${esUbicacionEspecial ? `${upcToShow}` : `${upcToShow} (x${item.UnidadesFardo || 1})`}</td>
              <td class="${mostrarProveedor ? 'col-desc-small' : 'col-desc'}">${item.descripcion || ''}</td>
              <td class="${mostrarProveedor ? 'col-cant-small' : 'col-cant'}">${item.cantidad || 0}</td>
              <td class="${mostrarProveedor ? 'col-exist-small' : 'col-exist'}">${existenciaToShow}</td>
              ${mostrarMalEstado ? `<td class="${mostrarProveedor ? 'col-malestado-small' : 'col-malestado'}">${item.MalEstado}</td>` : ``}
              ${mostrarProveedor ? `<td class="col-proveedor">${item.Proveedor || ''}</td>` : ``}
              ${mostrarCategoria ? `<td class="col-categoria">${item.Categoria || ''}</td>` : ''}

            </tr>
          `;
        }
      });

      // Si es la última página, agregamos el total general
      // Pero calculamos el total real basado en los ítems filtrados
      if (currentPage === totalPages) {
        // Calcular el total de fardos sumando los productos que pasaron el filtro
        const totalFardosFiltrados = allRows
          .filter(row => !row.isLocation && row.item)
          .reduce((sum, row) => sum + Number(row.item?.cantidad || 0), 0);
        
        htmlContent += `
          <tr class="location-row keep-together">
            <td colspan="${colspan}">Total Fardos: ${totalFardosFiltrados}</td>
          </tr>
        `;
      }
      
      htmlContent += `
            </tbody>
          </table>
          
          <div class="footer-container">
            <br>
            <span class="page-footer">
              Hoja ${currentPage} de ${totalPages}
            </span>
          </div>
        </div>
      `;
    });
    
    // Cerrar el documento
    htmlContent += `
      </body>
      </html>
    `;
  
    // Escribir el contenido en el iframe
    const frameDoc = printFrame.contentWindow;
    if (frameDoc) {
      frameDoc.document.open();
      frameDoc.document.write(htmlContent);
      frameDoc.document.close();
      
      // Esperar a que se cargue el contenido y luego imprimir
      setTimeout(() => {
        frameDoc.focus();
        frameDoc.print();
        
        // Eliminar el iframe después de un tiempo
        setTimeout(() => {
          document.body.removeChild(printFrame);
        }, 1000);
      }, 500);
    }
    actualizarEstado();
  };

  const actualizarEstado = async () => {
    const updateResponse = await fetch(`${API_URL}/allorders/actualizar-estado`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idPedido: idPedido
      }),
    });

    if (!updateResponse.ok) {
      throw new Error(`Error al actualizar el pedido: ${updateResponse.status}`);
    }

    const updateData = await updateResponse.json();
    if (!updateData.success) {
      throw new Error(updateData.message || "No se pudo actualizar el pedido");
    }
  };

  const handleExportToExcel = () => {
    const dataToExport = getFilteredData();
    const rows: any[][] = [];
  
    // Encabezados como filas individuales
    rows.push([`Pedido: ${idPedido}`]);
    rows.push([`Sucursal: ${sucursal}`]);
    rows.push([`Departamento: ${departamento}`]);
    rows.push([]); // fila vacía
  
    // Encabezados de columnas
    const headerRow: string[] = ["UPC", "Descripción", "Cantidad", "Existencia"];
    if (mostrarMalEstado) headerRow.push("Mal Estado");
    if (mostrarProveedor) headerRow.push("Proveedor");
    if (mostrarCategoria) headerRow.push("Categoria");
    rows.push(headerRow);
  
    // Agregar los datos de los productos
    Object.values(dataToExport).forEach((items) => {
      items.forEach((item) => {
        const upc = String(
          esUbicacionEspecial ? (item.UPCProducto || item.upc) : item.upc
        );
        const descripcion = item.descripcion || "";
        const cantidad = Number(item.cantidad);
        const existencia = Number(
          esUbicacionEspecial
            ? Math.floor(item.existencia || 0)
            : Math.floor(item.existenciafardos || 0)
        );
        const row: (string | number)[] = [upc, descripcion, cantidad, existencia];
  
        if (mostrarMalEstado) row.push(Number(item.MalEstado || 0));
        if (mostrarProveedor) row.push(item.Proveedor || "N/A");
        if (mostrarCategoria) row.push(item.Categoria || "N/A");
  
        rows.push(row);
      });
    });
  
    // Crear hoja y archivo
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Pedido");
  
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], {
      type:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    saveAs(blob, `Pedido_${idPedido}.xlsx`);
  };
   
  
  // No mostramos el modal si no está abierto
  if (!isOpen) return null;

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white p-6 rounded-lg w-full max-w-7xl h-[95vh] flex flex-col shadow-xl">
          {/* Encabezado del modal */}
          <div className="flex justify-between items-center mb-1 border-b pb-2">
            <h3 className="text-xl font-bold text-black">Vista de Impresión - Pedido {idPedido}</h3>
            <button
              onClick={handleClose}
              className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg transition-colors flex items-center"
              aria-label="Cerrar"
            >
              <X size={20} />
            </button>
          </div>

          {/* Información del pedido */}
          <InfoPedido 
            sucursal={sucursal}
            estado={estado}
            departamento={departamento}
            fardos={fardos}
          />

          {/* Instrucciones */}
          <div className="flex flex-col">
            <div className="flex items-center mb-2">
              <div className="flex items-center">
                <Info size={18} className="text-blue-600 mr-1" />
                <p className="text-sm text-blue-600 italic">
                  Vista previa de impresión. Arrastra los productos para reordenarlos o moverlos entre ubicaciones.
                </p>
              </div>
            </div>
            
            {/* Cabecera de columnas */}
            <div className="grid grid-cols-12 gap-2 py-2 px-10 bg-gray-100 rounded-md text-xs font-semibold uppercase tracking-wider text-gray-600 border border-gray-400">
              <div className="col-span-2 text-sm text-black">
                {esUbicacionEspecial ? "UPC Unidad" : "UPC Fardo"}
              </div>
              <div
                className="col-span-3 text-sm text-black cursor-pointer hover:underline"
                onClick={() => handleSort("descripcion")}
              >
                Descripción{getSortIcon("descripcion")}
              </div>
              <div
                className="col-span-1 text-center text-sm text-black cursor-pointer hover:underline"
                onClick={() => handleSort("cantidad")}
              >
                Cant.{getSortIcon("cantidad")}
              </div>
              <div
                className="col-span-1 text-center text-sm text-black cursor-pointer hover:underline"
                onClick={() => handleSort(esUbicacionEspecial ? "existencia" : "existenciafardos")}
              >
                Exist.{getSortIcon(esUbicacionEspecial ? "existencia" : "existenciafardos")}
              </div>

                <div
                  className="col-span-1 text-center text-sm text-black cursor-pointer hover:underline"
                  onClick={() => handleSort("MalEstado")}
                >
                  M.E{getSortIcon("MalEstado")}
                </div>

                <div
                  className="col-span-2 text-sm text-black cursor-pointer hover:underline"
                  onClick={() => handleSort("Proveedor")}
                >
                  Proveedor{getSortIcon("Proveedor")}
                </div>

                <div
                  className="col-span-2 text-sm text-black cursor-pointer hover:underline"
                  onClick={() => handleSort("Categoria")}
                >
                  Categoría{getSortIcon("Categoria")}
                </div>
            </div>
          </div>

          {/* Contenido organizado por ubicaciones */}
          <div className="flex-grow overflow-auto border rounded-lg bg-gray-50" style={{ minHeight: "60vh" }}>
            <div className="p-2">
            {Object.entries(getFilteredData()).map(([ubicacionArea, items]) => (
              <UbicacionDropArea 
                key={ubicacionArea}
                ubicacion={ubicacionArea}
                items={items} // ya vienen ordenados de getFilteredData()
                moveItem={moveItem}
                sucursalUbicacion={ubicacion}
                soloConExistencia={soloConExistencia}
              />
            ))}

            </div>
          </div>

          {/* Botones de acción */}
          <div className="mt-1 flex justify-between border-t pt-3 items-center gap-4 flex-wrap">

            {/* Checkboxes lado izquierdo */}
            <div className="flex items-center gap-6 flex-wrap">
              {/* Existencia */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="soloConExistencia"
                  checked={soloConExistencia}
                  onChange={(e) => setSoloConExistencia(e.target.checked)}
                  className="form-checkbox h-5 w-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <label htmlFor="soloConExistencia" className="ml-2 text-sm font-medium text-gray-700">
                  Solo con Existencia
                </label>
              </div>

              {/* Proveedor */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="mostrarProveedor"
                  checked={mostrarProveedor}
                  onChange={(e) => setMostrarProveedor(e.target.checked)}
                  className="form-checkbox h-5 w-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <label htmlFor="mostrarProveedor" className="ml-2 text-sm font-medium text-gray-700">
                  Imprimir Proveedor
                </label>
              </div>

              {/* Categoría */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="mostrarCategoria"
                  checked={mostrarCategoria}
                  onChange={(e) => setMostrarCategoria(e.target.checked)}
                  className="form-checkbox h-5 w-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <label htmlFor="mostrarCategoria" className="ml-2 text-sm font-medium text-gray-700">
                  Imprimir Categoría
                </label>
              </div>

              {/* Mal Estado */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="mostrarMalEstado"
                  checked={mostrarMalEstado}
                  onChange={(e) => setMostrarMalEstado(e.target.checked)}
                  className="form-checkbox h-5 w-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <label htmlFor="mostrarMalEstado" className="ml-2 text-sm font-medium text-gray-700">
                  Imprimir Mal Estado
                </label>
              </div>
            </div>

            {/* Botón de impresión lado derecho */}
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={handleExportToExcel}
                className="bg-green-700 hover:bg-green-800 text-white px-6 py-2 rounded-lg transition-colors flex items-center gap-2"
              >
                <Upload size={20} />
                Exportar a Excel
              </button>

              <button
                onClick={handlePrint}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors flex items-center gap-2"
              >
                <Printer size={20} />
                Imprimir
              </button>
            </div>
          </div>
        </div>
      </div>
    </DndProvider>
  );
};

export default memo(ModalImpresion);