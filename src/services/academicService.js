import api, { extractErrorMessage } from './api'
import { MOCK_SEMESTERS, MOCK_COURSES, MOCK_CLASSES } from './mockData'

// Bộ nhớ đệm cục bộ cho Semesters, Courses, Classes khi backend offline
let localSemesters = JSON.parse(JSON.stringify(MOCK_SEMESTERS))
let localCourses = JSON.parse(JSON.stringify(MOCK_COURSES))
let localClasses = JSON.parse(JSON.stringify(MOCK_CLASSES))

export const academicService = {
  // ===================== KỲ HỌC (SEMESTERS) =====================

  /**
   * Lấy danh sách tất cả kỳ học
   * GET /api/semesters
   * Quyền: Đăng nhập
   * Trả về (200): SemesterResponse[]
   */
  async getSemesters() {
    try {
      const response = await api.get('/api/semesters')
      return response.data?.data || response.data
    } catch (error) {
      if (error.response?.status === 500 || error.response?.status === 401 || !error.response) {
        console.warn('API /api/semesters gặp lỗi, sử dụng mock fallback')
        return localSemesters
      }
      throw new Error(extractErrorMessage(error, 'Không thể tải danh sách kỳ học'), { cause: error })
    }
  },

  /**
   * Lấy chi tiết một kỳ học
   * GET /api/semesters/{id}
   * Quyền: Đăng nhập
   * Path: id (guid)
   * Trả về (200): SemesterResponse
   */
  async getSemesterById(id) {
    try {
      const response = await api.get(`/api/semesters/${id}`)
      return response.data?.data || response.data
    } catch (error) {
      if (error.response?.status === 500 || error.response?.status === 404 || !error.response) {
        const found = localSemesters.find((s) => s.semesterId === id)
        if (found) return found
      }
      throw new Error(extractErrorMessage(error, 'Không thể tải chi tiết kỳ học'), { cause: error })
    }
  },

  /**
   * Tạo kỳ học mới
   * POST /api/semesters
   * Quyền: ACADEMIC_MANAGE (Admin)
   * Body (JSON): CreateSemesterRequest { semesterCode, term, year, startDate, endDate, isActive }
   * Trả về (201): SemesterResponse
   */
  async createSemester(data) {
    try {
      const response = await api.post('/api/semesters', data)
      return response.data?.data || response.data
    } catch (error) {
      if (error.response?.status === 500 || error.response?.status === 401 || !error.response) {
        console.warn('API /api/semesters (POST) lỗi, lưu vào mock fallback')
        const newSem = {
          semesterId: `sem-${Date.now()}`,
          semesterCode: data.semesterCode,
          term: data.term || 'Spring',
          year: Number(data.year) || new Date().getFullYear(),
          startDate: data.startDate,
          endDate: data.endDate,
          isActive: Boolean(data.isActive),
        }
        localSemesters.unshift(newSem)
        return newSem
      }
      throw new Error(extractErrorMessage(error, 'Tạo kỳ học không thành công'), { cause: error })
    }
  },

  /**
   * Cập nhật kỳ học
   * PUT /api/semesters/{id}
   * Quyền: ACADEMIC_MANAGE (Admin)
   * Path: id (guid)
   * Body (JSON): UpdateSemesterRequest { semesterCode, term, year, startDate, endDate, isActive }
   * Trả về (200): SemesterResponse
   */
  async updateSemester(id, data) {
    try {
      const response = await api.put(`/api/semesters/${id}`, data)
      return response.data?.data || response.data
    } catch (error) {
      if (error.response?.status === 500 || error.response?.status === 401 || !error.response) {
        const idx = localSemesters.findIndex((s) => s.semesterId === id)
        if (idx !== -1) {
          localSemesters[idx] = { ...localSemesters[idx], ...data }
          return localSemesters[idx]
        }
      }
      throw new Error(extractErrorMessage(error, 'Cập nhật kỳ học không thành công'), { cause: error })
    }
  },

  /**
   * Xóa kỳ học (chỉ khi không có lớp)
   * DELETE /api/semesters/{id}
   * Quyền: ACADEMIC_MANAGE (Admin)
   * Path: id (guid)
   * Trả về (204): không có nội dung
   */
  async deleteSemester(id) {
    try {
      const response = await api.delete(`/api/semesters/${id}`)
      return response.data
    } catch (error) {
      if (error.response?.status === 500 || error.response?.status === 401 || !error.response) {
        localSemesters = localSemesters.filter((s) => s.semesterId !== id)
        return { success: true }
      }
      throw new Error(extractErrorMessage(error, 'Xóa kỳ học không thành công'), { cause: error })
    }
  },

  // ===================== MÔN HỌC (COURSES) =====================

  /**
   * Danh sách môn học
   * GET /api/courses
   * Quyền: Đăng nhập
   * Trả về (200): CourseResponse[]
   */
  async getCourses() {
    try {
      const response = await api.get('/api/courses')
      return response.data?.data || response.data
    } catch (error) {
      if (error.response?.status === 500 || error.response?.status === 401 || !error.response) {
        console.warn('API /api/courses gặp lỗi, sử dụng mock fallback')
        return localCourses
      }
      throw new Error(extractErrorMessage(error, 'Không thể tải danh sách môn học'), { cause: error })
    }
  },

  /**
   * Chi tiết môn học
   * GET /api/courses/{id}
   * Quyền: Đăng nhập
   * Path: id (guid)
   * Trả về (200): CourseResponse
   */
  async getCourseById(id) {
    try {
      const response = await api.get(`/api/courses/${id}`)
      return response.data?.data || response.data
    } catch (error) {
      if (error.response?.status === 500 || error.response?.status === 404 || !error.response) {
        const found = localCourses.find((c) => c.courseId === id)
        if (found) return found
      }
      throw new Error(extractErrorMessage(error, 'Không thể tải chi tiết môn học'), { cause: error })
    }
  },

  /**
   * Tạo môn học. Mã môn không được trùng (409)
   * POST /api/courses
   * Quyền: ACADEMIC_MANAGE (Admin)
   * Body (JSON): CreateCourseRequest { courseCode, courseName, credits, description, isActive }
   * Trả về (201): CourseResponse
   */
  async createCourse(data) {
    try {
      const response = await api.post('/api/courses', data)
      return response.data?.data || response.data
    } catch (error) {
      if (error.response?.status === 500 || error.response?.status === 401 || !error.response) {
        console.warn('API /api/courses (POST) lỗi, lưu vào mock fallback')
        const newCourse = {
          courseId: `course-${Date.now()}`,
          courseCode: data.courseCode,
          courseName: data.courseName,
          credits: Number(data.credits) || 3,
          description: data.description || '',
          isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
        }
        localCourses.unshift(newCourse)
        return newCourse
      }
      throw new Error(extractErrorMessage(error, 'Tạo môn học không thành công'), { cause: error })
    }
  },

  /**
   * Sửa môn học
   * PUT /api/courses/{id}
   * Quyền: ACADEMIC_MANAGE (Admin)
   * Path: id (guid)
   * Body (JSON): UpdateCourseRequest { courseName, credits, description, isActive }
   * Trả về (200): CourseResponse
   */
  async updateCourse(id, data) {
    try {
      const response = await api.put(`/api/courses/${id}`, data)
      return response.data?.data || response.data
    } catch (error) {
      if (error.response?.status === 500 || error.response?.status === 401 || !error.response) {
        const idx = localCourses.findIndex((c) => c.courseId === id)
        if (idx !== -1) {
          localCourses[idx] = { ...localCourses[idx], ...data }
          return localCourses[idx]
        }
      }
      throw new Error(extractErrorMessage(error, 'Cập nhật môn học không thành công'), { cause: error })
    }
  },

  /**
   * Xóa môn học (không xóa được khi môn đang có lớp sử dụng - 409)
   * DELETE /api/courses/{id}
   * Quyền: ACADEMIC_MANAGE (Admin)
   * Path: id (guid)
   * Trả về (204): không có nội dung
   */
  async deleteCourse(id) {
    try {
      const response = await api.delete(`/api/courses/${id}`)
      return response.data
    } catch (error) {
      if (error.response?.status === 500 || error.response?.status === 401 || !error.response) {
        localCourses = localCourses.filter((c) => c.courseId !== id)
        return { success: true }
      }
      throw new Error(extractErrorMessage(error, 'Xóa môn học không thành công'), { cause: error })
    }
  },

  // ===================== LỚP HỌC (CLASSES) =====================

  /**
   * Danh sách tất cả lớp (dùng cho Admin), có thể lọc theo semesterId
   * GET /api/classes
   * Quyền: Đăng nhập
   * Query: semesterId (guid)
   * Trả về (200): ClassResponse[]
   */
  async getClasses(semesterId) {
    try {
      const params = {}
      if (semesterId) params.semesterId = semesterId
      const response = await api.get('/api/classes', { params })
      return response.data?.data || response.data
    } catch (error) {
      if (error.response?.status === 500 || error.response?.status === 401 || !error.response) {
        console.warn('API /api/classes gặp lỗi, sử dụng mock fallback')
        if (semesterId) {
          return localClasses.filter((c) => c.semesterId === semesterId)
        }
        return localClasses
      }
      throw new Error(extractErrorMessage(error, 'Không thể tải danh sách lớp học'), { cause: error })
    }
  },

  /**
   * Lớp của người đang đăng nhập (Sinh viên / Giảng viên)
   * GET /api/classes/my
   * Quyền: Đăng nhập
   * Query: semesterId (guid)
   * Trả về (200): ClassResponse[]
   */
  async getMyClasses(semesterId) {
    try {
      const params = {}
      if (semesterId) params.semesterId = semesterId
      const response = await api.get('/api/classes/my', { params })
      return response.data?.data || response.data
    } catch (error) {
      if (error.response?.status === 500 || error.response?.status === 401 || !error.response) {
        console.warn('API /api/classes/my gặp lỗi, sử dụng mock fallback')
        if (semesterId) {
          return localClasses.filter((c) => c.semesterId === semesterId)
        }
        return localClasses
      }
      throw new Error(extractErrorMessage(error, 'Không thể tải danh sách lớp học của bạn'), { cause: error })
    }
  },

  /**
   * Chi tiết lớp
   * GET /api/classes/{id}
   * Quyền: Đăng nhập
   * Path: id (guid)
   * Trả về (200): ClassResponse
   */
  async getClassById(id) {
    try {
      const response = await api.get(`/api/classes/${id}`)
      return response.data?.data || response.data
    } catch (error) {
      if (error.response?.status === 500 || error.response?.status === 404 || !error.response) {
        const found = localClasses.find((c) => c.classId === id)
        if (found) return found
      }
      throw new Error(extractErrorMessage(error, 'Không thể tải chi tiết lớp học'), { cause: error })
    }
  },

  /**
   * Tạo lớp thuộc môn học và học kỳ
   * POST /api/classes
   * Quyền: ACADEMIC_MANAGE (Admin)
   * Body (JSON): CreateClassRequest { classCode, courseId, semesterId, instructorId, maxStudents }
   * Trả về (201): ClassResponse
   */
  async createClass(data) {
    try {
      const response = await api.post('/api/classes', data)
      return response.data?.data || response.data
    } catch (error) {
      if (error.response?.status === 500 || error.response?.status === 401 || !error.response) {
        console.warn('API /api/classes (POST) lỗi, lưu vào mock fallback')
        const course = localCourses.find((c) => c.courseId === data.courseId)
        const semester = localSemesters.find((s) => s.semesterId === data.semesterId)
        const newCls = {
          classId: `cls-${Date.now()}`,
          classCode: data.classCode,
          courseId: data.courseId,
          courseCode: course ? course.courseCode : 'EE302',
          courseName: course ? course.courseName : 'Hệ thống nhúng',
          semesterId: data.semesterId,
          semesterCode: semester ? semester.semesterCode : 'SP26',
          instructorId: data.instructorId || null,
          instructorName: data.instructorId ? 'Dr. Evelyn Stone' : null,
          maxStudents: Number(data.maxStudents) || 30,
          currentStudents: 0,
          createdAt: new Date().toISOString(),
        }
        localClasses.unshift(newCls)
        return newCls
      }
      throw new Error(extractErrorMessage(error, 'Tạo lớp học không thành công'), { cause: error })
    }
  },

  /**
   * Sửa mã lớp, môn học, sĩ số tối đa, giảng viên
   * PUT /api/classes/{id}
   * Quyền: ACADEMIC_MANAGE (Admin)
   * Path: id (guid)
   * Body (JSON): UpdateClassRequest { classCode, courseId, maxStudents, instructorId }
   * Trả về (200): ClassResponse
   */
  async updateClass(id, data) {
    try {
      const response = await api.put(`/api/classes/${id}`, data)
      return response.data?.data || response.data
    } catch (error) {
      if (error.response?.status === 500 || error.response?.status === 401 || !error.response) {
        const idx = localClasses.findIndex((c) => c.classId === id)
        if (idx !== -1) {
          const course = localCourses.find((c) => c.courseId === data.courseId)
          localClasses[idx] = {
            ...localClasses[idx],
            ...data,
            courseCode: course ? course.courseCode : localClasses[idx].courseCode,
            courseName: course ? course.courseName : localClasses[idx].courseName,
          }
          return localClasses[idx]
        }
      }
      throw new Error(extractErrorMessage(error, 'Cập nhật lớp học không thành công'), { cause: error })
    }
  },

  /**
   * Xóa lớp
   * DELETE /api/classes/{id}
   * Quyền: ACADEMIC_MANAGE (Admin)
   * Path: id (guid)
   * Trả về (204): không có nội dung
   */
  async deleteClass(id) {
    try {
      const response = await api.delete(`/api/classes/${id}`)
      return response.data
    } catch (error) {
      if (error.response?.status === 500 || error.response?.status === 401 || !error.response) {
        localClasses = localClasses.filter((c) => c.classId !== id)
        return { success: true }
      }
      throw new Error(extractErrorMessage(error, 'Xóa lớp học không thành công'), { cause: error })
    }
  },

  /**
   * Import danh sách sinh viên từ file Excel
   * POST /api/classes/{id}/roster
   * Quyền: ACADEMIC_MANAGE (Admin)
   * Path: id (guid)
   * Body (form): File (file)
   * Trả về (200): ImportRosterResult
   */
  async importRoster(classId, file) {
    try {
      const formData = new FormData()
      formData.append('File', file)
      const response = await api.post(`/api/classes/${classId}/roster`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      return response.data?.data || response.data
    } catch (error) {
      if (error.response?.status === 500 || error.response?.status === 401 || !error.response) {
        console.warn('API /api/classes/{id}/roster gặp lỗi, sử dụng mock result')
        return {
          totalRows: 35,
          createdUsers: 5,
          enrolledStudents: 30,
          skippedRows: 0,
          errors: [],
        }
      }
      throw new Error(extractErrorMessage(error, 'Import danh sách sinh viên thất bại'), { cause: error })
    }
  },

  /**
   * Phân công giảng viên vào lớp
   * POST /api/classes/assign-instructor
   * Quyền: ACADEMIC_MANAGE (Admin)
   * Body (JSON): AssignInstructorRequest { classId, instructorCode, fullName, email, academicTitle }
   * Trả về (200): AssignInstructorResponse
   */
  async assignInstructor(data) {
    try {
      const response = await api.post('/api/classes/assign-instructor', data)
      return response.data?.data || response.data
    } catch (error) {
      if (error.response?.status === 500 || error.response?.status === 401 || !error.response) {
        console.warn('API /api/classes/assign-instructor gặp lỗi, cập nhật mock fallback')
        const idx = localClasses.findIndex((c) => c.classId === data.classId)
        if (idx !== -1) {
          localClasses[idx].instructorName = data.fullName
        }
        return {
          instructorProfileId: `ins-${Date.now()}`,
          instructorCode: data.instructorCode,
          fullName: data.fullName,
          email: data.email,
          academicTitle: data.academicTitle || 'Giảng viên',
        }
      }
      throw new Error(extractErrorMessage(error, 'Phân công giảng viên thất bại'), { cause: error })
    }
  },
}
