import { useState } from 'react'
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Grid,
  Paper,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import {
  CheckCircle as CheckCircleIcon,
  Save as SaveIcon,
  Info as InfoIcon,
  ArrowForward as ArrowForwardIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material'

/**
 * CourseQuotaSetting Component (Actor: LECTURER)
 * Cài đặt định mức linh kiện cho từng nhóm trong môn học (Phân hệ 3 trong quy trình Class Setup)
 */
export default function CourseQuotaSetting({ onNext, onPrev }) {
  // State cấu hình định mức linh kiện theo loại
  const [quotas, setQuotas] = useState([
    {
      id: 'vdk',
      type: 'Vi điều khiển',
      limitPerGroup: 2,
      currentStock: 120,
      note: 'Mỗi nhóm chỉ nhận tối đa 2 board chính.',
    },
    {
      id: 'cb',
      type: 'Cảm biến',
      limitPerGroup: 5,
      currentStock: 450,
      note: 'Bao gồm cảm biến nhiệt, cảm biến siêu âm, cảm biến chuyển động.',
    },
    {
      id: 'module',
      type: 'Modulo kết nối',
      limitPerGroup: 3,
      currentStock: 180,
      note: 'Bao gồm modulo Wi-Fi, Bluetooth, Ethernet.',
    },
    {
      id: 'thudong',
      type: 'Linh kiện thụ động',
      limitPerGroup: 20,
      currentStock: 1200,
      note: 'Bao gồm điện trở, tụ điện, cuộn cảm, LED.',
    },
  ])

  // System notification alert state
  const [showSavedAlert, setShowSavedAlert] = useState(false)
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })

  // Handle thay đổi số lượng định mức
  const handleLimitChange = (id, value) => {
    const val = parseInt(value, 10) || 0
    setQuotas((prev) =>
      prev.map((q) => (q.id === id ? { ...q, limitPerGroup: val < 0 ? 0 : val } : q))
    )
  }

  // Save quotas handler
  const handleSaveQuotas = () => {
    setShowSavedAlert(true)
    setToast({
      open: true,
      message: 'Hệ thống đã lưu cấu hình định mức cho môn EE302 thành công!',
      severity: 'success',
    })
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      {/* Header section */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: '#131b2e', mb: 0.5 }}>
          Cài đặt định mức linh kiện
        </Typography>
        <Typography variant="body2" sx={{ color: '#424754', fontSize: 13 }}>
          Bước 3: Cài đặt định mức linh kiện cho từng nhóm trong môn học (Dành cho Giảng viên)
        </Typography>
      </Box>

      {/* Top Course Overview Card */}
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          mb: 3,
          borderRadius: 2,
          border: '1px solid #e4e6ef',
          bgcolor: '#ffffff',
        }}
      >
        <Typography variant="caption" sx={{ fontWeight: 700, color: '#0058be', textTransform: 'uppercase' }}>
          Thông tin môn học
        </Typography>
        <Typography variant="h6" sx={{ fontWeight: 800, color: '#131b2e', mb: 2 }}>
          EE302 - Embedded Systems, HK2 2025-2026
        </Typography>

        <Grid container spacing={2}>
          <Grid item xs={4}>
            <Box sx={{ p: 1.8, bgcolor: '#f8fafc', borderRadius: 1.5, border: '1px solid #edf2f7' }}>
              <Typography variant="caption" sx={{ color: '#6b7280', fontWeight: 600, display: 'block' }}>
                SỐ NHÓM
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#131b2e' }}>
                12 nhóm
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={4}>
            <Box sx={{ p: 1.8, bgcolor: '#f8fafc', borderRadius: 1.5, border: '1px solid #edf2f7' }}>
              <Typography variant="caption" sx={{ color: '#6b7280', fontWeight: 600, display: 'block' }}>
                TỔNG LINH KIỆN DỰ KIẾN
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#0058be' }}>
                1,248
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={4}>
            <Box sx={{ p: 1.8, bgcolor: '#f8fafc', borderRadius: 1.5, border: '1px solid #edf2f7' }}>
              <Typography variant="caption" sx={{ color: '#6b7280', fontWeight: 600, display: 'block' }}>
                TỒN KHO HIỆN TẠI
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#059669' }}>
                3,856
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Main Quota Configuration Card */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: 2,
          border: '1px solid #e4e6ef',
          bgcolor: '#ffffff',
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 700, fontSize: 16, color: '#131b2e', mb: 2 }}>
          Cấu hình định mức linh kiện
        </Typography>

        <TableContainer sx={{ border: '1px solid #f0f2f5', borderRadius: 1.5, mb: 2 }}>
          <Table size="small">
            <TableHead sx={{ bgcolor: '#fafbff' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280', width: '22%' }}>
                  LOẠI LINH KIỆN
                </TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280', width: '22%' }}>
                  ĐỊNH MỨC / NHÓM
                </TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280', width: '20%' }}>
                  TỔNG KHO HIỆN TẠI
                </TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>
                  GHI CHÚ
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {quotas.map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell sx={{ fontWeight: 700, fontSize: 13, color: '#131b2e' }}>
                    {item.type}
                  </TableCell>
                  <TableCell>
                    <TextField
                      type="number"
                      size="small"
                      value={item.limitPerGroup}
                      onChange={(e) => handleLimitChange(item.id, e.target.value)}
                      sx={{
                        width: 100,
                        '& .MuiOutlinedInput-root': { height: 36, borderRadius: 1.5, fontSize: 13 },
                        '& input': { textAlign: 'center', fontWeight: 700 },
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ fontSize: 13, color: '#424754', fontWeight: 600 }}>
                    {item.currentStock.toLocaleString()}
                  </TableCell>
                  <TableCell sx={{ fontSize: 12, color: '#6b7280' }}>
                    {item.note}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 2 }}>
          <Typography variant="caption" sx={{ color: '#81899a', fontStyle: 'italic' }}>
            Lưu ý: Định mức trên áp dụng cho tất cả các nhóm trong môn học.
          </Typography>

          <Button
            variant="contained"
            onClick={handleSaveQuotas}
            startIcon={<SaveIcon />}
            sx={{
              bgcolor: '#0058be',
              px: 3,
              py: 1,
              borderRadius: 1.5,
              textTransform: 'none',
              fontWeight: 700,
              fontSize: 13,
              boxShadow: 'none',
              '&:hover': { bgcolor: '#0049a3' },
            }}
          >
            Lưu định mức
          </Button>
        </Box>
      </Paper>

      {/* System Saved Alert */}
      {showSavedAlert && (
        <Alert
          severity="success"
          icon={<CheckCircleIcon fontSize="inherit" />}
          onClose={() => setShowSavedAlert(false)}
          sx={{
            mt: 3,
            borderRadius: 2,
            bgcolor: '#e6f4ea',
            color: '#137333',
            border: '1px solid #b7e1cd',
            '& .MuiAlert-icon': { color: '#137333' },
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          Hệ thống đã lưu cấu hình định mức thành công
        </Alert>
      )}

      {/* Bottom navigation buttons */}
      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between' }}>
        {onPrev ? (
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={onPrev}
            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 1.5, borderColor: '#c2c6d6', color: '#424754' }}
          >
            Quay lại
          </Button>
        ) : <Box />}

        {onNext && (
          <Button
            variant="outlined"
            endIcon={<ArrowForwardIcon />}
            onClick={onNext}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              borderRadius: 1.5,
              borderColor: '#0058be',
              color: '#0058be',
              '&:hover': { bgcolor: '#eaedff' },
            }}
          >
            Sang bước 4: Tạo nhóm &amp; Mời thành viên
          </Button>
        )}
      </Box>

      {/* Snackbar */}
      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast({ ...toast, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={toast.severity} onClose={() => setToast({ ...toast, open: false })}>
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}
