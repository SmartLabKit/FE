import { useEffect, useState } from 'react'
import { Box, Step, StepLabel, Stepper, Typography } from '@mui/material'
import { projectService } from '../../services/projectService'

const RECEIVED_STATUSES = ['Borrowing', 'Overdue', 'Returned']
const DROPPED_STATUSES = ['Cancelled', 'Rejected']

/**
 * Các bước của nhóm từ lúc lập nhóm tới nộp bài, giống khối "Bắt đầu" trên mobile:
 * bước xong có dấu tick xanh, bước hiện tại tô xanh kèm một dòng gợi ý việc cần làm.
 */
function buildSteps({ choosingOpen, project, borrowRequests }) {
  const status = project?.status || ''
  const finalStatus = project?.finalStatus || ''
  const liveRequests = borrowRequests.filter((br) => !DROPPED_STATUSES.includes(br.status))
  const received = liveRequests.some((br) => RECEIVED_STATUSES.includes(br.status))
  const approved = status === 'Approved'

  let projectHint = 'Trưởng nhóm tạo đề tài và chọn linh kiện.'
  if (status === 'Draft') projectHint = 'Đề tài đang nháp, trưởng nhóm gửi duyệt khi xong.'
  if (status === 'Rejected') projectHint = 'Giảng viên trả lại đề tài, sửa rồi gửi duyệt lại.'

  let borrowHint = 'Chờ lab chuẩn bị đồ và hẹn ngày nhận.'
  if (liveRequests.some((br) => br.status === 'Ready')) borrowHint = 'Lab đã hẹn ngày, mang thẻ sinh viên đến nhận đồ.'

  let finalHint = 'Nộp link GitHub, slide, video demo và báo cáo khi làm xong.'
  if (finalStatus === 'Pending') finalHint = 'Đã nộp, chờ giảng viên xác nhận.'
  if (finalStatus === 'Returned') finalHint = 'Giảng viên trả lại bài nộp, sửa rồi nộp lại.'

  return [
    { label: 'Lập nhóm', done: !choosingOpen || Boolean(project), hint: 'Nhóm vẫn đổi thành viên được tới hết hạn chọn nhóm.' },
    { label: 'Đăng ký đề tài', done: ['Submitted', 'Approved'].includes(status), hint: projectHint },
    { label: 'GV duyệt đề tài', done: approved, hint: 'Đề tài đang chờ giảng viên duyệt.' },
    {
      label: 'Nhận linh kiện',
      done: approved && (received || liveRequests.length === 0),
      doneText: approved && liveRequests.length === 0 ? 'Không mượn kho' : '',
      hint: borrowHint,
    },
    { label: 'Nộp bài cuối', done: finalStatus === 'Accepted', hint: finalHint },
  ]
}

export default function TeamProgressSteps({ project, choosingOpen }) {
  const projectId = project?.projectId || ''
  const [detail, setDetail] = useState(null)

  useEffect(() => {
    if (!projectId) return undefined
    let active = true
    projectService
      .getProject(projectId)
      .then((result) => {
        if (active) setDetail(result)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [projectId])

  const shown = detail?.projectId === projectId ? detail : null
  const steps = buildSteps({
    choosingOpen,
    project: shown || project,
    borrowRequests: Array.isArray(shown?.borrowRequests) ? shown.borrowRequests : [],
  })
  let current = steps.findIndex((step) => !step.done)
  if (current === -1) current = steps.length

  return (
    <Box sx={{ border: '1px solid #e4e6ef', borderRadius: 2, bgcolor: '#f8fafc', px: 2, py: 1.75, mb: 2 }}>
      <Stepper activeStep={current} alternativeLabel>
        {steps.map((step, index) => (
          <Step key={step.label} completed={step.done}>
            <StepLabel
              sx={{
                '& .MuiStepIcon-root.Mui-completed': { color: '#16a34a' },
                '& .MuiStepLabel-label': { fontSize: 12, mt: 0.75 },
              }}
              optional={
                step.done && step.doneText ? (
                  <Typography variant="caption" sx={{ color: '#64748b', display: 'block', textAlign: 'center' }}>
                    {step.doneText}
                  </Typography>
                ) : null
              }
            >
              {index === current ? <strong>{step.label}</strong> : step.label}
            </StepLabel>
          </Step>
        ))}
      </Stepper>
      <Typography variant="body2" sx={{ textAlign: 'center', mt: 1.25, color: current === steps.length ? '#15803d' : '#0058be', fontWeight: 600 }}>
        {current === steps.length ? 'Nhóm đã hoàn thành đề tài.' : steps[current].hint}
      </Typography>
    </Box>
  )
}
