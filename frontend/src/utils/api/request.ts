import axios, { AxiosRequestConfig, AxiosResponse } from 'axios'
import { message } from 'antd'

// 创建 axios 实例
const request = axios.create({
  baseURL: import.meta.env.VITE_BASE_API_URL || '/api',
  timeout: 10000,
})

// 请求拦截器
request.interceptors.request.use(
  (config) => {
    // 添加认证 token
    const token = localStorage.getItem('auth_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器
request.interceptors.response.use(
  (response: AxiosResponse) => {
    const { data } = response

    // 如果是成功响应，直接返回数据
    if (response.status === 200) {
      return data
    }

    return data
  },
  (error) => {
    const { response } = error

    if (response) {
      const { status, data } = response

      switch (status) {
        case 401:
          // 不直接跳转，让组件处理
          const authError = new Error(data?.message || '未授权，请重新登录') as any
          authError.name = 'AuthError'
          authError.status = 401
          return Promise.reject(authError)
        case 403:
          const forbiddenError = new Error(data?.message || '拒绝访问') as any
          forbiddenError.name = 'ForbiddenError'
          forbiddenError.status = 403
          return Promise.reject(forbiddenError)
        case 404:
          message.error(data?.message || '请求的资源不存在')
          break
        case 500:
          message.error(data?.message || '服务器内部错误')
          break
        default:
          message.error(data?.message || '请求失败')
      }
    } else {
      message.error('网络错误，请检查网络连接')
    }

    return Promise.reject(error)
  }
)

export default request
export { request }
