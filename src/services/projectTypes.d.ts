export interface BorrowDeadlineResponse {
  dueDate: string
  semesterCode: string
  daysLeft: number
  canBorrow: boolean
}

export interface SubmitProjectRequest {
  borrowDate: string | null
  dueDate: string | null
}
