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
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
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
  SupervisorAccount as AdminIcon,
  School as LecturerIcon,
  Person as StudentIcon,
  SwapHoriz as SwitchRoleIcon,
  Check as CheckIcon,
} from '@mui/icons-material'
import { useNavigate, useLocation } from 'react-router-dom'

// Danh sách các vai trò (Actor) trong hệ thống Class Setup
export const ACTORS = {
  ADMIN: {
    id: 'ADMIN',
    name: 'Nguyễn Văn Minh',
    roleLabel: 'ADMIN',
    title: 'Quản trị hệ thống / Lab Staff',
    avatarBg: '#0058be',
    badgeColor: '#0058be',
    defaultRoute: '/class-setup/admin/semesters',
  },
  LECTURER: {
    id: 'LECTURER',
    name: 'TS. Nguyễn Văn Minh',
    roleLabel: 'LECTURER',
    title: 'Giảng viên phụ trách môn',
    avatarBg: '#0284c7',
    badgeColor: '#0284c7',
    defaultRoute: '/class-setup/lecturer/quotas',
  },
  STUDENT: {
    id: 'STUDENT',
    name: 'Lê Hoàng Nam',
    roleLabel: 'STUDENT',
    title: 'Sinh viên / Nhóm trưởng',
    avatarBg: '#059669',
    badgeColor: '#059669',
    defaultRoute: '/class-setup/student/groups',
  },
}

/**
 * PortalLayout: Khung giao diện dùng chung cho hệ thống SmartLabKit (LabStock Portal Core V3.1)
 * Bao gồm Sidebar bên trái, Topbar chứa thanh tìm kiếm & chuyển vai trò Actor, và vùng nội dung chính.
 */
