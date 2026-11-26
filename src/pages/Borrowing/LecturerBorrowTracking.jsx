import { useMemo, useState } from 'react'
import { Search as SearchIcon } from '@mui/icons-material'
import {
  Box,
  Button,
  Chip,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { formatVietnamDate } from '../../utils/dateFormatting'
import { borrowProgressOf } from './borrowHelpers'

const FILTERS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'preparing', label: 'Lab đang chuẩn bị' },
  { key: 'ready', label: 'Chờ nhận đồ' },
  { key: 'borrowing', label: 'Đang mượn' },
  { key: 'overdue', label: 'Quá hạn' },
  { key: 'returned', label: 'Đã trả' },
]

const headCellSx = { fontWeight: 800, fontSize: 11, color: '#6b7280' }

/**
 * Giảng viên theo dõi đơn mượn của các lớp mình dạy (chỉ xem): đơn đang ở bước nào, nhóm nào quá hạn.
 * Bấm một dòng để mở chi tiết đơn (món nào đã trả, hỏng hay mất).
 */
export default function LecturerBorrowTracking({ requests }) {
  const navigate = useNavigate()
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  const rows = useMemo(
    () =>
      requests
        .map((request) => ({ request, progress: borrowProgressOf(request) }))
        .filter((row) => row.progress && row.progress.key !== 'closed' && row.progress.key !== 'pending'),
    [requests]
  )

  const counts = useMemo(() => {
    const result = { all: rows.length }
    rows.forEach((row) => {
      result[row.progress.key] = (result[row.progress.key] || 0) + 1
    })
    return result
  }, [rows])

  const shown = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return rows
      .filter((row) => filter === 'all' || row.progress.key === filter)
      .filter((row) => {
        if (!keyword) return true
        const r = row.request
        return [r.requestCode, r.teamName, r.projectTitle, r.classCode, r.requesterName]
          .some((text) => String(text || '').toLowerCase().includes(keyword))
      })
      .sort((a, b) => {
        if (a.progress.key === 'overdue' && b.progress.key !== 'overdue') return -1
        if (b.progress.key === 'overdue' && a.progress.key !== 'overdue') return 1
        return new Date(a.request.dueDate) - new Date(b.request.dueDate)
      })
  }, [rows, filter, search])

  return (
    <Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, mb: 2.5 }}>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {FILTERS.map((item) => {
            const active = filter === item.key
            const isOverdue = item.key === 'overdue' && (counts.overdue || 0) > 0
            let color = '#475569'
            if (active) color = '#fff'
            else if (isOverdue) color = '#dc2626'
            let bgcolor = 'transparent'
            if (active && isOverdue) bgcolor = '#dc2626'
            else if (active) bgcolor = '#0058be'
            let borderColor = '#e2e8f0'
            if (active) borderColor = bgcolor
            else if (isOverdue) borderColor = '#fecaca'
            return (
              <Button
                key={item.key}
                size="small"
                variant={active ? 'contained' : 'outlined'}
                onClick={() => setFilter(item.key)}
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: 12,
                  px: 1.8,
                  py: 0.6,
                  bgcolor,
                  color,
                  borderColor,
                  boxShadow: 'none',
                }}
              >
                {item.label} ({counts[item.key] || 0})
              </Button>
            )
          })}
        </Box>
        <TextField
          size="small"
          placeholder="Tìm nhóm, đề tài, mã đơn..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: '#94a3b8', fontSize: 19 }} />
                </InputAdornment>
              ),
            },
          }}
          sx={{ width: { xs: '100%', sm: 300 }, '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: 12, bgcolor: '#f8fafc' } }}
        />
      </Box>

      <TableContainer sx={{ border: '1px solid #f0f2f5', borderRadius: 1.5 }}>
        <Table size="small">
          <TableHead sx={{ bgcolor: '#fafbff' }}>
            <TableRow>
              <TableCell sx={{ ...headCellSx, py: 1.2 }}>MÃ ĐƠN</TableCell>
              <TableCell sx={headCellSx}>NHÓM</TableCell>
              <TableCell sx={headCellSx}>ĐỀ TÀI</TableCell>
              <TableCell sx={headCellSx}>LỚP</TableCell>
              <TableCell sx={headCellSx}>HẠN TRẢ</TableCell>
              <TableCell sx={headCellSx}>TÌNH TRẠNG</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {shown.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  Không có đơn mượn nào.
                </TableCell>
              </TableRow>
            ) : (
              shown.map(({ request, progress }) => (
                <TableRow
                  key={request.borrowRequestId}
                  hover
                  onClick={() => navigate(`/borrow/requests/${request.borrowRequestId}`)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell sx={{ fontSize: 12, fontWeight: 700, color: '#0058be', whiteSpace: 'nowrap' }}>{request.requestCode}</TableCell>
                  <TableCell sx={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>{request.teamName || request.requesterName}</TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontSize: 12.5, fontWeight: 600, color: '#131b2e' }}>
                      {request.projectTitle || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ fontSize: 12, color: '#334155', whiteSpace: 'nowrap' }}>{request.classCode || '—'}</TableCell>
                  <TableCell sx={{ fontSize: 12, color: '#334155', whiteSpace: 'nowrap' }}>{formatVietnamDate(request.dueDate)}</TableCell>
                  <TableCell>
                    <Chip size="small" label={progress.label} sx={progress.sx} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}
