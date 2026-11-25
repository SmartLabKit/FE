import api, { extractErrorMessage } from './api'

const unwrap = (response) => response.data?.data ?? response.data

async function call(request, defaultMessage) {
  try {
    return unwrap(await request)
  } catch (error) {
    throw new Error(extractErrorMessage(error, defaultMessage), { cause: error })
  }
}

/** Phiếu trả: sinh viên gửi, lab duyệt và chọn ngày, tới ngày mang đồ lên lab nhận. */
export const returnSlipService = {
  /** lines: [{ borrowItemId, quantity }], quantity chỉ cần với vật tư tiêu hao. */
  create(borrowRequestId, data) {
    return call(api.post(`/api/borrow-requests/${borrowRequestId}/return-slips`, data), 'Không thể gửi phiếu trả.')
  },
  getById(id) {
    return call(api.get(`/api/return-slips/${id}`), 'Không thể tải phiếu trả.')
  },
  /** Phiếu của các lab mình phụ trách, tải hết các trang. */
  async getAll(params) {
    const slips = []
    for (let page = 1; ; page += 1) {
      const data = await call(api.get('/api/return-slips', { params: { ...params, page, size: 100 } }), 'Không thể tải phiếu trả.')
      slips.push(...(data.items || []))
      if (!data.hasNext) return slips
    }
  },
  /** data: { appointmentDate, comment } */
  approve(id, data) {
    return call(api.post(`/api/return-slips/${id}/approve`, data), 'Không thể duyệt phiếu trả.')
  },
  reschedule(id, data) {
    return call(api.post(`/api/return-slips/${id}/reschedule`, data), 'Không thể đổi ngày hẹn.')
  },
  reject(id, data) {
    return call(api.post(`/api/return-slips/${id}/reject`, data), 'Không thể từ chối phiếu trả.')
  },
  cancel(id) {
    return call(api.post(`/api/return-slips/${id}/cancel`), 'Không thể hủy phiếu trả.')
  },
}
