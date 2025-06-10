import { Routes, Route, Navigate } from "react-router-dom"; // ❌ Elimina BrowserRouter aquí
import Layout from "./components/Layout";
import DashboardHome from "./pages/Home";
import SyncOrders from "./pages/SyncOrders";
import DetailsOrders from "./pages/DetailsOrders";
import AllOrders from "./pages/AllOrders";
import DetailsAllOrders from "./pages/DetailsAllOrders";
import ChangeHistory from "./pages/ChangeHistory";
import Location from "./pages/Location";
import ConfigBodega from "./config/ConfigBodega";
import Login from "./pages/Login";
import { useEffect, useState } from "react";

// 🔹 Manejador de rutas protegidas
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isAuthenticated = localStorage.getItem("user") !== null;
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const user = localStorage.getItem("user");
    setIsAuthenticated(user !== null);
  }, []);

  return (
    <>
      <ConfigBodega />

      <Routes>
        {/* Public route for login */}
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
        />

        {/* Protected routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardHome />} />
          <Route path="sincronizar-pedidos" element={<SyncOrders />} />
          <Route path="/detalle/:idPedido" element={<DetailsOrders />} />
          <Route path="ver-pedidos" element={<AllOrders />} />
          <Route path="/detalleall/:idPedido" element={<DetailsAllOrders />} />
          <Route path="historial-cambios" element={<ChangeHistory />} />
          <Route path="ubicaciones" element={<Location />} />
        </Route>
      </Routes>
    </>
  );
}

export default App;
