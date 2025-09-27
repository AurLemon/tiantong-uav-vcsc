import React, { useEffect, useRef, useState } from 'react'
import { Button } from 'antd'
import { PlayCircleOutlined, PauseCircleOutlined, ReloadOutlined } from '@ant-design/icons'

interface RTMPPlayerProps {
  rtmpUrl?: string
  deviceId?: number
  style?: React.CSSProperties
  autoPlay?: boolean
}

const RTMPPlayer: React.FC<RTMPPlayerProps> = ({
  rtmpUrl,
  deviceId,
  style = { height: '300px', width: '100%' },
  autoPlay = false
}) => {
  const playerRef = useRef<HTMLDivElement>(null)
  const easyPlayerRef = useRef<any>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // 加载EasyPlayer脚本
  const loadEasyPlayerScript = () => {
    return new Promise<void>((resolve, reject) => {
      if (window.EasyPlayerPro) {
        resolve()
        return
      }

      const script = document.createElement('script')
      script.src = '/js/EasyPlayer-pro.js'
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('EasyPlayer.js加载失败'))
      document.head.appendChild(script)
    })
  }

  // 创建播放器实例
  const createPlayer = async () => {
    if (!playerRef.current) return

    try {
      setIsLoading(true)
      setError(null)

      // 加载EasyPlayer脚本
      await loadEasyPlayerScript()

      // 创建播放器配置
      const config = {
        stretch: true,
        hasAudio: true,
        isLive: true,
      }

      // 创建播放器实例 - 直接传递DOM元素
      easyPlayerRef.current = new window.EasyPlayerPro(playerRef.current, config)

      console.log('EasyPlayer创建成功')
      setIsLoading(false)

    } catch (err) {
      console.error('创建播放器失败:', err)
      setError(err instanceof Error ? err.message : '播放器创建失败')
      setIsLoading(false)
    }
  }

  // 播放视频
  const playVideo = async () => {
    if (!easyPlayerRef.current) {
      await createPlayer()
    }

    if (easyPlayerRef.current && rtmpUrl) {
      try {
        setIsLoading(true)
        console.log('开始播放视频流:', rtmpUrl)
        await easyPlayerRef.current.play(rtmpUrl)
        setIsPlaying(true)
        setError(null)
        setIsLoading(false)
        console.log('视频流播放成功')
      } catch (err) {
        console.error('播放失败:', err)
        setError('播放失败: ' + (err instanceof Error ? err.message : '未知错误'))
        setIsLoading(false)
      }
    } else {
      setError('播放器未初始化或视频流地址为空')
    }
  }

  // 暂停视频
  const pauseVideo = () => {
    if (easyPlayerRef.current) {
      easyPlayerRef.current.pause()
      setIsPlaying(false)
    }
  }

  // 销毁播放器
  const destroyPlayer = () => {
    return new Promise<void>((resolve) => {
      if (easyPlayerRef.current) {
        easyPlayerRef.current.destroy()
        easyPlayerRef.current = null
      }
      setTimeout(() => {
        resolve()
      }, 100)
    })
  }

  // 重新加载
  const reloadVideo = async () => {
    setError(null)
    setIsPlaying(false)
    await destroyPlayer()
    await createPlayer()
    if (rtmpUrl) {
      playVideo()
    }
  }

  // 初始化播放器并自动播放
  useEffect(() => {
    if (rtmpUrl) {
      // 延迟初始化，确保DOM完全渲染
      const timer = setTimeout(async () => {
        await createPlayer()
        // 自动播放
        if (easyPlayerRef.current) {
          playVideo()
        }
      }, 200)

      return () => clearTimeout(timer)
    }
  }, [rtmpUrl])

  // 清理函数
  useEffect(() => {
    return () => {
      destroyPlayer()
    }
  }, [])

  if (!rtmpUrl) {
    return (
      <div
        style={{
          ...style,
          background: '#f5f5f5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px dashed #d9d9d9',
          flexDirection: 'column'
        }}
      >
        <div style={{ textAlign: 'center', color: '#999' }}>
          <PlayCircleOutlined style={{ fontSize: '48px', marginBottom: '16px' }} />
          <div>未配置视频流地址</div>
          <div style={{ fontSize: '12px', marginTop: '8px' }}>
            请在设备设置中配置EasyNVR视频流地址
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', ...style }}>
      {/* EasyPlayer容器 */}
      <div
        ref={playerRef}
        style={{
          width: '100%',
          height: '100%',
          background: '#000'
        }}
      />

      {/* 控制按钮覆盖层 */}
      <div
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          display: 'flex',
          gap: '8px',
          zIndex: 10
        }}
      >
        <Button
          type="primary"
          size="small"
          icon={isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
          onClick={isPlaying ? pauseVideo : playVideo}
        >
          {isPlaying ? '暂停' : '播放'}
        </Button>
        <Button
          size="small"
          icon={<ReloadOutlined />}
          onClick={reloadVideo}
        >
          重载
        </Button>
      </div>

      {/* 加载提示 */}
      {isLoading && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(0, 0, 0, 0.8)',
            color: '#fff',
            padding: '16px',
            borderRadius: '4px',
            textAlign: 'center',
            zIndex: 20
          }}
        >
          正在加载EasyPlayer播放器...
        </div>
      )}

      {/* 错误提示 */}
      {error && !isLoading && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(0, 0, 0, 0.8)',
            color: '#fff',
            padding: '16px',
            borderRadius: '4px',
            textAlign: 'center',
            zIndex: 20
          }}
        >
          <div style={{ marginBottom: '8px' }}>{error}</div>
          <Button size="small" onClick={reloadVideo}>
            重试
          </Button>
        </div>
      )}

      {/* 视频流信息 */}
      <div
        style={{
          position: 'absolute',
          bottom: '10px',
          left: '10px',
          background: 'rgba(0, 0, 0, 0.7)',
          color: '#fff',
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '10px',
          zIndex: 10
        }}
      >
        EasyNVR: {rtmpUrl}
      </div>
    </div>
  )
}

// 声明全局类型
declare global {
  interface Window {
    EasyPlayerPro: any
  }
}

export default RTMPPlayer
