import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import HomePage from './pages/HomePage'
import Login from './pages/Login/Login.jsx'
import ForgotPassword from './pages/Auth/ForgotPassword.jsx'
import ResetPassword from './pages/Auth/ResetPassword.jsx'
import ActivateAccount from './pages/Auth/ActivateAccount.jsx'
import Users from './pages/Users/Users.jsx'
import Roles from './pages/Roles/Roles.jsx'
import SystemSettings from './pages/Admin/SystemSettings.jsx'
import AuditLogs from './pages/Admin/AuditLogs.jsx'
import Profile from './pages/Profile/Profile.jsx'
import ClassSetup from './pages/ClassSetup/ClassSetup.jsx'
import Components from './pages/Components/Components.jsx'
import ComponentCatalog from './pages/Components/ComponentCatalog.jsx'
import ComponentDetail from './pages/Components/ComponentDetail.jsx'
import NewComponent from './pages/Components/NewComponent.jsx'
import ComponentExcelImport from './pages/Components/ComponentExcelImport.jsx'
import StockInwards from './pages/Components/StockInwards.jsx'

import CreateSupplementaryBorrow from './pages/Borrowing/CreateSupplementaryBorrow.jsx'
import SupplementaryBorrowDetail from './pages/Borrowing/SupplementaryBorrowDetail.jsx'
import ReviewSupplementaryBorrow from './pages/Borrowing/ReviewSupplementaryBorrow.jsx'
import SupplementaryBorrowList from './pages/Borrowing/SupplementaryBorrowList.jsx'
import BorrowRequestDetail from './pages/Borrowing/BorrowRequestDetail.jsx'
import ReturnSlipDetail from './pages/Borrowing/ReturnSlipDetail.jsx'
import LabBorrowManagement from './pages/Borrowing/LabBorrowManagement.jsx'

import InventorySetup from './pages/Components/InventorySetup.jsx'
import LabRoomManagement from './pages/Components/LabRoomManagement.jsx'
import CabinetDetail from './pages/Components/CabinetDetail.jsx'
import StockReceipts from './pages/Components/StockReceipts.jsx'
import StockReceiptDetail from './pages/Components/StockReceiptDetail.jsx'
import InventoryLedger from './pages/Components/InventoryLedger.jsx'
import InventoryAuditDetail from './pages/Components/InventoryAuditDetail.jsx'
import ProjectManagement from './pages/Projects/ProjectManagement.jsx'
import StudentProjectList from './pages/Projects/StudentProjectList.jsx'
import StudentGroupsPage from './pages/ClassSetup/StudentGroupsPage.jsx'
import FinalSubmissionReview from './pages/Projects/FinalSubmissionReview.jsx'
import Dashboard from './pages/Reports/Dashboard.jsx'
import Reports from './pages/Reports/Reports.jsx'
import Notifications from './pages/Notifications/Notifications.jsx'
import IssueReports from './pages/IssueReports/IssueReports.jsx'

