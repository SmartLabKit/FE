import api from './api'

function unwrap(response) {
  return response.data?.data ?? response.data
}

function asList(value, keys = []) {
  if (Array.isArray(value)) return value
  for (const key of keys) {
    if (Array.isArray(value?.[key])) return value[key]
  }
  return []
}

export const inventoryService = {
  async getCategories() {
    return asList(unwrap(await api.get('/api/categories')), ['items', 'categories'])
  },
  async createCategory(data) {
    return unwrap(await api.post('/api/categories', data))
  },
  async updateCategory(id, data) {
    return unwrap(await api.put(`/api/categories/${id}`, data))
  },
  async deleteCategory(id) {
    return api.delete(`/api/categories/${id}`)
  },
  async getLabRooms() {
    return asList(unwrap(await api.get('/api/lab-rooms')), ['items', 'labRooms'])
  },
  async createLabRoom(data) {
    return unwrap(await api.post('/api/lab-rooms', data))
  },
  async updateLabRoom(id, data) {
    return unwrap(await api.put(`/api/lab-rooms/${id}`, data))
  },
  async assignLabStaff(labRoomId, data) {
    return unwrap(await api.post(`/api/lab-rooms/${labRoomId}/staff`, data))
  },
  async getCabinets(params) {
    return asList(unwrap(await api.get('/api/cabinets', { params })), ['items', 'cabinets'])
  },
  async getCabinet(id) {
    return unwrap(await api.get(`/api/cabinets/${id}`))
  },
  async getComponentItems(params) {
    return unwrap(await api.get('/api/component-items', { params }))
  },
  async createCabinet(data) {
    return unwrap(await api.post('/api/cabinets', data))
  },
  async updateCabinet(id, data) {
    return unwrap(await api.put(`/api/cabinets/${id}`, data))
  },
  async getComponents(params) {
    return asList(unwrap(await api.get('/api/components', { params })), ['items', 'components'])
  },
  async createComponent(data) {
    return unwrap(await api.post('/api/components', data))
  },
  async updateComponent(id, data) {
    return unwrap(await api.put(`/api/components/${id}`, data))
  },
  async uploadComponentImage(id, file) {
    const formData = new FormData()
    formData.append('file', file)
    return unwrap(await api.post(`/api/components/${id}/images`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }))
  },
  async deleteComponentImage(id, imageId) {
    return api.delete(`/api/components/${id}/images/${imageId}`)
  },
  async uploadDatasheet(id, file) {
    const formData = new FormData()
    formData.append('file', file)
    return unwrap(await api.put(`/api/components/${id}/datasheet`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }))
  },
  async deleteDatasheet(id) {
    return api.delete(`/api/components/${id}/datasheet`)
  },
  async getTutorials(id) {
    return asList(unwrap(await api.get(`/api/components/${id}/tutorials`)), ['items', 'tutorials'])
  },
  async createTutorial(id, data) {
    return unwrap(await api.post(`/api/components/${id}/tutorials`, data))
  },
  async updateTutorial(id, tutorialId, data) {
    return unwrap(await api.put(`/api/components/${id}/tutorials/${tutorialId}`, data))
  },
  async deleteTutorial(id, tutorialId) {
    return api.delete(`/api/components/${id}/tutorials/${tutorialId}`)
  },
  async getStockReceipts() {
    return asList(unwrap(await api.get('/api/stock-receipts')), ['items', 'receipts'])
  },
  async getStockReceipt(id) {
    return unwrap(await api.get(`/api/stock-receipts/${id}`))
  },
  async createStockReceipt(data) {
    return unwrap(await api.post('/api/stock-receipts', data))
  },
  async updateStockReceipt(id, data) {
    return unwrap(await api.put(`/api/stock-receipts/${id}`, data))
  },
  async uploadReceiptInvoice(id, file) {
    const formData = new FormData()
    formData.append('file', file)
    return unwrap(await api.put(`/api/stock-receipts/${id}/invoice`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }))
  },
  async deleteReceiptInvoice(id) {
    return api.delete(`/api/stock-receipts/${id}/invoice`)
  },
  async cancelStockReceipt(id) {
    return unwrap(await api.post(`/api/stock-receipts/${id}/cancel`))
  },
}
