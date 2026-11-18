import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowBack as BackIcon,
  CloudUpload as UploadIcon,
  Done as DoneIcon,
  Download as DownloadIcon,
  Restore as RestoreIcon,
  Sync as SyncIcon,
  WarningAmber as WarningIcon,
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
  MenuItem,
  Stack,
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
import {
  TRANSACTION_TYPES,
  auditStatusOf,
  formatDateTime,
  itemStatusOf,
  rowsOf,
} from './inventoryLabels'
import {
  downloadInventoryAuditTemplate,
  parseInventoryAuditExcel,
} from '../../utils/excelHelper'
import { normalizeSearchText } from './componentHelpers'

const headCellSx = { fontWeight: 700, color: '#334155' }

const DEVICE_AUDIT_STATE_OPTIONS = [
  { value: 'present', label: 'Có mặt (Khớp tủ)', color: 'success' },
  { value: 'pending', label: 'Chờ xác minh (Chưa loại khỏi kho)', color: 'warning' },
  { value: 'lost', label: 'Thất lạc (Lưu theo dõi, có thể khôi phục)', color: 'error' },
]

function SectionCard({ title, subtitle, actions, children }) {
  return (
    <Card variant="outlined" sx={{ borderColor: '#d8dced', boxShadow: 'none', mb: 2 }}>
      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderBottom: '1px solid #eef0f6',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 1.5,
        }}
      >
        <Box>
          <Typography sx={{ fontWeight: 800, color: '#182238' }}>{title}</Typography>
          {subtitle && <Typography sx={{ color: '#697386', fontSize: 12 }}>{subtitle}</Typography>}
        </Box>
        {actions && <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>{actions}</Box>}
      </Box>
      {children}
    </Card>
  )
}

/**
 * Chi tiết 1 phiên kiểm kê tủ:
 * - Đồng bộ tồn kho thời gian thực (Realtime) của tủ với tồn snapshot lúc mở phiên để phát hiện & xử lý nhanh sai lệch (VD: 260 vs 239).
 * - Hỗ trợ xuất/nhập kết quả kiểm kê bằng file Excel Template (.xlsx) thay vì nhập tay từng dòng.
 * - Thiết bị cá biệt hỗ trợ 3 trạng thái kiểm kê (Có mặt / Chờ xác minh / Thất lạc) — KHÔNG xóa mã thiết bị khỏi hệ thống,
 *   kèm danh sách thiết bị đang thất lạc ở tủ để khôi phục về kho 1 chạm khi tìm lại được.
 */
