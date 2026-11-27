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
        slotProps={{ paper: { elevation: 3, sx: { borderRadius: 2, minWidth: 240, mt: 1, p: 0.5 } } }}
      >
        <Box sx={{ px: 2, py: 1.5, bgcolor: SHELL_COLORS.pageBg, borderRadius: 1, mb: 0.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800, color: SHELL_COLORS.text, fontSize: 13 }}>
            {user.name}
          </Typography>
          <Typography variant="caption" sx={{ color: SHELL_COLORS.textMuted, fontSize: 11, display: 'block' }}>
            {user.email}
          </Typography>
          <Chip
            label={user.roleLabel}
            size="small"
            sx={{ mt: 0.5, height: 18, fontSize: 11, fontWeight: 800, bgcolor: `${badgeColor}20`, color: badgeColor }}
          />
        </Box>

        <MenuItem
          onClick={() => {
            closeMenu()
            onGoProfile()
          }}
          sx={{ borderRadius: 1, fontSize: 13, fontWeight: 600 }}
        >
          <AccountCircleIcon fontSize="small" sx={{ mr: 1.5, color: SHELL_COLORS.primary }} />
          Hồ sơ cá nhân
        </MenuItem>

        <Divider sx={{ my: 0.5 }} />

        <MenuItem
          onClick={() => {
            closeMenu()
            onLogout()
          }}
          sx={{ color: '#ef4444', borderRadius: 1, fontWeight: 700, fontSize: 13 }}
        >
          <LogoutIcon fontSize="small" sx={{ mr: 1.5 }} />
          Đăng xuất
        </MenuItem>
      </Menu>
    </Box>
  )
}
