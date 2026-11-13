import { useCallback, useMemo, useRef, useState } from 'react'
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
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
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
import RefreshIcon from '@mui/icons-material/Refresh'
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'
import SearchIcon from '@mui/icons-material/Search'
import PortalLayout from '../../components/layout/PortalLayout'
import IssueBorrowModal from '../../components/borrowing/IssueBorrowModal'
import ReceiveTransferModal from '../../components/borrowing/ReceiveTransferModal'
import ReturnBorrowModal from '../../components/borrowing/ReturnBorrowModal'
import { useLabBorrowRequests } from '../../hooks/useLabBorrowRequests'
import { borrowService } from '../../services/borrowService'
import { extractErrorMessage } from '../../services/api'

const PAGE_SIZE = 20

function getId(row) {
  return row?.borrowRequestId || row?.id
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('vi-VN').format(date)
}

function getDaysOverdue(dueDate) {
  if (!dueDate) return 0
  const dateOnly = String(dueDate).slice(0, 10)
  const [year, month, day] = dateOnly.split('-').map(Number)
  if (!year || !month || !day) return 0
  const due = new Date(year, month - 1, day)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.max(0, Math.floor((today - due) / 86400000))
}

function isOverdue(request) {
  return Boolean(request?.isOverdue) || request?.status === 'Overdue'
}

function statusColor(status) {
  if (status === 'Ready') return 'success'
  if (status === 'Approved') return 'warning'
  if (status === 'Cancelled' || status === 'Rejected' || status === 'Overdue') return 'error'
  return 'default'
}

