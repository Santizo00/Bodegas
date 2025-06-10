import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

export function exportToExcel(nombreArchivo: string, nombreHoja: string, data: any[], columnas: Record<string, string>) {
  const datosExportar = data.map(item => {
    const row: Record<string, any> = {};
    Object.entries(columnas).forEach(([key, label]) => {
      row[label] = item[key] ?? "N/A";
    });
    return row;
  });

  const hoja = XLSX.utils.json_to_sheet(datosExportar);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, nombreHoja);

  const excelBuffer = XLSX.write(libro, { bookType: "xlsx", type: "array" });
  const archivo = new Blob([excelBuffer], { type: "application/octet-stream" });
  saveAs(archivo, `${nombreArchivo}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
