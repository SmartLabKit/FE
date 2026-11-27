import { Badge, Box, IconButton, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Tooltip, Typography } from '@mui/material'
import {
  Close as CloseIcon,
  KeyboardDoubleArrowLeft as CollapseIcon,
  ViewSidebarOutlined as OpenSidebarIcon,
} from '@mui/icons-material'
import type { NavCounts, NavItem } from './types'
import { SHELL_COLORS, SIDEBAR_WIDTH_COLLAPSED, SIDEBAR_WIDTH_EXPANDED, TOOLTIP_Z_INDEX } from './types'

interface SidebarProps {
  items: NavItem[]
  counts: NavCounts
  /** true: chỉ icon (chỉ áp dụng desktop). Drawer mobile luôn mở rộng. */
  collapsed: boolean
  variant: 'desktop' | 'mobile'
  isActive: (item: NavItem) => boolean
  onNavigate: (item: NavItem) => void
  onToggleCollapsed: () => void
  /** Chỉ dùng cho mobile: đóng drawer. */
  onCloseMobile?: () => void
}

/** Pill tooltip nổi, z-index cao để không bị vùng nội dung/overflow che. */
const pillTooltipSlotProps = {
  popper: { sx: { zIndex: TOOLTIP_Z_INDEX } },
  tooltip: {
    sx: {
      bgcolor: SHELL_COLORS.primary,
      color: SHELL_COLORS.white,
      fontSize: 12,
      fontWeight: 600,
      px: 1.5,
      py: 0.75,
      borderRadius: 999,
      boxShadow: '0 4px 14px rgba(0, 88, 190, 0.3)',
    },
  },
}

const navTooltipSlotProps = {
  popper: { sx: { zIndex: TOOLTIP_Z_INDEX } },
  tooltip: {
    sx: { bgcolor: SHELL_COLORS.text, fontSize: 12, fontWeight: 500, borderRadius: 1.5 },
  },
}

/** Logo "SK" dùng chung cho cả hai trạng thái. */
function BrandLogo() {
  return (
    <Box
      sx={{
        width: 34,
        height: 34,
        bgcolor: SHELL_COLORS.primary,
        borderRadius: 1.2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: SHELL_COLORS.white,
        boxShadow: '0 2px 6px rgba(0, 88, 190, 0.25)',
        flexShrink: 0,
      }}
    >
      <Typography variant="subtitle2" sx={{ fontWeight: 800, lineHeight: 1 }}>
        SK
      </Typography>
    </Box>
  )
}

const focusRing = { outline: `2px solid ${SHELL_COLORS.focusRing}`, outlineOffset: 2 }

