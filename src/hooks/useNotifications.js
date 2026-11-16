import { useCallback, useEffect, useState } from 'react'
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr'
import { notificationService } from '../services/notificationService'

const POLL_INTERVAL_MS = 30000
const PREVIEW_SIZE = 10
export const NOTIFICATIONS_CHANGED_EVENT = 'smartlab:notifications-changed'

function getHubUrl() {
  return import.meta.env.DEV
    ? `${window.location.origin}/hubs/notifications`
    : `${(import.meta.env.VITE_API_URL || 'https://smartlab-production-ea45.up.railway.app').replace(/\/$/, '')}/hubs/notifications`
}

/**
 * Quản lý thông báo cho chuông trên thanh header:
 * - unreadCount: tải lúc đầu, gọi lại định kỳ 30 giây và tăng ngay khi SignalR đẩy "notificationReceived".
 * - items: 10 thông báo mới nhất, chỉ tải khi mở menu (loadPreview) để không gọi API thừa ở mọi trang.
 * - markAsRead / markAllAsRead cập nhật luôn state cục bộ để giao diện phản hồi ngay.
 */
export function useNotifications() {
  const [unreadCount, setUnreadCount] = useState(0)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const refreshCount = useCallback(() => (
    notificationService.getUnreadCount()
      .then(setUnreadCount)
      .catch(() => {})
  ), [])

  const loadPreview = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await notificationService.getMyNotifications({ page: 1, size: PREVIEW_SIZE })
      setItems(Array.isArray(result) ? result : result?.items || [])
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!localStorage.getItem('smartlabkit_token')) return undefined
    const firstLoad = window.setTimeout(refreshCount, 0)
    const timer = window.setInterval(refreshCount, POLL_INTERVAL_MS)
    return () => {
      window.clearTimeout(firstLoad)
      window.clearInterval(timer)
    }
  }, [refreshCount])

  useEffect(() => {
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, refreshCount)
    return () => window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, refreshCount)
  }, [refreshCount])

  useEffect(() => {
    const token = localStorage.getItem('smartlabkit_token')
    if (!token) return undefined
    let active = true

    const connection = new HubConnectionBuilder()
      .withUrl(getHubUrl(), { accessTokenFactory: () => localStorage.getItem('smartlabkit_token') || '' })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build()

    connection.on('notificationReceived', (notification) => {
      if (!active) return
      setUnreadCount((count) => count + 1)
      setItems((prev) => [notification, ...prev.filter((item) => item.notificationId !== notification.notificationId)].slice(0, PREVIEW_SIZE))
    })
    connection.onreconnected(() => {
      if (active) refreshCount()
    })

    connection.start().catch(() => {
    })

    return () => {
      active = false
      connection.stop()
    }
  }, [refreshCount])

  const markAsRead = useCallback(async (notification) => {
    if (notification.isRead) return
    await notificationService.markAsRead(notification.notificationId)
    setItems((prev) => prev.map((item) => (
      item.notificationId === notification.notificationId ? { ...item, isRead: true, readAt: new Date().toISOString() } : item
    )))
    setUnreadCount((count) => Math.max(0, count - 1))
  }, [])

  const markAllAsRead = useCallback(async () => {
    const remaining = await notificationService.markAllAsRead()
    setItems((prev) => prev.map((item) => ({ ...item, isRead: true })))
    setUnreadCount(remaining)
  }, [])

  return { unreadCount, items, loading, error, loadPreview, markAsRead, markAllAsRead, refreshCount }
}
