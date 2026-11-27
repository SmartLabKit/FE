import { useCallback, useState } from 'react'

const STORAGE_KEY = 'smartlabkit.sidebar.collapsed'

/** Đọc trạng thái đã lưu; localStorage có thể không khả dụng (private mode) nên bọc try/catch. */
function readStored(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

/** Quản lý trạng thái thu gọn/mở rộng của Sidebar và lưu vào localStorage. */
export function useSidebarCollapsed() {
  const [collapsed, setCollapsedState] = useState<boolean>(readStored)

  const setCollapsed = useCallback((value: boolean) => {
    setCollapsedState(value)
    try {
      window.localStorage.setItem(STORAGE_KEY, value ? '1' : '0')
    } catch {
      // Bỏ qua: chỉ mất khả năng ghi nhớ, giao diện vẫn hoạt động.
    }
  }, [])

  return { collapsed, setCollapsed }
}