export default function PortalLayout({ children, activeActor = 'ADMIN', onActorChange }) {
  const navigate = useNavigate()
  const location = useLocation()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))

  const [mobileOpen, setMobileOpen] = useState(false)
  const [roleMenuAnchor, setRoleMenuAnchor] = useState(null)

  const currentActor = ACTORS[activeActor] || ACTORS.ADMIN

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen)
  }

  const handleRoleMenuOpen = (e) => {
    setRoleMenuAnchor(e.currentTarget)
  }

  const handleRoleMenuClose = () => {
    setRoleMenuAnchor(null)
  }

  const handleSelectActor = (actorId) => {
    handleRoleMenuClose()
    if (onActorChange) {
      onActorChange(actorId)
    } else {
      navigate(ACTORS[actorId].defaultRoute)
    }
  }

  // Danh sách navigation ở menu bên trái
  const navItems = [
    { label: 'Dashboard', icon: <DashboardIcon fontSize="small" />, path: '/class-setup' },
    { label: 'Components', icon: <CategoryIcon fontSize="small" />, path: '#' },
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
          const isActive = location.pathname === item.path || (item.path === '/class-setup' && location.pathname.startsWith('/class-setup'))

          return (
            <ListItem key={item.label} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => {
                  if (item.path !== '#') navigate(item.path)
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

      {/* Quick Actor Selector Bar on Sidebar */}
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
          Đang xem dưới vai trò (Actor)
        </Typography>

        <Paper
          elevation={0}
          onClick={handleRoleMenuOpen}
          sx={{
            p: 1.2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            bgcolor: '#ffffff',
            border: '1px solid #dcdfe6',
            borderRadius: 1.5,
            cursor: 'pointer',
            transition: 'all 0.2s',
            '&:hover': { borderColor: '#0058be', boxShadow: '0 2px 8px rgba(0,88,190,0.1)' },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
            <Avatar
              sx={{
                width: 32,
                height: 32,
                bgcolor: currentActor.avatarBg,
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {currentActor.name.charAt(0)}
            </Avatar>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 700, fontSize: 12, color: '#131b2e' }}>
                {currentActor.name}
              </Typography>
              <Chip
                label={currentActor.roleLabel}
                size="small"
                sx={{
                  height: 16,
                  fontSize: 9,
                  fontWeight: 800,
                  bgcolor: `${currentActor.badgeColor}15`,
                  color: currentActor.badgeColor,
                  borderRadius: 0.8,
                }}
              />
            </Box>
          </Box>
          <SwitchRoleIcon sx={{ fontSize: 16, color: '#81899a' }} />
        </Paper>
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

            {/* Quick search input */}
            <TextField
              placeholder="Search requests, components..."
              size="small"
              sx={{
                width: { xs: 180, sm: 280, md: 340 },
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
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: '#81899a', fontSize: 18 }} />
                  </InputAdornment>
                ),
              }}
            />
          </Box>

          {/* Right Controls */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {/* Quick Switch Actor Dropdown */}
            <Tooltip title="Chuyển đổi vai trò người dùng (Actor)">
              <Button
                onClick={handleRoleMenuOpen}
                variant="outlined"
                size="small"
                startIcon={
                  activeActor === 'ADMIN' ? (
                    <AdminIcon fontSize="small" />
                  ) : activeActor === 'LECTURER' ? (
                    <LecturerIcon fontSize="small" />
                  ) : (
                    <StudentIcon fontSize="small" />
                  )
                }
                endIcon={<SwitchRoleIcon fontSize="small" />}
                sx={{
                  height: 36,
                  textTransform: 'none',
                  borderRadius: 1.5,
                  fontSize: 12,
                  fontWeight: 700,
                  borderColor: '#dcdfe6',
                  color: '#263247',
                  bgcolor: '#ffffff',
                  '&:hover': { borderColor: '#0058be', bgcolor: '#f4f7ff' },
                }}
              >
                Vai trò: {currentActor.roleLabel}
              </Button>
            </Tooltip>

            {/* Notifications */}
            <IconButton size="small" sx={{ color: '#556070' }}>
              <Badge badgeContent={3} color="primary" slotProps={{ badge: { style: { fontSize: 10, height: 16, minWidth: 16 } } }}>
                <NotificationsIcon fontSize="small" />
              </Badge>
            </IconButton>

            <Divider orientation="vertical" flexItem sx={{ my: 1.5 }} />

            {/* Profile Info */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Avatar
                sx={{
                  width: 32,
                  height: 32,
                  bgcolor: currentActor.avatarBg,
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {currentActor.name.charAt(0)}
              </Avatar>
              <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                <Typography variant="body2" sx={{ fontWeight: 700, fontSize: 12, lineHeight: 1.2 }}>
                  {currentActor.name}
                </Typography>
                <Typography variant="caption" sx={{ color: '#81899a', fontSize: 10, fontWeight: 600 }}>
                  {currentActor.roleLabel}
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Actor Role Selection Menu */}
        <Menu
          anchorEl={roleMenuAnchor}
          open={Boolean(roleMenuAnchor)}
          onClose={handleRoleMenuClose}
          PaperProps={{
            elevation: 3,
            sx: { borderRadius: 2, minWidth: 260, mt: 1, p: 0.5 },
          }}
        >
          <Box sx={{ px: 2, py: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 800, color: '#81899a', textTransform: 'uppercase' }}>
              Chọn Vai Trò Người Dùng (Actor)
            </Typography>
          </Box>
          <Divider sx={{ my: 0.5 }} />

          {Object.values(ACTORS).map((actor) => {
            const isSelected = actor.id === activeActor
            return (
              <MenuItem
                key={actor.id}
                onClick={() => handleSelectActor(actor.id)}
                selected={isSelected}
                sx={{ borderRadius: 1, my: 0.5, py: 1 }}
              >
                <Avatar
                  sx={{
                    width: 30,
                    height: 30,
                    bgcolor: actor.avatarBg,
                    fontSize: 12,
                    fontWeight: 700,
                    mr: 1.5,
                  }}
                >
                  {actor.name.charAt(0)}
                </Avatar>
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, fontSize: 13 }}>
                    {actor.name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#6b7280', fontSize: 11, display: 'block' }}>
                    {actor.title}
                  </Typography>
                </Box>
                {isSelected && <CheckIcon sx={{ fontSize: 18, color: '#0058be' }} />}
              </MenuItem>
            )
          })}
        </Menu>

        {/* Page Content */}
        <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, flexGrow: 1 }}>{children}</Box>
      </Box>
    </Box>
  )
}
