import { useEffect, useState } from 'react'
import { FactCheck as AuditIcon } from '@mui/icons-material'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
} from '@mui/material'
import { useNavigate } from 'react-router-dom'
import PortalLayout from '../../components/layout/PortalLayout'
import { inventoryService } from '../../services/inventoryService'
import { extractErrorMessage } from '../../services/api'
import { AUDIT_STATUSES, auditStatusOf, cabinetLabel, formatDateTime, rowsOf } from './inventoryLabels'

const PAGE_SIZE = 20
const headCellSx = { fontWeight: 700, color: '#334155' }

function StartAuditDialog({ onClose, onStarted }) {
  const [cabinets, setCabinets] = useState([])
  const [busyCabinets, setBusyCabinets] = useState({})
  const [cabinet, setCabinet] = useState(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    inventoryService.getCabinets()
      .then((items) => { if (active) setCabinets(items) })
      .catch((loadError) => { if (active) setError(extractErrorMessage(loadError, 'Không thể tải danh sách tủ.')) })
    Promise.all(
      ['InProgress', 'Submitted'].map((value) =>
        inventoryService.getInventoryAudits({ status: value, page: 1, size: 100 }).catch(() => null)
      )
    ).then((results) => {
      if (!active) return
      const busy = {}
      results.forEach((res, index) => {
        rowsOf(res).forEach((audit) => {
          busy[audit.cabinetId] = index === 0 ? 'đang có phiên kiểm' : 'đang chờ duyệt kết quả'
        })
      })
      setBusyCabinets(busy)
    })
    return () => { active = false }
  }, [])

  const start = async () => {
    setSaving(true)
    setError('')
    try {
      const audit = await inventoryService.startInventoryAudit({ cabinetId: cabinet.cabinetId, note: note.trim() || null })
      onStarted(audit)
    } catch (startError) {
      setError(extractErrorMessage(startError, 'Không thể bắt đầu kiểm kê.'))
      setSaving(false)
    }
  }

  return (
    <Dialog open onClose={() => !saving && onClose()} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 800 }}>Bắt đầu kiểm kê</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Autocomplete
            options={cabinets}
            value={cabinet}
            onChange={(_, value) => setCabinet(value)}
            getOptionLabel={cabinetLabel}
            getOptionDisabled={(option) => Boolean(busyCabinets[option.cabinetId])}
            renderOption={(props, option) => {
              const { key, ...rest } = props
              return (
                <li key={key} {...rest}>
                  {cabinetLabel(option)}
                  {busyCabinets[option.cabinetId] ? ` — ${busyCabinets[option.cabinetId]}` : ''}
                </li>
              )
            }}
            isOptionEqualToValue={(option, value) => option.cabinetId === value.cabinetId}
            renderInput={(params) => <TextField {...params} label="Tủ cần kiểm kê" required />}
          />
          <TextField label="Ghi chú (không bắt buộc)" value={note} onChange={(event) => setNote(event.target.value)} fullWidth />
          <Alert severity="info">Mỗi tủ chỉ có một phiên đang kiểm. Tồn kho chỉ thay đổi khi quản lý kho duyệt kết quả đếm.</Alert>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>Đóng</Button>
        <Button variant="contained" onClick={start} disabled={saving || !cabinet} sx={{ bgcolor: '#0058be' }}>
          {saving ? 'Đang tạo...' : 'Bắt đầu'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

/** Danh sách phiên kiểm kê tủ (mới nhất trước), lọc theo trạng thái, bắt đầu phiên mới. */
export default function InventoryAudits() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [startOpen, setStartOpen] = useState(false)

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setError('')
      try {
        const data = await inventoryService.getInventoryAudits({ status: status || undefined, page, size: PAGE_SIZE })
        if (active) setResult(data)
      } catch (loadError) {
        if (active) setError(extractErrorMessage(loadError, 'Không thể tải danh sách kiểm kê.'))
      } finally {
        if (active) setLoading(false)
      }
    }, 0)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [status, page])

  const audits = rowsOf(result)

  return (
    <PortalLayout headerTitle="Kiểm kê kho" headerSubtitle="Đếm thực tế từng tủ và ghi nhận chênh lệch vào sổ kho">
      <Box sx={{ maxWidth: 1440, mx: 'auto' }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Box
          sx={{
            p: 2,
            display: 'flex',
            justifyContent: 'space-between',
            gap: 1.5,
            flexWrap: 'wrap',
            bgcolor: '#fff',
            border: '1px solid #d8dced',
            borderRadius: '6px 6px 0 0',
          }}
        >
          <TextField
            select
            size="small"
            label="Trạng thái"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value)
              setPage(1)
            }}
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="">Tất cả</MenuItem>
            {Object.entries(AUDIT_STATUSES).map(([value, item]) => <MenuItem key={value} value={value}>{item.label}</MenuItem>)}
          </TextField>
          <Button variant="contained" startIcon={<AuditIcon />} onClick={() => setStartOpen(true)} sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#0058be' }}>
            Bắt đầu kiểm kê
          </Button>
        </Box>
        <Paper variant="outlined" sx={{ borderColor: '#d8dced', borderTop: 0, borderRadius: '0 0 6px 6px' }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#faf9ff' }}>
                  {['Ngày kiểm', 'Lab', 'Tủ', 'Người kiểm', 'Số dòng chênh lệch', 'Ghi chú', 'Trạng thái'].map((head) => (
                    <TableCell key={head} sx={headCellSx}>{head}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} align="center" sx={{ py: 5 }}><CircularProgress size={26} /></TableCell></TableRow>
                ) : audits.map((audit) => {
                  const auditStatus = auditStatusOf(audit.status)
                  return (
                    <TableRow
                      key={audit.auditId}
                      hover
                      onClick={() => navigate(`/class-setup/admin/inventory-audits/${audit.auditId}`)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>{formatDateTime(audit.auditDate)}</TableCell>
                      <TableCell>{audit.roomCode}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{audit.cabinetCode} · {audit.cabinetName}</TableCell>
                      <TableCell>{audit.auditorName}</TableCell>
                      <TableCell>{audit.status === 'Completed' ? audit.differenceCount : '—'}</TableCell>
                      <TableCell sx={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{audit.note || '—'}</TableCell>
                      <TableCell><Chip size="small" color={auditStatus.color} label={auditStatus.label} sx={{ fontWeight: 600, fontSize: 11 }} /></TableCell>
                    </TableRow>
                  )
                })}
                {!loading && audits.length === 0 && (
                  <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>Chưa có phiên kiểm kê nào.</TableCell></TableRow>
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

      {startOpen && (
        <StartAuditDialog
          onClose={() => setStartOpen(false)}
          onStarted={(audit) => navigate(`/class-setup/admin/inventory-audits/${audit.auditId}`)}
        />
      )}
    </PortalLayout>
  )
}
