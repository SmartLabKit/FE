import { useCallback, useEffect, useState } from 'react'
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr'
import { borrowService } from '../services/borrowService'

function getRows(result) {
  if (Array.isArray(result)) return result
  if (Array.isArray(result?.items)) return result.items
  if (Array.isArray(result?.data?.items)) return result.data.items
  return []
}

export function useLabBorrowRequests({ status, search, page, size = 20 }) {
  const [requests, setRequests] = useState([])
  const [transfers, setTransfers] = useState([])
  const [requestResult, setRequestResult] = useState(null)
  const [transferResult, setTransferResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [realtimeUnavailable, setRealtimeUnavailable] = useState(
    () => !localStorage.getItem('smartlabkit_token'),
  )

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [requestsResponse, transfersResponse] = await Promise.all([
        borrowService.getLabBorrowRequests({
          status: status || undefined,
          search: search || undefined,
          page,
          size,
        }),
        borrowService.getBorrowTransfers({
          search: search || undefined,
          page,
          size,
        }),
      ])
      setRequestResult(requestsResponse)
      setTransferResult(transfersResponse)
      setRequests(getRows(requestsResponse))
      setTransfers(getRows(transfersResponse))
    } catch (loadError) {
      setError(loadError.message || 'Không thể tải dữ liệu đơn mượn Lab.')
    } finally {
      setLoading(false)
    }
  }, [page, search, size, status])

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      if (active) refresh()
    }, 0)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [refresh])

  useEffect(() => {
    let active = true
    const token = localStorage.getItem('smartlabkit_token')
    if (!token) return undefined

    const hubUrl = import.meta.env.DEV
      ? `${window.location.origin}/hubs/notifications`
      : `${(import.meta.env.VITE_API_URL || 'https://smartlab-production-ea45.up.railway.app').replace(/\/$/, '')}/hubs/notifications`
    const connection = new HubConnectionBuilder()
      .withUrl(hubUrl, { accessTokenFactory: () => localStorage.getItem('smartlabkit_token') || '' })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build()

    connection.on('entityChanged', () => {
      if (active) refresh()
    })
    connection.onclose(() => {
      if (active) setRealtimeUnavailable(true)
    })
    connection.onreconnected(() => {
      if (active) setRealtimeUnavailable(false)
    })
    connection.start().then(() => {
      if (active) setRealtimeUnavailable(false)
    }).catch((startError) => {
      console.error('Không thể kết nối SignalR notifications:', startError)
      if (active) setRealtimeUnavailable(true)
    })

    return () => {
      active = false
      connection.stop()
    }
  }, [refresh])

  return {
    requests,
    transfers,
    requestResult,
    transferResult,
    loading,
    error,
    realtimeUnavailable,
    refresh,
  }
}
