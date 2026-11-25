import { useCallback, useEffect, useState } from 'react'
import { Alert, Box, Button, CircularProgress, Container, Paper, Typography } from '@mui/material'
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material'
import { useNavigate, useParams } from 'react-router-dom'
import PortalLayout from '../../components/layout/PortalLayout'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import { useAuth } from '../../context/AuthContext'
import { useEntityChanged } from '../../hooks/useEntityChanged'
import { returnSlipService } from '../../services/returnSlipService'
import { formatVietnamDate, formatVietnamDateTime } from '../../utils/dateFormatting'
import { labLabel } from '../../utils/labLabel'
import ReturnRow from './ReturnRow'
import ReturnSlipStaffActions from './ReturnSlipStaffActions'
import { COLORS, itemSubtitle, longDate, returnResult, slipStatusText } from './returnSlipHelpers'

/** Phần chính của phiếu, đổi theo trạng thái: chờ duyệt, ngày mang lên, lý do từ chối, đã nhận. */
function Headline({ slip }) {
  if (slip.status === 'Approved') {
    return (
      <>
        <Typography sx={{ fontSize: 14, color: COLORS.grey }}>Mang lên ngày</Typography>
        <Typography sx={{ fontSize: { xs: 24, sm: 30 }, fontWeight: 800, color: slip.isLate ? COLORS.red : COLORS.blue, lineHeight: 1.3 }}>
          {longDate(slip.appointmentDate)}
        </Typography>
        {slip.isLate && <Typography sx={{ color: COLORS.red, fontSize: 14 }}>Đã qua ngày hẹn, hãy liên hệ lab để đổi ngày.</Typography>}
      </>
    )
  }
  const text = {
    Pending: 'Chờ lab duyệt',
    Rejected: 'Lab từ chối',
    Completed: `Lab đã nhận ${formatVietnamDate(slip.receivedAt)}`,
    Cancelled: 'Đã hủy',
  }[slip.status]
  return <Typography sx={{ fontSize: { xs: 22, sm: 26 }, fontWeight: 800, color: slipStatusText(slip).color }}>{text}</Typography>
}

export default function ReturnSlipDetail() {
  const { id } = useParams()
  const { user, hasRole } = useAuth()
  const isStaff = hasRole('LabStaff')
  const navigate = useNavigate()
  const [slip, setSlip] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmRequest, setConfirmRequest] = useState(null)

  const load = useCallback(() => {
    returnSlipService
      .getById(id)
      .then((data) => {
        setSlip(data)
        setError('')
      })
      .catch((loadError) => setError(loadError.message))
  }, [id])

  useEffect(load, [load])
  useEntityChanged(load)

  const cancel = async () => {
    setBusy(true)
    try {
      setSlip(await returnSlipService.cancel(id))
      setError('')
    } catch (cancelError) {
      setError(cancelError.message)
      load()
    } finally {
      setBusy(false)
    }
  }

  const orderPath = slip ? `/borrow/requests/${slip.borrowRequestId}` : ''
  const canResend = [slip?.requesterId, slip?.createdBy].includes(user?.userId)

  return (
    <PortalLayout headerTitle="Phiếu trả" headerSubtitle={slip?.slipCode || ''}>
      <Container maxWidth="sm" disableGutters sx={{ py: 3 }}>
        {slip && (
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => (isStaff ? navigate('/borrow/lab-orders', { state: { tab: 5 } }) : navigate(orderPath))}
            sx={{ mb: 2, textTransform: 'none', fontWeight: 700 }}
          >
            {isStaff ? 'Phiếu trả' : `Đơn ${slip.requestCode}`}
          </Button>
        )}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {!slip && !error && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        )}
        {slip && (
          <Paper elevation={0} sx={{ p: { xs: 2.5, sm: 3.5 }, border: '1px solid #e4e6ef', borderRadius: 2 }}>
            <Typography sx={{ fontWeight: 800, fontSize: 18, mb: 2 }}>{slip.slipCode}</Typography>
            <Headline slip={slip} />
            <Typography sx={{ mt: 0.5 }}>{labLabel(slip)}</Typography>
            {isStaff && (
              <Typography sx={{ mt: 0.5, fontSize: 14, color: COLORS.grey }}>
                {slip.requesterName} · {slip.studentCode} · hạn trả {formatVietnamDate(slip.dueDate)}
              </Typography>
            )}
            {slip.reviewComment && (
              <Typography sx={{ mt: 0.5, fontSize: 14, color: slip.status === 'Rejected' ? COLORS.red : COLORS.grey }}>
                {{ Rejected: 'Lý do: ', Cancelled: '' }[slip.status] ?? 'Lab nhắn: '}
                {slip.reviewComment}
              </Typography>
            )}
            {slip.note && <Typography sx={{ mt: 0.5, fontSize: 14, color: COLORS.grey }}>Ghi chú: {slip.note}</Typography>}

            <Typography sx={{ fontWeight: 700, mt: 3, mb: 0.5 }}>
              {slip.status === 'Completed' ? 'Các món' : 'Món cần mang'}
            </Typography>
            {slip.items.map((item) => (
              <ReturnRow
                key={item.borrowItemId}
                title={item.componentName}
                subtitle={itemSubtitle(item, `${item.quantity}/${item.borrowedQuantity}`)}
                status={
                  returnResult(item, item.lineStatus, item.borrowedQuantity) ||
                  (slip.status === 'Completed' ? { text: 'Chưa mang', color: COLORS.amber } : null)
                }
              />
            ))}

            <Typography sx={{ mt: 2, fontSize: 12.5, color: COLORS.grey }}>
              {slip.createdByName} gửi {formatVietnamDateTime(slip.createdAt)}
              {slip.receivedByName ? ` · ${slip.receivedByName} nhận ${formatVietnamDateTime(slip.receivedAt)}` : ''}
            </Typography>
            {slip.status === 'Rejected' && canResend && (
              <Button
                fullWidth
                variant="contained"
                onClick={() => navigate(orderPath, { state: { returnItemIds: slip.items.map((item) => item.borrowItemId) } })}
                sx={{ mt: 2.5, py: 1.25, textTransform: 'none', fontWeight: 700, bgcolor: '#0058be' }}
              >
                Tạo lại
              </Button>
            )}
            {isStaff && ['Pending', 'Approved'].includes(slip.status) && (
              <ReturnSlipStaffActions key={`${slip.status}-${slip.appointmentDate}`} slip={slip} onChanged={setSlip} />
            )}
            {slip.canCancel && (
              <Button
                fullWidth
                disabled={busy}
                onClick={() =>
                  setConfirmRequest({
                    title: 'Hủy phiếu trả?',
                    message: 'Các món vẫn đang mượn, bạn tạo phiếu khác được.',
                    confirmText: 'Hủy phiếu',
                    onConfirm: cancel,
                  })
                }
                sx={{ mt: 2, textTransform: 'none', color: COLORS.grey }}
              >
                Hủy phiếu
              </Button>
            )}
          </Paper>
        )}
      </Container>
      <ConfirmDialog request={confirmRequest} onClose={() => setConfirmRequest(null)} />
    </PortalLayout>
  )
}
