import { Typography } from '@mui/material'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Login from './pages/Login/Login.jsx'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route
          path="/homepage"
          element={
            <Typography variant="h4" sx={{ p: 4 }}>
              Homepage
            </Typography>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
