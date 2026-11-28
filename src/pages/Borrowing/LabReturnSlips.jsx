import { useCallback, useEffect, useState } from 'react'
import { Alert, Box, CircularProgress, Typography } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { useEntityChanged } from '../../hooks/useEntityChanged'
import { returnSlipService } from '../../services/returnSlipService'
import ReturnRow, { RowGroup } from './ReturnRow'
import { COLORS, daysUntil, slipStatusText } from './returnSlipHelpers'

/** Chữ bên phải của một phiếu trong danh sách của lab. */
function actionText(slip) {
  if (slip.status === 'Pending') return { text: 'Duyệt ›', color: COLORS.amber }
  if (daysUntil(slip.appointmentDate) === 0) return { text: 'Nhận trả ›', color: COLORS.blue }
  return slipStatusText(slip)
}

/** Phiếu trả của lab đang cần xử lý: chờ duyệt, hẹn hôm nay hoặc trễ, sắp tới. */
export default function LabReturnSlips() {
  const navigate = useNavigate()
  const [slips, setSlips] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    Promise.all([returnSlipService.getAll({ status: 'Pending' }), returnSlipService.getAll({ status: 'Approved' })])
      .then(([pending, approved]) => {
        setSlips([...pending, ...approved])
        setError('')
      })
      .catch((loadError) => setError(loadError.message))
  }, [])

  useEffect(load, [load])
  useEntityChanged(load)

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
      </Alert>
    )
  }
  if (!slips) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
        <CircularProgress />
      </Box>
    )
  }

  const approved = slips
    .filter((slip) => slip.status === 'Approved')
    .sort((a, b) => String(a.appointmentDate).localeCompare(String(b.appointmentDate)))
  const sections = [
    { title: 'Chờ duyệt', items: slips.filter((slip) => slip.status === 'Pending').reverse() },
    { title: 'Hôm nay', items: approved.filter((slip) => daysUntil(slip.appointmentDate) === 0) },
    { title: 'Trễ hẹn', items: approved.filter((slip) => daysUntil(slip.appointmentDate) < 0) },
    { title: 'Sắp tới', items: approved.filter((slip) => daysUntil(slip.appointmentDate) > 0) },
  ].filter((section) => section.items.length > 0)

  return (
    <Box sx={{ maxWidth: 680, px: { xs: 2, sm: 3 }, py: 1.5 }}>
      {sections.length === 0 && <Typography sx={{ py: 3, color: COLORS.grey }}>Không có phiếu trả nào cần xử lý.</Typography>}
      {sections.map((section) => (
        <RowGroup key={section.title} title={section.title} count={section.items.length} sx={{ mb: 2 }}>
          {section.items.map((slip) => (
            <ReturnRow
              key={slip.returnSlipId}
              title={slip.slipCode}
              subtitle={[slip.requesterName, slip.projectTitle, `${slip.itemCount} món`].filter(Boolean).join(' · ')}
              status={actionText(slip)}
              onClick={() => navigate(`/borrow/return-slips/${slip.returnSlipId}`)}
            />
          ))}
        </RowGroup>
      ))}
    </Box>
  )
}
