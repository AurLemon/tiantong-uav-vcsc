import request from '@/utils/api/request'

export interface PredictionDataItem {
  id: number
  region?: string
  tid?: number
  element_type_name?: string
  v?: string
  tm?: string
}

export interface CreatePredictionDataParams {
  region?: string
  tid?: number
  v?: number
  tm?: string
}

export interface UpdatePredictionDataParams {
  region?: string
  tid?: number
  v?: number
  tm?: string
}

export interface PredictionDataQueryParams {
  page?: number
  page_size?: number
  region?: string
  tid?: number
  start_time?: string
  end_time?: string
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

// 获取预报数据列表（分页）
export async function getPredictionDataList(
  params?: PredictionDataQueryParams
): Promise<PaginatedResponse<PredictionDataItem>> {
  const cleanedParams = { ...params };
  Object.keys(cleanedParams).forEach((key) => {
    if (
      (cleanedParams as any)[key] === '' ||
      (cleanedParams as any)[key] === null ||
      (cleanedParams as any)[key] === undefined
    ) {
      delete (cleanedParams as any)[key];
    }
  });
  return request.get('/predictions', { params: cleanedParams })
}

// 获取单个预报数据
export async function getPredictionData(id: number): Promise<PredictionDataItem> {
  return request.get(`/predictions/${id}`)
}

// 创建预报数据
export async function createPredictionData(
  params: CreatePredictionDataParams
): Promise<PredictionDataItem> {
  return request.post('/predictions', params)
}

// 更新预报数据
export async function updatePredictionData(
  id: number,
  params: UpdatePredictionDataParams
): Promise<PredictionDataItem> {
  return request.put(`/predictions/${id}`, params)
}

// 删除预报数据
export async function deletePredictionData(id: number): Promise<{ message: string; id: number }> {
  return request.delete(`/predictions/${id}`)
}
