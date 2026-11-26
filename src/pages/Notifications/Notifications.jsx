import { useEffect, useState, useCallback } from 'react'
import { useEntityChanged } from '../../hooks/useEntityChanged'
import { DoneAll as DoneAllIcon } from '@mui/icons-material'
import {
  Alert, Box, Button, Chip, CircularProgress, List, ListItemButton, Paper, Tab,
  TablePagination, Tabs, Typography,
} from '@mui/material'
import { useNavigate } from 'react-router-dom'
import PortalLayout from '../../components/layout/PortalLayout'
import { formatRelativeTime, getNotificationPath } from '../../components/layout/notificationUtils'
import { useAuth } from '../../context/AuthContext'
import { notificationService } from '../../services/notificationService'
import { NOTIFICATIONS_CHANGED_EVENT } from '../../hooks/useNotifications'

const notifyBell = () => window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT))

const PAGE_SIZE = 20

export default function Notifications() {
  const navigate = useNavigate()
  const { hasRole } = useAuth()
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  // Dữ liệu đổi ở nơi khác thì tự tải lại
  const bumpReload = useCallback(() => setReloadKey((key) => key + 1), [])
  useEntityChanged(bumpReload)

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setError('')
      try {
        const data = await notificationService.getMyNotifications({
          isRead: filter === 'unread' ? false : undefined,
          page,
          size: PAGE_SIZE,
        })
        if (active) setResult(data)
      } catch (loadError) {
        if (active) setError(loadError.message)
      } finally {
        if (active) setLoading(false)
      }
    }, 0)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [filter, page, reloadKey])

  const items = Array.isArray(result) ? result : result?.items || []

  const handleClickItem = async (notification) => {
    try {
      if (!notification.isRead) {
        await notificationService.markAsRead(notification.notificationId)
        notifyBell()
      }
    } catch (markError) {
      setError(markError.message)
      return
    }
    const path = getNotificationPath(notification, hasRole)
    if (path) navigate(path)
    else setReloadKey((key) => key + 1)
  }

  const handleMarkAll = async () => {
    try {
      await notificationService.markAllAsRead()
      notifyBell()
      setReloadKey((key) => key + 1)
    } catch (markError) {
      setError(markError.message)
    }
  }

  return (
    <PortalLayout headerTitle="Thông báo" headerSubtitle="Tất cả thông báo gửi tới tài khoản của bạn">
      <Box sx={{ maxWidth: 960, mx: 'auto' }}>
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
        <Paper variant="outlined" sx={{ borderColor: '#d8dced', overflow: 'hidden' }}>
          <Box sx={{ px: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', borderBottom: '1px solid #eef0f6' }}>
            <Tabs
              value={filter}
              onChange={(_, value) => {
                setFilter(value)
                setPage(1)
              }}
            >
              <Tab value="all" label="Tất cả" sx={{ textTransform: 'none', fontWeight: 600 }} />
              <Tab value="unread" label="Chưa đọc" sx={{ textTransform: 'none', fontWeight: 600 }} />
            </Tabs>
            <Button size="small" startIcon={<DoneAllIcon fontSize="small" />} onClick={handleMarkAll} sx={{ textTransform: 'none', fontWeight: 600 }}>
              Đánh dấu tất cả đã đọc
            </Button>
          </Box>

          {loading ? (
            <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}><CircularProgress size={28} /></Box>
          ) : items.length === 0 ? (
            <Typography sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>
              {filter === 'unread' ? 'Không có thông báo chưa đọc.' : 'Bạn chưa có thông báo nào.'}
            </Typography>
          ) : (
            <List disablePadding>
              {items.map((notification) => (
                <ListItemButton
                  key={notification.notificationId}
                  onClick={() => handleClickItem(notification)}
                  sx={{
                    gap: 1.5,
                    py: 1.5,
                    bgcolor: notification.isRead ? 'transparent' : '#f3f6ff',
                    borderBottom: '1px solid #f0f2f5',
                  }}
                >
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, bgcolor: notification.isRead ? 'transparent' : '#0058be' }} />
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 14, color: '#131b2e', fontWeight: notification.isRead ? 400 : 700 }}>
                      {notification.title}
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: '#81899a', mt: 0.25 }}>
                      {formatRelativeTime(notification.createdAt)}
                    </Typography>
                  </Box>
                  {!notification.isRead && <Chip size="small" label="Mới" color="primary" sx={{ fontWeight: 600, fontSize: 11 }} />}
                </ListItemButton>
              ))}
            </List>
          )}

          <TablePagination
            component="div"
            count={result?.totalCount || 0}
            page={page - 1}
            onPageChange={(_, nextPage) => setPage(nextPage + 1)}
            rowsPerPage={PAGE_SIZE}
            rowsPerPageOptions={[PAGE_SIZE]}
            labelDisplayedRows={({ from, to, count }) => `${from}–${to} / ${count}`}
          />
        </Paper>
      </Box>
    </PortalLayout>
  )
}