import { AuthProvider } from './context/AuthContext'
import RequireRole from './components/common/RequireRole'

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
          <Route path="/activate" element={<ActivateAccount />} />

          {/* Hồ sơ cá nhân & Bảo mật (Đăng nhập) */}
          <Route path="/profile" element={<RequireRole><Profile /></RequireRole>} />
          <Route path="/notifications" element={<RequireRole><Notifications /></RequireRole>} />

          {/* Quản trị Tài khoản & Phân quyền & Cài đặt (Admin) */}
          <Route path="/admin/users" element={<RequireRole roles={['Admin']}><Users /></RequireRole>} />
          <Route path="/admin/roles" element={<RequireRole roles={['Admin']}><Roles /></RequireRole>} />
          <Route path="/admin/system-settings" element={<RequireRole roles={['Admin']}><SystemSettings /></RequireRole>} />
          <Route path="/admin/audit-logs" element={<RequireRole roles={['Admin']}><AuditLogs /></RequireRole>} />

          {/* Tổng quan & Báo cáo thống kê (Admin / InventoryManager / LabStaff / Lecturer) */}
          <Route path="/dashboard" element={<RequireRole roles={['Admin', 'InventoryManager', 'LabStaff', 'Lecturer']}><Dashboard /></RequireRole>} />
          <Route path="/reports" element={<RequireRole roles={['Admin', 'InventoryManager', 'LabStaff', 'Lecturer']}><Reports /></RequireRole>} />
          <Route path="/issue-reports" element={<RequireRole roles={['LabStaff', 'InventoryManager', 'Student']}><IssueReports /></RequireRole>} />

          {/* Class Setup Flow Routes */}
          <Route path="/class-setup" element={<RequireRole><ClassSetup /></RequireRole>} />
          <Route path="/class-setup/admin/semesters" element={<RequireRole roles={['Admin']}><ClassSetup /></RequireRole>} />
          <Route path="/class-setup/admin/courses" element={<RequireRole roles={['Admin']}><ClassSetup /></RequireRole>} />
          <Route path="/class-setup/admin/roster" element={<RequireRole roles={['Admin']}><ClassSetup /></RequireRole>} />
          <Route path="/class-setup/admin/components" element={<RequireRole roles={['InventoryManager', 'LabStaff']}><Components /></RequireRole>} />
          <Route path="/class-setup/admin/components/catalog" element={<RequireRole roles={['InventoryManager', 'LabStaff']}><ComponentCatalog /></RequireRole>} />
          <Route path="/class-setup/admin/components/:componentId" element={<RequireRole roles={['InventoryManager', 'LabStaff']}><ComponentDetail /></RequireRole>} />
          <Route path="/components/catalog" element={<RequireRole roles={['InventoryManager', 'LabStaff', 'Lecturer', 'Student']}><ComponentCatalog /></RequireRole>} />
          <Route path="/components/:componentId" element={<RequireRole roles={['InventoryManager', 'LabStaff', 'Lecturer', 'Student']}><ComponentDetail /></RequireRole>} />
          <Route path="/class-setup/admin/components/new" element={<RequireRole roles={['InventoryManager']}><NewComponent /></RequireRole>} />
          <Route path="/class-setup/admin/components/import" element={<RequireRole roles={['InventoryManager']}><ComponentExcelImport /></RequireRole>} />
          <Route path="/class-setup/admin/components/:componentId/edit" element={<RequireRole roles={['InventoryManager']}><NewComponent /></RequireRole>} />
          <Route path="/class-setup/admin/categories" element={<RequireRole roles={['InventoryManager', 'LabStaff']}><InventorySetup /></RequireRole>} />
          <Route path="/class-setup/admin/lab-rooms" element={<RequireRole roles={['InventoryManager', 'LabStaff']}><InventorySetup /></RequireRole>} />
          <Route path="/class-setup/admin/lab-room-management" element={<RequireRole roles={['Admin', 'InventoryManager']}><LabRoomManagement /></RequireRole>} />
          <Route path="/class-setup/admin/cabinets" element={<RequireRole roles={['InventoryManager', 'LabStaff']}><InventorySetup /></RequireRole>} />
          <Route path="/class-setup/admin/cabinets/:cabinetId" element={<RequireRole roles={['InventoryManager', 'LabStaff']}><CabinetDetail /></RequireRole>} />
          <Route path="/class-setup/admin/stock-inwards" element={<RequireRole roles={['InventoryManager']}><StockInwards /></RequireRole>} />
          <Route path="/class-setup/admin/stock-receipts" element={<RequireRole roles={['InventoryManager']}><StockReceipts /></RequireRole>} />
          <Route path="/class-setup/admin/stock-receipts/:receiptId" element={<RequireRole roles={['InventoryManager']}><StockReceiptDetail /></RequireRole>} />
          <Route path="/class-setup/admin/inventory-ledger" element={<RequireRole roles={['InventoryManager']}><InventoryLedger /></RequireRole>} />
          <Route path="/class-setup/admin/inventory-audits" element={<RequireRole roles={['InventoryManager', 'LabStaff']}><InventorySetup /></RequireRole>} />
          <Route path="/class-setup/admin/inventory-audits/:auditId" element={<RequireRole roles={['InventoryManager', 'LabStaff']}><InventoryAuditDetail /></RequireRole>} />
          <Route path="/class-setup/lecturer/classes" element={<RequireRole roles={['Lecturer']}><ClassSetup /></RequireRole>} />
          <Route path="/class-setup/lecturer/final-submissions" element={<RequireRole roles={['Lecturer', 'Admin']}><FinalSubmissionReview /></RequireRole>} />
          <Route path="/class-setup/student/groups" element={<RequireRole roles={['Student']}><StudentGroupsPage /></RequireRole>} />
          <Route path="/class-setup/student/project" element={<RequireRole roles={['Student']}><StudentProjectList /></RequireRole>} />
          <Route path="/class-setup/student/project/:teamId" element={<RequireRole roles={['Student']}><ProjectManagement /></RequireRole>} />

          {/* Mượn bổ sung & gia hạn */}
          <Route path="/borrow/lab-orders" element={<RequireRole roles={['LabStaff']}><LabBorrowManagement /></RequireRole>} />
          <Route path="/borrow/my-requests" element={<RequireRole roles={['Student', 'Lecturer']}><SupplementaryBorrowList /></RequireRole>} />
          <Route path="/borrow/requests/:id" element={<RequireRole><BorrowRequestDetail /></RequireRole>} />
          <Route path="/borrow/return-slips/:id" element={<RequireRole><ReturnSlipDetail /></RequireRole>} />
          <Route path="/borrow/supplementary" element={<RequireRole roles={['Student', 'Lecturer']}><SupplementaryBorrowList /></RequireRole>} />
          <Route path="/borrow/supplementary/create" element={<RequireRole roles={['Student']}><CreateSupplementaryBorrow /></RequireRole>} />
          <Route path="/borrow/supplementary/:id" element={<RequireRole roles={['Student', 'Lecturer']}><SupplementaryBorrowDetail /></RequireRole>} />
          <Route path="/borrow/supplementary/review/:id" element={<RequireRole roles={['Lecturer']}><ReviewSupplementaryBorrow /></RequireRole>} />

          {/* Đường dẫn không tồn tại */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
