import React, { useRef, useState } from 'react'
import { PageContainer, ProTable, ActionType, ProColumns } from '@ant-design/pro-components'
import { Button, Space, Tag, Modal, Form, Input, Dropdown, App, Switch, InputNumber } from 'antd'
import type { MenuProps } from 'antd'
import {
  PlusOutlined,
  MoreOutlined,
  WifiOutlined,
  DisconnectOutlined,
  StarOutlined,
  StarFilled,
  VideoCameraOutlined,
  EditOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'

import * as deviceService from '@/utils/api/device'
import { renderTableTime } from '@/utils/time'

interface DeviceWithStatus extends deviceService.Device {
  isConnected?: boolean
}

const DevicesIndex: React.FC = () => {
  const navigate = useNavigate()
  const actionRef = useRef<ActionType>()
  const [loading, setLoading] = useState(false)
  const { message } = App.useApp()

  // 获取设备列表
  const fetchDevices = async (_params: any) => {
    try {
      const response = await deviceService.getDevices()

      // 确保response是数组
      const devices = Array.isArray(response) ? response : []

      // 设备状态将通过后端API获取，这里直接返回设备数据
      const devicesWithStatus = devices.map((device: deviceService.Device) => ({
        ...device,
        isConnected: device.is_connected || false,
      }))

      return {
        data: devicesWithStatus,
        success: true,
        total: devicesWithStatus.length,
      }
    } catch (error: any) {
      console.error('Failed to fetch devices:', error)

      // 处理不同类型的错误
      if (error.name === 'AuthError') {
        message.error('登录已过期，请重新登录')
        // 可以选择跳转到登录页面或显示登录模态框
        setTimeout(() => {
          navigate('/user/login')
        }, 1500)
      } else if (error.name === 'NetworkError') {
        message.error('网络连接失败，请检查网络设置')
      } else {
        message.error(error.message || '获取设备列表失败')
      }

      return {
        data: [],
        success: false,
        total: 0,
      }
    }
  }

  // 跳转到创建页面
  const handleCreateDevice = () => {
    navigate('/admin/devices/create')
  }

  // 跳转到编辑页面
  const handleEditDevice = (device: DeviceWithStatus) => {
    navigate(`/admin/devices/edit/${device.uuid}`)
  }

  // 连接设备
  const handleConnect = async (device: DeviceWithStatus) => {
    try {
      if (!device.websocket_port) {
        message.error('设备未配置WebSocket端口')
        return
      }

      // 创建后端WebSocket服务器
      const response = await fetch(`/api/realtime/devices/${device.uuid}/websocket/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          port: device.websocket_port,
        }),
      })

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.message)
      }

      message.success(`设备 ${device.name} WebSocket服务器已启动，端口: ${device.websocket_port}`)
      actionRef.current?.reload()
    } catch (error: any) {
      message.error(`设备连接失败: ${error.message}`)
    }
  }

  // 断开连接
  const handleDisconnect = async (device: DeviceWithStatus) => {
    try {
      // 断开后端WebSocket代理连接
      await fetch(`/api/realtime/devices/${device.uuid}/websocket/disconnect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      message.success(`设备 ${device.name} 已断开连接`)
      actionRef.current?.reload()
    } catch (error: any) {
      console.error('断开连接错误:', error)
      message.success(`设备 ${device.name} 已断开连接`)
      actionRef.current?.reload()
    }
  }

  // 设置为默认设备
  const handleSetDefault = async (device: DeviceWithStatus) => {
    try {
      await deviceService.setDefaultDevice(device.uuid)
      message.success(`已设置 ${device.name} 为默认设备`)
      actionRef.current?.reload()
    } catch (error: any) {
      message.error(`设置默认设备失败: ${error.message}`)
    }
  }

  // 删除设备
  const handleDelete = async (device: DeviceWithStatus) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除设备 "${device.name}" 吗？`,
      onOk: async () => {
        try {
          await deviceService.deleteDevice(device.uuid)
          message.success('设备删除成功')
          actionRef.current?.reload()
        } catch (error: any) {
          message.error(`设备删除失败: ${error.message}`)
        }
      },
    })
  }

  // 操作菜单
  const getActionMenu = (device: DeviceWithStatus): MenuProps => ({
    items: [
      {
        key: 'connect',
        label: device.isConnected ? '断开连接' : '连接设备',
        icon: device.isConnected ? <DisconnectOutlined /> : <WifiOutlined />,
        onClick: () => (device.isConnected ? handleDisconnect(device) : handleConnect(device)),
      },
      {
        key: 'edit',
        label: '编辑设备',
        icon: <EditOutlined />,
        onClick: () => handleEditDevice(device),
      },
      {
        key: 'default',
        label: device.is_default ? '取消默认' : '设为默认',
        icon: device.is_default ? <StarFilled /> : <StarOutlined />,
        onClick: () => handleSetDefault(device),
        disabled: device.is_default,
      },
      {
        type: 'divider',
      },
      {
        key: 'delete',
        label: '删除设备',
        danger: true,
        onClick: () => handleDelete(device),
      },
    ],
  })

  const columns: ProColumns<DeviceWithStatus>[] = [
    {
      title: '设备名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          <a onClick={() => navigate(`/admin/devices/${record.uuid}`)}>{text}</a>
          {record.is_default && <StarFilled style={{ color: '#faad14' }} />}
        </Space>
      ),
    },
    {
      title: 'WebSocket端口',
      dataIndex: 'websocket_port',
      key: 'websocket_port',
      render: (port: number | undefined) => port || '-',
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '无人机品牌',
      dataIndex: 'drone_brand',
      key: 'drone_brand',
      ellipsis: true,
    },
    {
      title: '无人机型号',
      dataIndex: 'drone_model',
      key: 'drone_model',
      ellipsis: true,
    },
    {
      title: 'MQTT配置',
      key: 'mqtt_config',
      render: (_, record) => {
        if (record.mqtt_enabled && record.mqtt_port) {
          return (
            <Tag color='green' title={`MQTT Broker端口: ${record.mqtt_port}`}>
              已启用 (端口: {record.mqtt_port})
            </Tag>
          )
        }
        return <Tag color='default'>未启用</Tag>
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      valueType: 'dateTime',
      sorter: true,
      render: (_, record) => renderTableTime(record.created_at),
    },
    {
      title: '连接状态',
      dataIndex: 'isConnected',
      key: 'isConnected',
      render: (connected) => (
        <Tag color={connected ? 'green' : 'red'}>{connected ? '已连接' : '未连接'}</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (active) => <Tag color={active ? 'blue' : 'default'}>{active ? '启用' : '禁用'}</Tag>,
    },

    {
      title: '操作',
      valueType: 'option',
      key: 'option',
      width: 140,
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Space size={4}>
            <Button
              type='link'
              size='small'
              onClick={() => navigate(`/admin/devices/${record.uuid}`)}
            >
              查看
            </Button>
            <Button
              type='link'
              size='small'
              icon={<EditOutlined />}
              onClick={() => handleEditDevice(record)}
            >
              编辑
            </Button>
          </Space>
          <Space size={4}>
            <Button
              type='link'
              size='small'
              icon={<VideoCameraOutlined />}
              onClick={() => navigate(`/admin/devices/live/${record.uuid}`)}
            >
              实况
            </Button>
            <Dropdown menu={getActionMenu(record)} trigger={['click']}>
              <Button type='link' size='small' icon={<MoreOutlined />} />
            </Dropdown>
          </Space>
        </Space>
      ),
    },
  ]

  return (
    <PageContainer
      header={{
        title: '设备管理',
      }}
    >
      <ProTable<DeviceWithStatus>
        actionRef={actionRef}
        rowKey='uuid'
        search={false}
        toolBarRender={() => [
          <Button
            type='primary'
            key='primary'
            icon={<PlusOutlined />}
            onClick={handleCreateDevice}
          >
            添加设备
          </Button>,
        ]}
        request={fetchDevices}
        columns={columns}
        pagination={{
          defaultPageSize: 10,
          showSizeChanger: true,
        }}
      />




    </PageContainer>
  )
}

export default DevicesIndex
