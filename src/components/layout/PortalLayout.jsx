import { useState } from 'react'
import {
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Typography,
} from '@mui/material'
import {
  Category as CategoryIcon,
  CompareArrows as BorrowReturnIcon,
  AssignmentTurnedIn as ApprovalsIcon,
  Menu as MenuIcon,
  Logout as LogoutIcon,
  People as PeopleIcon,
  Security as SecurityIcon,
  AccountCircle as AccountCircleIcon,
  School as SchoolIcon,
  Groups as GroupsIcon,
  MenuBook as MenuBookIcon,
  Tune as TuneIcon,
  Close as CloseIcon,
  Dashboard as DashboardIcon,
  Assessment as ReportIcon,
  FactCheck as FinalSubmissionIcon,
  ReportProblem as IssueIcon,
  Checklist as AuditIcon,
  MeetingRoom as RoomIcon,
  History as AuditLogIcon,
} from '@mui/icons-material'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth, DEMO_ACCOUNTS } from '../../context/AuthContext'
import NotificationMenu from './NotificationMenu'
import { shouldBlockLeave } from '../../utils/leaveGuard'

/**
 * PortalLayout: Khung giao diện dùng chung cho hệ thống SmartLabKit
 * Hiển thị chuẩn vai trò của tài khoản đang đăng nhập và thanh điều hướng phân quyền.
 */
