import { useEffect, useState } from "react";
import TableComponent from "./Table";

interface CronogramData {
  idSucursal: number;
  nombreSucursal: string;
  descripcion: string;
  cantidad: number;
  diaDeLaSemana: string;
}

const obtenerDiaDeLaSemana = (): string => {
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

export const OrdersCalendar = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [diaDeLaSemana, setDiaDeLaSemana] = useState<string>(obtenerDiaDeLaSemana());
  const [data, setData] = useState<CronogramData[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [diaSeleccionado, setDiaSeleccionado] = useState<string>("");

  const diasSemana = [
    "Domingo",
    "Lunes",
    "Martes",
    "Miercoles",
    "Jueves",
    "Viernes",
    "Sabado",
  ];

  const fetchData = async (dia: string = diaDeLaSemana) => {
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:5000/cronogram?dia=${dia}`);
      if (!response.ok) throw new Error("Error al obtener los datos");
      const result: CronogramData[] = await response.json();
      setData(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBuscar = () => {
    if (diaSeleccionado) {
      fetchData(diaSeleccionado);
      setDiaDeLaSemana(diaSeleccionado);
    }
  };

  const handleLimpiar = () => {
    const hoy = obtenerDiaDeLaSemana();
    setDiaSeleccionado("");
    fetchData(hoy);
    setDiaDeLaSemana(hoy);
  };

  useEffect(() => {
    fetchData();
  }, []);
  
  function normalizeText(text: string): string {
    return text
      .toLowerCase()
      .normalize("NFD") // separa letras con tilde
      .replace(/[\u0300-\u036f]/g, "") // elimina tildes
      .replace(/\s+/g, " ") // reemplaza múltiples espacios por uno solo
      .trim();
  }

  function fuzzyMatch(text: string, input: string): boolean {
      const normalizedText = normalizeText(text);
      const normalizedInput = normalizeText(input);

      // Primero verifica coincidencia exacta (incluyendo espacios)
      if (normalizedText.includes(normalizedInput)) {
          return true;
      }

      // Luego verifica coincidencia de abreviación (letras en orden)
      let inputIndex = 0;
      for (let i = 0; i < normalizedText.length && inputIndex < normalizedInput.length; i++) {
          if (normalizedText[i] === normalizedInput[inputIndex]) {
              inputIndex++;
          }
      }

      return inputIndex === normalizedInput.length;
  }

  const filteredData = data.filter((item) =>
      fuzzyMatch(item.nombreSucursal, searchTerm)
  );
  
  if (loading) return <div className="text-center py-4">Cargando...</div>;
  if (error) return <div className="text-center py-4 text-red-500">Error: {error}</div>;

  const columns: { key: keyof CronogramData; label: string; sortable: boolean; editable :boolean ; compare?: (a: CronogramData, b: CronogramData) => number }[] = [
    { key: "nombreSucursal", label: "Sucursal", sortable: true, editable :true  },
    { key: "descripcion", label: "Cronograma", sortable: true, editable :true  },
    { 
      key: "cantidad", 
      label: "Cantidad de Pedidos", 
      sortable: true, 
      editable :true ,
      compare: (a, b) => a.cantidad - b.cantidad, 
    }
  ];

  const getRowStyle = (row: CronogramData): React.CSSProperties | string => {
    if (row.cantidad === 0) {
      return { backgroundColor: "#fee2e2" };
    }
    return {};
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-3 border border-gray-400 w-full h-full transition-all duration-300">
      <div className="mb-4">
        <h2 className="font-medium text-black mb-2">
          Cronograma de Pedidos ({diaDeLaSemana})
        </h2>
        <div className="flex flex-wrap items-end gap-4 mb-4">
        {/* Selección de día */}
        <div className="flex flex-col">
          <label className="text-xs md:text-sm font-medium text-gray-700">Seleccionar Día</label>
          <select
            value={diaSeleccionado}
            onChange={(e) => setDiaSeleccionado(e.target.value)}
            className="mt-1 p-1 md:p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black min-w-[140px] md:min-w-[180px]"
          >
            <option value="">Día a buscar</option>
            {diasSemana.map((dia) => (
              <option key={dia} value={dia}>
                {dia}
              </option>
            ))}
          </select>
        </div>

        {/* Botón Buscar */}
        <div className="flex flex-col">
          <label className="text-xs md:text-sm font-medium text-gray-700 invisible">
            Acción
          </label>
          <button
            onClick={handleBuscar}
            className="mt-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none min-w-[100px] md:min-w-[120px]"
          >
            Buscar
          </button>
        </div>

        {/* Botón Limpiar */}
        <div className="flex flex-col">
          <label className="text-xs md:text-sm font-medium text-gray-700 invisible">
            Acción
          </label>
          <button
            onClick={handleLimpiar}
            className="mt-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 focus:outline-none min-w-[100px] md:min-w-[120px]"
          >
            Limpiar
          </button>
        </div>
      </div>

      {/* Campo de búsqueda */}
      <div className="flex flex-col w-full max-w-md">
        <label className="text-xs md:text-sm font-medium text-gray-700">Buscar por Sucursal</label>
        <input
          type="text"
          placeholder="Nombre Sucursal"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="mt-1 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black placeholder-black"
        />
      </div>

      </div>
      <div className="mt-4">
        <TableComponent
          data={filteredData}
          columns={columns}
          maxHeight="calc(100vh - 400px)"
          enableSorting={true}
          getRowStyle={getRowStyle}
          enablePagination={true}
          rowsPerPage={1000}
        />
      </div>
    </div>
  );
};