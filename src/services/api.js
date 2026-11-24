import axios from 'axios'

// Khởi tạo instance Axios kết nối Backend API SmartLabKit (Railway Cloud / Local)
// Trong môi trường dev (localhost), sử dụng relative path '' để mọi request đi qua Vite proxy (tránh hoàn toàn CORS).
// Trong môi trường production, sử dụng biến môi trường VITE_API_URL hoặc mặc định domain Railway.
const baseURL = import.meta.env.DEV
  ? ''
  : (import.meta.env.VITE_API_URL || 'https://smartlab-production-ea45.up.railway.app')

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
})

// Request Interceptor: Tự động đính kèm JWT Access Token nếu có
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('smartlabkit_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response Interceptor: Trích xuất data từ ApiResponse<T> hoặc xử lý lỗi tập trung
api.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    // Phiên hết hạn cần xóa token và đưa người dùng về màn hình đăng nhập.
    if (error.response && error.response.status === 401) {
      const isPublicAuthRoute =
        window.location.pathname === '/login' ||
        window.location.pathname === '/forgot-password' ||
        window.location.pathname === '/reset-password'

      if (!isPublicAuthRoute) {
        localStorage.removeItem('smartlabkit_token')
        localStorage.removeItem('smartlabkit_user')
        window.location.assign('/login')
      }
    }
    return Promise.reject(error)
  }
)

/**
 * Hàm tiện ích trích xuất thông báo lỗi dễ hiểu từ Backend ApiResponse
 */
export function extractErrorMessage(error, defaultMsg = 'Đã có lỗi xảy ra. Vui lòng thử lại.') {
  if (!error) return defaultMsg

  if (error.response?.data) {
    const data = error.response.data

    // Nếu backend trả về errors dạng object { field: [messages] } hoặc array
    if (data.errors) {
      if (Array.isArray(data.errors) && data.errors.length > 0) {
        const firstErr = data.errors[0]
        if (typeof firstErr === 'string' && firstErr.trim()) return firstErr
        if (firstErr && typeof firstErr === 'object') {
          const nestedMsg = firstErr.message || firstErr.errorMessage || firstErr.description
          if (typeof nestedMsg === 'string' && nestedMsg.trim()) return nestedMsg
        }
      } else if (typeof data.errors === 'object' && !Array.isArray(data.errors)) {
        const firstKey = Object.keys(data.errors)[0]
        if (firstKey) {
          const val = data.errors[firstKey]
          if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'string' && val[0].trim()) {
            return val[0]
          }
          if (typeof val === 'string' && val.trim()) {
            return val
          }
        }
      }
    }

    // Nếu backend trả về message
    if (data.message && typeof data.message === 'string' && data.message.trim()) {
      return data.message
    }

    // Nếu backend trả về detail (RFC 7807)
    if (data.detail && typeof data.detail === 'string') {
      return data.detail
    }

    // Nếu backend trả về title
    if (data.title && typeof data.title === 'string') {
      return data.title
    }
  }

  if (error.message) {
    if (error.message.includes('Network Error')) {
      return 'Không thể kết nối tới máy chủ backend. Vui lòng kiểm tra kết nối mạng.'
    }
    return error.message
  }

  return defaultMsg
}

/**
 * Chuẩn hóa bóc tách dữ liệu từ ApiResponse dạng { success, message, data, errors }.
 * Nếu backend trả success === false thì ném Error kèm message từ backend.
 */
export function unwrapApiResponse(response, defaultErrorMsg = 'Đã có lỗi xảy ra. Vui lòng thử lại.') {
  const payload = response?.data
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    if (payload.success === false) {
      throw new Error(extractErrorMessage({ response: { data: payload } }, defaultErrorMsg))
    }
    if ('data' in payload) {
      return payload.data
    }
  }
  return payload
}

export default api