export default function PortalLayout({
  children,
  headerTitle,
  headerSubtitle,
  currentRole,
  currentUser: propUser,
  activeMenuKey,
}) {
  const { user, logout, hasPermission } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [mobileOpen, setMobileOpen] = useState(false)
  const [userMenuAnchor, setUserMenuAnchor] = useState(null)

  // Thông tin tài khoản hiện tại (hỗ trợ override từ props để demo đúng vai trò trên UI)
  const currentUser = propUser || user || DEMO_ACCOUNTS.ADMIN

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen)
  }

  const handleUserMenuOpen = (e) => {
    setUserMenuAnchor(e.currentTarget)
  }

  const handleUserMenuClose = () => {
    setUserMenuAnchor(null)
  }

  // Chuyển tới trang hồ sơ cá nhân
  const handleGoProfile = () => {
    handleUserMenuClose()
    navigate('/profile')
  }

  // Đăng xuất tài khoản
  const handleLogout = async () => {
    handleUserMenuClose()
    await logout()
    navigate('/login')
  }

  // Danh sách navigation ở menu bên trái lọc nghiêm ngặt theo vai trò
  const userRoles = (currentUser.roles || [currentUser.roleLabel || 'Admin']).map((r) => String(r).toUpperCase())
  const hasUserRole = (...targetRoles) => {
    return targetRoles.some((r) => userRoles.includes(r.toUpperCase()))
  }


  const navItems = [
    {
      label: 'Tổng quan',
      icon: <DashboardIcon fontSize="small" />,
      path: '/dashboard',
      roles: ['Admin', 'InventoryManager', 'LabStaff', 'Lecturer'],
    },
    {
      label: 'Báo cáo',
      icon: <ReportIcon fontSize="small" />,
      path: '/reports',
      roles: ['Admin', 'InventoryManager', 'LabStaff', 'Lecturer'],
    },
    {
      label: 'Sự cố thiết bị',
      icon: <IssueIcon fontSize="small" />,
      path: '/issue-reports',
      roles: ['InventoryManager', 'LabStaff', 'Student'],
      excludeRoles: ['Admin'],
    },

    // 1. Phân hệ SINH VIÊN (Student)
    {
      label: 'Nhóm & Lời mời',
      icon: <GroupsIcon fontSize="small" />,
      path: '/class-setup/student/groups',
      roles: ['Student'],
    },
    {
      label: 'Dự án của tôi',
      icon: <MenuBookIcon fontSize="small" />,
      path: '/class-setup/student/project',
      roles: ['Student'],
    },
    {
      label: 'Mượn / Trả linh kiện',
      icon: <BorrowReturnIcon fontSize="small" />,
      path: '/borrow/my-requests',
      roles: ['Student'],
    },

    // 2. Phân hệ GIẢNG VIÊN (Lecturer)
    {
      label: 'Lớp giảng dạy & nhóm',
      icon: <GroupsIcon fontSize="small" />,
      path: '/class-setup/lecturer/classes',
      roles: ['Lecturer'],
    },
    {
      label: 'Duyệt yêu cầu mượn',
      icon: <ApprovalsIcon fontSize="small" />,
      path: '/borrow/my-requests',
      roles: ['Lecturer'],
    },
    {
      label: 'Duyệt bài cuối kỳ',
      icon: <FinalSubmissionIcon fontSize="small" />,
      path: '/class-setup/lecturer/final-submissions',
      roles: ['Lecturer'],
      excludeRoles: ['Admin'],
    },

    // 3. Phân hệ HỌC VỤ & LỚP HỌC (Admin)
    {
      label: 'Kỳ học & Lớp môn',
      icon: <SchoolIcon fontSize="small" />,
      path: '/class-setup/admin/semesters',
      roles: ['Admin'],
    },
    {
      label: 'Danh mục Môn học',
      icon: <MenuBookIcon fontSize="small" />,
      path: '/class-setup/admin/courses',
      roles: ['Admin'],
    },
    {
      label: 'Nhập danh sách lớp & phân công',
      icon: <ApprovalsIcon fontSize="small" />,
      path: '/class-setup/admin/roster',
      roles: ['Admin'],
    },

    // 4. Phân hệ QUẢN LÝ KHO & LINH KIỆN (InventoryManager / LabStaff); Admin chỉ quản lý phòng lab
    {
      label: 'Linh kiện kho',
      icon: <CategoryIcon fontSize="small" />,
      path: '/class-setup/admin/components',
      roles: ['InventoryManager', 'LabStaff'],
    },
    {
      label: 'Tra cứu linh kiện',
      icon: <CategoryIcon fontSize="small" />,
      path: '/components/catalog',
      roles: ['InventoryManager', 'LabStaff', 'Lecturer', 'Student'],
    },
    {
      label: 'Tủ lưu trữ',
      icon: <RoomIcon fontSize="small" />,
      path: '/class-setup/admin/cabinets',
      roles: ['InventoryManager', 'LabStaff'],
    },
    {
      label: 'Quản lý phòng lab',
      icon: <RoomIcon fontSize="small" />,
      path: '/class-setup/admin/lab-room-management',
      permissionCodes: ['COMPONENT_MANAGE', 'USER_MANAGE'],
    },
    {
      label: 'Nhập kho',
      icon: <ApprovalsIcon fontSize="small" />,
      path: '/class-setup/admin/stock-receipts',
      roles: [ 'InventoryManager'],
    },
    {
      label: 'Kiểm kê kho',
      icon: <AuditIcon fontSize="small" />,
      path: '/class-setup/admin/inventory-audits',
      roles: ['InventoryManager', 'LabStaff'],
    },
    {
      label: 'Sổ kho',
      icon: <AuditLogIcon fontSize="small" />,
      path: '/class-setup/admin/inventory-ledger',
      roles: ['InventoryManager', 'LabStaff'],
    },

    // 5. Phân hệ BÀN GIAO & TRẢ ĐỒ (LabStaff)
    {
      label: 'Đơn mượn tại Lab',
      icon: <BorrowReturnIcon fontSize="small" />,
      path: '/borrow/lab-orders',
      roles: ['LabStaff'],
    },

    // 6. Phân hệ QUẢN TRỊ HỆ THỐNG & TÀI KHOẢN (Admin)
    {
      label: 'Người dùng',
      icon: <PeopleIcon fontSize="small" />,
      path: '/admin/users',
      roles: ['Admin'],
    },
    {
      label: 'Vai trò & Quyền',
      icon: <SecurityIcon fontSize="small" />,
      path: '/admin/roles',
      roles: ['Admin'],
    },
    {
      label: 'Cài đặt hệ thống',
      icon: <TuneIcon fontSize="small" />,
      path: '/admin/system-settings',
      roles: ['Admin'],
    },
    {
      label: 'Nhật ký thao tác',
      icon: <AuditLogIcon fontSize="small" />,
      path: '/admin/audit-logs',
      roles: ['Admin'],
    },
  ]

  // Lọc navigation theo đúng vai trò tài khoản đăng nhập (loại bỏ hoàn toàn tính năng không liên quan)
  const visibleNavItems = navItems.filter((item) => {
    if (item.excludeRoles && item.excludeRoles.some((r) => hasUserRole(r))) {
      return false
    }
    if (item.permissionCodes) {
      return item.permissionCodes.some((permission) => hasPermission(permission))
    }
    if (!item.roles || item.roles.length === 0) return true
    return item.roles.some((r) => hasUserRole(r))
  })

  const drawerContent = (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        bgcolor: '#ffffff',
        borderRight: '1px solid #e4e6ef',
        overflow: 'hidden',
      }}
    >
      {/* Brand Header */}
      <Box
        sx={{
          p: 2.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          borderBottom: '1px solid #f0f2f5',
          flexShrink: 0,
        }}
      >
        <Box
          sx={{
            width: 34,
            height: 34,
            bgcolor: '#0058be',
            borderRadius: 1.2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 2px 6px rgba(0, 88, 190, 0.25)',
          }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 800, lineHeight: 1 }}>
            SK
          </Typography>
        </Box>
        <Box sx={{ flexGrow: 1 }}>
          <Typography
            variant="subtitle1"
            sx={{ fontWeight: 800, color: '#0058be', lineHeight: 1.1, fontSize: 16 }}
          >
            SmartLabKit
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: '#808999', fontSize: 10, fontWeight: 700, letterSpacing: 0.5 }}
          >
            QUẢN LÝ PHÒNG LAB
          </Typography>
        </Box>

        {/* Nút đóng sidebar khi mở ở màn hình nhỏ / chia đôi cửa sổ */}
        <IconButton
          size="small"
          onClick={() => setMobileOpen(false)}
          sx={{
            display: { md: 'none' },
            color: '#808999',
            '&:hover': { bgcolor: '#f4f6fa', color: '#131b2e' },
          }}
          aria-label="Đóng menu"
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Main Navigation List - Có thanh cuộn mượt mà khi menu dài */}
      <List
        sx={{
          px: 1.5,
          py: 1.5,
          flexGrow: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          scrollbarWidth: 'thin',
          scrollbarColor: '#cbd5e1 transparent',
          '&::-webkit-scrollbar': {
            width: '5px',
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: '#dcdfe6',
            borderRadius: '4px',
            '&:hover': {
              backgroundColor: '#b4b9c8',
            },
          },
        }}
      >
        {visibleNavItems.map((item) => {
          const isCatalogRoute =
            location.pathname.startsWith('/components') ||
            location.pathname === '/class-setup/admin/components/catalog'
          const isComponentsRoute =
            location.pathname.startsWith('/class-setup/admin/components') &&
            !location.pathname.includes('/catalog')
          const isStockReceiptsRoute =
            location.pathname.startsWith('/class-setup/admin/stock-receipts') ||
            location.pathname.startsWith('/class-setup/admin/stock-inwards')
          const isCategoriesRoute = location.pathname.startsWith('/class-setup/admin/categories')
          const isLabRoomsRoute = location.pathname.startsWith('/class-setup/admin/lab-rooms')
          const isCabinetsRoute = location.pathname.startsWith('/class-setup/admin/cabinets')
          const isUsersRoute = location.pathname.startsWith('/admin/users')
          const isRolesRoute = location.pathname.startsWith('/admin/roles')
          const isSystemSettingsRoute = location.pathname.startsWith('/admin/system-settings')
          const isSemestersRoute = location.pathname === '/class-setup/admin/semesters'
          const isCoursesRoute = location.pathname === '/class-setup/admin/courses'
          const isRosterRoute = location.pathname === '/class-setup/admin/roster'
          const isStudentGroupsRoute = location.pathname === '/class-setup/student/groups'
          const isStudentProjectRoute = location.pathname.startsWith('/class-setup/student/project')
          const isLecturerClassesRoute = location.pathname.startsWith('/class-setup/lecturer/classes')
          const isBorrowRoute = location.pathname.startsWith('/borrow') || activeMenuKey === 'borrow' || activeMenuKey === 'handover'

          const isActive =
            item.path === '/admin/users'
              ? isUsersRoute
              : item.path === '/admin/roles'
              ? isRolesRoute
              : item.path === '/admin/system-settings'
              ? isSystemSettingsRoute
              : item.path === '/components/catalog'
              ? isCatalogRoute
              : item.path === '/class-setup/admin/components'
              ? isComponentsRoute
              : item.path === '/class-setup/admin/cabinets' || item.path === '/class-setup/admin/lab-rooms'
              ? isCategoriesRoute || isLabRoomsRoute || isCabinetsRoute
              : item.path === '/class-setup/admin/stock-receipts'
              ? isStockReceiptsRoute
              : item.path === '/class-setup/admin/semesters'
              ? isSemestersRoute
              : item.path === '/class-setup/admin/courses'
              ? isCoursesRoute
              : item.path === '/class-setup/admin/roster'
              ? isRosterRoute
              : item.path === '/class-setup/student/groups'
              ? isStudentGroupsRoute
              : item.path === '/class-setup/student/project'
              ? isStudentProjectRoute
              : item.path === '/class-setup/lecturer/classes'
              ? isLecturerClassesRoute
              : item.path === '/borrow/my-requests'
              ? isBorrowRoute
              : item.path === '/class-setup/admin/inventory-audits'
              ? location.pathname.startsWith(item.path)
              : location.pathname === item.path

          return (
            <ListItem key={item.label} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => {
                  if (item.path !== '#') {
                    if (shouldBlockLeave(item.path)) {
                      setMobileOpen(false)
                      return
                    }
                    navigate(item.path)
                    setMobileOpen(false)
                  }
                }}
                sx={{
                  borderRadius: 1.5,
                  py: 1,
                  px: 1.5,
                  bgcolor: isActive ? '#eaedff' : 'transparent',
                  color: isActive ? '#0058be' : '#424754',
                  '&:hover': {
                    bgcolor: isActive ? '#eaedff' : '#f4f6fa',
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 32,
                    color: isActive ? '#0058be' : '#6b7280',
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  slotProps={{
                    primary: {
                      fontSize: 13,
                      fontWeight: isActive ? 700 : 500,
                    },
                  }}
                />
              </ListItemButton>
            </ListItem>
          )
        })}
      </List>

      {/* Current Logged In Account Info Card on Sidebar Bottom */}
      <Box sx={{ p: 2, borderTop: '1px solid #f0f2f5', bgcolor: '#fafbff', flexShrink: 0 }}>
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            mb: 1,
            color: '#6b7280',
            fontWeight: 700,
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          Tài khoản đăng nhập
        </Typography>

        <Paper
          elevation={0}
          onClick={() => navigate('/profile')}
          sx={{
            p: 1.2,
            display: 'flex',
            alignItems: 'center',
            gap: 1.2,
            bgcolor: '#ffffff',
            border: '1px solid #dcdfe6',
            borderRadius: 1.5,
            cursor: 'pointer',
            transition: 'border-color 0.2s',
            '&:hover': { borderColor: '#0058be' },
          }}
        >
          <Avatar
            src={currentUser.avatarUrl}
            sx={{
              width: 32,
              height: 32,
              bgcolor: currentUser.avatarBg || '#0058be',
              fontSize: 12,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
          </Avatar>
          <Box sx={{ overflow: 'hidden' }}>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 700,
                fontSize: 12,
                color: '#131b2e',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {currentUser.name}
            </Typography>
            <Chip
              label={currentUser.roleLabel}
              size="small"
              sx={{
                height: 16,
                fontSize: 9,
                fontWeight: 800,
                bgcolor: `${currentUser.badgeColor || '#0058be'}15`,
                color: currentUser.badgeColor || '#0058be',
                borderRadius: 0.8,
              }}
            />
          </Box>
        </Paper>

        <Button
          fullWidth
          size="small"
          startIcon={<LogoutIcon fontSize="small" />}
          onClick={handleLogout}
          sx={{
            mt: 1.5,
            textTransform: 'none',
            fontSize: 11,
            fontWeight: 700,
            color: '#ef4444',
            bgcolor: '#fef2f2',
            borderRadius: 1.2,
            '&:hover': { bgcolor: '#fee2e2' },
          }}
        >
          Đăng xuất tài khoản
        </Button>
      </Box>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#f8fafc' }}>
      {/* Mobile Drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: 260,
            overflow: 'hidden',
            boxShadow: '4px 0 24px rgba(0, 0, 0, 0.12)',
          },
        }}
      >
        {drawerContent}
      </Drawer>

      {/* Desktop Permanent Sidebar */}
      <Box
        component="nav"
        sx={{
          width: { md: 240 },
          flexShrink: { md: 0 },
          display: { xs: 'none', md: 'block' },
        }}
      >
        <Box sx={{ position: 'fixed', top: 0, bottom: 0, width: 240, overflow: 'hidden' }}>
          {drawerContent}
        </Box>
      </Box>

      {/* Main Content Area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - 240px)` },
          minWidth: 0,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
        }}
      >
        {/* Topbar Header */}
        <Box
          component="header"
          sx={{
            height: 64,
            px: { xs: 2, sm: 3 },
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            bgcolor: '#ffffff',
            borderBottom: '1px solid #e4e6ef',
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, flex: { xs: 1, md: 'initial' } }}>
            <IconButton
              color="inherit"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ display: { md: 'none' } }}
            >
              <MenuIcon />
            </IconButton>

            {headerTitle && (
              <Box sx={{ minWidth: 0 }}>
                <Typography noWrap sx={{ color: '#182238', fontWeight: 800, fontSize: 16, lineHeight: 1.3 }}>
                  {headerTitle}
                </Typography>
                {headerSubtitle && (
                  <Typography noWrap sx={{ color: '#697386', fontSize: 10, lineHeight: 1.3 }}>
                    {headerSubtitle}
                  </Typography>
                )}
              </Box>
            )}
          </Box>

          {/* Right Controls */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0, pl: 1 }}>
            {/* Notifications: số chưa đọc realtime + danh sách thông báo */}
            <NotificationMenu />

            {currentRole && (
              <Chip
                label={currentRole}
                size="small"
                sx={{
                  display: { xs: 'none', sm: 'inline-flex' },
                  bgcolor: '#eff6ff',
                  color: '#0058be',
                  fontWeight: 700,
                  fontSize: 12,
                  borderRadius: 1.5,
                }}
              />
            )}

            <Divider orientation="vertical" flexItem sx={{ my: 1.5 }} />

            {/* User Avatar & Info */}
            <Box
              onClick={handleUserMenuOpen}
              sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}
            >
              <Avatar
                src={currentUser.avatarUrl}
                sx={{
                  width: 32,
                  height: 32,
                  bgcolor: currentUser.avatarBg || '#0058be',
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
              </Avatar>
              <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                <Typography variant="body2" sx={{ fontWeight: 700, fontSize: 12, lineHeight: 1.2 }}>
                  {currentUser.name}
                </Typography>
                <Typography variant="caption" sx={{ color: '#81899a', fontSize: 10, fontWeight: 600 }}>
                  {currentUser.roleLabel}
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>

        {/* User Account Popover Menu */}
        <Menu
          anchorEl={userMenuAnchor}
          open={Boolean(userMenuAnchor)}
          onClose={handleUserMenuClose}
          slotProps={{
            paper: {
              elevation: 3,
              sx: { borderRadius: 2, minWidth: 240, mt: 1, p: 0.5 },
            },
          }}
        >
          <Box sx={{ px: 2, py: 1.5, bgcolor: '#f8fafc', borderRadius: 1, mb: 0.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#131b2e', fontSize: 13 }}>
              {currentUser.name}
            </Typography>
            <Typography variant="caption" sx={{ color: '#6b7280', fontSize: 11, display: 'block' }}>
              {currentUser.email}
            </Typography>
            <Chip
              label={currentUser.roleLabel}
              size="small"
              sx={{
                mt: 0.5,
                height: 18,
                fontSize: 9,
                fontWeight: 800,
                bgcolor: `${currentUser.badgeColor || '#0058be'}20`,
                color: currentUser.badgeColor || '#0058be',
              }}
            />
          </Box>

          <MenuItem onClick={handleGoProfile} sx={{ borderRadius: 1, fontSize: 13, fontWeight: 600 }}>
            <AccountCircleIcon fontSize="small" sx={{ mr: 1.5, color: '#0058be' }} />
            Hồ sơ cá nhân & Bảo mật
          </MenuItem>

          <Divider sx={{ my: 0.5 }} />

          <MenuItem onClick={handleLogout} sx={{ color: '#ef4444', borderRadius: 1, fontWeight: 700, fontSize: 13 }}>
            <LogoutIcon fontSize="small" sx={{ mr: 1.5 }} />
            Đăng xuất tài khoản
          </MenuItem>
        </Menu>

        {/* Page Content */}
        <Box
          sx={{
            px: { xs: 2, sm: 3, md: 3 },
            py: { xs: 2, sm: 3, md: 4 },
            flexGrow: 1,
            width: '100%',
            minWidth: 0,
            boxSizing: 'border-box',
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  )
}
