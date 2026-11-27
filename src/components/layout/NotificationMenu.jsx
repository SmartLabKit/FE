import { useState } from 'react'
import {
  Alert, Badge, Box, Button, CircularProgress, Divider, IconButton, List, ListItemButton,
  Popover, Typography,
} from '@mui/material'
import {
  NotificationsOutlined as NotificationsIcon,
  DoneAll as DoneAllIcon,
} from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useNotifications } from '../../hooks/useNotifications'
import { formatRelativeTime, getNotificationPath } from './notificationUtils'

/**
 * Chuông thông báo trên thanh header: badge số chưa đọc (cập nhật realtime),
 * bấm vào mở danh sách 10 thông báo mới nhất.
 */
export default function NotificationMenu() {
  const navigate = useNavigate()
  const { hasRole } = useAuth()
  const { unreadCount, items, loading, error, loadPreview, markAsRead, markAllAsRead } = useNotifications()
  const [anchorEl, setAnchorEl] = useState(null)
  const [actionError, setActionError] = useState('')

  const handleOpen = (event) => {
    setAnchorEl(event.currentTarget)
    setActionError('')
    loadPreview()
  }

  const handleClickItem = async (notification) => {
    try {
      await markAsRead(notification)
    } catch (markError) {
      setActionError(markError.message)
      return
    }
    const path = getNotificationPath(notification, hasRole)
    if (path) {
      setAnchorEl(null)
      navigate(path)
    }
  }

  const handleMarkAll = async () => {
    try {
      await markAllAsRead()
    } catch (markError) {
      setActionError(markError.message)
    }
  }

  return (
    <>
      <IconButton size="small" sx={{ color: '#556070' }} onClick={handleOpen} aria-label="Thông báo">
        <Badge
          badgeContent={unreadCount}
          max={99}
          color="primary"
          slotProps={{ badge: { style: { fontSize: 11, height: 16, minWidth: 16 } } }}
        >
          <NotificationsIcon fontSize="small" />
        </Badge>
      </IconButton>

      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { width: 360, maxWidth: 'calc(100vw - 32px)', borderRadius: 2, border: '1px solid #e4e6ef', boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)' } } }}
      >
        <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography sx={{ fontWeight: 800, color: '#182238' }}>Thông báo</Typography>
          <Button
            size="small"
            startIcon={<DoneAllIcon fontSize="small" />}
            onClick={handleMarkAll}
            disabled={unreadCount === 0}
            sx={{ textTransform: 'none', fontWeight: 600, fontSize: 12 }}
          >
            Đánh dấu tất cả đã đọc
          </Button>
        </Box>
        <Divider />

        {(error || actionError) && <Alert severity="error" sx={{ m: 1.5 }}>{actionError || error}</Alert>}

        {loading && items.length === 0 ? (
          <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress size={24} /></Box>
        ) : items.length === 0 ? (
          <Typography sx={{ py: 4, textAlign: 'center', color: 'text.secondary', fontSize: 13 }}>Bạn chưa có thông báo nào.</Typography>
        ) : (
          <List disablePadding sx={{ maxHeight: 400, overflowY: 'auto' }}>
            {items.map((notification) => (
              <ListItemButton
                key={notification.notificationId}
                onClick={() => handleClickItem(notification)}
                sx={{
                  alignItems: 'flex-start',
                  gap: 1.25,
                  py: 1.25,
                  bgcolor: notification.isRead ? 'transparent' : '#f3f6ff',
                  borderBottom: '1px solid #f0f2f5',
                }}
              >
                <Box
                  sx={{
                    mt: 0.75,
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    flexShrink: 0,
                    bgcolor: notification.isRead ? 'transparent' : '#0058be',
                  }}
                />
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: 13, color: '#131b2e', fontWeight: notification.isRead ? 400 : 700, lineHeight: 1.4 }}>
                    {notification.title}
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: '#81899a', mt: 0.25 }}>
                    {formatRelativeTime(notification.createdAt)}
                  </Typography>
                </Box>
              </ListItemButton>
            ))}
          </List>
        )}

        <Divider />
        <Box sx={{ p: 1, textAlign: 'center' }}>
          <Button
            size="small"
            onClick={() => {
              setAnchorEl(null)
              navigate('/notifications')
            }}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Xem tất cả thông báo
          </Button>
        </Box>
      </Popover>
    </>
  )
}
