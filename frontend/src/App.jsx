import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import FileComplaint from "./pages/FileComplaint";
import Home from "./pages/Home";
import Login from "./pages/Login";
import MyComplaints from "./pages/MyComplaints";
import Register from "./pages/Register";
import AdminDashboard from "./pages/AdminDashboard";
import QADashboard from "./pages/QADashboard";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route
          index
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route
          path="complaints/new"
          element={
            <ProtectedRoute>
              <FileComplaint />
            </ProtectedRoute>
          }
        />
        <Route
          path="my-complaints"
          element={
            <ProtectedRoute>
              <MyComplaints />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin"
          element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/qa"
          element={
            <ProtectedRoute>
              <QADashboard />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
