import request from '@/utils/api/request'

/** 发送验证码 POST /login/captcha */
export async function getFakeCaptcha(
  params: {
    phone?: string
  },
  options?: { [key: string]: any }
) {
  return request<API.FakeCaptcha>('/login/captcha', {
    method: 'GET',
    params: {
      ...params,
    },
    ...(options || {}),
  })
}
