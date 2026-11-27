import { useState } from 'react'
import { Avatar, Box, Chip, Divider, IconButton, Menu, MenuItem, Typography } from '@mui/material'
import {
  AccountCircle as AccountCircleIcon,
  KeyboardArrowDown as ArrowDownIcon,
  Logout as LogoutIcon,
  Menu as MenuIcon,
} from '@mui/icons-material'
import NotificationMenu from '../NotificationMenu'
import type { ShellUser } from './types'
import { SHELL_COLORS, TOPBAR_HEIGHT } from './types'

interface TopbarProps {
  user: ShellUser
  currentRole?: string
  onOpenMobileMenu: () => void
  onGoProfile: () => void
  onLogout: () => void
}

/** Style chung cho các mục trong menu tài khoản. */
const menuItemSx = { minHeight: 40, px: 1.5, gap: 1.5, borderRadius: '8px', fontSize: 14, fontWeight: 500 } as const

/** Topbar mỏng: không hiển thị tiêu đề trang; chỉ có thông báo và menu tài khoản. */
export default function Topbar({ user, currentRole, onOpenMobileMenu, onGoProfile, onLogout }: TopbarProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const closeMenu = () => setAnchor(null)
  const initial = user.name ? user.name.charAt(0).toUpperCase() : 'U'
  const badgeColor = user.badgeColor || SHELL_COLORS.primary

  return (
    <Box
      component="header"
      sx={{
        height: TOPBAR_HEIGHT,
        px: { xs: 1.5, sm: 3 },
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        bgcolor: SHELL_COLORS.white,
        borderBottom: `1px solid ${SHELL_COLORS.border}`,
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
    >
      {/* Nút mở menu chỉ hiện ở màn hình nhỏ */}
      <IconButton edge="start" onClick={onOpenMobileMenu} aria-label="Mở menu" sx={{ display: { md: 'none' }, color: SHELL_COLORS.text }}>
        <MenuIcon />
      </IconButton>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, ml: 'auto' }}>
        <NotificationMenu />

        {currentRole && (
          <Chip
            label={currentRole}
            size="small"
            sx={{
              display: { xs: 'none', sm: 'inline-flex' },
              bgcolor: SHELL_COLORS.primarySoft,
              color: SHELL_COLORS.primary,
              fontWeight: 700,
              fontSize: 12,
              borderRadius: 1.5,
            }}
          />
        )}

        <Divider orientation="vertical" flexItem sx={{ my: 1.5 }} />

        {/* Cụm tài khoản: bấm để xổ menu */}
        <Box
          component="button"
          type="button"
          onClick={(e) => setAnchor(e.currentTarget)}
          aria-haspopup="menu"
          aria-expanded={Boolean(anchor)}
          aria-label="Menu tài khoản"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            cursor: 'pointer',
            border: 0,
            bgcolor: 'transparent',
            font: 'inherit',
            textAlign: 'left',
            borderRadius: 2,
            px: 0.75,
            py: 0.5,
            '&:hover': { bgcolor: SHELL_COLORS.hoverBg },
            '&:focus-visible': { outline: `2px solid ${SHELL_COLORS.focusRing}` },
          }}
        >
          <Avatar
            src={user.avatarUrl}
            sx={{ width: 30, height: 30, bgcolor: user.avatarBg || SHELL_COLORS.primary, fontSize: 13, fontWeight: 700 }}
          >
            {initial}
          </Avatar>
          <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
            <Typography variant="body2" sx={{ fontWeight: 700, fontSize: 12, lineHeight: 1.2, color: SHELL_COLORS.text }}>
              {user.name}
            </Typography>
            <Typography variant="caption" sx={{ color: '#81899a', fontSize: 11, fontWeight: 600 }}>
              {user.roleLabel}
            </Typography>
          </Box>
          <ArrowDownIcon fontSize="small" sx={{ color: SHELL_COLORS.textMuted }} />
        </Box>
      </Box>

      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={closeMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            elevation: 0,
            sx: {
              minWidth: 240,
              mt: 1,
              borderRadius: '12px',
              border: `1px solid ${SHELL_COLORS.border}`,
              boxShadow: '0 10px 30px rgba(15, 23, 42, 0.12)',
            },
          },
          list: { sx: { p: 0 } },
        }}
      >
        {/* Header: avatar | tên + badge role cùng hàng; email bên dưới */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.75 }}>
          <Avatar
            src={user.avatarUrl}
            sx={{ width: 40, height: 40, bgcolor: user.avatarBg || SHELL_COLORS.primary, fontSize: 16, fontWeight: 700 }}
          >
            {initial}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Typography noWrap sx={{ fontWeight: 700, color: '#0F172A', fontSize: 14, lineHeight: 1.3 }}>
                {user.name}
              </Typography>
              {user.roleLabel && (
                <Chip
                  label={user.roleLabel}
                  size="small"
                  sx={{
                    height: 20,
                    flexShrink: 0,
                    fontSize: 11,
                    fontWeight: 700,
                    bgcolor: `${badgeColor}1A`,
                    color: badgeColor,
                    '& .MuiChip-label': { px: 0.9 },
                  }}
                />
              )}
            </Box>
            <Typography noWrap sx={{ color: '#94A3B8', fontSize: 12, lineHeight: 1.4 }}>
              {user.email}
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ m: 0, borderColor: SHELL_COLORS.border }} />

        {/* Hai mục dùng chung kích thước/padding/hover để đồng đều */}
        <Box sx={{ p: 0.75 }}>
          <MenuItem
            onClick={() => {
              closeMenu()
              onGoProfile()
            }}
            sx={{ ...menuItemSx, color: SHELL_COLORS.navText, '&:hover': { bgcolor: SHELL_COLORS.hoverBg } }}
          >
            <AccountCircleIcon sx={{ fontSize: 20, color: SHELL_COLORS.primary }} />
            Hồ sơ cá nhân
          </MenuItem>
          <MenuItem
            onClick={() => {
              closeMenu()
              onLogout()
            }}
            sx={{ ...menuItemSx, color: '#DC2626', '&:hover': { bgcolor: '#FEF2F2' } }}
          >
            <LogoutIcon sx={{ fontSize: 20 }} />
            Đăng xuất
          </MenuItem>
        </Box>
      </Menu>
    </Box>
  )
}
