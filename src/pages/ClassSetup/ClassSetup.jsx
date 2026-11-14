import { useEffect } from 'react'
import { Box, Container, Tab, Tabs, Paper } from '@mui/material'
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

  const handleLecturerTabChange = (event, newValue) => {
    navigate(newValue === 0 ? '/class-setup/lecturer/classes' : '/class-setup/lecturer/quotas')
  }

  const adminTab = getAdminTab(location.pathname)
  const lecturerTab = location.pathname.includes('/lecturer/quotas') ? 1 : 0

  const handleAdminTabChange = (event, newValue) => {
    if (newValue === 0) {
      navigate('/class-setup/admin/semesters')
    } else if (newValue === 1) {
      navigate('/class-setup/admin/courses')
    } else {
      navigate('/class-setup/admin/roster')
    }
  }

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
      <Container maxWidth="xl" disableGutters>
        {/* Vai trò ADMIN: Hiển thị 3 tính năng dành riêng cho Admin */}
        {isAdminRoute && (
          <Box>
            <Paper
              elevation={0}
              sx={{
                bgcolor: '#ffffff',
                border: '1px solid #e4e6ef',
                borderRadius: 2,
                px: 2,
                py: 0.5,
                mb: 3,
              }}
            >
              <Tabs
                value={adminTab}
                onChange={handleAdminTabChange}
                sx={{
                  minHeight: 44,
                  '& .MuiTab-root': {
                    textTransform: 'none',
                    fontWeight: 700,
                    fontSize: 13,
                    minHeight: 44,
                    color: '#6b7280',
                  },
                  '& .Mui-selected': { color: '#0058be' },
                  '& .MuiTabs-indicator': { height: 3, borderRadius: 1.5, bgcolor: '#0058be' },
                }}
              >
                <Tab label="1. Kỳ học & Lớp môn học" />
                <Tab label="2. Danh mục Môn học (Courses)" />
                <Tab label="3. Nhập Danh sách SV & Phân công" />
              </Tabs>
            </Paper>

            {adminTab === 0 && <SemesterClassManager onNext={() => handleAdminTabChange(null, 2)} />}
            {adminTab === 1 && <CourseManager />}
            {adminTab === 2 && (
              <ImportRosterFaculty
                onPrev={() => handleAdminTabChange(null, 0)}
              />
            )}
          </Box>
        )}

        {/* Vai trò GIẢNG VIÊN (Lecturer) */}
        {isLecturerRoute && (
          <Box>
            <Paper
              elevation={0}
              sx={{ bgcolor: '#ffffff', border: '1px solid #e4e6ef', borderRadius: 2, px: 2, py: 0.5, mb: 3 }}
            >
              <Tabs value={lecturerTab} onChange={handleLecturerTabChange}>
                <Tab label="Lớp giảng dạy & nhóm" />
                <Tab label="Định mức môn học" />
              </Tabs>
            </Paper>
            {lecturerTab === 0 ? <LecturerClassManagement /> : <CourseQuotaSetting />}
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
