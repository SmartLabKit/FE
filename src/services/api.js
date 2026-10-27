import axios from 'axios'

// Khởi tạo instance Axios kết nối Backend API SmartLabKit
const api = axios.create({
  // Khi chạy dev thông qua proxy Vite hoặc direct URL
  baseURL: import.meta.env.VITE_API_URL || '',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
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
    // Nếu token hết hạn (401), xử lý dọn token nếu không phải đang ở trang login/register
    if (error.response && error.response.status === 401) {
      const isPublicAuthRoute =
        window.location.pathname === '/login' ||
        window.location.pathname === '/register' ||
        window.location.pathname === '/forgot-password' ||
        window.location.pathname === '/reset-password' ||
        window.location.pathname === '/verify-email'

      if (!isPublicAuthRoute) {
        localStorage.removeItem('smartlabkit_token')
        // Có thể kích hoạt sự kiện unauthorized nếu cần
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

    // Nếu backend trả về errors dạng object { field: [messages] }
    if (data.errors && typeof data.errors === 'object') {
      const firstKey = Object.keys(data.errors)[0]
      if (firstKey && Array.isArray(data.errors[firstKey]) && data.errors[firstKey].length > 0) {
        return data.errors[firstKey][0]
      }
    }

    // Nếu backend trả về message
    if (data.message && typeof data.message === 'string') {
      return data.message
    }
  }

  if (error.message) {
    if (error.message.includes('Network Error')) {
      return 'Không thể kết nối tới máy chủ backend. Vui lòng kiểm tra dịch vụ backend đang chạy.'
    }
    return error.message
  }

  return defaultMsg
}

export default api
