import { useState } from 'react'
import {
  Avatar,
  Badge,
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  TextField,
  Typography,
} from '@mui/material'
import {
  Dashboard as DashboardIcon,
  Category as CategoryIcon,
  CompareArrows as BorrowReturnIcon,
  QrCodeScanner as QrCodeIcon,
  Assessment as ReportsIcon,
  Settings as SettingsIcon,
  Search as SearchIcon,
  NotificationsOutlined as NotificationsIcon,
  Menu as MenuIcon,
  Logout as LogoutIcon,
} from '@mui/icons-material'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth, DEMO_ACCOUNTS } from '../../context/AuthContext'

/**
 * PortalLayout: Khung giao diện dùng chung cho hệ thống SmartLabKit (LabStock Portal Core V3.1)
 * Hiển thị chuẩn vai trò của tài khoản đang đăng nhập, không cho phép tự ý chuyển đổi vai trò.
 */
export default function PortalLayout({ children, headerTitle, headerSubtitle }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [mobileOpen, setMobileOpen] = useState(false)
  const [userMenuAnchor, setUserMenuAnchor] = useState(null)

  // Thông tin tài khoản hiện tại
  const currentUser = user || DEMO_ACCOUNTS.ADMIN

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen)
  }

  const handleUserMenuOpen = (e) => {
    setUserMenuAnchor(e.currentTarget)
  }

  const handleUserMenuClose = () => {
    setUserMenuAnchor(null)
  }

  // Đăng xuất tài khoản
  const handleLogout = () => {
    handleUserMenuClose()
    logout()
    navigate('/login')
  }

  // Danh sách navigation ở menu bên trái
  const navItems = [
    { label: 'Dashboard', icon: <DashboardIcon fontSize="small" />, path: '/class-setup' },
    { label: 'Components', icon: <CategoryIcon fontSize="small" />, path: '/class-setup/admin/components' },
    { label: 'Borrow / Return', icon: <BorrowReturnIcon fontSize="small" />, path: '#' },
    { label: 'QR Codes', icon: <QrCodeIcon fontSize="small" />, path: '#' },
    { label: 'Reports', icon: <ReportsIcon fontSize="small" />, path: '#' },
    { label: 'Settings', icon: <SettingsIcon fontSize="small" />, path: '#' },
  ]

  const drawerContent = (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        bgcolor: '#ffffff',
        borderRight: '1px solid #e4e6ef',
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
            LS
          </Typography>
        </Box>
        <Box>
          <Typography
            variant="subtitle1"
            sx={{ fontWeight: 800, color: '#0058be', lineHeight: 1.1, fontSize: 16 }}
          >
            LabStock
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: '#808999', fontSize: 10, fontWeight: 700, letterSpacing: 0.5 }}
          >
            PORTAL CORE V3.1
          </Typography>
        </Box>
      </Box>

      {/* Main Navigation List */}
      <List sx={{ px: 1.5, py: 2, flexGrow: 1 }}>
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || (
            item.path === '/class-setup' &&
            location.pathname.startsWith('/class-setup') &&
            location.pathname !== '/class-setup/admin/components'
          )

          return (
            <ListItem key={item.label} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => {
                  if (item.path !== '#') {
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
                  primaryTypographyProps={{
                    fontSize: 13,
                    fontWeight: isActive ? 700 : 500,
                  }}
                />
              </ListItemButton>
            </ListItem>
          )
        })}
      </List>

      {/* Current Logged In Account Info Card on Sidebar Bottom */}
      <Box sx={{ p: 2, borderTop: '1px solid #f0f2f5', bgcolor: '#fafbff' }}>
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
          sx={{
            p: 1.2,
            display: 'flex',
            alignItems: 'center',
            gap: 1.2,
            bgcolor: '#ffffff',
            border: '1px solid #dcdfe6',
            borderRadius: 1.5,
          }}
        >
          <Avatar
            sx={{
              width: 32,
              height: 32,
              bgcolor: currentUser.avatarBg || '#0058be',
              fontSize: 12,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {currentUser.name ? currentUser.name.charAt(0) : 'U'}
          </Avatar>
          <Box sx={{ overflow: 'hidden' }}>
            <Typography variant="body2" sx={{ fontWeight: 700, fontSize: 12, color: '#131b2e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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

  const searchField = (
    <TextField
      placeholder={headerTitle ? 'Search components, codes...' : 'Search requests, components...'}
      size="small"
      sx={{
        width: { xs: 180, sm: 280, md: headerTitle ? 280 : 340 },
        '& .MuiOutlinedInput-root': {
          height: 36,
          borderRadius: 1.5,
          bgcolor: '#f4f6fa',
          fontSize: 12,
          '& fieldset': { borderColor: 'transparent' },
          '&:hover fieldset': { borderColor: '#c2c6d6' },
          '&.Mui-focused fieldset': { borderColor: '#0058be' },
        },
      }}
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon sx={{ color: '#81899a', fontSize: 18 }} />
            </InputAdornment>
          ),
        },
      }}
    />
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
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: 240 },
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
        <Box sx={{ position: 'fixed', top: 0, bottom: 0, width: 240 }}>
          {drawerContent}
        </Box>
      </Box>

      {/* Main Content Area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - 240px)` },
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton
              color="inherit"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ display: { md: 'none' } }}
            >
              <MenuIcon />
            </IconButton>

            {headerTitle ? (
              <Box>
                <Typography sx={{ color: '#182238', fontWeight: 800, fontSize: 16, lineHeight: 1.3 }}>
                  {headerTitle}
                </Typography>
                {headerSubtitle && (
                  <Typography sx={{ color: '#697386', fontSize: 10, lineHeight: 1.3 }}>
                    {headerSubtitle}
                  </Typography>
                )}
              </Box>
            ) : searchField}
          </Box>

          {/* Right Controls */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {headerTitle && searchField}
            {/* Notifications */}
            <IconButton size="small" sx={{ color: '#556070' }}>
              <Badge badgeContent={3} color="primary" slotProps={{ badge: { style: { fontSize: 10, height: 16, minWidth: 16 } } }}>
                <NotificationsIcon fontSize="small" />
              </Badge>
            </IconButton>

            <Divider orientation="vertical" flexItem sx={{ my: 1.5 }} />

            {/* User Avatar & Info */}
            <Box
              onClick={handleUserMenuOpen}
              sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}
            >
              <Avatar
                sx={{
                  width: 32,
                  height: 32,
                  bgcolor: currentUser.avatarBg || '#0058be',
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {currentUser.name ? currentUser.name.charAt(0) : 'U'}
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
          PaperProps={{
            elevation: 3,
            sx: { borderRadius: 2, minWidth: 240, mt: 1, p: 0.5 },
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

          <Divider sx={{ my: 0.5 }} />

          <MenuItem onClick={handleLogout} sx={{ color: '#ef4444', borderRadius: 1, fontWeight: 700, fontSize: 13 }}>
            <LogoutIcon fontSize="small" sx={{ mr: 1.5 }} />
            Đăng xuất tài khoản
          </MenuItem>
        </Menu>

        {/* Page Content */}
        <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, flexGrow: 1 }}>{children}</Box>
      </Box>
    </Box>
  )
}
