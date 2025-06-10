import { useState, useMemo, useEffect, ReactNode, useRef, KeyboardEvent, useCallback } from "react";

interface Column<T> {
  key?: keyof T;
  label: string;
  sortable?: boolean;
  render?: (item: T, isEditing: boolean, onChange: (value: any) => void) => JSX.Element;
  compare?: (a: T, b: T) => number;
  editable?: boolean;
  width?: string | number;
  onEditComplete?: (newValue: any, item: T, rowIndex: number) => void;
}

interface TableProps<T> {
  width?: string;
  tableId?: string;
  data: T[];
  columns: Column<T>[];
  enableSorting?: boolean;
  enablePagination?: boolean;
  rowsPerPage?: number;
  onSelectionChange?: (selectedItems: T[]) => void;
  onDataChange?: (newData: T[]) => void;
  multiSelect?: boolean;
  customHeaderContent?: ReactNode;
  maxHeight?: string;
  className?: string;
  headerClassName?: string;
  rowClassName?: string;
  cellClassName?: string;
  getRowStyle?: (item: T) => React.CSSProperties | string;
  readOnly?: boolean;
}

// Tipo para la posición de una celda
interface CellPosition {
  rowIndex: number;
  colIndex: number;
}

// Tipo para el rango de selección
interface SelectionRange {
  startCell: CellPosition;
  endCell: CellPosition;
}

