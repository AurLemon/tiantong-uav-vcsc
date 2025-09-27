import request from '@/utils/api/request'

export interface UploadResponse {
  url: string
  filename: string
  size: number
  content_type?: string
}

export interface DeleteFileParams {
  url: string
}

// 上传图片
export async function uploadImage(file: File): Promise<UploadResponse> {
  const formData = new FormData()
  formData.append('file', file)
  
  return request.post('/upload/image', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
}

// 删除文件
export async function deleteFile(params: DeleteFileParams): Promise<{ message: string; url: string }> {
  return request.post('/upload/delete', params)
}
