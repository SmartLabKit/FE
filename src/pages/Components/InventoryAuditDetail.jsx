import { useEffect, useState } from 'react'
import { ArrowBack as BackIcon, Done as DoneIcon } from '@mui/icons-material'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { useNavigate, useParams } from 'react-router-dom'
import PortalLayout from '../../components/layout/PortalLayout'
import { inventoryService } from '../../services/inventoryService'
import { extractErrorMessage } from '../../services/api'
import { TRANSACTION_TYPES, auditStatusOf, formatDateTime } from './inventoryLabels'

const headCellSx = { fontWeight: 700, color: '#334155' }

function SectionCard({ title, subtitle, children }) {
  return (
    <Card variant="outlined" sx={{ borderColor: '#d8dced', boxShadow: 'none', mb: 2 }}>
      <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid #eef0f6' }}>
        <Typography sx={{ fontWeight: 800, color: '#182238' }}>{title}</Typography>
        {subtitle && <Typography sx={{ color: '#697386', fontSize: 12 }}>{subtitle}</Typography>}
      </Box>
      {children}
    </Card>
  )
}

/**
 * Chi tiết 1 phiên kiểm kê.
 * - Đang kiểm: nhập số đếm thực tế cho từng vật tư (mặc định bằng số hệ thống) và tick các thiết bị không tìm thấy,
 *   rồi Hoàn tất (vật tư lệch được điều chỉnh, thiết bị không thấy chuyển sang Mất) hoặc Hủy phiên (không ghi gì vào kho).
 * - Đã hoàn tất: biên bản các dòng chênh lệch đã ghi vào sổ kho và các đơn mượn bị thiếu hàng (nếu có).
 */
