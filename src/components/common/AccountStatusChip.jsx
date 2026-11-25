import { Chip } from '@mui/material'

/** Trạng thái tài khoản: đã kích hoạt (xanh), chờ kích hoạt (vàng), đã khóa (đỏ). */
export default function AccountStatusChip({ account }) {
  const style = { fontSize: 11, fontWeight: 700, height: 22 }
  if (account.isActive) return <Chip size="small" label="Đã kích hoạt" sx={{ ...style, bgcolor: '#ecfdf5', color: '#059669' }} />
  if (account.activationPending) return <Chip size="small" label="Chờ kích hoạt" sx={{ ...style, bgcolor: '#fffbeb', color: '#b45309' }} />
  return <Chip size="small" label="Đã khóa" sx={{ ...style, bgcolor: '#fef2f2', color: '#ef4444' }} />
}