export default function TableComponent<T>({
  tableId,
  data,
  columns,
  enableSorting = true,
  enablePagination = false,
  rowsPerPage = 10,
  onSelectionChange,
  onDataChange,
  multiSelect = false,
  customHeaderContent,
  maxHeight = "calc(100vh-210px)",
  width = "100%",
  className = "",
  headerClassName = "",
  rowClassName = "",
  cellClassName = "",
  getRowStyle,
  readOnly = false,
}: TableProps<T>) {
  // Estado original del componente
  const [sortColumn, setSortColumn] = useState<keyof T | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRows, setSelectedRows] = useState<T[]>([]);
  const [, setHoveredRow] = useState<T | null>(null);
  
  // Estados para navegación de celdas al estilo DataGridView
  const [activeCell, setActiveCell] = useState<CellPosition | null>(null);
  const [editingCell, setEditingCell] = useState<CellPosition | null>(null);
  const [selectionRange, setSelectionRange] = useState<SelectionRange | null>(null);
  const [editValue, setEditValue] = useState<any>(null);
  const [tableData, setTableData] = useState<T[]>(data);
  const [, setIsShiftPressed] = useState(false);
  const [, setIsCtrlPressed] = useState(false);
  
  // Referencias
  const tableRef = useRef<HTMLTableElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const copySelectedCellsRef = useRef<() => boolean>(() => false);
  const selectAllCellsRef = useRef<() => boolean>(() => false);

  // Actualizar datos locales cuando cambian los datos de entrada
  useEffect(() => {
    setTableData([...data]); // Forzar actualización de estado para evitar inconsistencias
  }, [data]);

  // Notificar cambios en los datos
  useEffect(() => {
    if (onDataChange && tableData !== data) {
      onDataChange(tableData);
    }
  }, [tableData, onDataChange, data]);

  // Reset la página cuando cambia la paginación
  useEffect(() => {
    setCurrentPage(1);
  }, [enablePagination]);

  // Enfocar el input cuando se inicia la edición
  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  // Define el useEffect sin depender de copySelectedCells
  useEffect(() => {
    const handleGlobalKeyDown = (e: globalThis.KeyboardEvent): void => {
      // Verificar si tenemos el foco en nuestra tabla o sus celdas
      const activeElement = document.activeElement;
      
      // Solo procesar eventos para ESTA instancia de tabla específica
      const isThisTableFocused = tableRef.current && 
        (tableRef.current === activeElement || 
         (tableRef.current.contains(activeElement) && 
          tableRef.current.closest(`[data-table-id="${tableId || 'default'}"]`)));
      
      if (!isThisTableFocused) return;
      
      // Manejar Ctrl+C
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        if (selectionRange || activeCell) {
          e.preventDefault();
          copySelectedCellsRef.current();
        }
      }
      
      // Manejar Ctrl+A
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault(); // Prevenir la selección predeterminada de toda la página
        selectAllCellsRef.current();
      }
    };
    
    // Agregar el listener a nivel de documento
    document.addEventListener('keydown', handleGlobalKeyDown as EventListener);
    
    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown as EventListener);
    };
  }, [selectionRange, activeCell]);

  useEffect(() => {
    selectAllCellsRef.current = selectAllCells;
  }, []);
  
  // Función para manejar la ordenación al hacer clic en un encabezado
  const handleSort = (column: keyof T) => {
    if (!enableSorting) return;
    const newSortOrder = sortColumn === column && sortOrder === "asc" ? "desc" : "asc";
    setSortColumn(column);
    setSortOrder(newSortOrder);
  };

  // Función auxiliar para manejar la conversión de valores antes de ordenar
  const parseValue = (value: any) => {
    if (value === null || value === undefined || value === "") return ""; // Evitar errores en valores vacíos

    // Si el valor es numérico, convertirlo
    const num = Number(value);
    if (!isNaN(num)) return num;

    // Si es una fecha válida, convertirla a milisegundos para ordenamiento
    const date = new Date(value);
    if (!isNaN(date.getTime())) return date.getTime();

    // Si es texto, devolverlo como string normal
    return String(value).toLowerCase();
  };

  // Ordenar datos
  const sortedData = useMemo(() => {
    if (!sortColumn) return tableData;

    const columnConfig = columns.find((col) => col.key === sortColumn);
    if (columnConfig?.compare) {
      return [...tableData].sort((a, b) => {
        const comparison = columnConfig.compare!(a, b);
        return sortOrder === "asc" ? comparison : -comparison;
      });
    }

    return [...tableData].sort((a, b) => {
      const valueA = parseValue(a[sortColumn]);
      const valueB = parseValue(b[sortColumn]);

      // Si ambos valores son números, compararlos como tales
      if (typeof valueA === "number" && typeof valueB === "number") {
        return sortOrder === "asc" ? valueA - valueB : valueB - valueA;
      }

      // Si ambos valores son texto, compararlos con localeCompare
      if (typeof valueA === "string" && typeof valueB === "string") {
        return sortOrder === "asc"
          ? valueA.localeCompare(valueB, undefined, { numeric: true, sensitivity: "base" })
          : valueB.localeCompare(valueA, undefined, { numeric: true, sensitivity: "base" });
      }

      return 0; // Evitar errores en caso de datos inesperados
    });
  }, [tableData, sortColumn, sortOrder, columns]);

  // Paginar datos
  const totalPages = Math.ceil(sortedData.length / rowsPerPage);
  const paginatedData = enablePagination
    ? sortedData.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)
    : sortedData || [];

  // Configurar paginación
  const maxPageButtons = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxPageButtons / 2));
  let endPage = startPage + maxPageButtons - 1;

  if (endPage > totalPages) {
    endPage = totalPages;
    startPage = Math.max(1, endPage - maxPageButtons + 1);
  }

  const isSelectable = !!onSelectionChange || multiSelect;

  // Manejar selección de fila (para checkboxes)
  const handleRowSelect = (item: T) => {
    if (!isSelectable) return;

    if (!multiSelect) {
      const newSelectedRows = selectedRows.includes(item) ? [] : [item];
      setSelectedRows(newSelectedRows);
      onSelectionChange?.(newSelectedRows);
    } else {
      const newSelectedRows = selectedRows.includes(item)
        ? selectedRows.filter((row) => row !== item)
        : [...selectedRows, item];

      setSelectedRows(newSelectedRows);
      onSelectionChange?.(newSelectedRows);
    }
  };

  // ======= FUNCIONES PARA NAVEGACIÓN Y EDICIÓN AL ESTILO DATAGRIDVIEW =======

  // Verificar si una celda está en el rango de selección
  const isCellInSelectionRange = useCallback(
    (rowIndex: number, colIndex: number): boolean => {
      if (!selectionRange) {
        return activeCell?.rowIndex === rowIndex && activeCell?.colIndex === colIndex;
      }

      const { startCell, endCell } = selectionRange;
      const minRow = Math.min(startCell.rowIndex, endCell.rowIndex);
      const maxRow = Math.max(startCell.rowIndex, endCell.rowIndex);
      const minCol = Math.min(startCell.colIndex, endCell.colIndex);
      const maxCol = Math.max(startCell.colIndex, endCell.colIndex);

      return rowIndex >= minRow && rowIndex <= maxRow && colIndex >= minCol && colIndex <= maxCol;
    },
    [selectionRange, activeCell]
  );

  // Verificar si una celda es editable
  const isCellEditable = (colIndex: number): boolean => {
    if (readOnly) return false;
    const column = columns[colIndex];
    return column.editable !== true;
  };

  // Seleccionar una celda
  const selectCell = (rowIndex: number, colIndex: number, extendSelection: boolean = false) => {
    if (rowIndex < 0 || colIndex < 0 || rowIndex >= paginatedData.length || colIndex >= columns.length) {
      return;
    }

    if (extendSelection && activeCell) {
      // Extender selección desde la celda activa
      setSelectionRange({
        startCell: activeCell,
        endCell: { rowIndex, colIndex }
      });
    } else {
      // Seleccionar solo esta celda
      setActiveCell({ rowIndex, colIndex });
      setSelectionRange(null);
    }
  };

  // Activar edición de celda
  const startCellEdit = (rowIndex: number, colIndex: number) => {
    if (!isCellEditable(colIndex)) return;
    
    const column = columns[colIndex];
    const row = paginatedData[rowIndex];
    
    if (!column.key) return;
    
    setEditingCell({ rowIndex, colIndex });
    setEditValue(row[column.key]);
    setActiveCell({ rowIndex, colIndex });
    setSelectionRange(null);
  };

  // Guardar edición de celda
  const commitCellEdit = () => {
    if (!editingCell) return;
    
    const { rowIndex, colIndex } = editingCell;
    const column = columns[colIndex];
    
    if (!column.key) return;
    
    const newData = [...tableData];
    // Necesitamos el índice real si hay paginación
    const actualRowIndex = enablePagination ? (currentPage - 1) * rowsPerPage + rowIndex : rowIndex;
    
    newData[actualRowIndex] = {
      ...newData[actualRowIndex],
      [column.key]: editValue
    };
    
    // Ejecutar la función personalizada onEditComplete si existe
    if (column.onEditComplete) {
      column.onEditComplete(editValue, paginatedData[rowIndex], actualRowIndex);
    }
    
    setTableData(newData);
    
    // Guardar la posición actual antes de limpiar el estado de edición
    const currentPosition = { rowIndex, colIndex };
    
    // Limpiar el estado de edición
    setEditingCell(null);
    setEditValue(null);
    
    // Mantener el foco en la tabla para poder seguir navegando
    setTimeout(() => {
      tableRef.current?.focus();
      
      // Restaurar la celda activa para que siga siendo la misma
      setActiveCell(currentPosition);
    }, 0);
  };

  // Cancelar edición
  const cancelEdit = () => {
    // Guardar posición actual
    const currentPosition = editingCell ? { 
      rowIndex: editingCell.rowIndex, 
      colIndex: editingCell.colIndex 
    } : null;
    
    // Limpiar estado de edición
    setEditingCell(null);
    setEditValue(null);
    
    // Restaurar foco y mantener la posición
    setTimeout(() => {
      tableRef.current?.focus();
      if (currentPosition) {
        setActiveCell(currentPosition);
      }
    }, 0);
  };

  // Navegar a la siguiente celda editable
  const navigateToNextCell = (rowIndex: number, colIndex: number, reverse: boolean = false) => {
    const totalRows = paginatedData.length;
    const totalCols = columns.length;
    
    if (reverse) {
      // Navegación hacia atrás
      for (let c = colIndex - 1; c >= 0; c--) {
        if (isCellEditable(c)) {
          selectCell(rowIndex, c);
          return;
        }
      }
      
      // Si llegamos aquí, necesitamos ir a la fila anterior
      if (rowIndex > 0) {
        for (let c = totalCols - 1; c >= 0; c--) {
          if (isCellEditable(c)) {
            selectCell(rowIndex - 1, c);
            return;
          }
        }
      }
    } else {
      // Navegación hacia adelante
      for (let c = colIndex + 1; c < totalCols; c++) {
        if (isCellEditable(c)) {
          selectCell(rowIndex, c);
          return;
        }
      }
      
      // Si llegamos aquí, necesitamos ir a la siguiente fila
      if (rowIndex < totalRows - 1) {
        for (let c = 0; c < totalCols; c++) {
          if (isCellEditable(c)) {
            selectCell(rowIndex + 1, c);
            return;
          }
        }
      }
    }
  };

  // Manejar el cambio de valor durante la edición
  const handleEditValueChange = (value: any) => {
    setEditValue(value);
  };

  // Copiar las celdas seleccionadas
  const copySelectedCells = useCallback(() => {
    if (!selectionRange && !activeCell) return false;
    
    try {
      let startRow, endRow, startCol, endCol;
      
      if (selectionRange) {
        startRow = Math.min(selectionRange.startCell.rowIndex, selectionRange.endCell.rowIndex);
        endRow = Math.max(selectionRange.startCell.rowIndex, selectionRange.endCell.rowIndex);
        startCol = Math.min(selectionRange.startCell.colIndex, selectionRange.endCell.colIndex);
        endCol = Math.max(selectionRange.startCell.colIndex, selectionRange.endCell.colIndex);
      } else if (activeCell) {
        startRow = endRow = activeCell.rowIndex;
        startCol = endCol = activeCell.colIndex;
      } else {
        return false;
      }
      
      // Verificar que los índices son válidos
      if (startRow < 0 || startCol < 0 || 
          endRow >= paginatedData.length || 
          endCol >= columns.length) {
        console.warn("Rangos de selección fuera de límites:", {startRow, endRow, startCol, endCol});
        return false;
      }
      
      let copyText = '';
      
      for (let r = startRow; r <= endRow; r++) {
        if (r >= paginatedData.length) continue; // Protección extra
        
        const rowValues = [];
        for (let c = startCol; c <= endCol; c++) {
          if (c >= columns.length) continue; // Protección extra
          
          const column = columns[c];
          if (column && column.key) {
            const value = paginatedData[r][column.key];
            // Manejar diferentes tipos de datos y valores nulos/undefined
            rowValues.push(value === null || value === undefined ? '' : String(value));
          } else {
            rowValues.push('');
          }
        }
        copyText += rowValues.join('\t') + '\n';
      }
      
      // Usar el método writeText de manera asíncrona con manejo de errores
      navigator.clipboard.writeText(copyText)
        .then(() => {
          console.log("Contenido copiado con éxito");
        })
        .catch(err => {
          console.error("Error al copiar al portapapeles:", err);
          // Implementar un fallback para navegadores que no soporten la API clipboard
          fallbackCopy(copyText);
        });
      
      return true;
    } catch (error) {
      console.error("Error en copySelectedCells:", error);
      return false;
    }
  }, [selectionRange, activeCell, paginatedData, columns]);

  // Método alternativo para copiar en caso de fallo de la API clipboard
  const fallbackCopy = (text: string): void => {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      console.log("Contenido copiado con método alternativo");
    } catch (err) {
      console.error("Error en fallbackCopy:", err);
    }
  };

  // Pegar texto desde el portapapeles
  const pasteFromClipboard = async () => {
    if (!activeCell || readOnly) return;
    
    try {
      const clipText = await navigator.clipboard.readText();
      const rows = clipText.split('\n').filter(row => row.trim());
      
      if (rows.length === 0) return;
      
      const newData = [...tableData];
      const startRow = enablePagination ? (currentPage - 1) * rowsPerPage + activeCell.rowIndex : activeCell.rowIndex;
      const startCol = activeCell.colIndex;
      
      for (let r = 0; r < rows.length && startRow + r < newData.length; r++) {
        const values = rows[r].split('\t');
        
        for (let c = 0; c < values.length && startCol + c < columns.length; c++) {
          const column = columns[startCol + c];
          
          if (column.key && column.editable !== false) {
            newData[startRow + r] = {
              ...newData[startRow + r],
              [column.key]: values[c]
            };
          }
        }
      }
      
      setTableData(newData);
    } catch (error) {
      console.error("Error al pegar desde el portapapeles:", error);
    }
  };

  // Seleccionar todas las celdas
  const selectAllCells = useCallback(() => {
    if (paginatedData.length === 0 || columns.length === 0) return false;
    
    // Selecciona desde la primera celda (0,0) hasta la última celda (última fila, última columna)
    setSelectionRange({
      startCell: { rowIndex: 0, colIndex: 0 },
      endCell: { 
        rowIndex: paginatedData.length - 1, 
        colIndex: columns.length - 1 
      }
    });
    
    // También establece la celda activa como la primera
    setActiveCell({ rowIndex: 0, colIndex: 0 });
    
    return true;
  }, [paginatedData.length, columns.length]);

  // Modificaciones en el manejo de eventos de teclado
  const handleKeyDown = (e: KeyboardEvent<HTMLTableElement>) => {
    // Actualizar estado de teclas modificadoras
    setIsShiftPressed(e.shiftKey);
    setIsCtrlPressed(e.ctrlKey || e.metaKey);

    if (editingCell) {
      // Navegación durante la edición
      switch (e.key) {
        case "Enter":
          commitCellEdit();
          // Mover a la celda de abajo si es posible
          if (editingCell.rowIndex < paginatedData.length - 1) {
            selectCell(editingCell.rowIndex + 1, editingCell.colIndex);
            ensureCellIsVisible(editingCell.rowIndex + 1, editingCell.colIndex);
          }
          e.preventDefault();
          break;
        case "Escape":
          cancelEdit();
          e.preventDefault();
          break;
        case "c":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault(); // Prevenir comportamiento predeterminado primero
            copySelectedCells();
          }
          break;
      }
      return;
    }

    if (!activeCell && !selectionRange) return;

    const currentRow = activeCell?.rowIndex ?? selectionRange?.endCell.rowIndex ?? 0;
    const currentCol = activeCell?.colIndex ?? selectionRange?.endCell.colIndex ?? 0;

    // Determinar si se está haciendo una selección extendida
    const isExtendingSelection = e.shiftKey;

    switch (e.key) {
      case "ArrowUp":
        if (e.ctrlKey || e.metaKey) {
          // Ir a la primera fila asegurando visibilidad
          selectCell(0, currentCol, false);
          ensureCellIsVisible(0, currentCol);
        } else {
          if (currentRow > 0) {
            selectCell(currentRow - 1, currentCol, false);
            ensureCellIsVisible(currentRow - 1, currentCol);
          } else {
            // Si ya estamos en la primera fila, hacer scroll hacia arriba
            ensureCellIsVisible(0, currentCol);
          }
        }
        e.preventDefault();
        break;
      case "ArrowDown":
        if (e.ctrlKey || e.metaKey) {
          // Ir a la última fila
          const lastRow = paginatedData.length - 1;
          if (isExtendingSelection) {
            // Extender selección desde la celda activa hasta la última fila
            extendSelection(currentRow, currentCol, lastRow, currentCol);
          } else {
            selectCell(lastRow, currentCol, false);
            ensureCellIsVisible(lastRow, currentCol);
          }
        } else {
          // Navegación normal hacia abajo
          if (currentRow < paginatedData.length - 1) {
            if (isExtendingSelection) {
              extendSelection(activeCell?.rowIndex || 0, activeCell?.colIndex || 0, currentRow + 1, currentCol);
            } else {
              selectCell(currentRow + 1, currentCol, false);
            }
            ensureCellIsVisible(currentRow + 1, currentCol);
          }
        }
        e.preventDefault();
        break;
      case "ArrowLeft":
        if (e.ctrlKey || e.metaKey) {
          // Ir a la primera columna
          if (isExtendingSelection) {
            // Extender selección desde la celda activa hasta la primera columna
            extendSelection(currentRow, currentCol, currentRow, 0);
          } else {
            selectCell(currentRow, 0, false);
            ensureCellIsVisible(currentRow, 0);
          }
        } else {
          // Navegación normal hacia la izquierda
          if (currentCol > 0) {
            if (isExtendingSelection) {
              extendSelection(activeCell?.rowIndex || 0, activeCell?.colIndex || 0, currentRow, currentCol - 1);
            } else {
              selectCell(currentRow, currentCol - 1, false);
            }
            ensureCellIsVisible(currentRow, currentCol - 1);
          }
        }
        e.preventDefault();
        break;
      case "ArrowRight":
        if (e.ctrlKey || e.metaKey) {
          // Ir a la última columna
          const lastCol = columns.length - 1;
          if (isExtendingSelection) {
            // Extender selección desde la celda activa hasta la última columna
            extendSelection(currentRow, currentCol, currentRow, lastCol);
          } else {
            selectCell(currentRow, lastCol, false);
            ensureCellIsVisible(currentRow, lastCol);
          }
        } else {
          // Navegación normal hacia la derecha
          if (currentCol < columns.length - 1) {
            if (isExtendingSelection) {
              extendSelection(activeCell?.rowIndex || 0, activeCell?.colIndex || 0, currentRow, currentCol + 1);
            } else {
              selectCell(currentRow, currentCol + 1, false);
            }
            ensureCellIsVisible(currentRow, currentCol + 1);
          }
        }
        e.preventDefault();
        break;
      case "Home":
        if (e.ctrlKey || e.metaKey) {
          // Ir a la primera celda (0,0)
          if (isExtendingSelection) {
            extendSelection(currentRow, currentCol, 0, 0);
          } else {
            selectCell(0, 0, false);
          }
          ensureCellIsVisible(0, 0);
        } else {
          // Ir al inicio de la fila
          if (isExtendingSelection) {
            extendSelection(currentRow, currentCol, currentRow, 0);
          } else {
            selectCell(currentRow, 0, false);
          }
          ensureCellIsVisible(currentRow, 0);
        }
        e.preventDefault();
        break;
      case "End":
        if (e.ctrlKey || e.metaKey) {
          // Ir a la última celda
          const lastRow = paginatedData.length - 1;
          const lastCol = columns.length - 1;
          if (isExtendingSelection) {
            extendSelection(currentRow, currentCol, lastRow, lastCol);
          } else {
            selectCell(lastRow, lastCol, false);
          }
          ensureCellIsVisible(lastRow, lastCol);
        } else {
          // Ir al final de la fila
          const lastCol = columns.length - 1;
          if (isExtendingSelection) {
            extendSelection(currentRow, currentCol, currentRow, lastCol);
          } else {
            selectCell(currentRow, lastCol, false);
          }
          ensureCellIsVisible(currentRow, lastCol);
        }
        e.preventDefault();
        break;
      case "Enter":
        if (!readOnly) {
          startCellEdit(currentRow, currentCol);
        }
        e.preventDefault();
        break;
      case "c":
        if (e.ctrlKey || e.metaKey) {
          copySelectedCells(); // Copiar las celdas seleccionadas
          e.preventDefault(); // Evitar el comportamiento predeterminado del navegador
        }
        break;
      case "v":
        if ((e.ctrlKey || e.metaKey) && !readOnly) {
          pasteFromClipboard();
        }
        break;
      case "a":
        if (e.ctrlKey || e.metaKey) {
          selectAllCells();
          e.preventDefault();
        }
        break;
    }
  };
  
  // Función para extender la selección en múltiples direcciones
  const extendSelection = (startRow: number, startCol: number, endRow: number, endCol: number) => {
    // Si no hay una celda activa anterior, usar la celda actual como punto de inicio
    if (!activeCell) {
      setActiveCell({ rowIndex: startRow, colIndex: startCol });
    }

    // Calcular los límites del rango de selección
    const minRow = Math.min(startRow, endRow);
    const maxRow = Math.max(startRow, endRow);
    const minCol = Math.min(startCol, endCol);
    const maxCol = Math.max(startCol, endCol);

    // Establecer el rango de selección
    setSelectionRange({
      startCell: { rowIndex: minRow, colIndex: minCol },
      endCell: { rowIndex: maxRow, colIndex: maxCol },
    });

    // Asegurar que la celda final es visible
    ensureCellIsVisible(endRow, endCol);
  };

  // Añade una referencia para el encabezado
  const theadRef = useRef<HTMLTableSectionElement>(null);

  // Improved function to ensure a cell is visible and receives focus
  const ensureCellIsVisible = (rowIndex: number, colIndex: number) => {
    setTimeout(() => {
      const cellElement = document.querySelector(`[data-row="${rowIndex}"][data-col="${colIndex}"]`);
      
      if (cellElement && tableRef.current && theadRef.current) {
        const headerHeight = theadRef.current.offsetHeight;
        const cellRect = cellElement.getBoundingClientRect();
        const tableRect = tableRef.current.getBoundingClientRect();
        const scrollContainer = tableRef.current.parentElement;

        if (!scrollContainer) return;
        
        // Calculate the current scroll position
        const currentScrollTop = scrollContainer.scrollTop;
        
        // Buffer space to ensure no overlap with header (increase for more space)
        const buffer = 15; 
        
        // If cell is hidden by header or close to it
        if (cellRect.top < tableRect.top + headerHeight + buffer) {
          // Calculate exact scroll position needed to show the cell below the header with buffer
          const newScrollTop = currentScrollTop + (cellRect.top - tableRect.top - headerHeight - buffer);
          
          scrollContainer.scrollTo({
            top: newScrollTop,
            behavior: "smooth"
          });
        }
        // If cell is below the visible area
        else if (cellRect.bottom > tableRect.bottom - buffer) {
          // Calculate exact scroll position needed to show the cell with buffer
          const newScrollTop = currentScrollTop + (cellRect.bottom - tableRect.bottom + buffer);
          
          scrollContainer.scrollTo({
            top: newScrollTop,
            behavior: "smooth"
          });
        }
        
        // Ensure the cell gets focus after scrolling completes
        setTimeout(() => {
          if (cellElement instanceof HTMLElement) {
            cellElement.focus();
          }
        }, 100); // Additional delay to ensure scroll completes before focus
      }
    }, 20);
  };

  // Manejar el clic en una celda
  const handleCellClick = (rowIndex: number, colIndex: number, e: React.MouseEvent) => {
    if (editingCell) {
      commitCellEdit();
    }

    if (e.detail === 1) {
      // Simple clic para seleccionar
      selectCell(rowIndex, colIndex, e.shiftKey);
    } else if (e.detail === 2) {
      // Doble clic para editar
      if (!readOnly) {
        startCellEdit(rowIndex, colIndex);
      }
    }
  };

  // Manejar el evento de mouse down
  const handleMouseDown = (e: React.MouseEvent, rowIndex: number, colIndex: number) => {
    if (e.button === 0) { // Solo botón izquierdo
      if (editingCell) {
        commitCellEdit();
      }
      
      selectCell(rowIndex, colIndex, e.shiftKey);
      tableRef.current?.focus();
    }
  };

  // Manejar el movimiento del mouse (para selección por arrastre)
  const handleMouseOver = (e: React.MouseEvent, rowIndex: number, colIndex: number) => {
    if (e.buttons === 1 && activeCell) { // Si el botón izquierdo está presionado
      setSelectionRange({
        startCell: activeCell,
        endCell: { rowIndex, colIndex }
      });
    }
  };

