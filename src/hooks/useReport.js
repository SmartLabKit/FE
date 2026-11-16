import { useEffect, useState } from 'react'

/**
 * Tải dữ liệu 1 báo cáo và tự tải lại khi deps thay đổi (bộ lọc, trang...).
 * - fetcher: hàm async trả về dữ liệu, ví dụ () => reportService.getLowStock(params)
 * - enabled = false thì không gọi API (dùng khi role không được xem hoặc thiếu tham số bắt buộc).
 * Việc tải được đẩy vào setTimeout (giống useLabBorrowRequests) để không setState đồng bộ trong effect;
 * biến `active` chặn kết quả của request cũ khi bộ lọc đổi nhanh hoặc component đã unmount.
 */
export function useReport(fetcher, deps, enabled = true) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(async () => {
      if (!enabled) {
        setLoading(false)
        return
      }
      setLoading(true)
      setError('')
      try {
        const result = await fetcher()
        if (active) setData(result)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps])

  return { data, loading, error }
}
