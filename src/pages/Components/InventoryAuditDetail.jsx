import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowBack as BackIcon,
  Done as DoneIcon,
  Restore as RestoreIcon,
} from '@mui/icons-material'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import PortalLayout from '../../components/layout/PortalLayout'
import { inventoryService } from '../../services/inventoryService'
import { extractErrorMessage } from '../../services/api'
import { TRANSACTION_TYPES, auditStatusOf, formatDateTime, rowsOf } from './inventoryLabels'

const headCellSx = { fontWeight: 700, color: '#334155' }

const FILTERS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'unchecked', label: 'Chưa kiểm' },
  { value: 'diff', label: 'Lệch' },
]

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

function diffColor(difference) {
  if (difference === null || difference === 0) return '#64748b'
  if (difference < 0) return '#c62828'
  return '#2e7d32'
}

function formatDiff(difference) {
  if (difference === null) return '—'
  if (difference > 0) return `+${difference}`
  return String(difference)
}

/**
 * Phiên kiểm kê 1 tủ.
 * Nhân viên lab tự đếm: ô số lượng để trống, từng thiết bị chọn Có mặt / Thiếu; kiểm hết mới gửi được.
 * Quản lý kho duyệt thì tồn kho mới đổi (vật tư theo số đếm, thiết bị thiếu sang Thất lạc).
 */
