import { useCallback, useEffect, useState } from 'react'
import { Alert, Box, Button, CircularProgress, Container, Paper, Snackbar, Stack, Typography } from '@mui/material'
import { ArrowBack as ArrowBackIcon, Cancel as CancelIcon } from '@mui/icons-material'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import PortalLayout from '../../components/layout/PortalLayout'
import { useAuth } from '../../context/AuthContext'
import { useEntityChanged } from '../../hooks/useEntityChanged'
import { borrowService } from '../../services/borrowService'
import { formatVietnamDate, formatVietnamDateTime } from '../../utils/dateFormatting'
import { getBorrowRequestStatusMeta, getShownPurpose } from './borrowHelpers'
import { labLabel } from '../../utils/labLabel'
import ReturnRow from './ReturnRow'
import ReturnSlipDialog from './ReturnSlipDialog'
import { COLORS, daysUntil, itemSubtitle, returnResult, shortDate, slipStatusText } from './returnSlipHelpers'

const isBorrowed = (request) => ['Borrowing', 'Overdue'].includes(request?.status)

/** Chữ trạng thái của một món trong đơn; món đang mượn chưa có phiếu trả thì để trống cho gọn. */
function itemStatus(item, request) {
  const result = returnResult(item, item.status, item.quantity)
  if (result) {
    const day = item.returnedAt ? ` ${shortDate(item.returnedAt)}` : ''
    return { ...result, text: `${result.text}${day}` }
  }
  if (item.status === 'Issued') {
    const slip = request.returnSlips?.find((s) => s.returnSlipId === item.returnSlipId)
    return slip ? slipStatusText(slip) : null
  }
  if (isBorrowed(request)) return { text: 'Con thay thế, chờ giao', color: COLORS.blue }
  if (['Approved', 'Ready'].includes(request.status)) return { text: 'Chờ giao', color: COLORS.grey }
  if (['Cancelled', 'Rejected'].includes(request.status)) return { text: 'Không giao', color: COLORS.grey }
  return null
}

function dueText(dueDate) {
  const days = daysUntil(dueDate)
  if (days < 0) return { text: `quá hạn ${-days} ngày`, color: COLORS.red }
  if (days === 0) return { text: 'hôm nay', color: COLORS.red }
  return { text: `còn ${days} ngày`, color: days <= 7 ? COLORS.amber : COLORS.grey }
}

