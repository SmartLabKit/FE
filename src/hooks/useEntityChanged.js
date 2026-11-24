import { useEffect } from 'react'
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr'

const DEBOUNCE_MS = 400

/**
 * Gọi onChanged khi BE báo dữ liệu đổi (SignalR "entityChanged") hoặc khi kết nối lại sau mất mạng.
 * Nhiều sự kiện liền nhau chỉ gọi một lần. onChanged cần ổn định (useCallback).
 */
export function useEntityChanged(onChanged) {
  useEffect(() => {
    if (!localStorage.getItem('smartlabkit_token')) return undefined
    let timer = 0
    const schedule = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(onChanged, DEBOUNCE_MS)
    }

    const hubUrl = import.meta.env.DEV
      ? `${window.location.origin}/hubs/notifications`
      : `${(import.meta.env.VITE_API_URL || 'https://smartlab-production-ea45.up.railway.app').replace(/\/$/, '')}/hubs/notifications`
    const connection = new HubConnectionBuilder()
      .withUrl(hubUrl, { accessTokenFactory: () => localStorage.getItem('smartlabkit_token') || '' })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build()

    connection.on('entityChanged', schedule)
    connection.onreconnected(schedule)
    connection.start().catch(() => {})

    return () => {
      window.clearTimeout(timer)
      connection.off('entityChanged', schedule)
      connection.stop()
    }
  }, [onChanged])
}
