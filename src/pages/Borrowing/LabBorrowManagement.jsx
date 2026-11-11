import { useCallback, useMemo, useState } from 'react'
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
  MenuItem,
  Paper,
  Stack,
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
import SearchIcon from '@mui/icons-material/Search'
import PortalLayout from '../../components/layout/PortalLayout'
import { useLabBorrowRequests } from '../../hooks/useLabBorrowRequests'
import { extractErrorMessage } from '../../services/api'
import { borrowService } from '../../services/borrowService'
import { inventoryService } from '../../services/inventoryService'

const PAGE_SIZE = 20

function getRows(result) {
  if (Array.isArray(result)) return result
  if (Array.isArray(result?.items)) return result.items
  if (Array.isArray(result?.data?.items)) return result.data.items
  return []
}

function getId(row) {
  return row?.borrowRequestId || row?.id
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('vi-VN').format(date)
}

function isConsumable(trackingType) {
  return String(trackingType || '').toLowerCase() === 'consumable'
}

function statusColor(status) {
  if (status === 'Ready') return 'success'
  if (status === 'Approved') return 'warning'
  if (status === 'Cancelled' || status === 'Rejected') return 'error'
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
  const [cabinets, setCabinets] = useState([])
  const [cabinetId, setCabinetId] = useState('')
  const [cabinetLoading, setCabinetLoading] = useState(false)
  const [scanCode, setScanCode] = useState('')
  const [scannedItems, setScannedItems] = useState([])
  const [scanLoading, setScanLoading] = useState(false)
  const [receiveError, setReceiveError] = useState('')
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

  const openReceiveDialog = async (line) => {
    setReceiveLine(line)
    setCabinets([])
    setCabinetId('')
    setScannedItems([])
    setScanCode('')
    setReceiveError('')
    setCabinetLoading(true)
    try {
      const availableCabinets = await inventoryService.getCabinets({
        roomId: line.pickupRoomId,
        page: 1,
        size: 100,
      })
      setCabinets(availableCabinets.filter((cabinet) => cabinet.roomId === line.pickupRoomId))
    } catch (loadError) {
      setReceiveError(extractErrorMessage(loadError, 'Không thể tải danh sách tủ của lab nhận.'))
    } finally {
      setCabinetLoading(false)
    }
  }

  const handleScanItem = async (event) => {
    event.preventDefault()
    const code = scanCode.trim()
    if (!code || !receiveLine) return
    if (scannedItems.length >= receiveLine.quantity) {
      setReceiveError(`Chỉ được quét đúng ${receiveLine.quantity} item cho dòng linh kiện này.`)
      return
    }
    setScanLoading(true)
    setReceiveError('')
    try {
      const result = await inventoryService.getComponentItems({
        search: code,
        componentId: receiveLine.componentId,
        page: 1,
        size: 50,
      })
      const matches = getRows(result).filter((item) => {
        const sameComponent = item.componentId === receiveLine.componentId
        const normalizedCode = code.toLocaleLowerCase()
        return sameComponent && [item.itemCode, item.serialNumber]
          .some((value) => String(value || '').trim().toLocaleLowerCase() === normalizedCode)
      })
      if (matches.length !== 1) {
        throw new Error(matches.length
          ? 'Mã quét khớp với nhiều item. Vui lòng nhập mã con duy nhất.'
          : 'Không tìm thấy mã item chính xác thuộc linh kiện này.')
      }
      const item = matches[0]
      if (!item.itemId) throw new Error('Dữ liệu item tra cứu không có itemId.')
      if (scannedItems.some((scanned) => scanned.itemId === item.itemId)) {
        throw new Error('Item này đã được quét; không thể thêm trùng.')
      }
      setScannedItems((current) => [...current, item])
      setScanCode('')
    } catch (scanError) {
      setReceiveError(extractErrorMessage(scanError, 'Tra cứu mã item thất bại.'))
    } finally {
      setScanLoading(false)
    }
  }

  const submitReceive = async () => {
    if (!receiveLine || !cabinetId) return
    const requiresItemIds = !isConsumable(receiveLine.trackingType)
    if (requiresItemIds && scannedItems.length !== receiveLine.quantity) {
      setReceiveError(`Cần quét đủ ${receiveLine.quantity} item trước khi xác nhận nhận hàng.`)
      return
    }
    const success = await runAction(
      `receive-${receiveLine.borrowItemId}`,
      () => borrowService.receiveTransfer(receiveLine.borrowRequestId, {
        borrowItemId: receiveLine.borrowItemId,
        toCabinetId: cabinetId,
        itemIds: requiresItemIds ? scannedItems.map((item) => item.itemId) : [],
      }),
      'Xác nhận nhận hàng thất bại.',
    )
    if (success) {
      setReceiveLine(null)
    }
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

  const pageInfo = tab === 0 ? requestResult : transferResult
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
          <Tabs value={tab} onChange={(_, value) => { setTab(value); setPage(1) }} aria-label="Danh sách đơn Lab">
            <Tab label="Đơn mượn" />
            <Tab label={`Chuyển liên lab (${transfers.length})`} />
          </Tabs>
          <Box component="form" onSubmit={handleSearch} sx={{ p: 2 }}>
            <Grid container spacing={1.5} alignItems="center">
              <Grid item xs={12} sm={5} md={4}>
                <TextField
                  fullWidth
                  size="small"
                  label="Tìm mã đơn, sinh viên, đề tài"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                />
              </Grid>
              {tab === 0 && (
                <Grid item xs={12} sm={3} md={2}>
                  <TextField
                    select
                    fullWidth
                    size="small"
                    label="Trạng thái"
                    value={status}
                    onChange={(event) => { setPage(1); setStatus(event.target.value) }}
                  >
                    <MenuItem value="Approved">Đã duyệt</MenuItem>
                    <MenuItem value="Ready">Sẵn sàng giao</MenuItem>
                    <MenuItem value="">Tất cả</MenuItem>
                  </TextField>
                </Grid>
              )}
              <Grid item>
                <Button type="submit" variant="contained" startIcon={<SearchIcon />}>Tìm kiếm</Button>
              </Grid>
            </Grid>
          </Box>
          <Divider />
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress /></Box>
          ) : tab === 0 ? (
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
                      <TableCell><Chip size="small" label={request.status} color={statusColor(request.status)} /></TableCell>
                    </TableRow>
                  ))}
                  {!requests.length && <TableRow><TableCell colSpan={6} align="center">Không có đơn phù hợp.</TableCell></TableRow>}
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

        {tab === 0 && (
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
                <Typography fontWeight={600}>Linh kiện trong đơn</Typography>
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
                          Chấp nhận, báo SV đến nhận
                        </Button>
                      </span>
                    </Tooltip>
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

      <Dialog open={Boolean(receiveLine)} onClose={() => { if (!actionLoading && !scanLoading) setReceiveLine(null) }} fullWidth maxWidth="sm">
        <DialogTitle>Xác nhận nhận hàng chuyển Lab</DialogTitle>
        <DialogContent>
          {receiveLine && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Alert severity="info">
                {receiveLine.componentName} · cần nhận đúng {receiveLine.quantity} {receiveLine.unit || 'item'}.
              </Alert>
              {receiveError && <Alert severity="error">{receiveError}</Alert>}
              <TextField
                select
                fullWidth
                label="Tủ lưu tại lab nhận"
                value={cabinetId}
                onChange={(event) => setCabinetId(event.target.value)}
                disabled={cabinetLoading}
              >
                {cabinets.map((cabinet) => (
                  <MenuItem key={cabinet.cabinetId} value={cabinet.cabinetId}>
                    {cabinet.cabinetCode} · {cabinet.cabinetName}
                  </MenuItem>
                ))}
              </TextField>
              {cabinetLoading && <CircularProgress size={22} />}
              {!cabinetLoading && !cabinets.length && <Alert severity="warning">Lab nhận chưa có tủ phù hợp để lưu linh kiện.</Alert>}
              {isConsumable(receiveLine.trackingType) ? (
                <Typography variant="body2" color="text.secondary">
                  Linh kiện tiêu hao không cần quét mã từng con.
                </Typography>
              ) : (
                <>
                  <Box component="form" onSubmit={handleScanItem}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                      <TextField
                        autoFocus
                        fullWidth
                        label="Quét hoặc nhập itemCode / serialNumber"
                        value={scanCode}
                        onChange={(event) => setScanCode(event.target.value)}
                        disabled={scanLoading || scannedItems.length >= receiveLine.quantity}
                      />
                      <Button type="submit" variant="outlined" disabled={!scanCode.trim() || scanLoading || scannedItems.length >= receiveLine.quantity}>
                        {scanLoading ? <CircularProgress size={20} /> : 'Thêm'}
                      </Button>
                    </Stack>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Đã quét {scannedItems.length}/{receiveLine.quantity}. Mã item không được quét trùng.
                  </Typography>
                  <Stack direction="row" useFlexGap flexWrap="wrap" spacing={1}>
                    {scannedItems.map((item) => (
                      <Chip
                        key={item.itemId}
                        label={item.itemCode || item.serialNumber}
                        onDelete={() => setScannedItems((current) => current.filter((entry) => entry.itemId !== item.itemId))}
                      />
                    ))}
                  </Stack>
                </>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReceiveLine(null)} disabled={Boolean(actionLoading) || scanLoading}>Đóng</Button>
          <Button
            variant="contained"
            disabled={
              !receiveLine ||
              !cabinetId ||
              cabinetLoading ||
              Boolean(actionLoading) ||
              (!isConsumable(receiveLine?.trackingType) && scannedItems.length !== receiveLine?.quantity)
            }
            onClick={submitReceive}
          >
            Xác nhận đã nhận
          </Button>
        </DialogActions>
      </Dialog>

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
    </PortalLayout>
  )
}
