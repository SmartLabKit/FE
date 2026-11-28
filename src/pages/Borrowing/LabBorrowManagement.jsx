import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  Grid,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  Snackbar,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'
import SearchIcon from '@mui/icons-material/Search'
import CloseIcon from '@mui/icons-material/Close'
import PortalLayout from '../../components/layout/PortalLayout'
import TrackingTypeBadge from '../../components/common/TrackingTypeBadge'
import IssueBorrowModal from '../../components/borrowing/IssueBorrowModal'
import CreateIssueReportDialog from '../IssueReports/CreateIssueReportDialog'
import { useLabBorrowRequests } from '../../hooks/useLabBorrowRequests'
import { useLabNewOrderCount } from '../../hooks/useLabNewOrderCount'
import { borrowService } from '../../services/borrowService'
import { extractErrorMessage } from '../../services/api'
import { formatVietnamDate, formatVietnamDateTime } from '../../utils/dateFormatting'
import { getBorrowRequestStatusMeta, getShownPurpose } from './borrowHelpers'
import { labCode, labLabel, labName } from '../../utils/labLabel'
import LabReturnSlips from './LabReturnSlips'
import PickupDateDialog from './PickupDateDialog'
import HandoverPhotos from '../../components/borrowing/HandoverPhotos'

const PAGE_SIZE = 20

const ORDER_STATUS_FILTERS = [
  { key: 'ALL', label: 'Tất cả', status: '', overdue: false },
  { key: 'Pending', label: 'Chờ GV duyệt', status: 'Pending', overdue: false },
  { key: 'Approved', label: 'Chờ lab xác nhận', status: 'Approved', overdue: false },
  { key: 'Ready', label: 'Sẵn sàng', status: 'Ready', overdue: false },
  { key: 'Borrowing', label: 'Đang mượn', status: 'Borrowing', overdue: false },
  { key: 'Overdue', label: 'Quá hạn', status: '', overdue: true },
  { key: 'Returned', label: 'Đã trả', status: 'Returned', overdue: false },
  { key: 'Rejected', label: 'Từ chối', status: 'Rejected', overdue: false },
  { key: 'Cancelled', label: 'Đã hủy', status: 'Cancelled', overdue: false },
]

const RETURN_DESK_FILTERS = [
  { key: 'Borrowing', label: 'Đang mượn', status: 'Borrowing', overdue: false },
  { key: 'Overdue', label: 'Quá hạn', status: '', overdue: true },
]

const LEGACY_TABS = { 4: 0, 5: 3 }

function getId(row) {
  return row?.borrowRequestId || row?.id
}

// Ngày hẹn nhận là đầu ngày theo giờ VN (BE lưu dạng UTC); trước thời điểm đó chưa được giao đồ
function isBeforePickupDay(borrowDate) {
  if (!borrowDate) return false
  return new Date() < new Date(borrowDate)
}

function getDaysOverdue(dueDate) {
  if (!dueDate) return 0
  const dateOnly = formatVietnamDate(dueDate)
  if (dateOnly === '—') return 0
  const [day, month, year] = dateOnly.split('/').map(Number)
  if (!year || !month || !day) return 0
  const due = new Date(year, month - 1, day)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.max(0, Math.floor((today - due) / 86400000))
}

function isOverdue(request) {
  return Boolean(request?.isOverdue) || request?.status === 'Overdue'
}

function isPendingReplacement(item, requestStatus) {
  return ['Borrowing', 'Overdue'].includes(requestStatus) && item.status === 'Pending'
}

function isLentUnit(item, requestStatus) {
  return ['Borrowing', 'Overdue'].includes(requestStatus) && item.status === 'Issued' && Boolean(item.itemCode)
}