export default function LabBorrowManagement() {
  const [status, setStatus] = useState('Approved')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [tab, setTab] = useState(0)
  const {
    requests,
    transfers,
    requestResult,
    transferResult,
    loading,
    error,
    realtimeUnavailable,
    refresh,
  } = useLabBorrowRequests({ status, search, page, size: PAGE_SIZE })

  const [selectedRequestId, setSelectedRequestId] = useState('')
  const [requestDetail, setRequestDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [actionError, setActionError] = useState('')
  const [actionLoading, setActionLoading] = useState('')
  const [receiveLine, setReceiveLine] = useState(null)
  const [issueRequest, setIssueRequest] = useState(null)
  const [returnRequest, setReturnRequest] = useState(null)
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })
  const [cardLoading, setCardLoading] = useState(false)
  const [cardMessage, setCardMessage] = useState(null)
  const cardInputRef = useRef(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')

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

  const reloadData = useCallback(async () => {
    await refresh()
    if (selectedRequestId) await loadDetail(selectedRequestId)
  }, [loadDetail, refresh, selectedRequestId])

  const handleSearch = (event) => {
    event.preventDefault()
    setPage(1)
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

  const receiveTransfer = (payload) => runAction(
    `receive-${payload.borrowItemId}`,
    () => borrowService.receiveTransfer(receiveLine.borrowRequestId, payload),
    'Xác nhận nhận hàng thất bại.',
  )

  const openReceiveDialog = (line) => {
    setReceiveLine(line)
  }

  const pendingTransfers = useMemo(() => {
    const items = requestDetail?.items || []
    return items.filter((item) =>
      item.sourceRoomId &&
      requestDetail?.roomId &&
      item.sourceRoomId !== requestDetail.roomId &&
      !item.receivedAt,
    )
  }, [requestDetail])

  const pageInfo = tab === 1 ? transferResult : requestResult
  const totalCount = Number(pageInfo?.totalCount ?? pageInfo?.total ?? 0)
  const detailItems = requestDetail?.items || []
  const detailRoomId = requestDetail?.roomId
  const canCancel = ['Approved', 'Ready'].includes(requestDetail?.status)

  const submitCancel = async () => {
    const reason = cancelReason.trim()
    if (!reason) return
    const success = await runAction(
      'cancel',
      () => borrowService.cancelBorrowRequest(selectedRequestId, { reason }),
      'Hủy đơn thất bại.',
    )
    if (success) {
      setCancelOpen(false)
      setCancelReason('')
    }
  }

  const dispatchLine = async (line) => {
    await runAction(
      `dispatch-${line.borrowItemId}`,
      () => borrowService.dispatchTransfer(line.borrowRequestId, { borrowItemId: line.borrowItemId }),
      'Xác nhận gửi linh kiện thất bại.',
    )
  }

  const acceptRequest = async () => {
    await runAction(
      'accept',
      () => borrowService.labAcceptBorrowRequest(selectedRequestId),
      'Chấp nhận đơn thất bại.',
    )
  }

  const issueBorrow = async (payload) => {
    const success = await runAction(
      'issue',
      () => borrowService.issueBorrowRequest(issueRequest.borrowRequestId, payload),
      'Bàn giao linh kiện thất bại.',
    )
    if (success) setIssueRequest(null)
    return success
  }

  const returnBorrow = async (payload) => {
    let updatedRequest = null
    const success = await runAction(
      'return',
      async () => {
        updatedRequest = await borrowService.returnBorrowRequest(returnRequest.borrowRequestId, payload)
        return updatedRequest
      },
      'Tiếp nhận trả đồ thất bại.',
    )
    if (success) {
      const updatedItems = updatedRequest?.items
      const stillOutstanding = Array.isArray(updatedItems) && updatedItems.some((item) => {
        if (String(item.trackingType || '').toLowerCase() === 'consumable') {
          return Number(item.returnedQuantity || 0) < Number(item.quantity || 0)
        }
        return !item.returnedAt && String(item.status || '').toLowerCase() !== 'returned'
      })
      const message = !Array.isArray(updatedItems)
        ? 'Đã ghi nhận nhận trả linh kiện.'
        : stillOutstanding
          ? 'Đã ghi nhận đợt trả. Đơn vẫn còn linh kiện đang mượn.'
          : 'Đã nhận đủ linh kiện. Đơn chuyển sang trạng thái Đã trả.'
      setReturnRequest(null)
      setToast({
        open: true,
        severity: 'success',
        message,
      })
    }
    return success
  }

  return (
    <PortalLayout
      headerTitle="Đơn mượn tại Lab"
      headerSubtitle="Xử lý đơn đã duyệt và chuyển hàng giữa các phòng Lab"
      activeMenuKey="handover"
    >
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
          <Typography variant="h5" fontWeight={700}>Quản lý đơn mượn</Typography>
          <Button startIcon={<RefreshIcon />} variant="outlined" onClick={reloadData} disabled={loading}>
            Làm mới
          </Button>
        </Stack>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {realtimeUnavailable && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Kết nối cập nhật tự động đang không khả dụng. Bạn vẫn có thể làm mới danh sách thủ công.
          </Alert>
        )}
        {actionError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError('')}>{actionError}</Alert>}

        <Paper variant="outlined" sx={{ mb: 2 }}>
          <Tabs
            value={tab}
            onChange={(_, value) => {
              setTab(value)
              setPage(1)
              if (value === 2) setStatus('Ready')
              else if (value === 3) setStatus('Borrowing')
              else if (value === 0 && (tab === 2 || tab === 3)) setStatus('Approved')
            }}
            aria-label="Danh sách đơn Lab"
          >
            <Tab label="Đơn mượn" />
            <Tab label={`Chuyển liên lab (${transfers.length})`} />
            <Tab label="Quầy giao đồ" />
            <Tab label="Quầy nhận trả" />
          </Tabs>
          <Box component="form" onSubmit={handleSearch} sx={{ p: 2 }}>
            <Grid container spacing={1.5} alignItems="center">
              <Grid item xs={12} sm={5} md={4}>
                <TextField
                  fullWidth
                  size="small"
                  label={tab === 2 ? 'Tìm đơn sẵn sàng · MSSV / mã đơn' : 'Tìm mã đơn, sinh viên, đề tài'}
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  InputProps={tab === 2 ? {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label="Chụp thẻ sinh viên"
                          onClick={() => cardInputRef.current?.click()}
                          disabled={cardLoading}
                          edge="end"
                        >
                          {cardLoading ? <CircularProgress size={20} /> : <PhotoCameraIcon />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  } : undefined}
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
              {(tab === 0 || tab === 3) && (
                <Grid item xs={12} sm={3} md={2}>
                  <TextField
                    select
                    fullWidth
                    size="small"
                    label="Trạng thái"
                    value={status}
                    onChange={(event) => { setPage(1); setStatus(event.target.value) }}
                  >
                    {tab === 3 ? (
                      <>
                        <MenuItem value="Borrowing">Đang mượn</MenuItem>
                        <MenuItem value="Overdue">Quá hạn</MenuItem>
                      </>
                    ) : (
                      <>
                        <MenuItem value="Approved">Đã duyệt</MenuItem>
                        <MenuItem value="Ready">Sẵn sàng giao</MenuItem>
                        <MenuItem value="">Tất cả</MenuItem>
                      </>
                    )}
                  </TextField>
                </Grid>
              )}
              <Grid item>
                <Button type="submit" variant="contained" startIcon={<SearchIcon />}>Tìm kiếm</Button>
              </Grid>
            </Grid>
            {tab === 2 && cardMessage && (
              <Alert severity={cardMessage.severity} sx={{ mt: 1.5 }}>{cardMessage.text}</Alert>
            )}
          </Box>
          <Divider />
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress /></Box>
          ) : tab !== 1 ? (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Mã đơn</TableCell>
                    <TableCell>Sinh viên / Lớp</TableCell>
                    <TableCell>Đề tài</TableCell>
                    <TableCell>Lab nhận</TableCell>
                    <TableCell>Ngày nhận dự kiến</TableCell>
                    <TableCell>Trạng thái</TableCell>
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
                      <TableCell>{request.requestCode || '—'}</TableCell>
                      <TableCell>{request.requesterName || '—'}<br /><Typography variant="caption" color="text.secondary">{request.classCode || ''}</Typography></TableCell>
                      <TableCell>{request.projectTitle || '—'}</TableCell>
                      <TableCell>{request.roomName || request.roomCode || '—'}</TableCell>
                      <TableCell>{formatDate(request.borrowDate)}</TableCell>
                      <TableCell>
                        <Stack spacing={0.5} alignItems="flex-start">
                          <Chip size="small" label={request.status} color={statusColor(request.status)} />
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
                  {!requests.length && <TableRow><TableCell colSpan={6} align="center">{tab === 2 ? 'Không tìm thấy đơn sẵn sàng giao.' : tab === 3 ? 'Không có đơn đang mượn cần nhận trả.' : 'Không có đơn phù hợp.'}</TableCell></TableRow>}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Mã đơn</TableCell>
                    <TableCell>Linh kiện</TableCell>
                    <TableCell>Số lượng</TableCell>
                    <TableCell>Luân chuyển</TableCell>
                    <TableCell>Thao tác</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {transfers.map((line) => (
                    <TableRow key={line.borrowItemId}>
                      <TableCell>{line.requestCode || '—'}</TableCell>
                      <TableCell>{line.componentName}<br /><Typography variant="caption" color="text.secondary">{line.componentCode}</Typography></TableCell>
                      <TableCell>{line.quantity} {line.unit || ''}</TableCell>
                      <TableCell>{line.sourceRoomCode || '—'} → {line.pickupRoomCode || '—'}<br /><Typography variant="caption" color="text.secondary">{line.dispatchedAt ? 'Đã gửi' : 'Chờ gửi'}</Typography></TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1}>
                          {line.canDispatch && (
                            <Button size="small" disabled={Boolean(actionLoading)} onClick={() => dispatchLine(line)}>
                              Xác nhận gửi
                            </Button>
                          )}
                          {line.canReceive && (
                            <Button size="small" variant="contained" disabled={Boolean(actionLoading)} onClick={() => openReceiveDialog(line)}>
                              Xác nhận nhận
                            </Button>
                          )}
                          {!line.canDispatch && !line.canReceive && <Typography variant="caption" color="text.secondary">Đang luân chuyển</Typography>}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!transfers.length && <TableRow><TableCell colSpan={5} align="center">Không có dòng chuyển hàng.</TableCell></TableRow>}
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
          />
        </Paper>

        {(tab === 0 || tab === 2 || tab === 3) && (
          <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
            {!selectedRequestId ? (
              <Typography color="text.secondary">Chọn một đơn để xem chi tiết và xử lý.</Typography>
            ) : detailLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
            ) : detailError ? (
              <Alert severity="error">{detailError}</Alert>
            ) : requestDetail ? (
              <Stack spacing={2}>
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
                  <Box>
                    <Typography variant="h6" fontWeight={700}>{requestDetail.requestCode}</Typography>
                    <Typography color="text.secondary">
                      {requestDetail.requesterName} · {requestDetail.classCode} · {requestDetail.projectTitle}
                    </Typography>
                  </Box>
                  <Chip label={requestDetail.status} color={statusColor(requestDetail.status)} />
                </Stack>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}><Typography variant="caption" color="text.secondary">Lab nhận</Typography><Typography>{requestDetail.roomName || requestDetail.roomCode || '—'}</Typography></Grid>
                  <Grid item xs={12} sm={4}><Typography variant="caption" color="text.secondary">Ngày nhận dự kiến</Typography><Typography>{formatDate(requestDetail.borrowDate)}</Typography></Grid>
                  <Grid item xs={12} sm={4}><Typography variant="caption" color="text.secondary">Hạn trả</Typography><Typography>{formatDate(requestDetail.dueDate)}</Typography></Grid>
                </Grid>
                <Divider />
                <Typography fontWeight={600}>Danh sách linh kiện yêu cầu:</Typography>
                {pendingTransfers.length > 0 && (
                  <Alert severity="warning">Còn linh kiện đang chuyển về lab. Chưa thể chấp nhận đơn.</Alert>
                )}
                <TableContainer>
                  <Table size="small">
                    <TableHead><TableRow><TableCell>Linh kiện</TableCell><TableCell>Loại theo dõi</TableCell><TableCell>Số lượng</TableCell><TableCell>Nguồn</TableCell><TableCell>Trạng thái dòng</TableCell><TableCell /></TableRow></TableHead>
                    <TableBody>
                      {detailItems.map((item) => {
                        const transferLine = transfers.find((line) => line.borrowItemId === item.borrowItemId)
                        const isRemote = Boolean(item.sourceRoomId && detailRoomId && item.sourceRoomId !== detailRoomId)
                        return (
                          <TableRow key={item.borrowItemId}>
                            <TableCell>{item.componentName}<br /><Typography variant="caption" color="text.secondary">{item.componentCode}</Typography></TableCell>
                            <TableCell>{item.trackingType || '—'}</TableCell>
                            <TableCell>{item.quantity} {item.unit || ''}</TableCell>
                            <TableCell>{item.sourceRoomCode || 'Lab nhận'}</TableCell>
                            <TableCell>
                              {isRemote && !item.receivedAt
                                ? <Chip size="small" color="warning" label="Đang chuyển" />
                                : <Chip size="small" color="success" label="Sẵn sàng" />}
                            </TableCell>
                            <TableCell>
                              {transferLine?.canDispatch && (
                                <Button size="small" onClick={() => dispatchLine(transferLine)} disabled={Boolean(actionLoading)}>Xác nhận gửi</Button>
                              )}
                              {transferLine?.canReceive && (
                                <Button size="small" onClick={() => openReceiveDialog(transferLine)} disabled={Boolean(actionLoading)}>Xác nhận nhận</Button>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                      {!detailItems.length && <TableRow><TableCell colSpan={6} align="center">Đơn không có linh kiện mượn kho.</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </TableContainer>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="flex-end">
                  {requestDetail.status === 'Approved' && (
                    <Tooltip title={pendingTransfers.length ? 'Còn linh kiện đang chuyển về lab' : ''}>
                      <span>
                        <Button
                          variant="contained"
                          disabled={pendingTransfers.length > 0 || Boolean(actionLoading)}
                          onClick={acceptRequest}
                        >
                          Hoàn tất
                        </Button>
                      </span>
                    </Tooltip>
                  )}
                  {requestDetail.status === 'Ready' && (
                    <Button
                      variant="contained"
                      disabled={Boolean(actionLoading)}
                      onClick={() => setIssueRequest(requestDetail)}
                    >
                      Giao đồ
                    </Button>
                  )}
                  {['Borrowing', 'Overdue'].includes(requestDetail.status) && (
                    <Button
                      variant="contained"
                      color="primary"
                      disabled={Boolean(actionLoading)}
                      onClick={() => setReturnRequest(requestDetail)}
                    >
                      Nhận trả đồ
                    </Button>
                  )}
                  {canCancel && (
                    <Button color="error" variant="outlined" onClick={() => setCancelOpen(true)} disabled={Boolean(actionLoading)}>
                      Hủy đơn
                    </Button>
                  )}
                </Stack>
              </Stack>
            ) : null}
          </Paper>
        )}
      </Container>

      <ReceiveTransferModal
        open={Boolean(receiveLine)}
        line={receiveLine}
        loading={Boolean(actionLoading)}
        onClose={() => setReceiveLine(null)}
        onReceive={receiveTransfer}
      />

      <IssueBorrowModal
        key={issueRequest?.borrowRequestId || 'issue-modal'}
        open={Boolean(issueRequest)}
        request={issueRequest}
        submitting={actionLoading === 'issue'}
        onClose={() => setIssueRequest(null)}
        onIssue={issueBorrow}
      />

      <ReturnBorrowModal
        key={returnRequest?.borrowRequestId || 'return-modal'}
        open={Boolean(returnRequest)}
        request={returnRequest}
        submitting={actionLoading === 'return'}
        onClose={() => setReturnRequest(null)}
        onReturn={returnBorrow}
      />

      <Dialog open={cancelOpen} onClose={() => { if (!actionLoading) setCancelOpen(false) }} fullWidth maxWidth="sm">
        <DialogTitle>Hủy đơn mượn</DialogTitle>
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
          <Button onClick={() => setCancelOpen(false)} disabled={Boolean(actionLoading)}>Đóng</Button>
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
