import { Chip } from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty'

export default function ProjectStatusChip({ status, size = 'small' }) {
  const sizeStyles = size === 'medium'
    ? { height: 32, fontSize: 13, '& .MuiChip-label': { px: 1.25 } }
    : {}
  const iconFontSize = size === 'medium' ? '16px !important' : '14px !important'

  switch (status) {
    case 'Submitted':
    case 'PendingApproval':
    case 'PendingLecturer':
    case 'Pending':
      return (
        <Chip
          icon={<HourglassEmptyIcon sx={{ fontSize: iconFontSize }} />}
          label="Chờ duyệt"
          size={size}
          sx={{ bgcolor: '#fef3c7', color: '#b45309', fontWeight: 800, fontSize: 11, ...sizeStyles }}
        />
      )
    case 'Approved':
      return (
        <Chip
          icon={<CheckCircleIcon sx={{ fontSize: iconFontSize }} />}
          label="Đã duyệt"
          size={size}
          sx={{ bgcolor: '#dcfce7', color: '#15803d', fontWeight: 800, fontSize: 11, ...sizeStyles }}
        />
      )
    case 'Rejected':
      return (
        <Chip
          icon={<CancelIcon sx={{ fontSize: iconFontSize }} />}
          label="Bị từ chối"
          size={size}
          sx={{ bgcolor: '#fee2e2', color: '#dc2626', fontWeight: 800, fontSize: 11, ...sizeStyles }}
        />
      )
    case 'Draft':
      return (
        <Chip
          label="Bản nháp"
          size={size}
          sx={{ bgcolor: '#f1f5f9', color: '#64748b', fontWeight: 700, fontSize: 11, ...sizeStyles }}
        />
      )
    default:
      return (
        <Chip
          label={status || 'Chờ duyệt'}
          size={size}
          sx={{ bgcolor: '#eff6ff', color: '#0058be', fontWeight: 700, fontSize: 11, ...sizeStyles }}
        />
      )
  }
}