function getItemStatusInfo(item, requestStatus) {
  const isConsum = String(item.trackingType || '').toLowerCase() === 'consumable'
  const isReturned = Boolean(item.returnedAt) ||
    ['returned', 'đã trả'].includes(String(item.status || '').toLowerCase())

  // 1. Nếu đã trả
  if (isReturned) {
    const condition = String(item.condition || item.returnCondition || '').toLowerCase()
    if (condition === 'damaged' || condition === 'hỏng hóc') {
      return {
        label: 'Đã trả (Hỏng)',
        bgcolor: '#fee2e2',
        textColor: '#dc2626',
      }
    }
    if (condition === 'lost' || condition === 'bị mất') {
      return {
        label: 'Đã trả (Mất)',
        bgcolor: '#fee2e2',
        textColor: '#dc2626',
      }
    }
    if (isConsum && Number(item.returnedQuantity || 0) < Number(item.quantity || 0)) {
      return {
        label: `Đã trả ${Number(item.returnedQuantity || 0)}/${item.quantity}, còn lại đã dùng`,
        bgcolor: '#dcfce7',
        textColor: '#15803d',
      }
    }
    return {
      label: 'Đã trả',
      bgcolor: '#dcfce7',
      textColor: '#15803d',
    }
  }

  // 2. Vật tư tiêu hao (consumable)
  if (isConsum) {
    const returnedQty = Number(item.returnedQuantity || 0)
    const totalQty = Number(item.quantity || 0)
    if (totalQty > 0 && returnedQty >= totalQty) {
      return {
        label: 'Đã trả',
        bgcolor: '#dcfce7',
        textColor: '#15803d',
      }
    }
    if (returnedQty > 0) {
      return {
        label: `Đã trả ${returnedQty}/${totalQty}`,
        bgcolor: '#e0f2fe',
        textColor: '#0369a1',
      }
    }
  }

  // 3. Con thay thế thêm vào đơn đang mượn, chưa giao
  if (isPendingReplacement(item, requestStatus)) {
    return {
      label: 'Con thay thế, chờ giao',
      bgcolor: '#e0f2fe',
      textColor: '#0369a1',
    }
  }

  // Đơn đang mượn hoặc quá hạn mà chưa trả
  if (['Borrowing', 'Overdue'].includes(requestStatus)) {
    return {
      label: 'Chưa trả',
      bgcolor: '#fffbeb',
      textColor: '#b45309',
    }
  }

  // 4. Toàn bộ đơn đã trả
  if (requestStatus === 'Returned') {
    return {
      label: 'Đã trả',
      bgcolor: '#dcfce7',
      textColor: '#15803d',
    }
  }

  // 5. Đơn sẵn sàng nhận linh kiện
  if (requestStatus === 'Ready') {
    return {
      label: 'Sẵn sàng',
      bgcolor: '#dcfce7',
      textColor: '#15803d',
    }
  }

  // 6. Đơn đã duyệt nhưng chưa giao
  if (requestStatus === 'Approved') {
    return {
      label: 'Chờ giao',
      bgcolor: '#f1f5f9',
      textColor: '#475569',
    }
  }

  // 7. Theo item.status hoặc mặc định Chờ giao
  const normStatus = String(item.status || '').toLowerCase()
  if (['damaged', 'hỏng hóc'].includes(normStatus)) {
    return { label: 'Hỏng hóc', bgcolor: '#fee2e2', textColor: '#dc2626' }
  }
  if (['lost', 'bị mất'].includes(normStatus)) {
    return { label: 'Bị mất', bgcolor: '#fee2e2', textColor: '#dc2626' }
  }
  if (['chưa trả', 'notreturned', 'borrowing', 'đang mượn', 'issued', 'đã giao'].includes(normStatus)) {
    return { label: 'Chưa trả', bgcolor: '#fffbeb', textColor: '#b45309' }
  }
  if (['pending', 'chờ giao'].includes(normStatus)) {
    return { label: 'Chờ giao', bgcolor: '#f1f5f9', textColor: '#475569' }
  }

  return {
    label: item.status || 'Chờ giao',
    bgcolor: '#f1f5f9',
    textColor: '#475569',
  }
}

// Tab Đơn mượn mở sẵn "Chờ lab xác nhận": việc lab cần làm trước là nhận các đơn GV vừa duyệt
const STATUS_BY_TAB = { 0: 'Approved', 2: 'Ready', 3: 'Borrowing' }

