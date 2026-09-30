import { useState, useEffect } from 'react'
import { Box, Container, Tab, Tabs, Paper } from '@mui/material'
import { useLocation, useNavigate } from 'react-router-dom'
import PortalLayout from '../../components/layout/PortalLayout'
import SemesterClassManager from './SemesterClassManager'
import ImportRosterFaculty from './ImportRosterFaculty'
import CourseQuotaSetting from './CourseQuotaSetting'
import GroupInviteManager from './GroupInviteManager'
import { useAuth, DEMO_ACCOUNTS } from '../../context/AuthContext'

/**
 * ClassSetup Component: Giao diện phân quyền tuyệt đối cho từng vai trò (Actor)
 * Đã bỏ toàn bộ các nút điều hướng chuyển vai trò và các nút nhảy qua bước của vai trò khác.
 */
export default function ClassSetup() {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const currentUser = user || DEMO_ACCOUNTS.ADMIN

  // Xác định sub-tab cho Admin (0: Quản lý kỳ học, 1: Nhập danh sách & phân công)
  const getAdminTab = (path) => {
    if (path.includes('/admin/roster')) return 1
    return 0
  }

  const [adminTab, setAdminTab] = useState(getAdminTab(location.pathname))

  useEffect(() => {
    setAdminTab(getAdminTab(location.pathname))
  }, [location.pathname])

  const handleAdminTabChange = (event, newValue) => {
    setAdminTab(newValue)
    if (newValue === 0) {
      navigate('/class-setup/admin/semesters')
    } else {
      navigate('/class-setup/admin/roster')
    }
  }

  // Phân lập ranh giới vai trò dựa trên tài khoản đăng nhập & đường dẫn
  const isLecturerRoute = location.pathname.includes('/lecturer') || currentUser.roleLabel === 'LECTURER'
  const isStudentRoute = location.pathname.includes('/student') || currentUser.roleLabel === 'STUDENT'
  const isAdminRoute = !isLecturerRoute && !isStudentRoute

  return (
    <PortalLayout>
      <Container maxWidth="xl" disableGutters>
        {/* Vai trò ADMIN: Chỉ hiển thị 2 tính năng dành riêng cho Admin */}
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
                <Tab label="Quản lý Kỳ học & Lớp môn học" />
                <Tab label="Nhập Danh sách Sinh viên & Phân công" />
              </Tabs>
            </Paper>

            {adminTab === 0 && <SemesterClassManager onNext={() => handleAdminTabChange(null, 1)} />}
            {adminTab === 1 && (
              <ImportRosterFaculty
                onPrev={() => handleAdminTabChange(null, 0)}
              />
            )}
          </Box>
        )}

        {/* Vai trò GIẢNG VIÊN (Lecturer): Chỉ hiển thị tính năng Cài đặt định mức */}
        {isLecturerRoute && (
          <Box>
            <CourseQuotaSetting />
          </Box>
        )}

        {/* Vai trò SINH VIÊN (Student): Chỉ hiển thị tính năng Tạo nhóm & Mời thành viên */}
        {isStudentRoute && (
          <Box>
            <GroupInviteManager />
          </Box>
        )}
      </Container>
    </PortalLayout>
  )
}
