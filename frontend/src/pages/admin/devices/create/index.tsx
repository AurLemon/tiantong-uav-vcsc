import React, { useState } from 'react'
import { PageContainer } from '@ant-design/pro-components'
import { Card, Form, Input, Button, Space, message, Switch, InputNumber } from 'antd'
import { useNavigate } from 'react-router-dom'
import { SaveOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import * as deviceService from '@/utils/api/device'

const DeviceCreate: React.FC = () => {
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  // 创建设备
  const handleCreate = async (values: deviceService.CreateDeviceParams) => {
    setSaving(true)
    try {
      const response = await deviceService.createDevice(values)
      message.success('设备创建成功')
      navigate(`/admin/devices/${response.uuid}`)
    } catch (error: any) {
      message.error(`设备创建失败: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageContainer
      header={{
        title: '创建设备',
        breadcrumb: {
          items: [
            {
              title: '设备管理',
              onClick: () => navigate('/admin/devices'),
            },
            {
              title: '创建设备',
            },
          ],
        },
        extra: [
          <Button
            key='back'
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/admin/devices')}
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
          onFinish={handleCreate}
          style={{ maxWidth: 800 }}
          initialValues={{
            mqtt_enabled: false,
            mqtt_port: 1883,
            websocket_port: 8080,
          }}
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
                创建设备
              </Button>
              <Button onClick={() => navigate('/admin/devices')}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </PageContainer>
  )
}

export default DeviceCreate
