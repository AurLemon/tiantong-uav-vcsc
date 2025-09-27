import React, { useEffect, useState } from 'react'
import { Space, Tag, Tooltip, Dropdown } from 'antd'
import type { MenuProps } from 'antd'
import {
  WifiOutlined,
  DisconnectOutlined,
  ThunderboltOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import * as deviceService from '@/utils/api/device'

interface DefaultDevice {
  id: string
  name: string
  isConnected: boolean
  data?: {
    battery?: string
    isfly?: string | boolean
    larr?: string[]
    location?: {
      latitude?: string
      longitude?: string
    }
  }
}

const DeviceStatus: React.FC = () => {
  const navigate = useNavigate()
  const [defaultDevice, setDefaultDevice] = useState<DefaultDevice | null>(null)

  // 获取默认设备和状态
  const fetchDefaultDevice = async () => {
    try {
      // 获取所有设备
      const devices = await deviceService.getDevices()

      // 找到默认设备
      const defaultDev = devices.find((d: any) => d.is_default)
      if (!defaultDev) {
        setDefaultDevice(null)
        return
      }

      // 获取设备状态
      const statusResponse = await fetch(`/api/realtime/devices/${defaultDev.uuid}/status`)
      const deviceStatus = statusResponse.ok ? await statusResponse.json() : null

      setDefaultDevice({
        id: defaultDev.uuid,
        name: defaultDev.name,
        isConnected: deviceStatus?.status === 'connected',
        data: deviceStatus?.data || {}
      })
    } catch (error) {
      console.error('Failed to fetch default device:', error)
      setDefaultDevice(null)
    }
  }

  // 定期更新设备状态
  useEffect(() => {
    fetchDefaultDevice()

    // 定期更新状态
    const interval = setInterval(fetchDefaultDevice, 3000)

    return () => {
      clearInterval(interval)
    }
  }, [])

  // 如果没有默认设备，不显示
  if (!defaultDevice) {
    return (
      <Tooltip title='未设置默认设备'>
        <Space
          style={{ cursor: 'pointer' }}
          onClick={() => navigate('/admin/devices')}
          className='!h-12 !leading-normal'
        >
          <DisconnectOutlined style={{ color: '#999' }} />
          <span style={{ color: '#999', fontSize: '12px' }}>无设备</span>
        </Space>
      </Tooltip>
    )
  }

  const { data, isConnected } = defaultDevice

  // 设备状态菜单
  const deviceMenu: MenuProps = {
    items: [
      {
        key: 'view',
        label: '查看设备详情',
        onClick: () => navigate(`/admin/devices/${defaultDevice.id}`),
      },
      {
        key: 'manage',
        label: '设备管理',
        onClick: () => navigate('/admin/devices'),
      },
    ],
  }

  return (
    <Dropdown menu={deviceMenu} trigger={['click']}>
      <div style={{ cursor: 'pointer', padding: '0 8px' }}>
        <Space size='small' className='!h-12 !leading-normal'>
          {/* 连接状态图标 */}
          <Tooltip title={isConnected ? '设备已连接' : '设备未连接'}>
            {isConnected ? (
              <WifiOutlined style={{ color: '#52c41a' }} />
            ) : (
              <DisconnectOutlined style={{ color: '#ff4d4f' }} />
            )}
          </Tooltip>

          {/* 设备名称 */}
          <span
            style={{
              fontSize: '12px',
              maxWidth: '80px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {defaultDevice.name}
          </span>

          {/* 连接状态和关键信息 */}
          {isConnected && data ? (
            <Space size={4} className='!h-12 !leading-normal'>
              {/* 电池电量 */}
              {data.battery && (
                <Tooltip title={`电池: ${data.battery}%`}>
                  <Space size={2}>
                    <ThunderboltOutlined style={{ fontSize: '10px' }} />
                    <span style={{ fontSize: '10px' }}>{data.battery}%</span>
                  </Space>
                </Tooltip>
              )}

              {/* 飞行状态 */}
              <Tag
                color={(data.isfly === '1' || data.isfly === true) ? 'red' : 'green'}
                style={{ fontSize: '10px', lineHeight: '14px', margin: 0 }}
              >
                {(data.isfly === '1' || data.isfly === true) ? '飞行' : '着陆'}
              </Tag>

              {/* 位置信息 */}
              {(data.location?.latitude && data.location?.longitude) || (data.larr && data.larr[0] && data.larr[1]) ? (
                <Tooltip title={`位置: ${data.location?.latitude || data.larr?.[0]}, ${data.location?.longitude || data.larr?.[1]}`}>
                  <EnvironmentOutlined style={{ fontSize: '10px', color: '#1890ff' }} />
                </Tooltip>
              ) : null}
            </Space>
          ) : (
            <Tag color='default' style={{ fontSize: '10px', lineHeight: '14px', margin: 0 }}>
              未连接
            </Tag>
          )}
        </Space>
      </div>
    </Dropdown>
  )
}

export default DeviceStatus
