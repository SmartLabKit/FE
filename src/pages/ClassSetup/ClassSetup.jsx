import { useEffect } from 'react'
import { Box, Container } from '@mui/material'
import { useLocation, useNavigate } from 'react-router-dom'
import PortalLayout from '../../components/layout/PortalLayout'
import SemesterClassManager from './SemesterClassManager'
import CourseManager from './CourseManager'
import ImportRosterFaculty from './ImportRosterFaculty'
import CourseQuotaSetting from './CourseQuotaSetting'
import GroupInviteManager from './GroupInviteManager'
import LecturerClassManagement from './LecturerClassManagement'
import { useAuth, DEMO_ACCOUNTS } from '../../context/AuthContext'

/**
 * ClassSetup Component: Giao diện quản lý Học kỳ, Môn học, Lớp & Nhóm (MF2)
 * Phân quyền rõ ràng cho từng vai trò (Actor):
 * - ADMIN: Quản lý Kỳ học & Lớp, Danh mục Môn học, Nhập Roster & Phân công
 * - LECTURER: Cài đặt định mức linh kiện
 * - STUDENT: Tạo nhóm & Mời thành viên, Phản hồi lời mời
 */
// Component quản lý Học kỳ, Môn học, Lớp & Nhóm (MF2)
export default function ClassSetup() {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const currentUser = user || DEMO_ACCOUNTS.ADMIN

  // Xác định sub-tab cho Admin (0: Kỳ học & Lớp, 1: Môn học, 2: Nhập roster & phân công)
  const getAdminTab = (path) => {
    if (path.includes('/admin/roster')) return 2
    if (path.includes('/admin/courses')) return 1
    return 0
  }

  const adminTab = getAdminTab(location.pathname)

  // Tự động điều hướng /class-setup về trang chính xác của từng role
  useEffect(() => {
    if (location.pathname === '/class-setup') {
      if (currentUser.roleLabel === 'STUDENT') {
        navigate('/class-setup/student/groups', { replace: true })
      } else if (currentUser.roleLabel === 'LECTURER') {
        navigate('/class-setup/lecturer/classes', { replace: true })
      } else if (currentUser.roleLabel === 'INVENTORYMANAGER') {
        navigate('/class-setup/admin/stock-inwards', { replace: true })
      } else if (currentUser.roleLabel === 'LABSTAFF') {
        navigate('/class-setup/admin/lab-rooms', { replace: true })
      } else {
        navigate('/class-setup/admin/semesters', { replace: true })
      }
    }
  }, [location.pathname, currentUser, navigate])

  // Phân lập ranh giới vai trò dựa trên tài khoản đăng nhập & đường dẫn
  const isLecturerRoute = location.pathname.includes('/lecturer') ||
    (!location.pathname.includes('/student') && currentUser.roleLabel === 'LECTURER')
  const isStudentRoute = location.pathname.includes('/student') ||
    (!location.pathname.includes('/lecturer') && currentUser.roleLabel === 'STUDENT')
  const isAdminRoute = !isLecturerRoute && !isStudentRoute && (currentUser.roleLabel === 'ADMIN' || !currentUser.roleLabel)

  return (
    <PortalLayout>
      <Container
        maxWidth="xl"
        disableGutters
        sx={{ width: '100%', maxWidth: 1600, minWidth: 0, mx: 'auto', boxSizing: 'border-box' }}
      >
        {/* Vai trò ADMIN: Hiển thị tính năng theo URL */}
        {isAdminRoute && (
          <Box>
            {adminTab === 0 && <SemesterClassManager onNext={() => navigate('/class-setup/admin/roster')} />}
            {adminTab === 1 && <CourseManager />}
            {adminTab === 2 && (
              <ImportRosterFaculty
                onPrev={() => navigate('/class-setup/admin/semesters')}
              />
            )}
          </Box>
        )}

        {/* Vai trò GIẢNG VIÊN (Lecturer) */}
        {isLecturerRoute && (
          <Box>
            {location.pathname.includes('/lecturer/quotas')
              ? <CourseQuotaSetting />
              : <LecturerClassManagement />}
          </Box>
        )}

        {/* Vai trò SINH VIÊN (Student): Hiển thị tính năng Tạo nhóm & Mời thành viên & Lời mời */}
        {isStudentRoute && (
          <Box>
            <GroupInviteManager />
          </Box>
        )}
      </Container>
    </PortalLayout>
  )
}