export default function InventoryAuditDetail() {
  const { auditId } = useParams()
  const navigate = useNavigate()
  const { user, hasRole, hasPermission } = useAuth()
  const [audit, setAudit] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [counts, setCounts] = useState({})
  const [itemStates, setItemStates] = useState({})
  const [filter, setFilter] = useState('all')
  const [note, setNote] = useState('')
  const [confirm, setConfirm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [review, setReview] = useState(null)
  const [reviewText, setReviewText] = useState('')
  const [lostItems, setLostItems] = useState([])
  const [restoringId, setRestoringId] = useState('')

  const applyAudit = useCallback(async (data) => {
    setAudit(data)
    setCounts({})
    setItemStates({})
    setNote(data.note || '')
    if (data?.cabinetId) {
      const lost = await inventoryService
        .getComponentItems({ cabinetId: data.cabinetId, status: 'Lost', page: 1, size: 100 })
        .catch(() => [])
      setLostItems(rowsOf(lost))
    }
  }, [])

  useEffect(() => {
    let active = true
    inventoryService
      .getInventoryAudit(auditId)
      .then((data) => {
        if (active) applyAudit(data)
      })
      .catch((loadError) => {
        if (active) setError(extractErrorMessage(loadError, 'Không thể tải phiên kiểm kê.'))
      })
    return () => {
      active = false
    }
  }, [auditId, applyAudit])

  const inProgress = audit?.status === 'InProgress'
  const submitted = audit?.status === 'Submitted'
  const canReview = hasPermission?.('INVENTORY_AUDIT_APPROVE')
  const canRestore = hasPermission?.('COMPONENT_MANAGE')
  const isOwnCount = Boolean(audit?.auditorId && user?.userId && audit.auditorId === user.userId && !hasRole?.('Admin'))
  const consumables = useMemo(() => audit?.consumables || [], [audit])
  const items = useMemo(() => audit?.items || [], [audit])
  const status = auditStatusOf(audit?.status)

  const countedOf = (line) => {
    const raw = counts[line.componentId]
    if (raw === undefined || raw === '') return null
    return Number(raw)
  }

  const differenceOf = (line) => {
    const counted = countedOf(line)
    if (counted === null) return null
    return counted - Number(line.systemQuantity)
  }

  const isLineChecked = (line) => countedOf(line) !== null
  const isItemChecked = (item) => Boolean(itemStates[item.itemId])

  const checkedCount =
    consumables.filter(isLineChecked).length + items.filter(isItemChecked).length
  const totalCount = consumables.length + items.length
  const allChecked = checkedCount === totalCount

  const diffLines = consumables.filter((line) => {
    const difference = differenceOf(line)
    return difference !== null && difference !== 0
  })
  const missingIds = items.filter((item) => itemStates[item.itemId] === 'missing').map((item) => item.itemId)

  const shownConsumables = consumables.filter((line) => {
    if (filter === 'unchecked') return !isLineChecked(line)
    if (filter === 'diff') {
      const difference = differenceOf(line)
      return difference !== null && difference !== 0
    }
    return true
  })

  const shownItems = items.filter((item) => {
    if (filter === 'unchecked') return !isItemChecked(item)
    if (filter === 'diff') return itemStates[item.itemId] === 'missing'
    return true
  })

  const handleRestoreLostItem = async (item) => {
    setRestoringId(item.itemId)
    setError('')
    try {
      await inventoryService.moveComponentItems({
        componentId: item.componentId,
        fromCabinetId: item.cabinetId || audit?.cabinetId,
        fromStatus: 'Lost',
        itemIds: [item.itemId],
        toStatus: 'Available',
        reason: 'Tìm thấy lại thiết bị và khôi phục về kho',
      })
      setNotice(`Đã khôi phục thiết bị ${item.itemCode} về kho.`)
      await applyAudit(await inventoryService.getInventoryAudit(auditId))
    } catch (restoreErr) {
      setError(extractErrorMessage(restoreErr, `Không thể khôi phục thiết bị ${item.itemCode}.`))
    } finally {
      setRestoringId('')
    }
  }

  const complete = async () => {
    setSaving(true)
    setError('')
    try {
      await inventoryService.completeInventoryAudit(auditId, {
        consumables: consumables.map((line) => ({
          componentId: line.componentId,
          countedQuantity: countedOf(line),
        })),
        missingItemIds: missingIds,
        note: note.trim() || null,
      })
      await applyAudit(await inventoryService.getInventoryAudit(auditId))
      setNotice('Đã gửi kết quả, chờ quản lý kho duyệt.')
      setConfirm(null)
    } catch (saveError) {
      setError(extractErrorMessage(saveError, 'Không thể gửi kết quả kiểm kê.'))
      setConfirm(null)
    } finally {
      setSaving(false)
    }
  }

  const submitReview = async () => {
    const kind = review
    setSaving(true)
    setError('')
    try {
      let updated
      if (kind === 'approve') {
        updated = await inventoryService.approveInventoryAudit(auditId, reviewText)
      } else {
        updated = await inventoryService.recountInventoryAudit(auditId, reviewText)
      }
      setReview(null)
      setReviewText('')
      await applyAudit(updated)
      if (kind === 'approve') {
        setNotice('Đã duyệt, tồn kho đã được cập nhật theo số đếm.')
      } else {
        setNotice('Đã trả về cho nhân viên lab đếm lại.')
      }
    } catch (reviewError) {
      setError(extractErrorMessage(reviewError, kind === 'approve' ? 'Không thể duyệt kết quả kiểm kê.' : 'Không thể trả về đếm lại.'))
      setReview(null)
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
    <PortalLayout headerTitle="Phiên kiểm kê" headerSubtitle="Đếm thực tế trong tủ và đối chiếu với số trên hệ thống">
      <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
        <Button
          startIcon={<BackIcon />}
          onClick={() => navigate('/class-setup/admin/inventory-audits')}
          sx={{ mb: 2, textTransform: 'none', fontWeight: 600 }}
        >
          Danh sách kiểm kê
        </Button>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}
        {notice && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice('')}>
            {notice}
          </Alert>
        )}
        {!audit && !error && (
          <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress />
          </Box>
        )}

        {audit && (
          <>
            <Card variant="outlined" sx={{ mb: 2, borderColor: '#d8dced', boxShadow: 'none' }}>
              <CardContent sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                <Box>
                  <Typography variant="h6" fontWeight={800}>{audit.cabinetName || audit.cabinetCode}</Typography>
                  <Typography color="text.secondary" fontSize={13.5}>
                    Người kiểm: {audit.auditorName} · Mở lúc {formatDateTime(audit.auditDate)}
                  </Typography>
                </Box>
                <Chip label={status.label} color={status.color} sx={{ fontWeight: 700 }} />
              </CardContent>
            </Card>

            {inProgress && (
              <>
                {audit.reviewNote && (
                  <Alert severity="warning" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>
                    Quản lý kho trả về đếm lại{audit.reviewedByName ? ` (${audit.reviewedByName})` : ''}: {audit.reviewNote}
                  </Alert>
                )}

                <Card variant="outlined" sx={{ mb: 2, borderColor: '#d8dced', boxShadow: 'none' }}>
                  <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                    <Box sx={{ flex: 1, minWidth: 200 }}>
                      <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 0.5 }}>
                        Đã kiểm {checkedCount}/{totalCount}
                        {diffLines.length + missingIds.length > 0 && (
                          <Box component="span" sx={{ color: '#c62828', ml: 1 }}>
                            · {diffLines.length + missingIds.length} lệch
                          </Box>
                        )}
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={totalCount === 0 ? 100 : (checkedCount * 100) / totalCount}
                        sx={{ height: 6, borderRadius: 3 }}
                      />
                    </Box>
                    <ToggleButtonGroup
                      size="small"
                      exclusive
                      value={filter}
                      onChange={(_event, value) => value && setFilter(value)}
                    >
                      {FILTERS.map((option) => (
                        <ToggleButton key={option.value} value={option.value} sx={{ textTransform: 'none', px: 1.5 }}>
                          {option.label}
                        </ToggleButton>
                      ))}
                    </ToggleButtonGroup>
                  </CardContent>
                </Card>

                {consumables.length > 0 && (
                  <SectionCard title={`Vật tư tiêu hao (${consumables.length})`} subtitle="Đếm trong tủ rồi nhập số thực tế.">
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ bgcolor: '#faf9ff' }}>
                            <TableCell sx={headCellSx}>Linh kiện</TableCell>
                            <TableCell align="right" sx={headCellSx}>Hệ thống</TableCell>
                            <TableCell sx={headCellSx}>Đếm thực tế</TableCell>
                            <TableCell align="right" sx={headCellSx}>Lệch</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {shownConsumables.map((line) => {
                            const difference = differenceOf(line)
                            return (
                              <TableRow key={line.componentId}>
                                <TableCell sx={{ fontWeight: 600 }}>{line.componentName}</TableCell>
                                <TableCell align="right">{line.systemQuantity}</TableCell>
                                <TableCell>
                                  <TextField
                                    size="small"
                                    placeholder="Nhập số"
                                    value={counts[line.componentId] ?? ''}
                                    onChange={(event) => {
                                      const value = event.target.value
                                      if (value === '' || /^\d+$/.test(value)) {
                                        setCounts((current) => ({ ...current, [line.componentId]: value }))
                                      }
                                    }}
                                    slotProps={{ htmlInput: { inputMode: 'numeric' } }}
                                    sx={{ width: 110 }}
                                  />
                                </TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700, color: diffColor(difference) }}>
                                  {formatDiff(difference)}
                                </TableCell>
                              </TableRow>
                            )
                          })}
                          {shownConsumables.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={4} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                                Không có dòng nào.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </SectionCard>
                )}

                {items.length > 0 && (
                  <SectionCard title={`Thiết bị (${items.length})`} subtitle="Tìm từng món trong tủ theo mã dán trên thiết bị.">
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ bgcolor: '#faf9ff' }}>
                            <TableCell sx={headCellSx}>Linh kiện</TableCell>
                            <TableCell sx={headCellSx}>Mã thiết bị</TableCell>
                            <TableCell sx={headCellSx}>Serial</TableCell>
                            <TableCell sx={headCellSx}>Kết quả</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {shownItems.map((item) => (
                            <TableRow
                              key={item.itemId}
                              sx={{ bgcolor: itemStates[item.itemId] === 'missing' ? '#fef2f2' : undefined }}
                            >
                              <TableCell sx={{ fontWeight: 600 }}>{item.componentName}</TableCell>
                              <TableCell sx={{ whiteSpace: 'nowrap' }}>{item.itemCode}</TableCell>
                              <TableCell>{item.serialNumber || '—'}</TableCell>
                              <TableCell>
                                <ToggleButtonGroup
                                  size="small"
                                  exclusive
                                  value={itemStates[item.itemId] || null}
                                  onChange={(_event, value) =>
                                    setItemStates((current) => ({ ...current, [item.itemId]: value }))
                                  }
                                >
                                  <ToggleButton value="present" color="success" sx={{ textTransform: 'none', px: 1.5 }}>
                                    Có mặt
                                  </ToggleButton>
                                  <ToggleButton value="missing" color="error" sx={{ textTransform: 'none', px: 1.5 }}>
                                    Thiếu
                                  </ToggleButton>
                                </ToggleButtonGroup>
                              </TableCell>
                            </TableRow>
                          ))}
                          {shownItems.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={4} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                                Không có dòng nào.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </SectionCard>
                )}

                {totalCount === 0 && (
                  <Alert severity="info" sx={{ mb: 2 }}>Tủ đang trống, không có gì để đếm.</Alert>
                )}

                <TextField
                  label="Ghi chú (không bắt buộc)"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  multiline
                  minRows={2}
                  fullWidth
                  sx={{ mb: 2, bgcolor: '#fff' }}
                />

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mb: 3 }}>
                  <Button
                    color="error"
                    onClick={() => setConfirm('cancel')}
                    disabled={saving}
                    sx={{ textTransform: 'none', fontWeight: 700 }}
                  >
                    Hủy phiên kiểm kê
                  </Button>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    {!allChecked && (
                      <Typography variant="body2" color="text.secondary">
                        Còn {totalCount - checkedCount} dòng chưa kiểm
                      </Typography>
                    )}
                    <Button
                      variant="contained"
                      startIcon={<DoneIcon />}
                      onClick={() => setConfirm('complete')}
                      disabled={saving || !allChecked}
                      sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#0058be' }}
                    >
                      Gửi kết quả
                    </Button>
                  </Stack>
                </Box>
              </>
            )}

            {submitted && (
              <SectionCard
                title="Kết quả đếm chờ duyệt"
                subtitle={`Gửi bởi ${audit.auditorName || 'nhân viên lab'}${audit.submittedAt ? ` lúc ${formatDateTime(audit.submittedAt)}` : ''}. Tồn kho chưa thay đổi cho tới khi được duyệt.`}
              >
                <Box sx={{ p: 2 }}>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: '#faf9ff' }}>
                          <TableCell sx={headCellSx}>Vật tư</TableCell>
                          <TableCell align="right" sx={headCellSx}>Hệ thống</TableCell>
                          <TableCell align="right" sx={headCellSx}>Đếm được</TableCell>
                          <TableCell align="right" sx={headCellSx}>Lệch</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(audit.submittedCounts || []).length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} sx={{ color: 'text.secondary' }}>Tủ không có vật tư tiêu hao.</TableCell>
                          </TableRow>
                        )}
                        {(audit.submittedCounts || []).map((line) => (
                          <TableRow key={line.componentId}>
                            <TableCell sx={{ fontWeight: 600 }}>{line.componentName}</TableCell>
                            <TableCell align="right">{line.systemQuantity}</TableCell>
                            <TableCell align="right">{line.countedQuantity}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700, color: diffColor(line.difference) }}>
                              {formatDiff(line.difference)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  <Typography sx={{ fontWeight: 700, fontSize: 14, mt: 2, mb: 1 }}>
                    Thiết bị báo thiếu ({(audit.missingItems || []).length})
                  </Typography>
                  {(audit.missingItems || []).length === 0 ? (
                    <Typography variant="body2" color="text.secondary">Không có thiết bị nào bị báo thiếu.</Typography>
                  ) : (
                    <Stack spacing={0.5}>
                      {audit.missingItems.map((item) => (
                        <Typography key={item.itemId} variant="body2">
                          <strong>{item.itemCode}</strong> · {item.componentName}
                          {item.serialNumber ? ` · S/N ${item.serialNumber}` : ''}
                        </Typography>
                      ))}
                    </Stack>
                  )}

                  {audit.note && (
                    <Alert severity="info" sx={{ mt: 2, whiteSpace: 'pre-wrap' }}>Ghi chú: {audit.note}</Alert>
                  )}

                  {canReview && (
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', flexWrap: 'wrap', mt: 2 }}>
                      {isOwnCount && (
                        <Typography variant="body2" sx={{ color: '#b45309', mr: 'auto', alignSelf: 'center' }}>
                          Bạn là người đã đếm tủ này, cần một người khác duyệt.
                        </Typography>
                      )}
                      <Button
                        variant="outlined"
                        disabled={saving || isOwnCount}
                        onClick={() => { setReviewText(''); setReview('recount') }}
                        sx={{ textTransform: 'none', fontWeight: 700 }}
                      >
                        Trả về đếm lại
                      </Button>
                      <Button
                        variant="contained"
                        disabled={saving || isOwnCount}
                        onClick={() => { setReviewText(''); setReview('approve') }}
                        sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#0058be' }}
                      >
                        Duyệt kết quả
                      </Button>
                    </Box>
                  )}
                  {!canReview && <Alert severity="info" sx={{ mt: 2 }}>Đang chờ quản lý kho duyệt.</Alert>}
                </Box>
              </SectionCard>
            )}

            {!inProgress && !submitted && (
              <>
                {audit.reviewNote && (
                  <Alert severity="info" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>
                    Ghi chú duyệt{audit.reviewedByName ? ` của ${audit.reviewedByName}` : ''}: {audit.reviewNote}
                  </Alert>
                )}
                {(audit.reservationShortages || []).length > 0 && (
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    Lab đang thiếu hàng cho các đơn đã duyệt:{' '}
                    {audit.reservationShortages
                      .map((line) => `${line.componentName} (còn ${line.inStock}, cần ${line.reserved}: ${(line.requestCodes || []).join(', ')})`)
                      .join('; ')}
                  </Alert>
                )}
                {audit.note && (
                  <Alert severity="info" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>Ghi chú: {audit.note}</Alert>
                )}
                <SectionCard title={`Chênh lệch đã ghi sổ kho (${(audit.differences || []).length})`}>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: '#faf9ff' }}>
                          {['Loại', 'Linh kiện', 'Serial', 'Thay đổi', 'Lý do'].map((head) => (
                            <TableCell key={head} sx={headCellSx}>{head}</TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(audit.differences || []).map((line) => (
                          <TableRow key={line.transactionId}>
                            <TableCell>{line.type === 'Retire' ? 'Thất lạc' : TRANSACTION_TYPES[line.type] || line.type}</TableCell>
                            <TableCell>{line.componentName}</TableCell>
                            <TableCell>{line.serialNumber || '—'}</TableCell>
                            <TableCell sx={{ fontWeight: 700, color: diffColor(line.quantityChange) }}>
                              {formatDiff(line.quantityChange)}
                            </TableCell>
                            <TableCell>{line.reason || '—'}</TableCell>
                          </TableRow>
                        ))}
                        {(audit.differences || []).length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                              Không có chênh lệch, số đếm khớp hệ thống.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </SectionCard>
              </>
            )}

            {lostItems.length > 0 && (
              <SectionCard
                title={`Thiết bị thất lạc của tủ này (${lostItems.length})`}
                subtitle={canRestore ? 'Tìm thấy lại thì bấm Khôi phục để đưa về kho.' : 'Tìm thấy lại thì báo quản lý kho khôi phục.'}
              >
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#fffbeb' }}>
                        {['Linh kiện', 'Mã thiết bị', 'Serial', ''].map((head) => (
                          <TableCell key={head} sx={headCellSx}>{head}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {lostItems.map((item) => (
                        <TableRow key={item.itemId} hover>
                          <TableCell>{item.componentName}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{item.itemCode}</TableCell>
                          <TableCell>{item.serialNumber || '—'}</TableCell>
                          <TableCell align="right">
                            {canRestore && (
                              <Button
                                size="small"
                                variant="outlined"
                                color="success"
                                startIcon={<RestoreIcon />}
                                disabled={restoringId === item.itemId}
                                onClick={() => handleRestoreLostItem(item)}
                                sx={{ textTransform: 'none', fontWeight: 700 }}
                              >
                                {restoringId === item.itemId ? 'Đang khôi phục...' : 'Khôi phục'}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </SectionCard>
            )}
          </>
        )}
      </Box>

      <Dialog open={Boolean(confirm)} onClose={() => !saving && setConfirm(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 800 }}>
          {confirm === 'cancel' ? 'Hủy phiên kiểm kê?' : 'Gửi kết quả kiểm kê?'}
        </DialogTitle>
        <DialogContent>
          {confirm === 'cancel' ? (
            <Typography variant="body2">Phiên kiểm kê sẽ bị hủy, tồn kho không thay đổi.</Typography>
          ) : (
            <Stack spacing={1}>
              <Typography variant="body2">
                • <strong>{diffLines.length}</strong> loại vật tư lệch so với hệ thống.
              </Typography>
              <Typography variant="body2">
                • <strong>{missingIds.length}</strong> thiết bị báo thiếu, sẽ chuyển sang Thất lạc khi được duyệt.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Tồn kho chỉ thay đổi sau khi quản lý kho duyệt.
              </Typography>
            </Stack>
          )}
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

      <Dialog open={Boolean(review)} onClose={() => !saving && setReview(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 800 }}>
          {review === 'approve' ? 'Duyệt kết quả kiểm kê?' : 'Trả về đếm lại?'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {review === 'approve'
              ? 'Vật tư lệch được điều chỉnh theo số đếm, thiết bị báo thiếu chuyển sang Thất lạc, mọi thay đổi ghi vào sổ kho.'
              : 'Nhân viên lab sẽ đếm lại từ đầu. Tồn kho không thay đổi.'}
          </Typography>
          <TextField
            fullWidth
            multiline
            minRows={2}
            label={review === 'approve' ? 'Ghi chú (không bắt buộc)' : 'Lý do đếm lại *'}
            value={reviewText}
            onChange={(event) => setReviewText(event.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setReview(null)} disabled={saving}>Đóng</Button>
          <Button
            variant="contained"
            onClick={submitReview}
            disabled={saving || (review === 'recount' && !reviewText.trim())}
          >
            {saving ? 'Đang xử lý...' : review === 'approve' ? 'Duyệt' : 'Trả về đếm lại'}
          </Button>
        </DialogActions>
      </Dialog>
    </PortalLayout>
  )
}
