export interface PagedResult<T> {
  items: T[]
  page: number
  size: number
  totalCount: number
  totalPages: number
}

export interface BorrowRequestResponse {
  borrowRequestId: string
  requestCode: string
  status: string
  requesterId: string
  requesterName: string
  classId: string
  classCode: string
  projectId: string
  projectTitle: string
  roomId: string
  roomCode: string
  roomName: string
  requestDate: string
  approvedAt: string | null
  borrowDate: string | null
  dueDate: string | null
  itemCount: number
  waitingTransferCount: number
}

export interface BorrowItemResponse {
  borrowItemId: string
  componentId: string
  componentCode: string
  componentName: string
  trackingType: string
  unit: string
  quantity: number
  status: string
  sourceRoomId: string | null
  sourceRoomCode: string | null
  receivedAt: string | null
  dispatchedAt: string | null
  componentItemId: string | null
  itemCode: string | null
  serialNumber: string | null
}

export interface BorrowRequestDetailResponse extends BorrowRequestResponse {
  isOverdue: boolean
  rejectReason: string | null
  purpose: string
  items: BorrowItemResponse[]
}

export interface TransferLineResponse {
  borrowItemId: string
  borrowRequestId: string
  requestCode: string
  componentId: string
  componentCode: string
  componentName: string
  trackingType: string
  unit: string
  quantity: number
  sourceRoomId: string
  sourceRoomCode: string
  pickupRoomId: string
  pickupRoomCode: string
  approvedAt: string
  borrowDate: string
  dispatchedAt: string | null
  canDispatch: boolean
  canReceive: boolean
}

export interface ReceiveTransferRequest {
  borrowItemId: string
  toCabinetId: string
  itemIds: string[]
}

export interface DispatchTransferRequest {
  borrowItemId: string
}

export interface CancelBorrowRequest {
  reason: string
}

export interface ComponentItemResponse {
  itemId: string
  itemCode: string
  serialNumber: string | null
  componentId: string
  componentCode: string
  componentName: string
  cabinetId: string
  status: string
  condition: string
}

export interface CabinetResponse {
  cabinetId: string
  cabinetCode: string
  cabinetName: string
  roomId: string
  roomCode: string
  roomName: string
  status: string
}
