import { Chip } from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty'

export default function ProjectStatusChip({ status }) {
  switch (status) {
    case 'Submitted':
    case 'PendingApproval':
    case 'PendingLecturer':
    case 'Pending':
      return (
        <Chip
          icon={<HourglassEmptyIcon sx={{ fontSize: '14px !important' }} />}
          label="Chờ duyệt"
          size="small"
          sx={{ bgcolor: '#fef3c7', color: '#b45309', fontWeight: 800, fontSize: 11 }}
        />
      )
    case 'Approved':
      return (
        <Chip
          icon={<CheckCircleIcon sx={{ fontSize: '14px !important' }} />}
          label="Đã duyệt"
          size="small"
          sx={{ bgcolor: '#dcfce7', color: '#15803d', fontWeight: 800, fontSize: 11 }}
        />
      )
    case 'Rejected':
      return (
        <Chip
          icon={<CancelIcon sx={{ fontSize: '14px !important' }} />}
          label="Bị từ chối"
          size="small"
          sx={{ bgcolor: '#fee2e2', color: '#dc2626', fontWeight: 800, fontSize: 11 }}
        />
      )
    case 'Draft':
      return (
        <Chip
          label="Bản nháp"
          size="small"
          sx={{ bgcolor: '#f1f5f9', color: '#64748b', fontWeight: 700, fontSize: 11 }}
        />
      )
    default:
      return (
        <Chip
          label={status || 'Chờ duyệt'}
          size="small"
          sx={{ bgcolor: '#eff6ff', color: '#0058be', fontWeight: 700, fontSize: 11 }}
        />
      )
  }
}