export default function LabBorrowManagement() {
  const location = useLocation()
  const navigate = useNavigate()
  const initialTab = LEGACY_TABS[location.state?.tab] ?? location.state?.tab ?? 0
  const [status, setStatus] = useState(STATUS_BY_TAB[initialTab] ?? '')
  const [overdueFilter, setOverdueFilter] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [tab, setTab] = useState(initialTab)
  const {
    requests,
    requestResult,
    loading,
    error,
    realtimeUnavailable,
    refresh,
  } = useLabBorrowRequests({ status, overdue: overdueFilter, search, page, size: PAGE_SIZE })

  // Đơn mới tới lab = GV đã duyệt, lab chưa xác nhận: hiện số trên nút lọc và chữ "Mới" trên từng dòng
  const newOrderCount = useLabNewOrderCount(true)

  // SV đến nhầm lab: tìm không ra ở lab mình thì xem đơn có ở lab khác không để hướng dẫn qua đúng lab
  const [otherLabMatches, setOtherLabMatches] = useState([])
  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      if (!search || loading || requests.length > 0) {
        if (active) setOtherLabMatches([])
        return
      }
      borrowService.findInOtherLabs(search).then((matches) => {
        if (active) setOtherLabMatches(matches)
      })
    }, 0)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [search, loading, requests.length])

  const [selectedRequestId, setSelectedRequestId] = useState('')
  const [requestDetail, setRequestDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [actionError, setActionError] = useState('')
  const [actionLoading, setActionLoading] = useState('')
  const [issueRequest, setIssueRequest] = useState(null)
  const [pickupRequest, setPickupRequest] = useState(null)
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })
  const [cardLoading, setCardLoading] = useState(false)
  const [cardMessage, setCardMessage] = useState(null)
  const cardInputRef = useRef(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelLine, setCancelLine] = useState(null)
  const [brokenItemCode, setBrokenItemCode] = useState('')

  const loadDetail = useCallback(async (id) => {
    if (!id) {
      setRequestDetail(null)
      return
    }
    setDetailLoading(true)
    setDetailError('')
    try {
      setRequestDetail(await borrowService.getBorrowRequestById(id))
    } catch (loadError) {
      setDetailError(loadError.message || 'Không thể tải chi tiết đơn mượn.')
      setRequestDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  // Gỡ ảnh giao / nhận trả chưa dùng ngay trong chi tiết đơn; ảnh đã dùng để bàn giao thì BE từ chối
  const removeHandoverPhoto = async (photo) => {
    setActionError('')
    try {
      await borrowService.deleteHandoverPhoto(getId(requestDetail), photo.photoId)
      await loadDetail(getId(requestDetail))
    } catch (removeError) {
      setActionError(removeError.message || 'Không gỡ được ảnh.')
    }
  }

  const closeDetail = () => {
    setSelectedRequestId('')
    setRequestDetail(null)
    if (location.search) navigate(location.pathname, { replace: true })
  }

  // Mở từ thông báo (?open=<id>): hiện ngay chi tiết đơn đó
  const openFromLink = new URLSearchParams(location.search).get('open')
  useEffect(() => {
    if (!openFromLink) return undefined
    const timer = window.setTimeout(() => {
      setSelectedRequestId(openFromLink)
      loadDetail(openFromLink)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [openFromLink, loadDetail])

  const reloadData = useCallback(async () => {
    await refresh()
    if (selectedRequestId) await loadDetail(selectedRequestId)
  }, [loadDetail, refresh, selectedRequestId])

  const handleSearch = (event) => {
    event.preventDefault()
    setPage(1)
    // Tìm theo MSSV / mã đơn thì tìm trên mọi trạng thái của tab Đơn mượn
    if (tab === 0 && searchInput.trim()) {
      setStatus('')
      setOverdueFilter(false)
    }
    setSearch(searchInput.trim())
  }

  const handleStudentCardPhoto = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setCardMessage({ severity: 'error', text: 'Vui lòng chọn ảnh thẻ sinh viên.' })
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setCardMessage({ severity: 'error', text: 'Ảnh thẻ không được vượt quá 5 MB.' })
      return
    }

    setCardLoading(true)
    setCardMessage(null)
    try {
      const result = await borrowService.readStudentCard(file)
      setTab(2)
      setStatus('Ready')
      setPage(1)
      if (result.aiAvailable && result.studentCode) {
        setSearchInput(result.studentCode)
        setSearch(result.studentCode)
        setCardMessage({
          severity: result.isStudentCard ? 'success' : 'warning',
          text: result.isStudentCard
            ? `Đã nhận diện MSSV ${result.studentCode}; đang tìm đơn sẵn sàng giao.`
            : `AI đọc được MSSV ${result.studentCode} nhưng chưa xác nhận đây là thẻ sinh viên. Đang tìm đơn; vui lòng đối chiếu thông tin.`,
        })
      } else {
        setCardMessage({
          severity: 'warning',
          text: result.aiAvailable
            ? 'Không đọc được MSSV từ ảnh. Vui lòng nhập MSSV để tìm thủ công.'
            : 'AI nhận diện thẻ hiện không khả dụng. Vui lòng nhập MSSV để tìm thủ công.',
        })
      }
    } catch (readError) {
      setCardMessage({ severity: 'error', text: extractErrorMessage(readError, 'Không thể nhận diện thẻ sinh viên.') })
    } finally {
      setCardLoading(false)
    }
  }

  const runAction = async (actionKey, operation, fallbackMessage) => {
    setActionLoading(actionKey)
    setActionError('')
    try {
      await operation()
      await reloadData()
      return true
    } catch (actionFailure) {
      setActionError(actionFailure.message || fallbackMessage)
      return false
    } finally {
      setActionLoading('')
    }
  }

  const totalCount = Number(requestResult?.totalCount ?? requestResult?.total ?? 0)
  const detailItems = requestDetail?.items || []
  // Chỉ một bước GV duyệt: hiện người duyệt, giờ duyệt và nhận xét ngay trong thông tin đơn thay cho khối lịch sử
  const lecturerDecision = (requestDetail?.approvals || []).filter((approval) => approval.decidedAt).slice(-1)[0] || null
  // Cột Thao tác chỉ có khi đơn đang mượn: ghi nhận sự cố, giao hoặc hủy con thay thế
  const showLineActions = detailItems.some(
    (item) => isLentUnit(item, requestDetail?.status) || isPendingReplacement(item, requestDetail?.status),
  )
  const canCancel = ['Approved', 'Ready'].includes(requestDetail?.status)

  const closeCancel = () => {
    if (actionLoading) return
    setCancelOpen(false)
    setCancelLine(null)
    setCancelReason('')
  }

  const submitCancel = async () => {
    const reason = cancelReason.trim()
    if (!reason) return
    const success = await runAction(
      'cancel',
      () => (cancelLine
        ? borrowService.cancelReplacement(selectedRequestId, { borrowItemId: cancelLine.borrowItemId, reason })
        : borrowService.cancelBorrowRequest(selectedRequestId, { reason })),
      cancelLine ? 'Hủy con thay thế thất bại.' : 'Hủy đơn thất bại.',
    )
    if (success) {
      setCancelOpen(false)
      setCancelLine(null)
      setCancelReason('')
    }
  }

  // Xác nhận sẵn sàng (chọn ngày hẹn) hoặc đổi ngày hẹn; trả về lỗi để hộp thoại hiện
  const savePickupDate = async (date) => {
    try {
      if (pickupRequest.status === 'Ready') await borrowService.changePickupDate(pickupRequest.borrowRequestId, date)
      else await borrowService.labAcceptBorrowRequest(pickupRequest.borrowRequestId, date)
    } catch (pickupError) {
      return pickupError.message
    }
    setPickupRequest(null)
    await reloadData()
    return ''
  }

  const issueBorrow = async (payload) => {
    const success = await runAction(
      'issue',
      () => (issueRequest.replacementLine
        ? borrowService.issueReplacement(issueRequest.borrowRequestId, {
          borrowItemId: issueRequest.replacementLine.borrowItemId,
          itemId: payload.units[0].itemIds[0],
          photoId: payload.photoId,
          overrideReason: payload.overrideReason,
        })
        : borrowService.issueBorrowRequest(issueRequest.borrowRequestId, payload)),
      'Bàn giao linh kiện thất bại.',
    )
    if (success) setIssueRequest(null)
    return success
  }


  return (
    <PortalLayout
      headerTitle="Xử lý đơn mượn"
      headerSubtitle="Xử lý đơn đã duyệt: giao linh kiện, nhận trả và theo dõi đơn của lab mình"
      activeMenuKey="handover"
    >
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
          <Typography variant="h5" fontWeight={700}>Quản lý đơn mượn</Typography>
        </Stack>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {realtimeUnavailable && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Kết nối cập nhật tự động đang không khả dụng.
          </Alert>
        )}
        {actionError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError('')}>{actionError}</Alert>}

        <Paper variant="outlined" sx={{ mb: 2 }}>
          <Tabs
            value={tab}
            variant="scrollable"
            scrollButtons="auto"
            onChange={(_, value) => {
              setTab(value)
              setPage(1)
              setOverdueFilter(false)
              if (value === 2) setStatus('Ready')
              else if (value === 3) setStatus('Borrowing')
              else if (value === 0) setStatus('Approved')
            }}
            aria-label="Danh sách đơn Lab"
          >
            <Tab value={0} label="Đơn mượn" />
            <Tab value={2} label="Giao linh kiện" />
            <Tab value={3} label="Nhận trả" />
          </Tabs>

          <>
          {tab === 3 && (
            <Box sx={{ borderBottom: '1px solid #eef0f6' }}>
              <Typography sx={{ fontWeight: 800, px: { xs: 2, sm: 3 }, pt: 2 }}>Phiếu trả</Typography>
              <LabReturnSlips />
              <Typography sx={{ fontWeight: 800, px: { xs: 2, sm: 3 }, pb: 0.5 }}>Đơn đang mượn</Typography>
            </Box>
          )}
          {/* Thanh tìm kiếm & bộ lọc trạng thái đơn mượn */}
          <Box component="form" onSubmit={handleSearch} sx={{ p: 2 }}>
            <Grid container spacing={1.5} alignItems="center">
              <Grid size={{ xs: 12, sm: 7, md: 6 }}>
                <TextField
                  fullWidth
                  size="small"
                  label={
                    tab === 2
                      ? 'Tìm đơn sẵn sàng · MSSV / mã đơn'
                      : 'Tìm mã đơn, sinh viên, MSSV, đề tài...'
                  }
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  slotProps={
                    tab === 2
                      ? {
                          input: {
                            endAdornment: (
                              <InputAdornment position="end">
                                <Tooltip title="Quét thẻ sinh viên bằng AI">
                                  <IconButton
                                    aria-label="Chụp thẻ sinh viên"
                                    onClick={() => cardInputRef.current?.click()}
                                    disabled={cardLoading}
                                    edge="end"
                                  >
                                    {cardLoading ? <CircularProgress size={20} /> : <PhotoCameraIcon />}
                                  </IconButton>
                                </Tooltip>
                              </InputAdornment>
                            ),
                          },
                        }
                      : undefined
                  }
                />
                {tab === 2 && (
                  <input
                    ref={cardInputRef}
                    hidden
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleStudentCardPhoto}
                  />
                )}
              </Grid>
              <Grid size={{ xs: 'auto' }}>
                <Button type="submit" variant="contained" startIcon={<SearchIcon />} sx={{ textTransform: 'none', height: 40 }}>
                  Tìm kiếm
                </Button>
              </Grid>
              {search && (
                <Grid size={{ xs: 'auto' }}>
                  <Button
                    variant="outlined"
                    onClick={() => {
                      setSearchInput('')
                      setSearch('')
                      setPage(1)
                    }}
                    sx={{ textTransform: 'none', height: 40 }}
                  >
                    Xóa tìm
                  </Button>
                </Grid>
              )}
            </Grid>

            {/* Dải nút lọc trạng thái 1 chạm */}
            {(tab === 0 || tab === 3) && (() => {
              let filterOptions = ORDER_STATUS_FILTERS
              if (tab === 3) filterOptions = RETURN_DESK_FILTERS
              return (
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', mt: 1.75 }}>
                  {filterOptions.map((opt) => {
                    const active = overdueFilter === opt.overdue && status === opt.status
                    return (
                      <Button
                        key={opt.key}
                        type="button"
                        size="small"
                        variant={active ? 'contained' : 'outlined'}
                        onClick={() => {
                          setPage(1)
                          setStatus(opt.status)
                          setOverdueFilter(opt.overdue)
                        }}
                        sx={{
                          textTransform: 'none',
                          borderRadius: '999px',
                          fontWeight: 700,
                          fontSize: 12,
                          px: 1.75,
                          py: 0.35,
                          boxShadow: 'none',
                          bgcolor: active ? (opt.overdue ? '#dc2626' : '#0058be') : '#ffffff',
                          borderColor: active ? (opt.overdue ? '#dc2626' : '#0058be') : '#cbd5e1',
                          color: active ? '#ffffff' : '#334155',
                          '&:hover': {
                            bgcolor: active ? (opt.overdue ? '#b91c1c' : '#0049a3') : '#f1f5f9',
                            borderColor: active ? (opt.overdue ? '#b91c1c' : '#0049a3') : '#94a3b8',
                          },
                        }}
                      >
                        {opt.label}
                        {opt.key === 'Approved' && newOrderCount > 0 ? ` (${newOrderCount})` : ''}
                      </Button>
                    )
                  })}
                </Box>
              )
            })()}

            {tab === 2 && cardMessage && (
              <Alert severity={cardMessage.severity} sx={{ mt: 1.5 }}>{cardMessage.text}</Alert>
            )}
          </Box>

          <Divider />

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress /></Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#faf9ff' }}>
                    <TableCell sx={{ fontWeight: 700 }}>Mã đơn</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Sinh viên</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Lớp</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Đề tài</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Số món</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Lab nhận</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Hạn trả</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Trạng thái</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {requests.map((request) => (
                    <TableRow
                      hover
                      key={getId(request)}
                      selected={getId(request) === selectedRequestId}
                      onClick={() => {
                        const requestId = getId(request)
                        setSelectedRequestId(requestId)
                        loadDetail(requestId)
                      }}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell sx={{ fontWeight: 700, color: '#0058be', whiteSpace: 'nowrap' }}>
                        {request.requestCode || '—'}
                        {request.status === 'Approved' && (
                          <Chip
                            label="Mới"
                            size="small"
                            sx={{ ml: 0.75, height: 18, fontSize: 11, fontWeight: 800, bgcolor: '#dc2626', color: '#fff' }}
                          />
                        )}
                        {request.isSupplementary && (
                          <Chip
                            label="Mượn thêm"
                            size="small"
                            sx={{ ml: 0.75, height: 18, fontSize: 11, fontWeight: 700, bgcolor: '#fef3c7', color: '#b45309' }}
                          />
                        )}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>{request.requesterName || '—'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{request.classCode || '—'}</TableCell>
                      <TableCell>{request.projectTitle || '—'}</TableCell>
                      <TableCell align="right">{typeof request.itemCount === 'number' ? request.itemCount : '—'}</TableCell>
                      <TableCell title={labName(request)} sx={{ whiteSpace: 'nowrap' }}>{labCode(request)}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 600, color: isOverdue(request) ? '#dc2626' : 'inherit' }}>
                        {formatVietnamDate(request.dueDate)}
                      </TableCell>
                      <TableCell>
                        <Stack spacing={0.5} alignItems="flex-start">
                          {(() => {
                            const meta = getBorrowRequestStatusMeta(request.status)
                            return <Chip size="small" label={meta.label} sx={meta.sx} />
                          })()}
                          {isOverdue(request) && (
                            <Stack direction="row" spacing={0.75} alignItems="center">
                              <Chip size="small" color="error" label="Quá hạn" />
                              {getDaysOverdue(request.dueDate) > 0 && (
                                <Typography variant="caption" color="error.main" fontWeight={600}>
                                  Trễ {getDaysOverdue(request.dueDate)} ngày
                                </Typography>
                              )}
                            </Stack>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!requests.length && (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                        {tab === 2
                          ? 'Không tìm thấy đơn sẵn sàng giao.'
                          : tab === 3
                            ? 'Không có đơn đang mượn cần nhận trả.'
                            : status === 'Approved' && !search
                              ? 'Không có đơn mới chờ lab xác nhận.'
                              : 'Không có đơn phù hợp.'}
                        {otherLabMatches.length > 0 && (
                          <Alert severity="warning" sx={{ mt: 2, textAlign: 'left' }}>
                            {otherLabMatches.map((match) => (
                              <div key={match.requestCode}>
                                Đơn <strong>{match.requestCode}</strong>
                                {match.studentCode ? ` của ${match.studentCode}` : ''} thuộc{' '}
                                <strong>{match.roomCode}</strong> · {match.roomName} ({getBorrowRequestStatusMeta(match.status).label}).
                                Hướng dẫn sinh viên qua {match.roomCode}.
                              </div>
                            ))}
                          </Alert>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          <TablePagination
            component="div"
            count={totalCount}
            page={page - 1}
            onPageChange={(_, nextPage) => setPage(nextPage + 1)}
            rowsPerPage={PAGE_SIZE}
            rowsPerPageOptions={[PAGE_SIZE]}
            labelDisplayedRows={({ from, to, count }) => `${from}–${to} / ${count}`}
          />
          </>
        </Paper>

        <Drawer
          anchor="right"
          open={(tab === 0 || tab === 2 || tab === 3) && Boolean(selectedRequestId)}
          onClose={closeDetail}
        >
          <Box sx={{ width: { xs: '100vw', sm: 560, md: 720 }, p: { xs: 2, md: 3 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography sx={{ fontWeight: 800, color: '#64748b', fontSize: 13 }}>Chi tiết đơn mượn</Typography>
              <IconButton onClick={closeDetail} aria-label="Đóng">
                <CloseIcon />
              </IconButton>
            </Box>
            {detailLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
            ) : detailError ? (
              <Alert severity="error">{detailError}</Alert>
            ) : requestDetail ? (
              <Stack spacing={2}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                  <Box>
                    <Typography variant="h6" fontWeight={700}>{requestDetail.requestCode}</Typography>
                  </Box>
                  {(() => {
                    const meta = getBorrowRequestStatusMeta(requestDetail.status)
                    return <Chip label={meta.label} sx={meta.sx} />
                  })()}
                </Box>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 3 }}>
                    <Typography variant="caption" color="text.secondary">Sinh viên</Typography>
                    <Typography fontWeight={600}>{requestDetail.requesterName || '—'}</Typography>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 3 }}>
                    <Typography variant="caption" color="text.secondary">MSSV</Typography>
                    <Typography fontWeight={600}>{requestDetail.studentCode || '—'}</Typography>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 3 }}>
                    <Typography variant="caption" color="text.secondary">Lớp</Typography>
                    <Typography fontWeight={600}>{requestDetail.classCode || '—'}</Typography>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 3 }}>
                    <Typography variant="caption" color="text.secondary">Đề tài</Typography>
                    <Typography fontWeight={600}>{requestDetail.projectTitle || '—'}</Typography>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 3 }}>
                    <Typography variant="caption" color="text.secondary">Lab nhận linh kiện</Typography>
                    <Typography fontWeight={600}>{labLabel(requestDetail)}</Typography>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 3 }}>
                    <Typography variant="caption" color="text.secondary">Ngày gửi đơn</Typography>
                    <Typography fontWeight={600}>{formatVietnamDate(requestDetail.requestDate)}</Typography>
                  </Grid>
                  {requestDetail.status === 'Ready' && requestDetail.borrowDate && (
                    <Grid size={{ xs: 12, sm: 3 }}>
                      <Typography variant="caption" color="text.secondary">Ngày hẹn nhận</Typography>
                      <Typography fontWeight={600}>{formatVietnamDate(requestDetail.borrowDate)}</Typography>
                    </Grid>
                  )}
                  <Grid size={{ xs: 12, sm: 3 }}>
                    <Typography variant="caption" color="text.secondary">Hạn trả</Typography>
                    <Typography fontWeight={600} color={isOverdue(requestDetail) ? 'error.main' : 'inherit'}>
                      {formatVietnamDate(requestDetail.dueDate)}
                    </Typography>
                  </Grid>
                  {lecturerDecision && (
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant="caption" color="text.secondary">
                        {lecturerDecision.status === 'Rejected' ? 'GV từ chối' : 'GV duyệt'}
                      </Typography>
                      <Typography fontWeight={600}>
                        {lecturerDecision.approverName || '—'} · {formatVietnamDateTime(lecturerDecision.decidedAt)}
                      </Typography>
                    </Grid>
                  )}
                </Grid>
                {lecturerDecision?.comment && (
                  <Alert severity="warning" icon={false}>
                    <strong>Nhận xét của GV:</strong> {lecturerDecision.comment}
                  </Alert>
                )}
                {requestDetail.rejectReason && (
                  <Alert severity="error" sx={{ py: 0.5 }}>
                    <strong>Lý do {requestDetail.status === 'Cancelled' ? 'hủy' : 'từ chối'}:</strong> {requestDetail.rejectReason}
                  </Alert>
                )}
                <Divider />
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                  <Typography fontWeight={600}>Danh sách linh kiện yêu cầu ({detailItems.length}):</Typography>
                  {['Borrowing', 'Overdue'].includes(requestDetail.status) && detailItems.length > 0 && (
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <Chip
                        size="small"
                        label={`Đã trả: ${detailItems.filter((i) => Boolean(i.returnedAt) || String(i.status || '').toLowerCase() === 'returned').length}/${detailItems.length}`}
                        sx={{ bgcolor: '#dcfce7', color: '#15803d', fontWeight: 700, fontSize: 11 }}
                      />
                    </Box>
                  )}
                </Box>
                <TableContainer>
                  <Table size="small">
                    <TableHead><TableRow><TableCell>Linh kiện</TableCell><TableCell>Loại quản lý</TableCell><TableCell>Số lượng</TableCell><TableCell>Trạng thái dòng</TableCell>{showLineActions && <TableCell align="right">Thao tác</TableCell>}</TableRow></TableHead>
                    <TableBody>
                      {detailItems.map((item) => {
                        const statusInfo = getItemStatusInfo(item, requestDetail.status)
                        return (
                          <TableRow key={item.borrowItemId}>
                            <TableCell>{item.componentName}</TableCell>
                            <TableCell><TrackingTypeBadge type={item.trackingType} /></TableCell>
                            <TableCell>{item.quantity} {item.unit || ''}</TableCell>
                            <TableCell>
                              <Chip
                                size="small"
                                label={statusInfo.label}
                                sx={{
                                  bgcolor: statusInfo.bgcolor,
                                  color: statusInfo.textColor,
                                  fontWeight: 700,
                                  fontSize: 11,
                                }}
                              />
                            </TableCell>
                            {showLineActions && (
                            <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                              {isLentUnit(item, requestDetail.status) && (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="warning"
                                  disabled={Boolean(actionLoading)}
                                  onClick={() => setBrokenItemCode(item.itemCode)}
                                  sx={{ textTransform: 'none', fontWeight: 700 }}
                                >
                                  Ghi nhận sự cố
                                </Button>
                              )}
                              {isPendingReplacement(item, requestDetail.status) && (
                                <>
                                  <Button
                                    size="small"
                                    variant="contained"
                                    disabled={Boolean(actionLoading)}
                                    onClick={() => setIssueRequest({ ...requestDetail, items: [item], replacementLine: item })}
                                    sx={{ textTransform: 'none', fontWeight: 700 }}
                                  >
                                    Giao
                                  </Button>
                                  <Button
                                    size="small"
                                    color="error"
                                    disabled={Boolean(actionLoading)}
                                    onClick={() => {
                                      setCancelLine(item)
                                      setCancelOpen(true)
                                    }}
                                    sx={{ textTransform: 'none', ml: 1 }}
                                  >
                                    Hủy
                                  </Button>
                                </>
                              )}
                            </TableCell>
                            )}
                          </TableRow>
                        )
                      })}
                      {!detailItems.length && <TableRow><TableCell colSpan={showLineActions ? 5 : 4} align="center">Đơn không có linh kiện mượn kho.</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </TableContainer>

                {actionError && <Alert severity="error" onClose={() => setActionError('')}>{actionError}</Alert>}
                <HandoverPhotos
                  photos={requestDetail.photos}
                  canRemove={(photo) =>
                    photo.photoType === 'Issue'
                      ? requestDetail.status === 'Ready'
                      : ['Borrowing', 'Overdue'].includes(requestDetail.status)}
                  onRemove={removeHandoverPhoto}
                />

                {getShownPurpose(requestDetail.purpose) && (
                  <Box sx={{ p: 1.75, borderRadius: 1.5, bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b', display: 'block', mb: 0.4 }}>
                      MỤC ĐÍCH
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#1e293b', lineHeight: 1.6 }}>
                      {getShownPurpose(requestDetail.purpose)}
                    </Typography>
                  </Box>
                )}

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="flex-end">
                  {requestDetail.status === 'Approved' && (
                    <Button
                      variant="contained"
                      disabled={Boolean(actionLoading)}
                      onClick={() => setPickupRequest(requestDetail)}
                    >
                      Xác nhận sẵn sàng
                    </Button>
                  )}
                  {requestDetail.status === 'Ready' && (
                    <Button variant="outlined" disabled={Boolean(actionLoading)} onClick={() => setPickupRequest(requestDetail)}>
                      Đổi ngày hẹn
                    </Button>
                  )}
                  {requestDetail.status === 'Ready' && (() => {
                    // Chỉ giao đồ từ ngày hẹn trở đi; SV đến sớm thì đổi ngày hẹn sang hôm nay trước
                    const beforePickupDay = isBeforePickupDay(requestDetail.borrowDate)
                    return (
                      <Box sx={{ textAlign: 'right' }}>
                        <Button
                          variant="contained"
                          disabled={Boolean(actionLoading) || beforePickupDay}
                          onClick={() => setIssueRequest(requestDetail)}
                        >
                          Xác minh và bàn giao
                        </Button>
                        {beforePickupDay && (
                          <Typography variant="caption" sx={{ display: 'block', color: '#b45309', mt: 0.5 }}>
                            Hẹn nhận {formatVietnamDate(requestDetail.borrowDate)}
                          </Typography>
                        )}
                      </Box>
                    )
                  })()}
                  {['Borrowing', 'Overdue'].includes(requestDetail.status) && (() => {
                    // Chỉ nhận trả theo phiếu trả của SV: phiếu đã duyệt thì nhận đồ, phiếu chờ thì duyệt trước
                    const slips = requestDetail.returnSlips || []
                    const slip = slips.find((s) => s.status === 'Approved') || slips.find((s) => s.status === 'Pending')
                    if (!slip) {
                      return (
                        <Button variant="contained" disabled>
                          Chờ SV gửi phiếu trả
                        </Button>
                      )
                    }
                    return (
                      <Button variant="contained" onClick={() => navigate(`/borrow/return-slips/${slip.returnSlipId}`)}>
                        {slip.status === 'Approved' ? `Nhận trả theo phiếu ${slip.slipCode}` : `Duyệt phiếu trả ${slip.slipCode}`}
                      </Button>
                    )
                  })()}
                  {canCancel && (
                    <Button color="error" variant="outlined" onClick={() => setCancelOpen(true)} disabled={Boolean(actionLoading)}>
                      Hủy đơn
                    </Button>
                  )}
                </Stack>
              </Stack>
            ) : null}
          </Box>
        </Drawer>
      </Container>

      {pickupRequest && (
        <PickupDateDialog request={pickupRequest} onClose={() => setPickupRequest(null)} onSave={savePickupDate} />
      )}

      <IssueBorrowModal
        key={issueRequest?.borrowRequestId || 'issue-modal'}
        open={Boolean(issueRequest)}
        request={issueRequest}
        submitting={actionLoading === 'issue'}
        onClose={() => setIssueRequest(null)}
        onIssue={issueBorrow}
      />

      {brokenItemCode && (
        <CreateIssueReportDialog
          initialCode={brokenItemCode}
          onClose={() => setBrokenItemCode('')}
          onCreated={reloadData}
        />
      )}

      <Dialog open={cancelOpen} onClose={closeCancel} fullWidth maxWidth="sm">
        <DialogTitle>{cancelLine ? `Hủy con thay thế: ${cancelLine.componentName}` : 'Hủy đơn mượn'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={3}
            label="Lý do hủy (bắt buộc)"
            value={cancelReason}
            onChange={(event) => setCancelReason(event.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeCancel} disabled={Boolean(actionLoading)}>Đóng</Button>
          <Button
            color="error"
            variant="contained"
            disabled={!cancelReason.trim() || Boolean(actionLoading)}
            onClick={submitCancel}
          >
            Xác nhận hủy
          </Button>
        </DialogActions>
      </Dialog>
      <Snackbar
        open={toast.open}
        autoHideDuration={6000}
        onClose={() => setToast((current) => ({ ...current, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={toast.severity}
          variant="filled"
          onClose={() => setToast((current) => ({ ...current, open: false }))}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </PortalLayout>
  )
}
