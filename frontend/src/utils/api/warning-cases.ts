import request from '@/utils/api/request'

export interface WarningCaseItem {
  id: number
  content?: any
}

export interface CreateWarningCaseParams {
  content: any
}

export interface UpdateWarningCaseParams {
  content?: any
}

export interface WarningCaseQueryParams {
  page?: number
  page_size?: number
}

export interface ParsedContent {
  yearMonths?: string[]
  timeRanges?: Array<{ start: string; end: string }>
  timeDataMap?: Record<string, any>
  timeRangeDataMap?: Record<string, any>
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    current_page: number
    page_size: number
    total_items: number
    total_pages: number
    has_next: boolean
    has_prev: boolean
  }
}

// 获取风险个例列表（分页）
export async function getWarningCaseList(
  params?: WarningCaseQueryParams
): Promise<PaginatedResponse<WarningCaseItem>> {
  return request.get('/warnings', { params })
}

// 获取单个风险个例
export async function getWarningCase(id: number): Promise<WarningCaseItem> {
  return request.get(`/warnings/${id}`)
}

// 解析风险个例内容
export async function parseWarningCaseContent(id: number): Promise<ParsedContent> {
  return request.get(`/warnings/${id}/parse`)
}

// 创建风险个例
export async function createWarningCase(
  params: CreateWarningCaseParams
): Promise<WarningCaseItem> {
  return request.post('/warnings', params)
}

// 更新风险个例
export async function updateWarningCase(
  id: number,
  params: UpdateWarningCaseParams
): Promise<WarningCaseItem> {
  return request.put(`/warnings/${id}`, params)
}

// 删除风险个例
export async function deleteWarningCase(id: number): Promise<{ message: string; id: number }> {
  return request.delete(`/warnings/${id}`)
}
