import { useEffect, useRef, useState } from 'react'

/**
 * Tải dữ liệu 1 báo cáo và tự tải lại khi deps thay đổi (bộ lọc, trang...).
 * - fetcher: hàm async trả về dữ liệu, ví dụ () => reportService.getLowStock(params)
 * - enabled = false thì không gọi API (dùng khi role không được xem hoặc thiếu tham số bắt buộc).
 * Việc tải được đẩy vào setTimeout (giống useLabBorrowRequests) để không setState đồng bộ trong effect;
 * biến `active` chặn kết quả của request cũ khi bộ lọc đổi nhanh hoặc component đã unmount.
 * fetcher được giữ trong ref để effect chỉ chạy lại khi giá trị trong deps thay đổi (so sánh qua depsKey).
 */
export function useReport(fetcher, deps, enabled = true) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState('')
  const fetcherRef = useRef(fetcher)
  const depsKey = JSON.stringify(deps)

  useEffect(() => {
    fetcherRef.current = fetcher
  })

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
        const result = await fetcherRef.current()
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
  }, [enabled, depsKey])

  return { data, loading, error }
}
