import { useEffect, useState } from 'react'
import { FactCheck as AuditIcon } from '@mui/icons-material'
import {
  Alert,
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
import { useAuth } from '../../context/AuthContext'
import { inventoryService } from '../../services/inventoryService'
import { extractErrorMessage } from '../../services/api'
import { AUDIT_STATUSES, auditStatusOf, formatDateTime, rowsOf } from './inventoryLabels'
import { labLabel } from '../../utils/labLabel'

const PAGE_SIZE = 20
const headCellSx = { fontWeight: 700, color: '#334155' }

function StartAuditDialog({ onClose, onStarted }) {
  const [rooms, setRooms] = useState([])
  const [cabinets, setCabinets] = useState([])
  const [busyCabinets, setBusyCabinets] = useState({})
  const [roomId, setRoomId] = useState('')
  const [cabinetId, setCabinetId] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    Promise.all([inventoryService.getCabinets(), inventoryService.getLabRooms()])
      .then(([items, labRooms]) => {
        if (!active) return
        const shownRooms = labRooms.filter((room) => room.isMine)
        const shownRoomIds = new Set(shownRooms.map((room) => room.roomId))
        setRooms(shownRooms)
        setCabinets(items.filter((item) => shownRoomIds.has(item.roomId)))
        if (shownRooms.length === 1) setRoomId(shownRooms[0].roomId)
      })
      .catch((loadError) => { if (active) setError(extractErrorMessage(loadError, 'Không thể tải danh sách lab và tủ.')) })
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

  const roomCabinets = cabinets.filter((item) => item.roomId === roomId)

  const start = async () => {
    setSaving(true)
    setError('')
    try {
      const audit = await inventoryService.startInventoryAudit({ cabinetId, note: note.trim() || null })
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
          <TextField
            select
            label="Lab"
            value={roomId}
            onChange={(event) => {
              setRoomId(event.target.value)
              setCabinetId('')
            }}
            required
            fullWidth
          >
            {rooms.map((room) => (
              <MenuItem key={room.roomId} value={room.roomId}>{labLabel(room)}</MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Tủ"
            value={cabinetId}
            onChange={(event) => setCabinetId(event.target.value)}
            disabled={!roomId}
            helperText={roomId ? '' : 'Chọn lab trước'}
            required
            fullWidth
          >
            {roomCabinets.map((item) => (
              <MenuItem key={item.cabinetId} value={item.cabinetId} disabled={Boolean(busyCabinets[item.cabinetId])}>
                {item.cabinetName || item.cabinetCode}
                {busyCabinets[item.cabinetId] ? ` — ${busyCabinets[item.cabinetId]}` : ''}
              </MenuItem>
            ))}
            {roomId && roomCabinets.length === 0 && <MenuItem disabled value="">Lab này chưa có tủ</MenuItem>}
          </TextField>
          <TextField label="Ghi chú (không bắt buộc)" value={note} onChange={(event) => setNote(event.target.value)} fullWidth />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>Đóng</Button>
        <Button variant="contained" onClick={start} disabled={saving || !cabinetId} sx={{ bgcolor: '#0058be' }}>
          {saving ? 'Đang tạo...' : 'Bắt đầu'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

/**
 * Danh sách phiên kiểm kê tủ (mới nhất trước), lọc theo trạng thái, bắt đầu phiên mới.
 * embedded: hiện bên trong tab "Kiểm kê" của trang Tủ & kiểm kê, không tự bọc PortalLayout.
 */
export default function InventoryAudits({ embedded = false }) {
  const navigate = useNavigate()
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [startOpen, setStartOpen] = useState(false)
  const { hasRole } = useAuth()
  const canCount = hasRole('LabStaff')

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

  const content = (
    <>
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
          {canCount && (
            <Button variant="contained" startIcon={<AuditIcon />} onClick={() => setStartOpen(true)} sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#0058be' }}>
              Bắt đầu kiểm kê
            </Button>
          )}
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
    </>
  )

  if (embedded) return content

  return (
    <PortalLayout headerTitle="Kiểm kê kho" headerSubtitle="Đếm thực tế từng tủ và ghi nhận chênh lệch vào sổ kho">
      {content}
    </PortalLayout>
  )
}
