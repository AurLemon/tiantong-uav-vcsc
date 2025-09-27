import request from '@/utils/api/request'

export interface ElementType {
  id: number
  name: string
}

export interface CreateElementTypeParams {
  name: string
}

export interface UpdateElementTypeParams {
  name?: string
}

export interface ElementTypeQueryParams {
  page?: number
  page_size?: number
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

// 获取要素类型列表（分页）
export async function getElementTypeList(
  params?: ElementTypeQueryParams
): Promise<PaginatedResponse<ElementType>> {
  return request.get('/element-types', { params })
}

// 获取所有要素类型（不分页，用于下拉选择）
export async function getAllElementTypes(): Promise<ElementType[]> {
  return request.get('/element-types/all')
}

// 获取单个要素类型
export async function getElementType(id: number): Promise<ElementType> {
  return request.get(`/element-types/${id}`)
}

// 创建要素类型
export async function createElement(
  params: CreateElementTypeParams
): Promise<ElementType> {
  return request.post('/element-types', params)
}

// 更新要素类型
export async function updateElementType(
  id: number,
  params: UpdateElementTypeParams
): Promise<ElementType> {
  return request.put(`/element-types/${id}`, params)
}

// 删除要素类型
export async function deleteElementType(id: number): Promise<{ message: string; id: number }> {
  return request.delete(`/element-types/${id}`)
}
