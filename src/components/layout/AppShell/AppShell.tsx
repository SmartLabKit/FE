import { useState } from 'react'
import { Box, Drawer } from '@mui/material'
import { useLocation, useNavigate } from 'react-router-dom'
import { DEMO_ACCOUNTS, useAuth } from '../../../context/AuthContext'
import { useLabNewOrderCount } from '../../../hooks/useLabNewOrderCount'
import ForcePasswordChangeDialog from '../../common/ForcePasswordChangeDialog'
import { shouldBlockLeave } from '../../../utils/leaveGuard'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { NAV_ITEMS, filterNavItems, getUserRoles, isNavActive } from './navConfig'
import { useSidebarCollapsed } from './useSidebarCollapsed'
import type { AppShellProps, NavCounts, NavItem, ShellUser } from './types'
import { SHELL_COLORS, SIDEBAR_WIDTH_COLLAPSED, SIDEBAR_WIDTH_EXPANDED } from './types'

/**
 * AppShell: khung chung (Sidebar + Topbar + vùng nội dung).
 * Menu lọc theo roles/permissions của user từ AuthContext (/api/auth/me).
 */
export default function AppShell({ children, currentRole, currentUser: propUser, activeMenuKey }: AppShellProps) {
  const { user, logout, hasPermission } = useAuth() as {
    user?: (ShellUser & { mustChangePassword?: boolean }) | null
    logout: () => Promise<void>
    hasPermission: (code: string) => boolean
  }
  const navigate = useNavigate()
  const location = useLocation()
  const { collapsed, setCollapsed } = useSidebarCollapsed()
  const [mobileOpen, setMobileOpen] = useState(false)

  // Hỗ trợ override user từ props để demo đúng vai trò trên UI
  const currentUser: ShellUser = propUser || user || (DEMO_ACCOUNTS.ADMIN as ShellUser)

  const labNewOrders = useLabNewOrderCount(getUserRoles(currentUser).includes('LABSTAFF')) as number
  const counts: NavCounts = { labNewOrders }
  const items = filterNavItems(NAV_ITEMS, currentUser, hasPermission)

  // Điều hướng, tôn trọng guard rời trang (form chưa lưu)
  const handleNavigate = (item: NavItem) => {
    setMobileOpen(false)
    if (item.path === '#' || shouldBlockLeave(item.path)) return
    navigate(item.path)
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const isActive = (item: NavItem) => isNavActive(item, location.pathname, activeMenuKey)
  // Trang chủ: mục điều hướng đầu tiên mà user được phép thấy (mặc định /dashboard)
  const homePath = items[0]?.path && items[0].path !== '#' ? items[0].path : '/dashboard'
  const handleGoHome = () => {
    setMobileOpen(false)
    if (shouldBlockLeave(homePath)) return
    navigate(homePath)
  }
  const sidebarWidth = collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: SHELL_COLORS.pageBg }}>
      {/* Mobile: drawer luôn mở rộng */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { width: SIDEBAR_WIDTH_EXPANDED, boxSizing: 'border-box', overflow: 'hidden' },
        }}
      >
        <Sidebar
          variant="mobile"
          collapsed={false}
          items={items}
          counts={counts}
          isActive={isActive}
          onNavigate={handleNavigate}
          onToggleCollapsed={() => setMobileOpen(false)}
          homePath={homePath}
          onGoHome={handleGoHome}
          onCloseMobile={() => setMobileOpen(false)}
        />
      </Drawer>

      {/* Desktop: sidebar cố định; wrapper giữ chỗ để nội dung co giãn theo */}
      <Box
        component="aside"
        sx={{
          width: sidebarWidth,
          flexShrink: 0,
          display: { xs: 'none', md: 'block' },
          transition: 'width 0.2s ease',
        }}
      >
        <Box sx={{ position: 'fixed', top: 0, bottom: 0, zIndex: 20 }}>
          <Sidebar
            variant="desktop"
            collapsed={collapsed}
            items={items}
            counts={counts}
            isActive={isActive}
            onNavigate={handleNavigate}
            onToggleCollapsed={() => setCollapsed(!collapsed)}
            homePath={homePath}
            onGoHome={handleGoHome}
          />
        </Box>
      </Box>

      <Box component="main" sx={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Topbar
          user={currentUser}
          currentRole={currentRole}
          onOpenMobileMenu={() => setMobileOpen(true)}
          onGoProfile={() => navigate('/profile')}
          onLogout={handleLogout}
        />
        <Box sx={{ bgcolor: SHELL_COLORS.pageBg, px: { xs: 2, sm: 3 }, py: { xs: 2, sm: 3, md: 4 }, flexGrow: 1, width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
          {children}
        </Box>
      </Box>

      {user?.mustChangePassword && <ForcePasswordChangeDialog />}
    </Box>
  )
}
