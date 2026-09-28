import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import HomePage from './pages/HomePage'
import Login from './pages/Login/Login.jsx'
import ClassSetup from './pages/ClassSetup/ClassSetup.jsx'
import { AuthProvider } from './context/AuthContext'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Trang mặc định */}
          <Route path="/" element={<HomePage />} />

          {/* Trang đăng nhập */}
          <Route path="/login" element={<Login />} />

          {/* Trang chủ */}
          <Route path="/homepage" element={<HomePage />} />

          {/* Class Setup Flow Routes */}
          <Route path="/class-setup" element={<ClassSetup />} />
          <Route path="/class-setup/admin/semesters" element={<ClassSetup />} />
          <Route path="/class-setup/admin/roster" element={<ClassSetup />} />
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