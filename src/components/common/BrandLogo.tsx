import { Box, Typography } from '@mui/material'
import logoUrl from '../../assets/logo.svg'

interface BrandLogoProps {
  /** true: chỉ hiển thị icon logo vuông; false: logo + tên "SmartLabKit". */
  collapsed?: boolean
  /** Kích thước cạnh icon (px). */
  size?: number
  /** Dòng phụ dưới tên thương hiệu (chỉ hiện khi mở rộng). */
  subtitle?: string
  /** Màu chữ tên thương hiệu. */
  color?: string
}

/** Logo SmartLabKit dùng chung (Sidebar, Đăng nhập, Quên mật khẩu...). */
export default function BrandLogo({ collapsed = false, size = 36, subtitle, color = '#0058be' }: BrandLogoProps) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
      <Box
        component="img"
        src={logoUrl}
        alt="SmartLabKit"
        draggable={false}
        sx={{ width: size, height: size, flexShrink: 0, display: 'block', objectFit: 'contain' }}
      />
      {!collapsed && (
        <Box sx={{ minWidth: 0 }}>
          <Typography noWrap sx={{ fontWeight: 800, color, lineHeight: 1.1, fontSize: 16 }}>
            SmartLabKit
          </Typography>
          {subtitle && (
            <Typography noWrap sx={{ color: '#808999', fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
      )}
    </Box>
  )
}