// Clases CSS predeterminadas
const defaultClassName = "overflow-y-auto border border-gray-600 rounded-lg";
const defaultHeaderClassName = "bg-gray-200 text-gray-700 sticky top-0 z-10";
const defaultRowClassName = "hover:bg-gray-100";
const defaultCellClassName = "p-3 border border-black text-black select-none";

return (
  <div 
    className={`${defaultClassName} ${className}`} 
    style={{ maxHeight, width, position: 'relative', overflowX: 'hidden' }}
    data-table-id={tableId || 'default'}
  >
    <table 
      className="w-full border-collapse" 
      ref={tableRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
    <thead 
    ref={theadRef} 
    className={`${defaultHeaderClassName} ${headerClassName}`}
    style={{ 
      position: 'sticky', 
      top: 0, 
      zIndex: 10,
      backgroundColor: '#f3f4f6', // Match your design
      boxShadow: '0 1px 2px rgba(0,0,0,0.1)' // Optional shadow for visual separation
    }}
  >
      <tr>
        {columns.map((col, index) => (
          <th
            key={col.key ? col.key.toString() : `col-${index}`}
            className={`p-3 border border-gray-500 text-left ${
              col.sortable ? "cursor-pointer" : ""
            }`}
            style={{ width: col.width }}
            onClick={() => col.key && col.sortable && handleSort(col.key)}
          >
            {col.label} {col.key && sortColumn === col.key ? (sortOrder === "asc" ? "▲" : "▼") : ""}
          </th>
        ))}
        {isSelectable && (
          <th className="p-3 border border-gray-300 w-12">
            {multiSelect && customHeaderContent}
          </th>
        )}
      </tr>
    </thead>
      <tbody style={{ marginTop: "48px" }}> {/* Añade un margen superior aquí */}
        {paginatedData.map((item, rowIndex) => {
          const rowStyle = getRowStyle ? getRowStyle(item) : {};
          const isCustomStyle = typeof rowStyle === "object";

          return (
            <tr
              key={rowIndex}
              className={`${defaultRowClassName} ${rowClassName} ${
                !isCustomStyle ? (rowStyle as string) : ""
              } ${selectedRows.includes(item) ? "bg-blue-100" : ""}`}
              style={isCustomStyle ? (rowStyle as React.CSSProperties) : {}}
              onMouseEnter={() => setHoveredRow(item)}
              onMouseLeave={() => setHoveredRow(null)}
            >
              {columns.map((col, colIndex) => (
                <td
                  key={col.key ? col.key.toString() : `col-${colIndex}`}
                  className={`${defaultCellClassName} ${cellClassName} ${
                    isCellInSelectionRange(rowIndex, colIndex) ? "bg-blue-200 ring-2 ring-blue-500 ring-inset" : ""
                  } ${col.editable === false ? "bg-gray-100" : ""} select-none`}
                  onMouseDown={(e) => handleMouseDown(e, rowIndex, colIndex)}
                  onMouseOver={(e) => handleMouseOver(e, rowIndex, colIndex)}
                  onClick={(e) => handleCellClick(rowIndex, colIndex, e)}
                  style={{ width: col.width }}
                  data-row={rowIndex}
                  data-col={colIndex}
                  tabIndex={-1} // Hace que la celda sea enfocable
                >
                  {editingCell?.rowIndex === rowIndex && editingCell?.colIndex === colIndex ? (
                    col.render ? (
                      col.render(item, true, handleEditValueChange)
                    ) : (
                      <input
                        ref={inputRef}
                        type="text"
                        value={editValue !== null ? editValue : col.key ? String(item[col.key] || '') : ''}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={commitCellEdit}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            commitCellEdit();
                            // Moverse a la celda de abajo
                            if (rowIndex < paginatedData.length - 1) {
                              selectCell(rowIndex + 1, colIndex);
                            }
                          } else if (e.key === 'Tab') {
                            e.preventDefault();
                            commitCellEdit();
                            navigateToNextCell(rowIndex, colIndex, e.shiftKey);
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            cancelEdit();
                          }
                        }}
                        className="w-full h-full p-2 outline-none border border-blue-500 bg-white text-black"
                        autoFocus
                      />
                    )
                  ) : (
                    col.render ? col.render(item, false, () => {}) : col.key ? (item[col.key] as any) : null
                  )}
                </td>
              ))}
              {isSelectable && (
                <td className={`${defaultCellClassName} ${cellClassName} text-center`}>
                  <input
                    type="checkbox"
                    checked={selectedRows.includes(item)}
                    onChange={() => handleRowSelect(item)}
                    className="cursor-pointer bg-gray-100"
                  />
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>

    {enablePagination && totalPages > 1 && (
      <div className="flex justify-center items-center mt-2 space-x-2 p-4">
        <button
          className="px-4 py-2 rounded bg-gray-600 text-white disabled:opacity-50"
          disabled={currentPage === 1}
          onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
        >
          Anterior
        </button>

        {Array.from({ length: endPage - startPage + 1 }, (_, index) => startPage + index).map(
          (page) => (
            <button
              key={page}
              className={`px-3 py-2 rounded ${
                currentPage === page ? "bg-blue-600 text-white" : "bg-gray-400"
              }`}
              onClick={() => setCurrentPage(page)}
            >
              {page}
            </button>
          )
        )}

        <button
          className="px-4 py-2 rounded bg-gray-600 text-white disabled:opacity-50"
          disabled={currentPage === totalPages}
          onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
        >
          Siguiente
        </button>
      </div>
    )}
  </div>
);
}