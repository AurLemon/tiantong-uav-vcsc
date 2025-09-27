import request from '@/utils/api/request'

export interface CollectionDataItem {
  id: number
  longitude: string
  latitude: string
  altitude?: string
  temperature?: string
  humidity?: string
  device_id?: number
  device_name?: string
  image_url?: string
  weather_condition_id?: number
  weather_condition_name?: string
  collected_at: string
  created_at: string
  updated_at: string
}

export interface CreateCollectionDataParams {
  longitude: number
  latitude: number
  altitude?: number
  temperature?: number
  humidity?: number
  device_id?: number
  image_url?: string
  weather_condition_id?: number
  collected_at?: string
}

export interface UpdateCollectionDataParams {
  longitude?: number
  latitude?: number
  altitude?: number
  temperature?: number
  humidity?: number
  device_id?: number
  image_url?: string
  weather_condition_id?: number
  collected_at?: string
}

export interface CollectionDataQueryParams {
  page?: number
  page_size?: number
  device_id?: number
  weather_condition_id?: number
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

// 获取采集数据列表（分页）
export async function getCollectionDataList(
  params?: CollectionDataQueryParams
): Promise<PaginatedResponse<CollectionDataItem>> {
  return request.get('/collection-data', { params })
}

// 获取单个采集数据
export async function getCollectionData(id: number): Promise<CollectionDataItem> {
  return request.get(`/collection-data/${id}`)
}

// 创建采集数据
export async function createCollectionData(
  params: CreateCollectionDataParams
): Promise<CollectionDataItem> {
  return request.post('/collection-data', params)
}

// 更新采集数据
export async function updateCollectionData(
  id: number,
  params: UpdateCollectionDataParams
): Promise<CollectionDataItem> {
  return request.put(`/collection-data/${id}`, params)
}

// 删除采集数据
export async function deleteCollectionData(id: number): Promise<{ message: string; id: number }> {
  return request.delete(`/collection-data/${id}`)
}
