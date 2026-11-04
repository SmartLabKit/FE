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
    // Nếu token hết hạn (401), xử lý dọn token nếu không phải đang ở trang login/forgot-password
    if (error.response && error.response.status === 401) {
      const isPublicAuthRoute =
        window.location.pathname === '/login' ||
        window.location.pathname === '/forgot-password' ||
        window.location.pathname === '/reset-password'

      if (!isPublicAuthRoute) {
        localStorage.removeItem('smartlabkit_token')
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
        return typeof data.errors[0] === 'string' ? data.errors[0] : JSON.stringify(data.errors[0])
      }
      if (typeof data.errors === 'object') {
        const firstKey = Object.keys(data.errors)[0]
        if (firstKey) {
          const val = data.errors[firstKey]
          if (Array.isArray(val) && val.length > 0) {
            return val[0]
          }
          if (typeof val === 'string') {
            return val
          }
        }
      }
    }

    // Nếu backend trả về message
    if (data.message && typeof data.message === 'string') {
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

export default api