export default function InventoryAuditDetail() {
  const { auditId } = useParams()
  const navigate = useNavigate()
  const [audit, setAudit] = useState(null)
  const [error, setError] = useState('')
  const [counts, setCounts] = useState({})
  const [missingIds, setMissingIds] = useState([])
  const [note, setNote] = useState('')
  const [confirm, setConfirm] = useState(null)
  const [saving, setSaving] = useState(false)

  const applyAudit = (data) => {
    setAudit(data)
    setCounts(Object.fromEntries((data.consumables || []).map((line) => [line.componentId, String(line.systemQuantity)])))
    setMissingIds([])
    setNote(data.note || '')
  }

  useEffect(() => {
    let active = true
    inventoryService.getInventoryAudit(auditId)
      .then((data) => { if (active) applyAudit(data) })
      .catch((loadError) => { if (active) setError(extractErrorMessage(loadError, 'Không thể tải phiên kiểm kê.')) })
    return () => { active = false }
  }, [auditId])

  const inProgress = audit?.status === 'InProgress'
  const consumables = audit?.consumables || []
  const items = audit?.items || []
  const invalidCount = consumables.some((line) => {
    const value = Number(counts[line.componentId])
    return counts[line.componentId] === '' || !Number.isInteger(value) || value < 0
  })
  const changedConsumables = consumables.filter((line) => Number(counts[line.componentId]) !== line.systemQuantity)
  const status = auditStatusOf(audit?.status)

  const toggleMissing = (itemId) =>
    setMissingIds((current) => (current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId]))

  const complete = async () => {
    setSaving(true)
    setError('')
    try {
      const data = await inventoryService.completeInventoryAudit(auditId, {
        consumables: consumables.map((line) => ({ componentId: line.componentId, countedQuantity: Number(counts[line.componentId]) })),
        missingItemIds: missingIds,
        note: note.trim() || null,
      })
      applyAudit(data)
      setConfirm(null)
    } catch (saveError) {
      setError(extractErrorMessage(saveError, 'Không thể hoàn tất kiểm kê.'))
      setConfirm(null)
    } finally {
      setSaving(false)
    }
  }

  const cancel = async () => {
    setSaving(true)
    setError('')
    try {
      await inventoryService.cancelInventoryAudit(auditId)
      navigate('/class-setup/admin/inventory-audits')
    } catch (cancelError) {
      setError(extractErrorMessage(cancelError, 'Không thể hủy phiên kiểm kê.'))
      setConfirm(null)
      setSaving(false)
    }
  }

  return (
    <PortalLayout headerTitle="Phiên kiểm kê" headerSubtitle="Đếm hàng trong tủ và ghi nhận chênh lệch">
      <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
        <Button startIcon={<BackIcon />} onClick={() => navigate('/class-setup/admin/inventory-audits')} sx={{ mb: 2, textTransform: 'none' }}>
          Danh sách kiểm kê
        </Button>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {!audit && !error && <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}><CircularProgress /></Box>}

        {audit && (
          <>
            <Card variant="outlined" sx={{ mb: 2, borderColor: '#d8dced', boxShadow: 'none' }}>
              <CardContent sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>{audit.cabinetCode} · {audit.cabinetName}</Typography>
                  <Typography color="text.secondary">
                    Lab {audit.roomCode} · {audit.auditorName} · {formatDateTime(audit.auditDate)}
                  </Typography>
                </Box>
                <Chip label={status.label} color={status.color} sx={{ fontWeight: 700 }} />
              </CardContent>
            </Card>

            {inProgress ? (
              <>
                <SectionCard title={`Vật tư tiêu hao (${consumables.length})`} subtitle="Nhập số đếm thực tế, mặc định bằng số hệ thống đang ghi">
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: '#faf9ff' }}>
                          {['Linh kiện', 'Mã', 'Hệ thống', 'Đếm thực tế', 'Chênh lệch'].map((head) => <TableCell key={head} sx={headCellSx}>{head}</TableCell>)}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {consumables.map((line) => {
                          const counted = Number(counts[line.componentId])
                          const difference = Number.isInteger(counted) ? counted - line.systemQuantity : 0
                          return (
                            <TableRow key={line.componentId}>
                              <TableCell sx={{ fontWeight: 600 }}>{line.componentName}</TableCell>
                              <TableCell sx={{ color: '#0058be' }}>{line.componentCode}</TableCell>
                              <TableCell>{line.systemQuantity}</TableCell>
                              <TableCell>
                                <TextField
                                  size="small"
                                  type="number"
                                  value={counts[line.componentId] ?? ''}
                                  onChange={(event) => setCounts((current) => ({ ...current, [line.componentId]: event.target.value }))}
                                  slotProps={{ htmlInput: { min: 0 } }}
                                  sx={{ width: 120 }}
                                />
                              </TableCell>
                              <TableCell sx={{ fontWeight: 700, color: difference < 0 ? '#c62828' : difference > 0 ? '#2e7d32' : 'text.secondary' }}>
                                {difference > 0 ? `+${difference}` : difference}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                        {consumables.length === 0 && (
                          <TableRow><TableCell colSpan={5} align="center" sx={{ py: 3, color: 'text.secondary' }}>Tủ không có vật tư tiêu hao.</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </SectionCard>

                <SectionCard title={`Thiết bị trong tủ (${items.length})`} subtitle="Tick các thiết bị KHÔNG tìm thấy, chúng sẽ chuyển sang trạng thái Mất khi hoàn tất">
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: '#faf9ff' }}>
                          {['Không thấy', 'Mã thiết bị', 'Linh kiện', 'Serial'].map((head) => <TableCell key={head} sx={headCellSx}>{head}</TableCell>)}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {items.map((item) => (
                          <TableRow key={item.itemId} hover onClick={() => toggleMissing(item.itemId)} sx={{ cursor: 'pointer', bgcolor: missingIds.includes(item.itemId) ? '#fef2f2' : undefined }}>
                            <TableCell padding="checkbox"><Checkbox color="error" checked={missingIds.includes(item.itemId)} /></TableCell>
                            <TableCell sx={{ color: '#0058be', fontWeight: 600 }}>{item.itemCode}</TableCell>
                            <TableCell>{item.componentName}</TableCell>
                            <TableCell>{item.serialNumber || '—'}</TableCell>
                          </TableRow>
                        ))}
                        {items.length === 0 && (
                          <TableRow><TableCell colSpan={4} align="center" sx={{ py: 3, color: 'text.secondary' }}>Tủ không có thiết bị quản lý theo từng chiếc.</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </SectionCard>

                <TextField label="Ghi chú biên bản (không bắt buộc)" value={note} onChange={(event) => setNote(event.target.value)} multiline minRows={2} fullWidth sx={{ mb: 2, bgcolor: '#fff' }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1.5, flexWrap: 'wrap' }}>
                  <Button color="error" onClick={() => setConfirm('cancel')} disabled={saving} sx={{ textTransform: 'none', fontWeight: 700 }}>
                    Hủy phiên kiểm kê
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<DoneIcon />}
                    onClick={() => setConfirm('complete')}
                    disabled={saving || invalidCount}
                    sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#0058be' }}
                  >
                    Hoàn tất kiểm kê
                  </Button>
                </Box>
              </>
            ) : (
              <>
                {(audit.reservationShortages || []).length > 0 && (
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    Lab đang thiếu hàng cho các đơn đã duyệt:{' '}
                    {audit.reservationShortages.map((line) => `${line.componentName} (còn ${line.inStock}, cần ${line.reserved}: ${(line.requestCodes || []).join(', ')})`).join('; ')}
                  </Alert>
                )}
                {audit.note && <Alert severity="info" sx={{ mb: 2 }}>Ghi chú: {audit.note}</Alert>}
                <SectionCard title={`Biên bản chênh lệch (${(audit.differences || []).length})`} subtitle="Các dòng đã ghi vào sổ kho bởi phiên kiểm kê này">
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: '#faf9ff' }}>
                          {['Loại', 'Linh kiện', 'Serial', 'Thay đổi', 'Lý do'].map((head) => <TableCell key={head} sx={headCellSx}>{head}</TableCell>)}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(audit.differences || []).map((line) => (
                          <TableRow key={line.transactionId}>
                            <TableCell>{TRANSACTION_TYPES[line.type] || line.type}</TableCell>
                            <TableCell>{line.componentCode} · {line.componentName}</TableCell>
                            <TableCell>{line.serialNumber || '—'}</TableCell>
                            <TableCell sx={{ fontWeight: 700, color: line.quantityChange < 0 ? '#c62828' : '#2e7d32' }}>
                              {line.quantityChange > 0 ? `+${line.quantityChange}` : line.quantityChange}
                            </TableCell>
                            <TableCell>{line.reason || '—'}</TableCell>
                          </TableRow>
                        ))}
                        {(audit.differences || []).length === 0 && (
                          <TableRow><TableCell colSpan={5} align="center" sx={{ py: 3, color: 'text.secondary' }}>Không có chênh lệch, số đếm khớp hệ thống.</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </SectionCard>
              </>
            )}
          </>
        )}
      </Box>

      <Dialog open={Boolean(confirm)} onClose={() => !saving && setConfirm(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 800 }}>{confirm === 'cancel' ? 'Hủy phiên kiểm kê?' : 'Hoàn tất kiểm kê?'}</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            {confirm === 'cancel'
              ? 'Phiên kiểm kê sẽ bị hủy, kho không thay đổi.'
              : `${changedConsumables.length} vật tư sẽ được điều chỉnh và ${missingIds.length} thiết bị chuyển sang Mất. Mọi thay đổi được ghi vào sổ kho.`}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirm(null)} disabled={saving}>Đóng</Button>
          <Button
            variant="contained"
            color={confirm === 'cancel' ? 'error' : 'primary'}
            onClick={confirm === 'cancel' ? cancel : complete}
            disabled={saving}
          >
            {saving ? 'Đang xử lý...' : 'Xác nhận'}
          </Button>
        </DialogActions>
      </Dialog>
    </PortalLayout>
  )
}
