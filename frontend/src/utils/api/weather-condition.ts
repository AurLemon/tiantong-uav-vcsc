import request from '@/utils/api/request'

export interface WeatherCondition {
  id: number
  name: string
  description?: string
  created_at: string
  updated_at: string
}

export interface CreateWeatherConditionParams {
  name: string
  description?: string
}

export interface UpdateWeatherConditionParams {
  name?: string
  description?: string
}

export interface WeatherConditionQueryParams {
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

// 获取天气情况列表（分页）
export async function getWeatherConditionList(
  params?: WeatherConditionQueryParams
): Promise<PaginatedResponse<WeatherCondition>> {
  return request.get('/weather-conditions', { params })
}

// 获取所有天气情况（不分页，用于下拉选择）
export async function getAllWeatherConditions(): Promise<WeatherCondition[]> {
  return request.get('/weather-conditions/all')
}

// 获取单个天气情况
export async function getWeatherCondition(id: number): Promise<WeatherCondition> {
  return request.get(`/weather-conditions/${id}`)
}

// 创建天气情况
export async function createWeatherCondition(
  params: CreateWeatherConditionParams
): Promise<WeatherCondition> {
  return request.post('/weather-conditions', params)
}

// 更新天气情况
export async function updateWeatherCondition(
  id: number,
  params: UpdateWeatherConditionParams
): Promise<WeatherCondition> {
  return request.put(`/weather-conditions/${id}`, params)
}

// 删除天气情况
export async function deleteWeatherCondition(id: number): Promise<{ message: string; id: number }> {
  return request.delete(`/weather-conditions/${id}`)
}
