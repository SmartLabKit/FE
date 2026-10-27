import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import HomePage from './pages/HomePage'
import Login from './pages/Login/Login.jsx'
import Register from './pages/Auth/Register.jsx'
import VerifyEmail from './pages/Auth/VerifyEmail.jsx'
import ForgotPassword from './pages/Auth/ForgotPassword.jsx'
import ResetPassword from './pages/Auth/ResetPassword.jsx'
import Users from './pages/Users/Users.jsx'
import Roles from './pages/Roles/Roles.jsx'
import Profile from './pages/Profile/Profile.jsx'
import ClassSetup from './pages/ClassSetup/ClassSetup.jsx'
import Components from './pages/Components/Components.jsx'
import NewComponent from './pages/Components/NewComponent.jsx'
import StockInwards from './pages/Components/StockInwards.jsx'
import StorageAllocation from './pages/Components/StorageAllocation.jsx'
import { AuthProvider } from './context/AuthContext'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Trang mặc định & Giới thiệu */}
          <Route path="/" element={<HomePage />} />
          <Route path="/homepage" element={<HomePage />} />

          {/* Luồng Xác thực & Tài khoản (Public) */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Hồ sơ cá nhân & Bảo mật (Đăng nhập) */}
          <Route path="/profile" element={<Profile />} />

          {/* Quản trị Tài khoản & Phân quyền (Admin) */}
          <Route path="/admin/users" element={<Users />} />
          <Route path="/admin/roles" element={<Roles />} />

          {/* Class Setup Flow Routes */}
          <Route path="/class-setup" element={<ClassSetup />} />
          <Route path="/class-setup/admin/semesters" element={<ClassSetup />} />
          <Route path="/class-setup/admin/roster" element={<ClassSetup />} />
          <Route path="/class-setup/admin/components" element={<Components />} />
          <Route path="/class-setup/admin/components/new" element={<NewComponent />} />
          <Route path="/class-setup/admin/stock-inwards" element={<StockInwards />} />
          <Route path="/class-setup/admin/storage-allocation/:inwardId" element={<StorageAllocation />} />
          <Route path="/class-setup/lecturer/quotas" element={<ClassSetup />} />
          <Route path="/class-setup/student/groups" element={<ClassSetup />} />

          {/* Đường dẫn không tồn tại */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
