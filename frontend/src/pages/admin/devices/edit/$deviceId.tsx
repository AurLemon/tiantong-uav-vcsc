import React, { useEffect, useState } from 'react'
import { PageContainer } from '@ant-design/pro-components'
import { Card, Form, Input, Button, Space, message, Switch, InputNumber } from 'antd'
import { useParams, useNavigate } from 'react-router-dom'
import { SaveOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import * as deviceService from '@/utils/api/device'

type Device = deviceService.Device

const DeviceEdit: React.FC = () => {
  const { deviceId } = useParams<{ deviceId: string }>()
  const navigate = useNavigate()
  const [device, setDevice] = useState<Device | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  // 获取设备信息
  const fetchDevice = async () => {
    if (!deviceId) return

    try {
      const response = await deviceService.getDevice(deviceId)
      setDevice(response)
      
      // 设置表单初始值
      form.setFieldsValue({
        name: response.name,
        websocket_port: response.websocket_port,
        rtmp_url: response.rtmp_url,
        http_api_url: response.http_api_url,
        description: response.description,
        drone_model: response.drone_model,
        drone_brand: response.drone_brand,
        is_default: response.is_default,
        is_active: response.is_active,
        mqtt_port: response.mqtt_port,
        mqtt_enabled: response.mqtt_enabled,
      })
    } catch (error: any) {
      message.error(`获取设备信息失败: ${error.message}`)
      navigate('/admin/devices')
    } finally {
      setLoading(false)
    }
  }

  // 保存设备信息
  const handleSave = async (values: deviceService.UpdateDeviceParams) => {
    if (!device) return

    setSaving(true)
    try {
      await deviceService.updateDevice(device.uuid, values)
      message.success('设备信息更新成功')
      navigate(`/admin/devices/${device.uuid}`)
    } catch (error: any) {
      message.error(`设备更新失败: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    fetchDevice()
  }, [deviceId])

  if (loading) {
    return <PageContainer loading />
  }

  if (!device) {
    return <PageContainer>设备不存在</PageContainer>
  }

  return (
    <PageContainer
      header={{
        title: `编辑设备 - ${device.name}`,
        breadcrumb: {
          items: [
            {
              title: '设备管理',
              onClick: () => navigate('/admin/devices'),
            },
            {
              title: device.name,
              onClick: () => navigate(`/admin/devices/${device.uuid}`),
            },
            {
              title: '编辑设备',
            },
          ],
        },
        extra: [
          <Button
            key='back'
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(`/admin/devices/${device.uuid}`)}
          >
            返回
          </Button>,
        ],
      }}
    >
      <Card title='设备信息'>
        <Form
          form={form}
          layout='vertical'
          onFinish={handleSave}
          style={{ maxWidth: 800 }}
        >
          <Form.Item
            name='name'
            label='设备名称'
            rules={[{ required: true, message: '请输入设备名称' }]}
          >
            <Input placeholder='请输入设备名称' />
          </Form.Item>

          <Form.Item
            name='websocket_port'
            label='WebSocket端口'
            rules={[
              { required: true, message: '请输入WebSocket端口' },
              { type: 'number', min: 1, max: 65535, message: '端口号必须在1-65535之间' },
            ]}
          >
            <InputNumber
              placeholder='8080'
              style={{ width: '100%' }}
              min={1}
              max={65535}
            />
          </Form.Item>

          <Form.Item
            name='easynvr_url'
            label='EasyNVR视频流地址'
            rules={[
              { type: 'url', message: '请输入有效的EasyNVR视频流地址' },
            ]}
          >
            <Input placeholder='http://localhost:10800/api/v1/stream/live/hls/channel1' />
          </Form.Item>

          <Form.Item
            name='http_api_url'
            label='HTTP API地址'
            rules={[
              { type: 'url', message: '请输入有效的HTTP API地址' },
            ]}
          >
            <Input placeholder='http://localhost:8080/api' />
          </Form.Item>

          <Form.Item name='description' label='设备描述'>
            <Input.TextArea placeholder='请输入设备描述' rows={3} />
          </Form.Item>

          <Form.Item name='drone_brand' label='无人机品牌'>
            <Input placeholder='请输入无人机品牌' />
          </Form.Item>

          <Form.Item name='drone_model' label='无人机型号'>
            <Input placeholder='请输入无人机型号' />
          </Form.Item>

          <Form.Item name='is_default' valuePropName='checked' label='设为默认设备'>
            <Switch />
          </Form.Item>

          <Form.Item name='is_active' valuePropName='checked' label='启用设备'>
            <Switch />
          </Form.Item>

          {/* MQTT配置 */}
          <div style={{ marginTop: 24, marginBottom: 16, borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
            <h4 style={{ marginBottom: 16 }}>MQTT Broker服务器配置</h4>
            <p style={{ color: '#666', marginBottom: 16, fontSize: '14px' }}>
              启用后，系统将为此设备启动一个MQTT Broker服务器，温湿度传感器等设备可以连接到此服务器发送数据
            </p>
            
            <Form.Item name='mqtt_enabled' valuePropName='checked' label='启用MQTT Broker'>
              <Switch />
            </Form.Item>
            
            <Form.Item 
              name='mqtt_port' 
              label='MQTT Broker端口'
              rules={[
                { type: 'number', min: 1, max: 65535, message: '端口号必须在1-65535之间' }
              ]}
            >
              <InputNumber 
                placeholder='1883' 
                style={{ width: '100%' }}
                min={1}
                max={65535}
              />
            </Form.Item>
          </div>

          <Form.Item>
            <Space>
              <Button 
                type='primary' 
                htmlType='submit' 
                loading={saving}
                icon={<SaveOutlined />}
              >
                保存设备
              </Button>
              <Button onClick={() => navigate(`/admin/devices/${device.uuid}`)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </PageContainer>
  )
}

export default DeviceEdit
