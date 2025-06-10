import React from "react";
import { ArrowUpDown, Search } from "lucide-react";
import TableComponent from "../components/Table";

interface ProductoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBuscar: () => void;
  productos: any[];
  onSeleccionar: (producto: any) => void;
  modo: "reemplazo" | "agregar";
  productoSeleccionado?: any;
  showUPC: boolean;
  toggleSearchFields: () => void;
  modalUpcValue: string;
  setModalUpcValue: (value: string) => void;
  modalDescripcionValue: string;
  setModalDescripcionValue: (value: string) => void;
}

const ProductoModal: React.FC<ProductoModalProps> = ({
  isOpen,
  onClose,
  onBuscar,
  productos,
  onSeleccionar,
  modo,
  productoSeleccionado,
  showUPC,
  toggleSearchFields,
  modalUpcValue,
  setModalUpcValue,
  modalDescripcionValue,
  setModalDescripcionValue
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="bg-white p-3 rounded-lg shadow-lg w-[1200px] z-50">
        <h2 className="text-xl font-semibold mb-1 text-black">
          {modo === "reemplazo" ? "Reemplazar Producto" : "Agregar Producto"}
        </h2>

        {/* Mostrar detalles solo si es modo reemplazo */}
        {modo === "reemplazo" && productoSeleccionado && (
          <div className="flex space-x-12 mb-3">
            <p className="text-black"><strong>UPC:</strong> {productoSeleccionado.upc}</p>
            <p className="text-black"><strong>Descripción:</strong> {productoSeleccionado.descripcion}</p>
            <p className="text-black"><strong>Cantidad:</strong> {productoSeleccionado.cantidad || 'N/A'}</p>
          </div>
        )}

        <hr className="border-gray-600 mb-3" />

        <div className="flex space-x-4 mb-3">
          {showUPC && (
            <input
              type="text"
              placeholder="Búsqueda por UPC"
              value={modalUpcValue}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, "");
                if (value.length <= 13) {
                  setModalUpcValue(value);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onBuscar();
                }
              }}
              className="flex-1 p-2 border border-gray-800 rounded-lg bg-white text-black placeholder-black"
            />
          )}

          {!showUPC && (
            <input
              type="text"
              placeholder="Búsqueda por Descripción"
              value={modalDescripcionValue}
              onChange={(e) => setModalDescripcionValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onBuscar();
                }
              }}
              className="flex-1 p-2 border border-gray-800 rounded-lg bg-white text-black placeholder-black"
            />
          )}

          <button className="bg-green-700 text-white p-2 rounded-lg flex items-center space-x-2" onClick={onBuscar}>
            <Search className="h-5 w-5" />
            <span>Buscar</span>
          </button>

          <button className="bg-blue-600 text-white p-2 rounded-lg flex items-center space-x-2" onClick={toggleSearchFields}>
            <span>UPC</span>
            <ArrowUpDown className="h-5 w-5" />
            <span>Descricpion</span>
          </button>
        </div>

        <div className="border border-gray-300 rounded-lg overflow-hidden">
          <TableComponent
            data={productos}
            columns={[
              { key: "UPCPaquete", 
                label: "UPCFardo", 
                sortable: true, 
                editable :true,
                render: (item) => <>{item.UPCPaquete || item.upc}</>   },
              { key: "upc", label: "UPCUnidad", sortable: true, editable :true  },
              { key: "descripcion", label: "Descripción", sortable: true, editable :true  },
              { key: "UnidadesFardo", label: "Unidades Fardo", sortable: true, editable :true  },
              { key: "existenciafardos", label: "Existencia Fardos", sortable: true, editable :true  },
              { key: "existencia", label: "Existencia Unidades", sortable: true, editable :true  },
              { key: "reservadopedido", label: "Reservado", sortable: true, editable :true  },
              {
                label: "Opción",
                render: (productoReemplazo) => (
                  <button
                    className="bg-blue-600 text-white px-2 py-1 rounded-lg"
                    onClick={() => onSeleccionar({
                      ...productoReemplazo,
                      UPCPaquete: productoReemplazo.UPCPaquete || productoReemplazo.upc 
                    })}
                  >
                    Seleccionar
                  </button>
                ),
              },
            ]}
            enableSorting={true}
            enablePagination={true}
            rowsPerPage={25}
            maxHeight="calc(100vh - 230px)"
          />
        </div>

        <div className="flex justify-end mt-1">
          <button className="bg-red-600 text-white px-3 py-2 rounded-lg" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductoModal;