import React, { useEffect, useRef } from 'react'
import { message } from 'antd'

interface AMapComponentProps {
  latitude?: string | number
  longitude?: string | number
  altitude?: string | number
  style?: React.CSSProperties
  zoom?: number
}

declare global {
  interface Window {
    AMap: any
    AMapLoader: any
  }
}

const AMapComponent: React.FC<AMapComponentProps> = ({
  latitude,
  longitude,
  altitude,
  style = { height: '300px', width: '100%' },
  zoom = 15,
}) => {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<any>(null)
  const markerInstance = useRef<any>(null)

  // 初始化地图
  const initMap = async () => {
    if (!mapRef.current) return

    try {
      // 检查是否已加载高德地图
      if (!window.AMap) {
        // 动态加载高德地图API
        const script = document.createElement('script')
        const amapKey = import.meta.env.VITE_AMAP_KEY || '28a1bdda4a136854394ccd52a8ffad77'
        script.src = `https://webapi.amap.com/maps?v=2.0&key=${amapKey}&plugin=AMap.Scale,AMap.ToolBar,AMap.ControlBar`
        script.async = true

        script.onload = () => {
          createMap()
        }

        script.onerror = () => {
          console.error('高德地图加载失败')
          message.error('地图加载失败，请检查网络连接')
        }

        document.head.appendChild(script)
      } else {
        createMap()
      }
    } catch (error) {
      console.error('地图初始化失败:', error)
    }
  }

  // 创建地图实例
  const createMap = () => {
    if (!mapRef.current || !window.AMap) return

    // 默认中心点（北京）
    const defaultCenter = [116.397428, 39.90923]
    const center = latitude && longitude ? [Number(longitude), Number(latitude)] : defaultCenter

    mapInstance.current = new window.AMap.Map(mapRef.current, {
      zoom: zoom,
      center: center,
      viewMode: '3D',
      pitch: 0,
      rotation: 0,
      showLabel: true,
      mapStyle: 'amap://styles/normal',
    })

    // 添加控件
    mapInstance.current.addControl(new window.AMap.Scale())
    mapInstance.current.addControl(new window.AMap.ToolBar())
    mapInstance.current.addControl(new window.AMap.ControlBar())

    // 如果有坐标，添加标记
    if (latitude && longitude) {
      addMarker(Number(longitude), Number(latitude))
    }
  }

  // 添加标记
  const addMarker = (lng: number, lat: number) => {
    if (!mapInstance.current || !window.AMap) return

    // 移除旧标记
    if (markerInstance.current) {
      mapInstance.current.remove(markerInstance.current)
    }

    // 创建新标记
    markerInstance.current = new window.AMap.Marker({
      position: [lng, lat],
      title: `位置: ${lat.toFixed(6)}, ${lng.toFixed(6)}${altitude ? `\n高度: ${altitude}m` : ''}`,
      icon: new window.AMap.Icon({
        size: new window.AMap.Size(25, 34),
        image: 'https://webapi.amap.com/theme/v1.3/markers/n/mark_b.png',
        imageOffset: new window.AMap.Pixel(-9, -3),
        imageSize: new window.AMap.Size(135, 40),
      }),
    })

    mapInstance.current.add(markerInstance.current)

    // 设置地图中心
    mapInstance.current.setCenter([lng, lat])

    // 添加信息窗体
    const infoWindow = new window.AMap.InfoWindow({
      content: `
        <div style="padding: 10px;">
          <p><strong>设备位置</strong></p>
          <p>纬度: ${lat.toFixed(6)}</p>
          <p>经度: ${lng.toFixed(6)}</p>
          ${altitude ? `<p>高度: ${altitude}m</p>` : ''}
        </div>
      `,
      offset: new window.AMap.Pixel(0, -30),
    })

    markerInstance.current.on('click', () => {
      infoWindow.open(mapInstance.current, [lng, lat])
    })
  }

  // 更新标记位置
  useEffect(() => {
    if (mapInstance.current && latitude && longitude) {
      addMarker(Number(longitude), Number(latitude))
    }
  }, [latitude, longitude, altitude])

  // 初始化地图
  useEffect(() => {
    initMap()

    return () => {
      if (mapInstance.current) {
        mapInstance.current.destroy()
      }
    }
  }, [])

  return (
    <div style={style}>
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
      {!latitude || !longitude ? (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(255, 255, 255, 0.9)',
            padding: '10px',
            borderRadius: '4px',
            textAlign: 'center',
            fontSize: '12px',
            color: '#666',
          }}
        >
          等待位置数据...
          <br />
          <span style={{ fontSize: '10px' }}>高德地图已配置，等待设备位置信息</span>
        </div>
      ) : null}
    </div>
  )
}

export default AMapComponent
