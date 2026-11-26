import { useEffect, useState } from 'react'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
} from '@mui/material'
import PortalLayout from '../../components/layout/PortalLayout'
import { useAuth } from '../../context/AuthContext'
import { inventoryService } from '../../services/inventoryService'
import { extractErrorMessage } from '../../services/api'
import { getDisplayCode } from './componentHelpers'
import { TRANSACTION_TYPES, cabinetLabel, formatDateTime, itemStatusOf, rowsOf } from './inventoryLabels'

const PAGE_SIZE = 20
const headCellSx = { fontWeight: 700, color: '#334155', whiteSpace: 'nowrap' }
const EMPTY_FILTERS = { component: null, cabinetId: '', type: '', fromDate: '', toDate: '' }
const COLUMNS = ['Thời gian', 'Loại', 'Linh kiện', 'Tủ', 'Thay đổi', 'Người làm', 'Lý do / Chứng từ']

/** Lý do BE ghi kèm trạng thái tiếng Anh và mã nội bộ: đổi sang chữ dễ đọc. */
const readableReason = (reason) =>
  String(reason || '')
    .replace(/\s*[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/gi, '')
    .replace(/\b(Available|Borrowed|Lost|Retired)\b/g, (status) => itemStatusOf(status).label)
    .replace(/\s*->\s*/g, ' → ')
    .trim()

/**
 * Sổ kho: từng dòng nhập, mượn, trả, chuyển tủ, điều chỉnh, thanh lý (mới nhất trước).
 * Quản lý kho xem mọi lab; nhân viên lab chỉ xem lab mình phụ trách (BE lọc).
 */
export default function InventoryLedger() {
  const { hasPermission } = useAuth()
  const everyLab = hasPermission('INVENTORY_AUDIT_APPROVE')
  const [components, setComponents] = useState([])
  const [cabinets, setCabinets] = useState([])
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [page, setPage] = useState(1)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    inventoryService.getComponents()
      .then((data) => { if (active) setComponents(rowsOf(data)) })
      .catch(() => { if (active) setComponents([]) })
    Promise.all([inventoryService.getCabinets(), everyLab ? [] : inventoryService.getLabRooms()])
      .then(([items, rooms]) => {
        if (!active) return
        const myRoomIds = new Set(rooms.filter((room) => room.isMine).map((room) => room.roomId))
        setCabinets(everyLab ? items : items.filter((item) => myRoomIds.has(item.roomId)))
      })
      .catch(() => { if (active) setCabinets([]) })
    return () => { active = false }
  }, [everyLab])

  const invalidRange = Boolean(filters.fromDate && filters.toDate && filters.fromDate > filters.toDate)
  const componentId = filters.component?.componentId
  const { cabinetId, type, fromDate, toDate } = filters

  useEffect(() => {
    if (invalidRange) return undefined
    let active = true
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setError('')
      try {
        const data = await inventoryService.getInventoryTransactions({
          componentId: componentId || undefined,
          cabinetId: cabinetId || undefined,
          type: type || undefined,
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
          page,
          size: PAGE_SIZE,
        })
        if (active) setResult(data)
      } catch (loadError) {
        if (active) setError(extractErrorMessage(loadError, 'Không thể tải sổ kho.'))
      } finally {
        if (active) setLoading(false)
      }
    }, 0)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [componentId, cabinetId, type, fromDate, toDate, page, invalidRange])

  const update = (patch) => {
    setFilters((current) => ({ ...current, ...patch }))
    setPage(1)
  }

  const rows = rowsOf(result)

  return (
    <PortalLayout headerTitle="Sổ kho" headerSubtitle="Từng lần nhập, mượn, trả, chuyển tủ, điều chỉnh và thanh lý">
      <Box sx={{ maxWidth: 1440, mx: 'auto' }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {!everyLab && <Alert severity="info" sx={{ mb: 2 }}>Bạn xem được sổ kho của lab mình phụ trách.</Alert>}
        <Box
          sx={{
            p: 2,
            display: 'flex',
            gap: 1.5,
            flexWrap: 'wrap',
            alignItems: 'flex-start',
            bgcolor: '#fff',
            border: '1px solid #d8dced',
            borderRadius: '6px 6px 0 0',
          }}
        >
          <Autocomplete
            size="small"
            sx={{ minWidth: 240, flex: '1 1 240px' }}
            options={components}
            value={filters.component}
            onChange={(_, value) => update({ component: value })}
            getOptionLabel={(option) => `${getDisplayCode(option)} · ${option.componentName}`}
            isOptionEqualToValue={(option, value) => option.componentId === value.componentId}
            renderInput={(params) => <TextField {...params} label="Linh kiện" />}
          />
          <TextField select size="small" label="Tủ" value={filters.cabinetId} onChange={(event) => update({ cabinetId: event.target.value })} sx={{ minWidth: 200, flex: '1 1 200px' }}>
            <MenuItem value="">Tất cả tủ</MenuItem>
            {cabinets.map((cabinet) => <MenuItem key={cabinet.cabinetId} value={cabinet.cabinetId}>{cabinetLabel(cabinet)}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Loại giao dịch" value={filters.type} onChange={(event) => update({ type: event.target.value })} sx={{ minWidth: 180 }}>
            <MenuItem value="">Tất cả loại</MenuItem>
            {Object.entries(TRANSACTION_TYPES).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
          </TextField>
          <TextField type="date" size="small" label="Từ ngày" value={filters.fromDate} onChange={(event) => update({ fromDate: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField
            type="date"
            size="small"
            label="Đến ngày"
            value={filters.toDate}
            onChange={(event) => update({ toDate: event.target.value })}
            error={invalidRange}
            helperText={invalidRange ? 'Phải sau hoặc bằng từ ngày' : ''}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <Button onClick={() => update(EMPTY_FILTERS)} sx={{ textTransform: 'none', height: 40 }}>Xóa bộ lọc</Button>
        </Box>
        <Paper variant="outlined" sx={{ borderColor: '#d8dced', borderTop: 0, borderRadius: '0 0 6px 6px' }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#faf9ff' }}>
                  {COLUMNS.map((head) => <TableCell key={head} sx={headCellSx}>{head}</TableCell>)}
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={COLUMNS.length} align="center" sx={{ py: 5 }}><CircularProgress size={26} /></TableCell></TableRow>
                ) : rows.map((row) => (
                  <TableRow key={row.transactionId} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTime(row.createdAt)}</TableCell>
                    <TableCell>{TRANSACTION_TYPES[row.type] || row.type}</TableCell>
                    <TableCell sx={{ fontSize: 13, fontWeight: 600 }}>{row.componentName}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.cabinetCode || '—'}</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: row.quantityChange < 0 ? '#c62828' : row.quantityChange > 0 ? '#2e7d32' : '#64748b' }}>
                      {row.quantityChange > 0 ? `+${row.quantityChange}` : row.quantityChange}
                    </TableCell>
                    <TableCell>{row.createdByName}</TableCell>
                    <TableCell sx={{ minWidth: 180 }}>{[readableReason(row.reason), row.receiptCode].filter(Boolean).join(' · ') || '—'}</TableCell>
                  </TableRow>
                ))}
                {!loading && rows.length === 0 && (
                  <TableRow><TableCell colSpan={COLUMNS.length} align="center" sx={{ py: 4, color: 'text.secondary' }}>Không có dòng nào.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={result?.totalCount || 0}
            page={page - 1}
            onPageChange={(_, nextPage) => setPage(nextPage + 1)}
            rowsPerPage={PAGE_SIZE}
            rowsPerPageOptions={[PAGE_SIZE]}
            labelDisplayedRows={({ from, to, count }) => `${from}–${to} / ${count}`}
          />
        </Paper>
      </Box>
    </PortalLayout>
  )
}