export default function InventoryAuditDetail() {
  const { auditId } = useParams()
  const navigate = useNavigate()
  const [audit, setAudit] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [counts, setCounts] = useState({})
  const [itemStates, setItemStates] = useState({})
  const [deviceQuery, setDeviceQuery] = useState('')
  const [note, setNote] = useState('')
  const [confirm, setConfirm] = useState(null)
  const [saving, setSaving] = useState(false)

  // Dữ liệu đồng bộ realtime từ tủ (tồn vật tư hiện tại & danh sách thiết bị đang báo thất lạc trong hệ thống)
  const [liveStockMap, setLiveStockMap] = useState(() => new Map())
  const [cabinetContentMap, setCabinetContentMap] = useState(() => new Map())
  const [lostItems, setLostItems] = useState([])
  const [syncingLive, setSyncingLive] = useState(false)
  const [restoringId, setRestoringId] = useState('')

  const fetchLiveCabinetState = useCallback(async (cabinetId) => {
    if (!cabinetId) return new Map()
    setSyncingLive(true)
    try {
      const [consRes, cabData, lostRes] = await Promise.all([
        inventoryService.getConsumableStocks({ cabinetId, page: 1, size: 500 }).catch(() => []),
        inventoryService.getCabinet(cabinetId).catch(() => null),
        inventoryService.getComponentItems({ cabinetId, status: 'Lost', page: 1, size: 100 }).catch(() => []),
      ])

      const nextLiveMap = new Map()
      rowsOf(consRes).forEach((stock) => {
        if (stock?.componentId) {
          nextLiveMap.set(stock.componentId, Number(stock.quantity ?? 0))
        }
      })

      const nextContentMap = new Map()
      const contents =
        cabData?.contents || cabData?.Contents || cabData?.components || cabData?.stocks || []
      if (Array.isArray(contents)) {
        contents.forEach((row) => {
          if (row?.componentId) {
            nextContentMap.set(row.componentId, {
              totalQuantity: Number(row.totalQuantity ?? row.quantity ?? 0),
              availableQuantity: Number(row.availableQuantity ?? row.totalQuantity ?? row.quantity ?? 0),
            })
            if (!nextLiveMap.has(row.componentId) && row.trackingType === 'CONSUMABLE') {
              nextLiveMap.set(row.componentId, Number(row.totalQuantity ?? row.quantity ?? 0))
            }
          }
        })
      }

      setLiveStockMap(nextLiveMap)
      setCabinetContentMap(nextContentMap)
      setLostItems(rowsOf(lostRes))
      return nextLiveMap
    } finally {
      setSyncingLive(false)
    }
  }, [])

  const applyAudit = useCallback(
    async (data, preserveInputs = false) => {
      setAudit(data)
      if (!preserveInputs) {
        setCounts(
          Object.fromEntries(
            (data.consumables || []).map((line) => [line.componentId, String(line.systemQuantity)])
          )
        )
        setItemStates(
          Object.fromEntries((data.items || []).map((item) => [item.itemId, 'present']))
        )
        setNote(data.note || '')
      }
      if (data?.cabinetId) {
        await fetchLiveCabinetState(data.cabinetId)
      }
    },
    [fetchLiveCabinetState]
  )

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
  const consumables = useMemo(() => audit?.consumables || [], [audit])
  const items = useMemo(() => audit?.items || [], [audit])

  // Phát hiện các dòng có chênh lệch giữa snapshot lúc mở phiên và tồn tủ realtime hiện tại
  const driftedConsumables = useMemo(() => {
    return consumables.filter((line) => {
      if (!liveStockMap.has(line.componentId)) return false
      return liveStockMap.get(line.componentId) !== Number(line.systemQuantity)
    })
  }, [consumables, liveStockMap])

  const invalidCount = consumables.some((line) => {
    const raw = counts[line.componentId]
    if (raw === '' || raw === undefined) return true
    const value = Number(raw)
    return !Number.isInteger(value) || value < 0
  })

  const changedConsumables = consumables.filter((line) => {
    const raw = counts[line.componentId]
    if (raw === '' || raw === undefined) return false
    return Number(raw) !== Number(line.systemQuantity)
  })

  // Phân loại thiết bị cá biệt theo 3 trạng thái: Có mặt / Chờ xác minh / Thất lạc
  const lostSelectedIds = useMemo(
    () => items.filter((item) => itemStates[item.itemId] === 'lost').map((item) => item.itemId),
    [items, itemStates]
  )
  const pendingVerifyItems = useMemo(
    () => items.filter((item) => itemStates[item.itemId] === 'pending'),
    [items, itemStates]
  )
  const presentCount = items.length - lostSelectedIds.length - pendingVerifyItems.length

  // Lọc danh sách thiết bị theo từ khóa tìm kiếm
  const filteredItems = useMemo(() => {
    const q = normalizeSearchText(deviceQuery)
    if (!q) return items
    return items.filter((item) =>
      normalizeSearchText(`${item.itemCode || ''} ${item.componentName || ''} ${item.serialNumber || ''}`).includes(q)
    )
  }, [items, deviceQuery])

  // Tổng hợp số lượng vật tư tiêu hao
  const consumableTotals = useMemo(() => {
    let totalSystem = 0
    let totalLive = 0
    let totalCounted = 0
    consumables.forEach((line) => {
      const sys = Number(line.systemQuantity || 0)
      const live = liveStockMap.has(line.componentId) ? liveStockMap.get(line.componentId) : sys
      const raw = counts[line.componentId]
      const cnt = raw !== '' && raw !== undefined && Number.isInteger(Number(raw)) ? Number(raw) : sys
      totalSystem += sys
      totalLive += live
      totalCounted += cnt
    })
    return {
      totalSystem,
      totalLive,
      totalCounted,
      totalDiff: totalCounted - totalSystem,
    }
  }, [consumables, liveStockMap, counts])

  const status = auditStatusOf(audit?.status)

  // Làm mới dữ liệu phiên kiểm kê và tồn kho thực tế tại tủ
  const handleRefreshSync = async () => {
    if (!audit) return
    setError('')
    try {
      const freshAudit = await inventoryService.getInventoryAudit(auditId)
      await applyAudit(freshAudit, true)
      setNotice('Đã làm mới và đồng bộ dữ liệu tồn kho mới nhất từ tủ.')
    } catch (refreshErr) {
      setError(extractErrorMessage(refreshErr, 'Không thể đồng bộ lại tồn kho tủ.'))
    }
  }

  // Đồng bộ toàn bộ cột "Đếm thực tế" theo tồn tủ realtime hiện tại (không cần gõ tay từng dòng)
  const handleSyncCountsToLive = () => {
    const next = {}
    consumables.forEach((line) => {
      const liveVal = liveStockMap.has(line.componentId)
        ? liveStockMap.get(line.componentId)
        : line.systemQuantity
      next[line.componentId] = String(liveVal)
    })
    setCounts(next)
    setNotice('Đã đồng bộ toàn bộ số đếm thực tế theo tồn kho hiện tại trong tủ.')
  }

  // Khớp toàn bộ cột "Đếm thực tế" bằng số hệ thống (snapshot)
  const handleResetCountsToSystem = () => {
    setCounts(
      Object.fromEntries(consumables.map((line) => [line.componentId, String(line.systemQuantity)]))
    )
    setNotice('Đã đặt lại toàn bộ số đếm khớp với số hệ thống lúc mở phiên.')
  }

  // Nhập kết quả kiểm kê từ file Excel (.xlsx / .csv)
  const handleImportAuditExcel = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError('')
    try {
      const parsed = await parseInventoryAuditExcel(file)
      let matchedCons = 0
      let matchedItems = 0

      if (parsed.consumables.length > 0) {
        setCounts((current) => {
          const next = { ...current }
          parsed.consumables.forEach((row) => {
            const normCode = normalizeSearchText(row.componentCode)
            const normName = normalizeSearchText(row.componentName)
            const target = consumables.find(
              (line) =>
                (normCode && normalizeSearchText(line.componentCode) === normCode) ||
                (normName && normalizeSearchText(line.componentName) === normName)
            )
            const val = Number(row.countedQuantity)
            if (target && Number.isInteger(val) && val >= 0) {
              next[target.componentId] = String(val)
              matchedCons += 1
            }
          })
          return next
        })
      }

      if (parsed.items.length > 0) {
        setItemStates((current) => {
          const next = { ...current }
          parsed.items.forEach((row) => {
            const normCode = normalizeSearchText(row.itemCode)
            const target = items.find((it) => normalizeSearchText(it.itemCode) === normCode)
            if (target) {
              next[target.itemId] = row.auditState
              matchedItems += 1
            }
          })
          return next
        })
      }

      setNotice(
        `Đã đọc kết quả kiểm kê từ "${file.name}": cập nhật ${matchedCons} dòng vật tư và ${matchedItems} thiết bị cá biệt.`
      )
    } catch (parseErr) {
      setError(`Không thể đọc file Excel kiểm kê: ${parseErr.message || 'Định dạng không hợp lệ.'}`)
    }
  }

  // Khôi phục thiết bị đang báo thất lạc (Lost) về trạng thái Sẵn sàng (Available) ngay tại màn kiểm kê
  const handleRestoreLostItem = async (item) => {
    setRestoringId(item.itemId)
    setError('')
    try {
      await inventoryService.moveComponentItems({
        componentId: item.componentId,
        fromCabinetId: item.cabinetId || audit?.cabinetId,
        fromStatus: 'Lost',
        quantity: 1,
        itemIds: [item.itemId],
        toStatus: 'Available',
        reason: 'Tìm thấy lại thiết bị và khôi phục về kho',
      })
      setNotice(`Đã khôi phục thiết bị ${item.itemCode} về trạng thái Sẵn sàng trong kho.`)
      const freshAudit = await inventoryService.getInventoryAudit(auditId)
      await applyAudit(freshAudit, true)
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
      // Ghi nhận các thiết bị ở trạng thái "Chờ xác minh" vào ghi chú biên bản (KHÔNG loại khỏi kho)
      let finalNote = note.trim()
      if (pendingVerifyItems.length > 0) {
        const pendingCodes = pendingVerifyItems.map((it) => it.itemCode).join(', ')
        const tag = `[Chờ xác minh - chưa báo mất: ${pendingCodes}]`
        finalNote = finalNote ? `${finalNote}\n${tag}` : tag
      }

      await inventoryService.completeInventoryAudit(auditId, {
        consumables: consumables.map((line) => ({
          componentId: line.componentId,
          countedQuantity: Number(counts[line.componentId]),
        })),
        missingItemIds: lostSelectedIds,
        note: finalNote || null,
      })

      // Tải lại toàn bộ phiên kiểm kê + tồn tủ realtime + danh sách thiết bị thất lạc để đảm bảo đồng bộ 100%
      const refreshed = await inventoryService.getInventoryAudit(auditId)
      await applyAudit(refreshed)
      setNotice('Hoàn tất kiểm kê và đã đồng bộ số liệu với sổ kho.')
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
    <PortalLayout
      headerTitle="Phiên kiểm kê"
      headerSubtitle="Đối chiếu tồn kho thực tế, đồng bộ số liệu tủ và quản lý thiết bị thất lạc không mất dữ liệu"
    >
      <Box sx={{ maxWidth: 1280, mx: 'auto' }}>
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
          <Button
            startIcon={<BackIcon />}
            onClick={() => navigate('/class-setup/admin/inventory-audits')}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Danh sách kiểm kê
          </Button>
          {audit && (
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Button
                size="small"
                variant="outlined"
                startIcon={<SyncIcon />}
                disabled={syncingLive}
                onClick={handleRefreshSync}
                sx={{ textTransform: 'none', fontWeight: 600 }}
              >
                {syncingLive ? 'Đang đồng bộ...' : 'Làm mới & đồng bộ tồn tủ'}
              </Button>
              {audit.cabinetId && (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => navigate(`/class-setup/admin/cabinets/${audit.cabinetId}`)}
                  sx={{ textTransform: 'none', fontWeight: 600 }}
                >
                  Xem chi tiết tủ
                </Button>
              )}
            </Stack>
          )}
        </Box>

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
                  <Typography variant="h6" fontWeight={800}>
                    {audit.cabinetCode} · {audit.cabinetName}
                  </Typography>
                  <Typography color="text.secondary" fontSize={13.5}>
                    Lab {audit.roomCode} · Người kiểm: {audit.auditorName} · Mở lúc {formatDateTime(audit.auditDate)}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  {inProgress && (
                    <>
                      <Chip
                        size="small"
                        label={`Vật tư: ${consumableTotals.totalCounted}/${consumableTotals.totalSystem}`}
                        color={consumableTotals.totalDiff === 0 ? 'success' : 'warning'}
                        variant="outlined"
                        sx={{ fontWeight: 700 }}
                      />
                      <Chip
                        size="small"
                        label={`Thiết bị: ${presentCount} có mặt · ${pendingVerifyItems.length} chờ XM · ${lostSelectedIds.length} thất lạc`}
                        variant="outlined"
                        sx={{ fontWeight: 600 }}
                      />
                    </>
                  )}
                  <Chip label={status.label} color={status.color} sx={{ fontWeight: 700 }} />
                </Stack>
              </CardContent>
            </Card>

            {inProgress ? (
              <>
                {/* Cảnh báo lệch đồng bộ giữa snapshot lúc mở phiên và tồn tủ realtime hiện tại */}
                {driftedConsumables.length > 0 && (
                  <Alert
                    severity="warning"
                    icon={<WarningIcon />}
                    sx={{ mb: 2 }}
                    action={
                      <Button
                        size="small"
                        color="inherit"
                        variant="outlined"
                        onClick={handleSyncCountsToLive}
                        sx={{ textTransform: 'none', fontWeight: 700, whiteSpace: 'nowrap' }}
                      >
                        Đồng bộ theo tồn hiện tại
                      </Button>
                    }
                  >
                    <strong>Phát hiện lệch đồng bộ tồn kho ({driftedConsumables.length} loại vật tư):</strong> Tồn kho
                    hiện tại trong tủ đã thay đổi so với thời điểm mở phiên kiểm kê (có thể do có giao dịch nhập/mượn/trả
                    phát sinh). Bấm <strong>&quot;Đồng bộ theo tồn hiện tại&quot;</strong> để tự động điền đúng số tồn thực tế
                    mà không cần nhập tay.
                  </Alert>
                )}

                <SectionCard
                  title={`Vật tư tiêu hao (${consumables.length})`}
                  subtitle="Đối chiếu số hệ thống lúc mở phiên, tồn tủ realtime hiện tại và số đếm thực tế (hỗ trợ nhập từ Excel)"
                  actions={
                    <>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<DownloadIcon />}
                        onClick={() => downloadInventoryAuditTemplate(audit, liveStockMap)}
                        sx={{
                          textTransform: 'none',
                          fontWeight: 700,
                          borderColor: '#16a34a',
                          color: '#15803d',
                          '&:hover': { bgcolor: '#f0fdf4', borderColor: '#15803d' },
                        }}
                      >
                        Xuất mẫu kiểm kê (.xlsx)
                      </Button>
                      <Button
                        size="small"
                        component="label"
                        variant="outlined"
                        startIcon={<UploadIcon />}
                        sx={{ textTransform: 'none', fontWeight: 700 }}
                      >
                        Nhập kết quả Excel
                        <input hidden type="file" accept=".xlsx,.xls,.csv" onChange={handleImportAuditExcel} />
                      </Button>
                      <Button
                        size="small"
                        variant="text"
                        onClick={handleSyncCountsToLive}
                        sx={{ textTransform: 'none', fontWeight: 600 }}
                      >
                        Điền theo tồn hiện tại
                      </Button>
                      <Button
                        size="small"
                        variant="text"
                        onClick={handleResetCountsToSystem}
                        sx={{ textTransform: 'none', fontWeight: 600 }}
                      >
                        Khớp hệ thống
                      </Button>
                    </>
                  }
                >
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: '#faf9ff' }}>
                          {[
                            'Linh kiện',
                            'Mã',
                            'Hệ thống (mở phiên)',
                            'Tồn tủ hiện tại (Realtime)',
                            'Đếm thực tế',
                            'Chênh lệch',
                          ].map((head) => (
                            <TableCell key={head} sx={headCellSx}>
                              {head}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {consumables.map((line) => {
                          const raw = counts[line.componentId]
                          const isBlank = raw === '' || raw === undefined
                          const counted = Number(raw)
                          const validVal = !isBlank && Number.isInteger(counted) && counted >= 0
                          const difference = validVal ? counted - Number(line.systemQuantity) : null
                          const liveQty = liveStockMap.has(line.componentId)
                            ? liveStockMap.get(line.componentId)
                            : Number(line.systemQuantity)
                          const cabInfo = cabinetContentMap.get(line.componentId)
                          const hasDrift = liveQty !== Number(line.systemQuantity)

                          return (
                            <TableRow
                              key={line.componentId}
                              sx={{ bgcolor: hasDrift ? '#fffbeb' : undefined }}
                            >
                              <TableCell sx={{ fontWeight: 600 }}>{line.componentName}</TableCell>
                              <TableCell sx={{ color: '#0058be', fontWeight: 600 }}>{line.componentCode}</TableCell>
                              <TableCell sx={{ fontWeight: 600 }}>{line.systemQuantity}</TableCell>
                              <TableCell>
                                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                                  <Typography
                                    sx={{
                                      fontWeight: 700,
                                      color: hasDrift ? '#b45309' : '#0f172a',
                                      fontSize: 13.5,
                                    }}
                                  >
                                    {liveQty}
                                  </Typography>
                                  {hasDrift && (
                                    <Chip
                                      size="small"
                                      label={`Lệch ${liveQty - Number(line.systemQuantity) > 0 ? '+' : ''}${liveQty - Number(line.systemQuantity)}`}
                                      color="warning"
                                      variant="outlined"
                                      onClick={() =>
                                        setCounts((cur) => ({ ...cur, [line.componentId]: String(liveQty) }))
                                      }
                                      sx={{ fontSize: 11, height: 22, cursor: 'pointer', fontWeight: 700 }}
                                      title="Bấm để điền số tồn tủ hiện tại vào ô Đếm thực tế"
                                    />
                                  )}
                                  {cabInfo && cabInfo.availableQuantity < cabInfo.totalQuantity && (
                                    <Typography sx={{ fontSize: 11, color: '#64748b' }}>
                                      (Khả dụng: {cabInfo.availableQuantity})
                                    </Typography>
                                  )}
                                </Stack>
                              </TableCell>
                              <TableCell>
                                <TextField
                                  size="small"
                                  type="number"
                                  value={counts[line.componentId] ?? ''}
                                  error={!validVal}
                                  helperText={!validVal ? 'Số nguyên ≥ 0' : ''}
                                  onKeyDown={(e) => {
                                    if (['-', '+', 'e', 'E', '.', ','].includes(e.key)) e.preventDefault()
                                  }}
                                  onChange={(event) => {
                                    const val = event.target.value
                                    if (val === '' || /^\d+$/.test(val)) {
                                      setCounts((current) => ({ ...current, [line.componentId]: val }))
                                    }
                                  }}
                                  slotProps={{ htmlInput: { min: 0, step: 1 } }}
                                  sx={{ width: 120 }}
                                />
                              </TableCell>
                              <TableCell
                                sx={{
                                  fontWeight: 700,
                                  color:
                                    difference === null
                                      ? '#94a3b8'
                                      : difference < 0
                                        ? '#c62828'
                                        : difference > 0
                                          ? '#2e7d32'
                                          : 'text.secondary',
                                }}
                              >
                                {difference === null ? '—' : difference > 0 ? `+${difference}` : difference}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                        {consumables.length > 0 && (
                          <TableRow sx={{ bgcolor: '#f8fafc' }}>
                            <TableCell colSpan={2} sx={{ fontWeight: 800 }}>
                              Tổng cộng ({consumables.length} loại vật tư)
                            </TableCell>
                            <TableCell sx={{ fontWeight: 800 }}>{consumableTotals.totalSystem}</TableCell>
                            <TableCell sx={{ fontWeight: 800 }}>{consumableTotals.totalLive}</TableCell>
                            <TableCell sx={{ fontWeight: 800 }}>{consumableTotals.totalCounted}</TableCell>
                            <TableCell
                              sx={{
                                fontWeight: 800,
                                color:
                                  consumableTotals.totalDiff < 0
                                    ? '#c62828'
                                    : consumableTotals.totalDiff > 0
                                      ? '#2e7d32'
                                      : 'text.secondary',
                              }}
                            >
                              {consumableTotals.totalDiff > 0
                                ? `+${consumableTotals.totalDiff}`
                                : consumableTotals.totalDiff}
                            </TableCell>
                          </TableRow>
                        )}
                        {consumables.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                              Tủ không có vật tư tiêu hao.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </SectionCard>

                <SectionCard
                  title={`Thiết bị cá biệt trong tủ (${items.length})`}
                  subtitle="Chọn trạng thái từng thiết bị. Thiết bị báo Thất lạc vẫn được giữ mã trong hệ thống để khôi phục khi tìm thấy; chọn 'Chờ xác minh' nếu chưa muốn đổi trạng thái kho."
                  actions={
                    <TextField
                      size="small"
                      placeholder="Tìm mã thiết bị, tên, serial..."
                      value={deviceQuery}
                      onChange={(e) => setDeviceQuery(e.target.value)}
                      sx={{ minWidth: 240, bgcolor: '#fff' }}
                    />
                  }
                >
                  <Alert severity="info" sx={{ mx: 2, mt: 1.5, mb: 1, py: 0.5 }}>
                    <strong>Lưu ý bảo toàn mã thiết bị:</strong> Khi chọn <strong>&quot;Chờ xác minh&quot;</strong>, thiết
                    bị giữ nguyên trạng thái <em>Sẵn sàng</em> và được ghi chú vào biên bản kiểm kê. Khi chọn{' '}
                    <strong>&quot;Thất lạc&quot;</strong>, thiết bị chuyển sang trạng thái <em>Thất lạc (chờ tìm lại)</em> —{' '}
                    <strong>không bị xóa khỏi hệ thống</strong> và có thể bấm <em>Khôi phục về kho</em> ngay khi tìm thấy.
                  </Alert>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: '#faf9ff' }}>
                          {['Mã thiết bị', 'Linh kiện', 'Serial', 'Kết quả kiểm kê'].map((head) => (
                            <TableCell key={head} sx={headCellSx}>
                              {head}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {filteredItems.map((item) => {
                          const currentState = itemStates[item.itemId] || 'present'
                          return (
                            <TableRow
                              key={item.itemId}
                              hover
                              sx={{
                                bgcolor:
                                  currentState === 'lost'
                                    ? '#fef2f2'
                                    : currentState === 'pending'
                                      ? '#fffbeb'
                                      : undefined,
                              }}
                            >
                              <TableCell sx={{ color: '#0058be', fontWeight: 700 }}>{item.itemCode}</TableCell>
                              <TableCell sx={{ fontWeight: 500 }}>{item.componentName}</TableCell>
                              <TableCell>{item.serialNumber || '—'}</TableCell>
                              <TableCell sx={{ minWidth: 270 }}>
                                <TextField
                                  select
                                  size="small"
                                  fullWidth
                                  value={currentState}
                                  onChange={(e) =>
                                    setItemStates((cur) => ({ ...cur, [item.itemId]: e.target.value }))
                                  }
                                >
                                  {DEVICE_AUDIT_STATE_OPTIONS.map((opt) => (
                                    <MenuItem key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </MenuItem>
                                  ))}
                                </TextField>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                        {filteredItems.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                              {items.length === 0
                                ? 'Tủ không có thiết bị quản lý theo từng chiếc.'
                                : 'Không tìm thấy thiết bị khớp từ khóa.'}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </SectionCard>

                <TextField
                  label="Ghi chú biên bản (không bắt buộc)"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  multiline
                  minRows={2}
                  fullWidth
                  sx={{ mb: 2, bgcolor: '#fff' }}
                />

                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1.5, flexWrap: 'wrap', mb: 3 }}>
                  <Button
                    color="error"
                    onClick={() => setConfirm('cancel')}
                    disabled={saving}
                    sx={{ textTransform: 'none', fontWeight: 700 }}
                  >
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
                    {audit.reservationShortages
                      .map(
                        (line) =>
                          `${line.componentName} (còn ${line.inStock}, cần ${line.reserved}: ${(line.requestCodes || []).join(', ')})`
                      )
                      .join('; ')}
                  </Alert>
                )}
                {audit.note && (
                  <Alert severity="info" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>
                    Ghi chú biên bản: {audit.note}
                  </Alert>
                )}
                <SectionCard
                  title={`Biên bản chênh lệch (${(audit.differences || []).length})`}
                  subtitle="Các dòng đã ghi nhận vào sổ kho bởi phiên kiểm kê này. Thiết bị thất lạc vẫn được lưu mã bên dưới để khôi phục khi tìm thấy."
                >
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: '#faf9ff' }}>
                          {['Loại giao dịch', 'Linh kiện', 'Serial', 'Thay đổi', 'Lý do'].map((head) => (
                            <TableCell key={head} sx={headCellSx}>
                              {head}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(audit.differences || []).map((line) => (
                          <TableRow key={line.transactionId}>
                            <TableCell>
                              {line.type === 'Retire'
                                ? 'Thất lạc (Kiểm kê — giữ mã để khôi phục)'
                                : TRANSACTION_TYPES[line.type] || line.type}
                            </TableCell>
                            <TableCell>
                              {line.componentCode} · {line.componentName}
                            </TableCell>
                            <TableCell>{line.serialNumber || '—'}</TableCell>
                            <TableCell
                              sx={{
                                fontWeight: 700,
                                color: line.quantityChange < 0 ? '#c62828' : '#2e7d32',
                              }}
                            >
                              {line.quantityChange > 0 ? `+${line.quantityChange}` : line.quantityChange}
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

            {/* Danh sách thiết bị đang ở trạng thái Thất lạc trong tủ — Chứng minh mã thiết bị KHÔNG bị xóa khỏi hệ thống và khôi phục được 1 chạm */}
            {lostItems.length > 0 && (
              <SectionCard
                title={`Thiết bị đang theo dõi thất lạc tại tủ này (${lostItems.length})`}
                subtitle="Các mã thiết bị chưa tìm thấy vẫn được lưu nguyên trong hệ thống. Khi tìm thấy lại, bấm 'Đã tìm thấy — Khôi phục về kho'."
              >
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#fffbeb' }}>
                        {['Mã thiết bị', 'Linh kiện', 'Serial', 'Trạng thái', ''].map((head) => (
                          <TableCell key={head} sx={headCellSx}>
                            {head}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {lostItems.map((item) => {
                        const st = itemStatusOf(item.status)
                        return (
                          <TableRow key={item.itemId} hover>
                            <TableCell sx={{ color: '#0058be', fontWeight: 700 }}>{item.itemCode}</TableCell>
                            <TableCell>{item.componentName}</TableCell>
                            <TableCell>{item.serialNumber || '—'}</TableCell>
                            <TableCell>
                              <Chip size="small" color={st.color} label={st.label} sx={{ fontWeight: 600, fontSize: 11 }} />
                            </TableCell>
                            <TableCell align="right">
                              <Button
                                size="small"
                                variant="outlined"
                                color="success"
                                startIcon={<RestoreIcon />}
                                disabled={restoringId === item.itemId}
                                onClick={() => handleRestoreLostItem(item)}
                                sx={{ textTransform: 'none', fontWeight: 700 }}
                              >
                                {restoringId === item.itemId ? 'Đang khôi phục...' : 'Đã tìm thấy — Khôi phục về kho'}
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
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
          {confirm === 'cancel' ? 'Hủy phiên kiểm kê?' : 'Xác nhận hoàn tất kiểm kê?'}
        </DialogTitle>
        <DialogContent>
          {confirm === 'cancel' ? (
            <Typography variant="body2">Phiên kiểm kê sẽ bị hủy, tồn kho không thay đổi.</Typography>
          ) : (
            <Stack spacing={1}>
              <Typography variant="body2">
                • <strong>{changedConsumables.length}</strong> loại vật tư tiêu hao sẽ được điều chỉnh số lượng.
              </Typography>
              <Typography variant="body2">
                • <strong>{pendingVerifyItems.length}</strong> thiết bị đánh dấu <em>Chờ xác minh</em> sẽ được lưu vào
                ghi chú biên bản (<strong>giữ nguyên trạng thái Sẵn sàng trong kho</strong>).
              </Typography>
              <Typography variant="body2">
                • <strong>{lostSelectedIds.length}</strong> thiết bị đánh dấu <em>Thất lạc</em> sẽ chuyển sang trạng thái{' '}
                <strong>Thất lạc (chờ tìm lại)</strong> — mã thiết bị vẫn được lưu trong hệ thống để khôi phục khi tìm thấy.
              </Typography>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirm(null)} disabled={saving}>
            Đóng
          </Button>
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
