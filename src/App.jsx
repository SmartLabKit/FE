
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import HomePage from './pages/HomePage'
import Login from './pages/Login/Login.jsx'
import { Typography } from '@mui/material'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Trang mặc định */}
        <Route path="/" element={<HomePage />} />

        {/* Trang đăng nhập */}
        <Route path="/login" element={<Login />} />

        {/* Trang chủ */}
        <Route
          path="/homepage"
          element={<HomePage />}
        />

        {/* Đường dẫn không tồn tại */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App