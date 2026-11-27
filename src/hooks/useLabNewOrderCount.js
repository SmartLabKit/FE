import { useCallback, useEffect, useState } from 'react'
import { borrowService } from '../services/borrowService'
import { useEntityChanged } from './useEntityChanged'

/**
 * Số đơn GV đã duyệt đang chờ lab xác nhận (đơn mới của lab), để hiện số đỏ trên menu "Xử lý đơn mượn".
 * Tự tải lại khi BE báo có thay đổi. enabled = false (không phải LabStaff) thì luôn là 0.
 */
export function useLabNewOrderCount(enabled) {
  const [count, setCount] = useState(0)

  const load = useCallback(() => {
    if (!enabled) return
    borrowService
      .getLabBorrowRequests({ status: 'Approved', page: 1, size: 1 })
      .then((result) => setCount(Number(result?.totalCount) || 0))
      .catch(() => {})
  }, [enabled])

  useEffect(() => {
    const timer = window.setTimeout(load, 0)
    return () => window.clearTimeout(timer)
  }, [load])
  useEntityChanged(load)

  if (!enabled) return 0
  return count
}