export default function Sidebar({
  items,
  counts,
  collapsed,
  variant,
  isActive,
  onNavigate,
  onToggleCollapsed,
  onCloseMobile,
}: SidebarProps) {
  // Mobile luôn hiển thị dạng mở rộng
  const isCollapsed = variant === 'desktop' && collapsed
  const width = isCollapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width,
        boxSizing: 'border-box',
        // Thu gọn: nền trùng nền trang, không viền để nội dung liền mạch
        bgcolor: isCollapsed ? SHELL_COLORS.pageBg : SHELL_COLORS.white,
        borderRight: isCollapsed ? '1px solid transparent' : `1px solid ${SHELL_COLORS.border}`,
        transition: 'width 0.2s ease, background-color 0.2s ease',
        overflow: 'hidden',
      }}
    >
      {/* Đầu thanh: chiều cao cố định nên hover/đổi trạng thái không làm giật layout */}
      <Box
        sx={{
          height: 64,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: isCollapsed ? 'center' : 'space-between',
          px: isCollapsed ? 0 : 2,
        }}
      >
        {isCollapsed ? (
          <Tooltip title="Mở thanh bên" placement="right" arrow slotProps={pillTooltipSlotProps}>
            <IconButton
              onClick={onToggleCollapsed}
              aria-label="Mở thanh bên"
              sx={{
                width: 44,
                height: 44,
                position: 'relative',
                borderRadius: 2,
                '&:hover': { bgcolor: SHELL_COLORS.primarySoft },
                '&.Mui-focusVisible': focusRing,
                // Hover/focus: ẩn logo, hiện icon mở thanh bên (xếp chồng, không đổi kích thước)
                '& .sk-logo, & .sk-open': { position: 'absolute', transition: 'opacity 0.15s ease' },
                '& .sk-open': { opacity: 0, color: SHELL_COLORS.primary },
                '&:hover .sk-logo, &.Mui-focusVisible .sk-logo': { opacity: 0 },
                '&:hover .sk-open, &.Mui-focusVisible .sk-open': { opacity: 1 },
              }}
            >
              <Box className="sk-logo" sx={{ display: 'flex' }}>
                <BrandLogo />
              </Box>
              <OpenSidebarIcon className="sk-open" />
            </IconButton>
          </Tooltip>
        ) : (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
              <BrandLogo />
              <Box sx={{ minWidth: 0 }}>
                <Typography noWrap sx={{ fontWeight: 800, color: SHELL_COLORS.primary, lineHeight: 1.1, fontSize: 16 }}>
                  SmartLabKit
                </Typography>
                <Typography noWrap sx={{ color: '#808999', fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}>
                  QUẢN LÝ PHÒNG LAB
                </Typography>
              </Box>
            </Box>

            {variant === 'desktop' ? (
              <Tooltip title="Thu gọn thanh bên" arrow slotProps={navTooltipSlotProps}>
                <IconButton
                  size="small"
                  onClick={onToggleCollapsed}
                  aria-label="Thu gọn thanh bên"
                  sx={{
                    color: SHELL_COLORS.textMuted,
                    '&:hover': { bgcolor: SHELL_COLORS.primarySoft, color: SHELL_COLORS.primary },
                    '&.Mui-focusVisible': focusRing,
                  }}
                >
                  <CollapseIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            ) : (
              <IconButton size="small" onClick={onCloseMobile} aria-label="Đóng menu" sx={{ color: SHELL_COLORS.textMuted }}>
                <CloseIcon fontSize="small" />
              </IconButton>
            )}
          </>
        )}
      </Box>

      {/* Danh sách điều hướng */}
      <List
        component="nav"
        sx={{
          px: isCollapsed ? 1 : 1.5,
          py: 1,
          flexGrow: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          scrollbarWidth: 'thin',
          scrollbarColor: '#cbd5e1 transparent',
        }}
      >
        {items.map((item) => {
          const active = isActive(item)
          const count = item.countKey ? counts[item.countKey] : 0

          const button = (
            <ListItemButton
              onClick={() => onNavigate(item)}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
              sx={{
                borderRadius: isCollapsed ? 2 : 1.5,
                py: 1,
                px: isCollapsed ? 0 : 1.5,
                minHeight: 44,
                justifyContent: isCollapsed ? 'center' : 'flex-start',
                bgcolor: active ? SHELL_COLORS.primarySoft : 'transparent',
                color: active ? SHELL_COLORS.primary : SHELL_COLORS.text,
                '&:hover': { bgcolor: active ? SHELL_COLORS.primarySoft : SHELL_COLORS.hoverBg, color: SHELL_COLORS.primary },
                '&.Mui-focusVisible': { bgcolor: SHELL_COLORS.hoverBg, ...focusRing },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: isCollapsed ? 0 : 36,
                  justifyContent: 'center',
                  color: active ? SHELL_COLORS.primary : SHELL_COLORS.textMuted,
                }}
              >
                <Badge
                  color="error"
                  badgeContent={count}
                  max={99}
                  sx={{ '& .MuiBadge-badge': { fontSize: 10, height: 16, minWidth: 16 } }}
                >
                  {item.icon}
                </Badge>
              </ListItemIcon>
              {!isCollapsed && (
                <ListItemText
                  primary={item.label}
                  slotProps={{ primary: { fontSize: 13, fontWeight: active ? 700 : 500, noWrap: true } }}
                />
              )}
            </ListItemButton>
          )

          return (
            <ListItem key={`${item.path}-${item.label}`} disablePadding sx={{ mb: 0.5 }}>
              {isCollapsed ? (
                <Tooltip title={item.label} placement="right" arrow slotProps={navTooltipSlotProps}>
                  {button}
                </Tooltip>
              ) : (
                button
              )}
            </ListItem>
          )
        })}
      </List>
    </Box>
  )
}
