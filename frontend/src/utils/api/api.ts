import request from '@/utils/api/request'

/** 退出登录接口 POST /api/login/outLogin */
export async function outLogin(options?: { [key: string]: any }) {
  return request<Record<string, any>>('/login/outLogin', {
    method: 'POST',
    ...(options || {}),
  })
}

/** 登录接口 POST /api/login/account */
export async function login(body: API.LoginParams, options?: { [key: string]: any }) {
  return request<API.LoginResult>('/login/account', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  })
}

/** 此处后端没有提供注释 GET /api/notices */
export async function getNotices(options?: { [key: string]: any }) {
  return request<API.NoticeIconList>('/notices', {
    method: 'GET',
    ...(options || {}),
  })
}

/** 获取规则列表 GET /api/rule */
export async function rule(
  params: {
    // query
    /** 当前的页码 */
    current?: number
    /** 页面的容量 */
    pageSize?: number
  },
  options?: { [key: string]: any }
) {
  return request<API.RuleList>('/rule', {
    method: 'GET',
    params: {
      ...params,
    },
    ...(options || {}),
  })
}

/** 更新规则 PUT /api/rule */
export async function updateRule(options?: { [key: string]: any }) {
  return request<API.RuleListItem>('/rule', {
    method: 'POST',
    data: {
      method: 'update',
      ...(options || {}),
    },
  })
}

/** 新建规则 POST /api/rule */
export async function addRule(options?: { [key: string]: any }) {
  return request<API.RuleListItem>('/rule', {
    method: 'POST',
    data: {
      method: 'post',
      ...(options || {}),
    },
  })
}

/** 删除规则 DELETE /api/rule */
export async function removeRule(options?: { [key: string]: any }) {
  return request<Record<string, any>>('/rule', {
    method: 'POST',
    data: {
      method: 'delete',
      ...(options || {}),
    },
  })
}

export async function emailLogin(body: API.EmailLoginParams, options?: { [key: string]: any }) {
  return request<API.Response>(`/auth/email-login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  })
}

export async function passwordLogin(
  body: API.PasswordLoginParams,
  options?: { [key: string]: any }
) {
  return request<API.Response>(`/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  })
}

export function authHeader() {
  return {
    Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
  }
}

export async function currentUser(options?: { [key: string]: any }) {
  return request<API.CurrentUser>(`/user/current`, {
    method: 'GET',
    headers: authHeader(),
    ...(options || {}),
  })
}

export async function fetchDynConfig(options?: { [key: string]: any }) {
  // return request(`/config.json`, {
  return request(`/admin/config`, {
    method: 'GET',
    headers: authHeader(),
    ...(options || {}),
  })
}

export async function drawingList(
  params: {
    // query
    /** 当前的页码 */
    current?: number
    /** 页面的容量 */
    pageSize?: number
  },
  options?: { [key: string]: any }
) {
  const data = await request<Array<API.DrawingList>>(`/drawing/list`, {
    method: 'GET',
    headers: authHeader(),
    params: {
      ...Object.fromEntries(Object.entries(params).filter(([_, value]) => value)),
    },
    ...(options || {}),
  })
  return {
    data,
    total: (data as any).length,
    success: true,
    pageSize: 1000,
    current: parseInt(`${params.current}`, 10) || 1,
  }
}

export async function drawingView(params?: { [key: string]: any }) {
  return request<API.DrawingView>(`/drawing/view`, {
    method: 'GET',
    headers: authHeader(),
    params: {
      ...params,
    },
  })
}

export async function drawingDimensionList(
  params: {
    // query
    /** 当前的页码 */
    current?: number
    /** 页面的容量 */
    pageSize?: number
  },
  options?: { [key: string]: any }
) {
  const data = await request<Array<API.DrawingDimension>>(`/dimension/view`, {
    method: 'GET',
    headers: authHeader(),
    params: {
      ...params,
    },
    ...(options || {}),
  })
  return {
    data,
    total: (data as any).length,
    success: true,
    pageSize: 1000,
    current: parseInt(`${params.current}`, 10) || 1,
  }
}

export async function drawingMetadata(
  params: {
    // query
    /** 当前的页码 */
    current?: number
    /** 页面的容量 */
    pageSize?: number
  },
  options?: { [key: string]: any }
) {
  const data = await request<any>(`/metadata/view`, {
    method: 'GET',
    headers: authHeader(),
    params: {
      ...params,
    },
    ...(options || {}),
  })
  return {
    data: {
      drawing_id: (data as any).drawing_id,
      rows: [
        { title: 'Material', value: (data as any).material },
        { title: 'Finishing', value: (data as any).finishing },
        { title: 'Treatment', value: (data as any).treatment },
      ],
      total: (data as any).length,
      success: true,
      pageSize: 1000,
      current: parseInt(`${params.current}`, 10) || 1,
    },
  }
}

export async function drawingDimensionScore(
  params: {
    // query
    /** 当前的页码 */
    current?: number
    /** 页面的容量 */
    pageSize?: number
  },
  options?: { [key: string]: any }
) {
  const data = await request<Array<API.DrawingDimension>>(`/dimension/score`, {
    method: 'GET',
    headers: authHeader(),
    params: {
      ...params,
    },
    ...(options || {}),
  })
  return {
    data,
    total: (data as any).length,
    success: true,
    pageSize: 1000,
    current: parseInt(`${params.current}`, 10) || 1,
  }
}

export async function drawingDimensionFirstRevision(
  params: {
    // query
    /** 当前的页码 */
    current?: number
    /** 页面的容量 */
    pageSize?: number
  },
  options?: { [key: string]: any }
) {
  const data = await request<Array<API.DrawingDimension>>(`/dimension/first`, {
    method: 'GET',
    headers: authHeader(),
    params: {
      ...params,
    },
    ...(options || {}),
  })
  return {
    data,
    total: (data as any).length,
    success: true,
    pageSize: 1000,
    current: parseInt(`${params.current}`, 10) || 1,
  }
}

export async function drawingDimensionLastRevision(
  params: {
    // query
    /** 当前的页码 */
    current?: number
    /** 页面的容量 */
    pageSize?: number
  },
  options?: { [key: string]: any }
) {
  const data = await request<Array<API.DrawingDimension>>(`/dimension/last`, {
    method: 'GET',
    headers: authHeader(),
    params: {
      ...params,
    },
    ...(options || {}),
  })
  return {
    data,
    total: (data as any).length,
    success: true,
    pageSize: 1000,
    current: parseInt(`${params.current}`, 10) || 1,
  }
}

export async function editDimension(body: any, options?: { [key: string]: any }) {
  return request<Record<string, any>>(`/dimension/edit`, {
    method: 'POST',
    headers: authHeader(),
    data: body,
    ...(options || {}),
  })
}

export async function editMetadata(body: any, options?: { [key: string]: any }) {
  return request<Record<string, any>>(`/metadata/edit`, {
    method: 'POST',
    headers: authHeader(),
    data: body,
    ...(options || {}),
  })
}
