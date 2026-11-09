import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import HomePage from './pages/HomePage'
import Login from './pages/Login/Login.jsx'
import ForgotPassword from './pages/Auth/ForgotPassword.jsx'
import ResetPassword from './pages/Auth/ResetPassword.jsx'
import Users from './pages/Users/Users.jsx'
import Roles from './pages/Roles/Roles.jsx'
import SystemSettings from './pages/Admin/SystemSettings.jsx'
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
import BorrowRequestDetail from './pages/Borrowing/BorrowRequestDetail.jsx'

import InventorySetup from './pages/Components/InventorySetup.jsx'
import CabinetDetail from './pages/Components/CabinetDetail.jsx'
import StockReceipts from './pages/Components/StockReceipts.jsx'
import StockReceiptDetail from './pages/Components/StockReceiptDetail.jsx'
import ProjectManagement from './pages/Projects/ProjectManagement.jsx'

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

          {/* Quản trị Tài khoản & Phân quyền & Cài đặt (Admin) */}
          <Route path="/admin/users" element={<Users />} />
          <Route path="/admin/roles" element={<Roles />} />
          <Route path="/admin/system-settings" element={<SystemSettings />} />

          {/* Class Setup Flow Routes */}
          <Route path="/class-setup" element={<ClassSetup />} />
          <Route path="/class-setup/admin/semesters" element={<ClassSetup />} />
          <Route path="/class-setup/admin/courses" element={<ClassSetup />} />
          <Route path="/class-setup/admin/roster" element={<ClassSetup />} />
          <Route path="/class-setup/admin/components" element={<Components />} />
          <Route path="/class-setup/admin/components/new" element={<NewComponent />} />
          <Route path="/class-setup/admin/components/:componentId/edit" element={<NewComponent />} />
          <Route path="/class-setup/admin/categories" element={<InventorySetup />} />
          <Route path="/class-setup/admin/lab-rooms" element={<InventorySetup />} />
          <Route path="/class-setup/admin/cabinets" element={<InventorySetup />} />
          <Route path="/class-setup/admin/cabinets/:cabinetId" element={<CabinetDetail />} />
          <Route path="/class-setup/admin/stock-inwards" element={<StockInwards />} />
          <Route path="/class-setup/admin/stock-receipts" element={<StockReceipts />} />
          <Route path="/class-setup/admin/stock-receipts/:receiptId" element={<StockReceiptDetail />} />
          <Route path="/class-setup/admin/storage-allocation/:inwardId" element={<StorageAllocation />} />
          <Route path="/class-setup/lecturer/quotas" element={<ClassSetup />} />
          <Route path="/class-setup/student/groups" element={<ClassSetup />} />
          <Route path="/class-setup/student/project/:teamId" element={<ProjectManagement />} />

          {/* MF5.1: Mượn Bổ Sung (Supplementary Borrowing) */}
          <Route path="/borrow/my-requests" element={<SupplementaryBorrowList />} />
          <Route path="/borrow/requests/:id" element={<BorrowRequestDetail />} />
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
