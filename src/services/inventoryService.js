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
  async getLabStaff(labRoomId) {
    return asList(unwrap(await api.get(`/api/lab-rooms/${labRoomId}/staff`)), ['items', 'staff', 'users'])
  },
  async removeLabStaff(labRoomId, userId) {
    return api.delete(`/api/lab-rooms/${labRoomId}/staff/${userId}`)
  },
  async getCabinets(params) {
    return asList(unwrap(await api.get('/api/cabinets', { params })), ['items', 'cabinets'])
  },
  async getCabinet(id) {
    return unwrap(await api.get(`/api/cabinets/${id}`))
  },
  async getComponentItems(params, config = {}) {
    return unwrap(await api.get('/api/component-items', { ...config, params }))
  },
  async getComponentItem(id) {
    return unwrap(await api.get(`/api/component-items/${id}`))
  },
  async updateComponentItem(id, data) {
    return unwrap(await api.put(`/api/component-items/${id}`, data))
  },
  async moveComponentItems(data) {
    return unwrap(await api.post('/api/component-items/move', data))
  },
  async retireComponentItem(id, data) {
    return unwrap(await api.post(`/api/component-items/${id}/retire`, data))
  },
  async getConsumableStocks(params) {
    return unwrap(await api.get('/api/consumable-stocks', { params }))
  },
  async moveConsumableStock(data) {
    return unwrap(await api.post('/api/consumable-stocks/move', data))
  },
  async adjustConsumableStock(data) {
    return unwrap(await api.post('/api/consumable-stocks/adjust', data))
  },
  async getInventoryTransactions(params) {
    return unwrap(await api.get('/api/inventory-transactions', { params }))
  },
  async getInventoryAudits(params) {
    return unwrap(await api.get('/api/inventory-audits', { params }))
  },
  async getInventoryAudit(id) {
    return unwrap(await api.get(`/api/inventory-audits/${id}`))
  },
  async startInventoryAudit(data) {
    return unwrap(await api.post('/api/inventory-audits', data))
  },
  async completeInventoryAudit(id, data) {
    return unwrap(await api.post(`/api/inventory-audits/${id}/complete`, data))
  },
  async cancelInventoryAudit(id) {
    return api.delete(`/api/inventory-audits/${id}`)
  },
  async createCabinet(data) {
    return unwrap(await api.post('/api/cabinets', data))
  },
  async updateCabinet(id, data) {
    return unwrap(await api.put(`/api/cabinets/${id}`, data))
  },
  async getComponents(params) {
    const queryParams = params
      ? { ...params }
      : { page: 1, size: 1000, Page: 1, Size: 1000, pageSize: 1000, PageSize: 1000 }
    const res = await api.get('/api/components', { params: queryParams })
    const unwrapped = unwrap(res)
    const items = asList(unwrapped, ['items', 'components'])
    const totalCount = Number(
      unwrapped?.totalCount ??
      unwrapped?.totalItems ??
      unwrapped?.total ??
      res.data?.totalCount ??
      res.data?.totalItems ??
      items.length
    )

    // Nếu không truyền params riêng và BE giới hạn pageSize nhỏ hơn totalCount (ví dụ BE max 20, 50 nhưng tổng có nhiều hơn),
    // tự động tải nốt các trang còn lại để FE nắm đầy đủ danh sách và tồn kho thực tế.
    if (!params && items.length > 0 && items.length < totalCount) {
      const pageSize = items.length
      const totalPages = Math.ceil(totalCount / pageSize)
      const remainingPromises = []
      for (let p = 2; p <= totalPages; p++) {
        remainingPromises.push(
          api
            .get('/api/components', {
              params: { page: p, size: pageSize, Page: p, Size: pageSize, pageSize, PageSize: pageSize },
            })
            .then((r) => asList(unwrap(r), ['items', 'components']))
            .catch(() => [])
        )
      }
      const moreBatches = await Promise.all(remainingPromises)
      for (const batch of moreBatches) {
        items.push(...batch)
      }
    }

    return items
  },
  async getComponent(id) {
    try {
      return unwrap(await api.get(`/api/components/${id}`))
    } catch {
      const all = await inventoryService.getComponents()
      return all.find((c) => (c.componentId || c.id || c.ComponentId || c.Id) === id) || null
    }
  },
  async getComponentById(id) {
    return unwrap(await api.get(`/api/components/${id}`))
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
    formData.append('image', file)
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
    formData.append('datasheet', file)
    try {
      return unwrap(await api.put(`/api/components/${id}/datasheet`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }))
    } catch {
      return unwrap(await api.post(`/api/components/${id}/datasheet`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }))
    }
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
