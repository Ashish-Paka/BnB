/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Routes, Route } from "react-router-dom";
import { CartProvider } from "./contexts/CartContext";
import CustomerPage from "./pages/CustomerPage";
import DashboardPage from "./pages/DashboardPage";

export default function App() {
  return (
    <CartProvider>
      <Routes>
        <Route path="/" element={<CustomerPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
      </Routes>
    </CartProvider>
  );
}
