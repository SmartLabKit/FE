import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import HomePage from './pages/HomePage'
import Login from './pages/Login/Login.jsx'
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
import CreateSupplementaryBorrow from './pages/Borrowing/CreateSupplementaryBorrow.jsx'
import SupplementaryBorrowDetail from './pages/Borrowing/SupplementaryBorrowDetail.jsx'
import ReviewSupplementaryBorrow from './pages/Borrowing/ReviewSupplementaryBorrow.jsx'
import SupplementaryBorrowList from './pages/Borrowing/SupplementaryBorrowList.jsx'
import CreateReturnRequest from './pages/Borrowing/CreateReturnRequest.jsx'
import ReturnRequestDetail from './pages/Borrowing/ReturnRequestDetail.jsx'
import ConfirmReturnRequest from './pages/Borrowing/ConfirmReturnRequest.jsx'
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
          <Route path="/class-setup/admin/courses" element={<ClassSetup />} />
          <Route path="/class-setup/admin/roster" element={<ClassSetup />} />
          <Route path="/class-setup/admin/components" element={<Components />} />
          <Route path="/class-setup/admin/components/new" element={<NewComponent />} />
          <Route path="/class-setup/admin/stock-inwards" element={<StockInwards />} />
          <Route path="/class-setup/admin/storage-allocation/:inwardId" element={<StorageAllocation />} />
          <Route path="/class-setup/lecturer/quotas" element={<ClassSetup />} />
          <Route path="/class-setup/student/groups" element={<ClassSetup />} />

          {/* MF5.1: Mượn Bổ Sung (Supplementary Borrowing) */}
          <Route path="/borrow/my-requests" element={<SupplementaryBorrowList />} />
          <Route path="/borrow/supplementary" element={<SupplementaryBorrowList />} />
          <Route path="/borrow/supplementary/create" element={<CreateSupplementaryBorrow />} />
          <Route path="/borrow/supplementary/:id" element={<SupplementaryBorrowDetail />} />
          <Route path="/borrow/supplementary/review/:id" element={<ReviewSupplementaryBorrow />} />

          {/* MF5.2: Trả Linh Kiện (Component Return Process) */}
          <Route path="/borrow/return/create" element={<CreateReturnRequest />} />
          <Route path="/borrow/return/:id" element={<ReturnRequestDetail />} />
          <Route path="/borrow/return/confirm/:id" element={<ConfirmReturnRequest />} />

          {/* Đường dẫn không tồn tại */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