export default function BorrowRequestDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, hasRole } = useAuth()
  const [request, setRequest] = useState(null)
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })
  const [returnOpen, setReturnOpen] = useState(Boolean(location.state?.returnItemIds))
  const isStudent = user?.roleLabel === 'STUDENT' || user?.roles?.some((role) => role.toLowerCase() === 'student')
  const isStaff = hasRole?.('LabStaff')
  const hasMyRequests = isStudent || hasRole?.('Lecturer')
  const backLabel = isStaff ? 'Xử lý đơn mượn' : isStudent ? 'Đơn mượn của tôi' : 'Quay lại'
  const goBack = () => {
    if (isStaff) navigate('/borrow/lab-orders')
    else if (hasMyRequests) navigate('/borrow/my-requests')
    else navigate(-1)
  }
  const canCancel = isStudent && ['Approved', 'Ready'].includes(request?.status)

  useEffect(() => {
    let active = true
    borrowService.getBorrowRequestById(id)
      .then((result) => {
        if (active) setRequest(result)
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || 'Không thể tải chi tiết đơn mượn.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [id])

  const reload = useCallback(() => {
    borrowService.getBorrowRequestById(id).then(setRequest).catch(() => {})
  }, [id])
  useEntityChanged(reload)

  const borrowed = isBorrowed(request)
  const items = request?.items || []
  const stillOut = items.filter((item) => item.status === 'Issued')
  const others = items.filter((item) => item.status !== 'Issued')
  const returnable = stillOut.filter((item) => !item.returnSlipId)
  const canReturn = Boolean(request?.canCreateReturnSlip) && returnable.length > 0
  const due = request?.dueDate ? dueText(request.dueDate) : null

  const handleCancel = async () => {
    setCancelling(true)
    setError('')
    try {
      const result = await borrowService.cancelBorrowRequest(id, {})
      setRequest(result)
      setToast({ open: true, message: 'Đã hủy đơn mượn và hoàn trả hàng đã giữ về kho.', severity: 'success' })
    } catch (requestError) {
      setError(requestError.message || 'Không thể hủy đơn mượn.')
    } finally {
      setCancelling(false)
    }
  }

  return (
    <PortalLayout headerTitle="Chi tiết đơn mượn" headerSubtitle={request?.requestCode || 'Đơn mượn của tôi'}>
      <Container maxWidth="sm" disableGutters sx={{ py: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={goBack}
          sx={{ mb: 2, textTransform: 'none', fontWeight: 700 }}
        >
          {backLabel}
        </Button>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
        ) : error && !request ? (
          <Alert severity="error">{error}</Alert>
        ) : request && (
          <Stack spacing={2}>
            {error && <Alert severity="error">{error}</Alert>}
            <Paper elevation={0} sx={{ p: { xs: 2.5, sm: 3.5 }, border: '1px solid #e4e6ef', borderRadius: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                <Typography sx={{ fontWeight: 800, fontSize: 21 }}>{request.requestCode}</Typography>
                <Typography sx={{ fontWeight: 700, color: getBorrowRequestStatusMeta(request.status).sx?.color || COLORS.grey }}>
                  {getBorrowRequestStatusMeta(request.status).label}
                </Typography>
              </Box>
              <Typography sx={{ fontSize: 14, color: COLORS.grey }}>
                {[request.projectTitle, labLabel(request)].filter(Boolean).join(' · ')}
              </Typography>
              {request.status === 'Ready' && request.borrowDate && (
                <Typography sx={{ mt: 1.5 }}>
                  Đến nhận ngày <b>{formatVietnamDate(request.borrowDate)}</b>, nhớ mang thẻ sinh viên
                </Typography>
              )}
              {request.dueDate && (
                <Typography sx={{ mt: request.status === 'Ready' ? 0.5 : 1.5 }}>
                  Hạn trả <b>{formatVietnamDate(request.dueDate)}</b>
                  {borrowed && <span style={{ color: due.color }}> ({due.text})</span>}
                </Typography>
              )}
              {request.rejectReason && <Alert severity="warning" sx={{ mt: 2 }}>{request.rejectReason}</Alert>}

              {(borrowed ? stillOut : items).length > 0 && (
                <Typography sx={{ fontWeight: 700, mt: 3, mb: 0.5 }}>{borrowed ? 'Đang mượn' : 'Linh kiện'}</Typography>
              )}
              {(borrowed ? stillOut : items).map((item) => (
                <ReturnRow
                  key={item.borrowItemId}
                  title={item.componentName}
                  subtitle={itemSubtitle(item)}
                  status={itemStatus(item, request)}
                  onClick={item.returnSlipId ? () => navigate(`/borrow/return-slips/${item.returnSlipId}`) : undefined}
                />
              ))}
              {items.length === 0 && <Typography sx={{ mt: 2, color: COLORS.grey }}>Đơn chưa có linh kiện.</Typography>}

              {canReturn && (
                <Button
                  fullWidth
                  variant="contained"
                  onClick={() => setReturnOpen(true)}
                  sx={{ mt: 2.5, py: 1.25, textTransform: 'none', fontWeight: 700, bgcolor: '#0058be' }}
                >
                  Trả linh kiện
                </Button>
              )}

              {request.returnSlips?.length > 0 && (
                <>
                  <Typography sx={{ fontWeight: 700, mt: 3, mb: 0.5 }}>Phiếu trả</Typography>
                  {request.returnSlips.map((slip) => (
                    <ReturnRow
                      key={slip.returnSlipId}
                      title={slip.slipCode}
                      subtitle={`${slip.itemCount} món`}
                      status={slipStatusText(slip)}
                      onClick={() => navigate(`/borrow/return-slips/${slip.returnSlipId}`)}
                    />
                  ))}
                </>
              )}

              {borrowed && others.length > 0 && (
                <>
                  <Typography sx={{ fontWeight: 700, mt: 3, mb: 0.5 }}>Đã xử lý</Typography>
                  {others.map((item) => (
                    <ReturnRow
                      key={item.borrowItemId}
                      title={item.componentName}
                      subtitle={itemSubtitle(item)}
                      status={itemStatus(item, request)}
                    />
                  ))}
                </>
              )}

              <Typography sx={{ mt: 3, fontSize: 13, color: COLORS.grey, lineHeight: 1.7 }}>
                {request.requesterName} ({request.studentCode}) · {request.classCode}
                <br />
                Gửi {formatVietnamDateTime(request.requestDate)}
                {getShownPurpose(request.purpose) && (
                  <>
                    <br />
                    {getShownPurpose(request.purpose)}
                  </>
                )}
              </Typography>
            </Paper>

            {canCancel && (
              <Alert
                severity="warning"
                action={
                  <Button
                    color="error"
                    startIcon={cancelling ? <CircularProgress size={16} /> : <CancelIcon />}
                    disabled={cancelling}
                    onClick={handleCancel}
                  >
                    {cancelling ? 'Đang hủy...' : 'Hủy đơn'}
                  </Button>
                }
              >
                Bạn có thể hủy đơn đã duyệt trước khi Lab giao linh kiện.
              </Alert>
            )}
          </Stack>
        )}
      </Container>

      {returnOpen && canReturn && (
        <ReturnSlipDialog
          borrowRequestId={id}
          items={returnable}
          preselected={location.state?.returnItemIds}
          onClose={() => setReturnOpen(false)}
          onCreated={(slip) => navigate(`/borrow/return-slips/${slip.returnSlipId}`)}
        />
      )}
      <Snackbar
        open={toast.open}
        autoHideDuration={5000}
        onClose={() => setToast((current) => ({ ...current, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={toast.severity} onClose={() => setToast((current) => ({ ...current, open: false }))}>
          {toast.message}
        </Alert>
      </Snackbar>
    </PortalLayout>
  )
}
