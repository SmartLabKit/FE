import type { MouseEvent } from 'react'
import { Badge, Box, IconButton, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Tooltip } from '@mui/material'
import {
  Close as CloseIcon,
  KeyboardDoubleArrowLeft as CollapseIcon,
  ViewSidebarOutlined as OpenSidebarIcon,
} from '@mui/icons-material'
import BrandLogo from '../../common/BrandLogo'
import type { NavCounts, NavItem } from './types'
import { SHELL_COLORS, SIDEBAR_WIDTH_COLLAPSED, SIDEBAR_WIDTH_EXPANDED, TOOLTIP_Z_INDEX, TOPBAR_HEIGHT } from './types'

interface SidebarProps {
  items: NavItem[]
  counts: NavCounts
  /** true: chỉ icon (chỉ áp dụng desktop). Drawer mobile luôn mở rộng. */
  collapsed: boolean
  variant: 'desktop' | 'mobile'
  isActive: (item: NavItem) => boolean
  onNavigate: (item: NavItem) => void
  onToggleCollapsed: () => void
  /** Đường dẫn trang chủ (dùng cho href) và handler điều hướng về đó. */
  homePath: string
  onGoHome: () => void
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
      boxShadow: '0 4px 14px rgba(11, 79, 150, 0.3)',
    },
  },
}

const navTooltipSlotProps = {
  popper: { sx: { zIndex: TOOLTIP_Z_INDEX } },
  tooltip: {
    sx: { bgcolor: SHELL_COLORS.text, fontSize: 12, fontWeight: 500, borderRadius: 1.5 },
  },
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
  homePath,
  onGoHome,
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
        // Luôn trắng (cả thu gọn/mở rộng), ngăn cách vùng nội dung bằng viền mảnh
        bgcolor: SHELL_COLORS.white,
        borderRight: `1px solid ${SHELL_COLORS.border}`,
        transition: 'width 0.2s ease',
        overflow: 'hidden',
      }}
    >
      {/* Đầu thanh: chiều cao cố định nên hover/đổi trạng thái không làm giật layout */}
      <Box
        sx={{
          // Cùng chiều cao + viền dưới với Topbar để đường kẻ ngang liền mạch qua Sidebar
          height: TOPBAR_HEIGHT,
          boxSizing: 'border-box',
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
                borderRadius: '50%',
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
                <BrandLogo collapsed />
              </Box>
              <OpenSidebarIcon className="sk-open" />
            </IconButton>
          </Tooltip>
        ) : (
          <>
            {/* Logo + tên app: điều hướng về trang chủ */}
            <Box
              component="a"
              href={homePath}
              onClick={(e: MouseEvent<HTMLElement>) => {
                e.preventDefault()
                onGoHome()
              }}
              aria-label="Về trang chủ SmartLabKit"
              sx={{
                display: 'flex',
                alignItems: 'center',
                minWidth: 0,
                py: 0.5,
                cursor: 'pointer',
                textDecoration: 'none',
                '&:focus-visible': focusRing,
              }}
            >
              <BrandLogo color={SHELL_COLORS.primary} />
            </Box>
            {variant === 'desktop' ? (
              <Tooltip title="Thu gọn thanh bên" arrow slotProps={navTooltipSlotProps}>
                <IconButton
                  size="small"
                  onClick={onToggleCollapsed}
                  aria-label="Thu gọn thanh bên"
                  sx={{
                    color: SHELL_COLORS.textMuted,
                    borderRadius: '50%',
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
                // Thu gọn: nút tròn 44x44 (hover/active/focus đều tròn), icon ở giữa
                ...(isCollapsed
                  ? { width: 44, height: 44, minHeight: 44, flexGrow: 0, p: 0, mx: 'auto', borderRadius: '50%' }
                  : { borderRadius: 1.5, py: 1, px: 1.5, minHeight: 44 }),
                justifyContent: isCollapsed ? 'center' : 'flex-start',
                bgcolor: active ? SHELL_COLORS.primarySoft : 'transparent',
                color: active ? SHELL_COLORS.primary : SHELL_COLORS.navText,
                transition: 'background-color 0.15s ease, color 0.15s ease',
                '&:hover': { bgcolor: active ? SHELL_COLORS.primarySoft : SHELL_COLORS.hoverBg, color: SHELL_COLORS.primary },
                '&.Mui-focusVisible': { bgcolor: SHELL_COLORS.hoverBg, ...focusRing },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: isCollapsed ? 0 : 36,
                  justifyContent: 'center',
                  color: 'inherit',
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
