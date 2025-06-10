# Sistema de Gestión de Pedidos para Bodegas

Este proyecto es una aplicación integral para la gestión de pedidos que llegan a bodegas, permitiendo el control, seguimiento y procesamiento eficiente de los productos solicitados por diferentes sucursales.

## Descripción General

El sistema está compuesto por un **backend** (Node.js + Express) y un **frontend** (React + TypeScript), integrados en una aplicación de escritorio mediante Electron. Permite visualizar, sincronizar, modificar y controlar el flujo de pedidos, así como gestionar el inventario y la ubicación de productos en la bodega.

## Funcionalidades Principales

- **Visualización de Pedidos:** Consulta de todos los pedidos recibidos, con filtros por sucursal, estado, fecha, departamento, etc.
- **Detalle de Pedido:** Visualización detallada de los productos de cada pedido, existencias, ubicaciones, faltantes y observaciones.
- **Sincronización de Pedidos:** Importación y actualización de pedidos desde sistemas externos o centrales.
- **Gestión de Inventario:** Consulta y edición de existencias por ubicación, con soporte para productos en mal estado y categorías.
- **Historial de Cambios:** Registro de todas las modificaciones realizadas sobre los pedidos y productos.
- **Impresión y Exportación:** Generación de reportes imprimibles y exportación a Excel de los pedidos y productos.
- **Gestión de Usuarios y Sesiones:** Inicio de sesión y control de acceso por usuario.
- **Configuración de Sucursal:** Permite seleccionar y configurar la sucursal/bodega activa.

## Estructura de Carpetas

- **Backend/**: Servidor Express, lógica de negocio, servicios, rutas y conexión a bases de datos.
  - `src/routes/`: Endpoints para pedidos, ubicaciones, historial, etc.
  - `src/services/`: Lógica de negocio y consultas SQL.
  - `src/config/`: Configuración de base de datos y middlewares.
- **Frontend/**: Aplicación React con páginas y componentes.
  - `src/pages/`: Páginas principales (pedidos, detalles, ubicaciones, historial, login, etc.).
  - `src/components/`: Componentes reutilizables (tablas, modales, sidebar, impresión, etc.).
  - `src/config/`: Configuración de la bodega/sucursal.
  - `src/services/`: Servicios auxiliares (alertas, exportación, loading, etc.).
- **main.js / preload.js**: Integración con Electron para empaquetar la app como escritorio.

## Páginas y Flujos Principales

- **Login:** Autenticación de usuario.
- **Home:** Panel principal con calendario de pedidos y resumen de la bodega.
- **Sincronizar Pedidos:** Importa y actualiza pedidos desde sistemas externos.
- **Ver Pedidos:** Lista de pedidos con filtros avanzados.
- **Detalle de Pedido:** Visualiza y gestiona los productos de un pedido, permite reemplazos, observaciones, impresión y exportación.
- **Detalle de Todos los Pedidos:** Vista consolidada de todos los productos de todos los pedidos.
- **Ubicaciones:** Consulta y gestión de inventario por ubicación física en la bodega.
- **Historial de Cambios:** Registro detallado de todas las modificaciones realizadas.
- **Configuración:** Selección y configuración de la sucursal/bodega activa.

## Tecnologías Utilizadas

- **Frontend:** React, TypeScript, Vite, TailwindCSS, MUI, dnd-kit (drag & drop), SweetAlert2.
- **Backend:** Node.js, Express, MySQL, dotenv, cors, express-session, jsonwebtoken.
- **Desktop:** Electron (main.js, preload.js).

## Instalación y Ejecución

1. Instalar dependencias en Backend y Frontend:
   ```sh
   cd Backend && npm install
   cd ../Frontend && npm install
   ```
2. Configurar archivos `.env` en Backend según info.txt.
3. Ejecutar el backend:
   ```sh
   npm run dev
   ```
4. Ejecutar el frontend:
   ```sh
   npm run dev
   ```
5. Para empaquetar como aplicación de escritorio, seguir las instrucciones en `info.txt` y usar Electron.

## Notas
- El sistema está preparado para trabajar con múltiples sucursales y ubicaciones.
- El flujo de trabajo está optimizado para el personal de bodega, permitiendo identificar rápidamente faltantes, imprimir listas y registrar cambios.
- El historial de cambios permite auditoría completa de las acciones realizadas.

---

Para dudas técnicas, revisar los archivos en `src/pages/` y `src/services/` de ambos proyectos.
