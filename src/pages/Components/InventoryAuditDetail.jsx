import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowBack as BackIcon,
  Done as DoneIcon,
  Restore as RestoreIcon,
} from '@mui/icons-material'
import {
  Alert,
  Autocomplete,
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
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import PortalLayout from '../../components/layout/PortalLayout'
import { inventoryService } from '../../services/inventoryService'
import { extractErrorMessage } from '../../services/api'
import { TRANSACTION_TYPES, auditStatusOf, formatDateTime, rowsOf } from './inventoryLabels'
import { normalizeSearchText } from './componentHelpers'

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
  const [presentIds, setPresentIds] = useState({})
  const [checkedOrder, setCheckedOrder] = useState([])
  const [tab, setTab] = useState('checked')
  const [selected, setSelected] = useState(null)
  const [quantityInput, setQuantityInput] = useState('')
  const [searchKey, setSearchKey] = useState(0)
  const [scanMessage, setScanMessage] = useState('')
  const searchRef = useRef(null)
  const quantityRef = useRef(null)
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
    setPresentIds({})
    setCheckedOrder([])
    setSelected(null)
    setQuantityInput('')
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

  const searchOptions = useMemo(
    () => [
      ...consumables.map((line) => ({
        key: `c:${line.componentId}`,
        kind: 'consumable',
        name: line.componentName,
        detail: `Hệ thống: ${line.systemQuantity}`,
        searchText: normalizeSearchText(`${line.componentName} ${line.componentCode || ''}`),
        line,
      })),
      ...items.map((item) => ({
        key: `i:${item.itemId}`,
        kind: 'item',
        name: item.componentName,
        detail: [item.itemCode, item.serialNumber && `S/N ${item.serialNumber}`].filter(Boolean).join(' · '),
        searchText: normalizeSearchText(`${item.componentName} ${item.itemCode || ''} ${item.serialNumber || ''}`),
        item,
      })),
    ],
    [consumables, items]
  )

  const countedOf = (line) => {
    const raw = counts[line.componentId]
    if (raw === undefined) return null
    return Number(raw)
  }

  const differenceOf = (line) => {
    const counted = countedOf(line)
    if (counted === null) return null
    return counted - Number(line.systemQuantity)
  }

  const isChecked = (option) => {
    if (option.kind === 'consumable') return countedOf(option.line) !== null
    return Boolean(presentIds[option.item.itemId])
  }

  const optionsByKey = new Map(searchOptions.map((option) => [option.key, option]))
  const checkedOptions = checkedOrder.map((key) => optionsByKey.get(key)).filter(Boolean)
  const uncheckedOptions = searchOptions.filter((option) => !isChecked(option))
  const checkedCount = searchOptions.length - uncheckedOptions.length
  const totalCount = searchOptions.length

  const diffLines = consumables.filter((line) => {
    const difference = differenceOf(line)
    return difference !== null && difference !== 0
  })
  const uncountedLines = consumables.filter((line) => countedOf(line) === null)
  const missingIds = items.filter((item) => !presentIds[item.itemId]).map((item) => item.itemId)
  const diffOptions = checkedOptions.filter(
    (option) => option.kind === 'consumable' && differenceOf(option.line) !== 0
  )

  const markChecked = (key) => {
    setCheckedOrder((current) => [key, ...current.filter((existing) => existing !== key)])
  }

  const unmark = (option) => {
    if (option.kind === 'consumable') {
      setCounts((current) => {
        const next = { ...current }
        delete next[option.line.componentId]
        return next
      })
    } else {
      setPresentIds((current) => {
        const next = { ...current }
        delete next[option.item.itemId]
        return next
      })
    }
    setCheckedOrder((current) => current.filter((key) => key !== option.key))
  }

  const focusSearch = () => {
    setSearchKey((key) => key + 1)
    window.setTimeout(() => searchRef.current?.focus(), 0)
  }

  const pickOption = (option) => {
    if (!option) return
    if (option.kind === 'item') {
      if (presentIds[option.item.itemId]) {
        setScanMessage(`${option.item.itemCode} đã được ghi nhận trước đó.`)
      } else {
        setPresentIds((current) => ({ ...current, [option.item.itemId]: true }))
        markChecked(option.key)
        setScanMessage(`Có mặt: ${option.name} (${option.item.itemCode})`)
      }
      focusSearch()
      return
    }
    setSelected(option)
    const current = counts[option.line.componentId]
    setQuantityInput(current === undefined ? '' : String(current))
    setScanMessage('')
    window.setTimeout(() => quantityRef.current?.focus(), 0)
  }

  const saveQuantity = () => {
    if (!selected || quantityInput === '') return
    setCounts((current) => ({ ...current, [selected.line.componentId]: Number(quantityInput) }))
    markChecked(selected.key)
    setScanMessage(`Đã ghi ${selected.name}: ${quantityInput}`)
    setSelected(null)
    setQuantityInput('')
    focusSearch()
  }

  let shownOptions = checkedOptions
  if (tab === 'unchecked') shownOptions = uncheckedOptions
  if (tab === 'diff') shownOptions = diffOptions

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
          countedQuantity: countedOf(line) ?? 0,
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
                  <CardContent>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'flex-start' }}>
                      <Autocomplete
                        key={searchKey}
                        options={searchOptions}
                        autoHighlight
                        openOnFocus={false}
                        value={null}
                        onChange={(_event, option) => pickOption(option)}
                        getOptionLabel={(option) => option.name}
                        getOptionKey={(option) => option.key}
                        filterOptions={(options, state) => {
                          const query = normalizeSearchText(state.inputValue)
                          if (!query) return []
                          return options.filter((option) => option.searchText.includes(query)).slice(0, 20)
                        }}
                        noOptionsText="Không có món này trong tủ"
                        renderOption={(props, option) => {
                          const { key, ...rest } = props
                          return (
                            <Box component="li" key={key} {...rest} sx={{ display: 'block !important' }}>
                              <Typography sx={{ fontWeight: 600, fontSize: 14 }}>
                                {option.name}
                                {isChecked(option) && (
                                  <Box component="span" sx={{ color: '#2e7d32', fontSize: 12, ml: 1 }}>đã kiểm</Box>
                                )}
                              </Typography>
                              <Typography sx={{ fontSize: 12, color: '#64748b' }}>{option.detail}</Typography>
                            </Box>
                          )
                        }}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            inputRef={searchRef}
                            autoFocus
                            placeholder="Gõ tên linh kiện hoặc quét mã thiết bị"
                          />
                        )}
                        sx={{ flex: 1, minWidth: 0 }}
                      />
                      {selected && (
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography sx={{ fontWeight: 600, fontSize: 14, maxWidth: 200 }} noWrap title={selected.name}>
                            {selected.name}
                          </Typography>
                          <TextField
                            inputRef={quantityRef}
                            size="small"
                            placeholder="Số đếm"
                            value={quantityInput}
                            onChange={(event) => {
                              const value = event.target.value
                              if (value === '' || /^\d+$/.test(value)) setQuantityInput(value)
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') saveQuantity()
                              if (event.key === 'Escape') {
                                setSelected(null)
                                focusSearch()
                              }
                            }}
                            slotProps={{ htmlInput: { inputMode: 'numeric' } }}
                            sx={{ width: 100 }}
                          />
                          <Button
                            variant="contained"
                            onClick={saveQuantity}
                            disabled={quantityInput === ''}
                            sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#0058be' }}
                          >
                            Ghi
                          </Button>
                        </Stack>
                      )}
                    </Stack>
                    {scanMessage && (
                      <Typography sx={{ fontSize: 13, color: '#2e7d32', mt: 1 }}>{scanMessage}</Typography>
                    )}
                    <Box sx={{ mt: 2 }}>
                      <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 0.5 }}>
                        Đã kiểm {checkedCount}/{totalCount}
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={totalCount === 0 ? 100 : (checkedCount * 100) / totalCount}
                        sx={{ height: 6, borderRadius: 3 }}
                      />
                    </Box>
                  </CardContent>
                </Card>

                <Card variant="outlined" sx={{ mb: 2, borderColor: '#d8dced', boxShadow: 'none' }}>
                  <Tabs value={tab} onChange={(_event, value) => setTab(value)} sx={{ px: 1, borderBottom: '1px solid #eef0f6' }}>
                    <Tab value="checked" label={`Đã kiểm (${checkedOptions.length})`} sx={{ textTransform: 'none', fontWeight: 700 }} />
                    <Tab value="unchecked" label={`Chưa kiểm (${uncheckedOptions.length})`} sx={{ textTransform: 'none', fontWeight: 700 }} />
                    <Tab value="diff" label={`Lệch (${diffOptions.length})`} sx={{ textTransform: 'none', fontWeight: 700 }} />
                  </Tabs>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: '#faf9ff' }}>
                          <TableCell sx={headCellSx}>Linh kiện</TableCell>
                          <TableCell align="right" sx={headCellSx}>Hệ thống</TableCell>
                          <TableCell align="right" sx={headCellSx}>Thực tế</TableCell>
                          <TableCell align="right" sx={headCellSx}>Lệch</TableCell>
                          <TableCell />
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {shownOptions.map((option) => {
                          const checked = isChecked(option)
                          let system = 1
                          let actual = '—'
                          let difference = null
                          if (option.kind === 'consumable') {
                            system = option.line.systemQuantity
                            difference = differenceOf(option.line)
                            if (checked) actual = countedOf(option.line)
                          } else if (checked) {
                            actual = 1
                            difference = 0
                          }
                          return (
                            <TableRow key={option.key} hover>
                              <TableCell>
                                <Typography sx={{ fontWeight: 600, fontSize: 13.5 }}>{option.name}</Typography>
                                {option.kind === 'item' && (
                                  <Typography sx={{ fontSize: 12, color: '#64748b' }}>{option.detail}</Typography>
                                )}
                              </TableCell>
                              <TableCell align="right">{system}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700 }}>{actual}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700, color: diffColor(difference) }}>
                                {formatDiff(difference)}
                              </TableCell>
                              <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                {option.kind === 'consumable' && (
                                  <Button size="small" onClick={() => pickOption(option)} sx={{ textTransform: 'none' }}>
                                    {checked ? 'Sửa' : 'Đếm'}
                                  </Button>
                                )}
                                {option.kind === 'item' && !checked && (
                                  <Button size="small" onClick={() => pickOption(option)} sx={{ textTransform: 'none' }}>
                                    Có mặt
                                  </Button>
                                )}
                                {checked && (
                                  <Button size="small" color="inherit" onClick={() => unmark(option)} sx={{ textTransform: 'none', color: '#64748b' }}>
                                    Bỏ
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                        {shownOptions.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                              {tab === 'checked' && 'Chưa kiểm món nào. Gõ tên hoặc quét mã ở ô phía trên để bắt đầu.'}
                              {tab === 'unchecked' && (totalCount === 0 ? 'Tủ đang trống.' : 'Đã kiểm hết.')}
                              {tab === 'diff' && 'Chưa có món nào lệch.'}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Card>

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
                    <Button
                      variant="contained"
                      startIcon={<DoneIcon />}
                      onClick={() => setConfirm('complete')}
                      disabled={saving || checkedCount === 0}
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
              {uncountedLines.length > 0 && (
                <Typography variant="body2" sx={{ color: '#b45309' }}>
                  • <strong>{uncountedLines.length}</strong> loại vật tư chưa đếm sẽ tính là <strong>0</strong>.
                </Typography>
              )}
              <Typography variant="body2" sx={{ color: missingIds.length > 0 ? '#b45309' : undefined }}>
                • <strong>{missingIds.length}</strong> thiết bị chưa ghi nhận có mặt sẽ báo <strong>thiếu</strong> (chuyển sang Thất lạc khi được duyệt).
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
