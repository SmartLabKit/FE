/**
 * Chốt chặn rời trang dùng chung (BrowserRouter không có useBlocker).
 * Trang có dữ liệu chưa lưu gọi setLeaveGuard(fn); fn(path) trả về true nghĩa là trang đã tự xử lý
 * (ví dụ mở hộp hỏi), nơi điều hướng không được chuyển trang nữa.
 */
let guard = null

export function setLeaveGuard(fn) {
  guard = fn
}

export function clearLeaveGuard(fn) {
  if (guard === fn) guard = null
}

export function shouldBlockLeave(path) {
  if (!guard) return false
  return guard(path) === true
}
