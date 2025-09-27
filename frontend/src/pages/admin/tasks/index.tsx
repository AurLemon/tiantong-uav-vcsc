import React, { useRef, useState } from 'react'
import { PageContainer, ProTable, ActionType, ProColumns } from '@ant-design/pro-components'
import {
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  message,
  Dropdown,
  Popconfirm,
  App,
} from 'antd'
import type { MenuProps } from 'antd'
import {
  PlusOutlined,
  MoreOutlined,
  PlayCircleOutlined,
  StopOutlined,
  DeleteOutlined,
  EditOutlined,
  ThunderboltOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { uavManager } from '@/utils/uav/manager'
import * as taskService from '@/utils/api/task'
import * as deviceService from '@/utils/api/device'

import { renderTableTime, toUTC } from '@/utils/time'
import TaskStepEditor, { TaskStep } from '@/components/features/tasks/common/TaskStepEditor'

interface TaskWithDevice extends taskService.Task {
  device?: deviceService.Device
}

const TasksIndex: React.FC = () => {
  const navigate = useNavigate()
  const actionRef = useRef<ActionType>()
  const [createModalVisible, setCreateModalVisible] = useState(false)
  const [stepEditorVisible, setStepEditorVisible] = useState(false)
  const [editingTask, setEditingTask] = useState<taskService.Task | null>(null)
  const [createForm] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [devices, setDevices] = useState<deviceService.Device[]>([])
  const [currentSteps, setCurrentSteps] = useState<TaskStep[]>([])
  const { message } = App.useApp()

  // 获取任务列表
  const fetchTasks = async (_params: any) => {
    try {
      const response = await taskService.getTasks()
      const data = response?.data || response || []
      return {
        data: Array.isArray(data) ? data : [],
        success: true,
        total: Array.isArray(data) ? data.length : 0,
      }
    } catch (error: any) {
      console.error('获取任务列表失败:', error)

      if (error?.response?.status === 401) {
        message.error('认证失败，请重新登录')
        setTimeout(() => {
          navigate('/login')
        }, 1500)
      } else if (error?.response?.status >= 500) {
        message.error('服务器错误，请稍后重试')
      } else if (error?.code === 'NETWORK_ERROR') {
        message.error('网络连接失败，请检查网络')
      } else {
        message.error(error?.message || '获取任务列表失败')
      }

      return {
        data: [],
        success: false,
        total: 0,
      }
    }
  }

  // 获取设备列表
  const fetchDevices = async () => {
    try {
      const response = await deviceService.getDevices()
      setDevices(response || [])
    } catch (error) {
      console.error('获取设备列表失败:', error)
    }
  }

  // 创建任务
  const handleCreate = async (values: any) => {
    try {
      setLoading(true)
      const taskData = {
        ...values,
        parameters: currentSteps.length > 0 ? { steps: currentSteps } : undefined,
      }
      await taskService.createTask(taskData)
      message.success('任务创建成功')
      setCreateModalVisible(false)
      createForm.resetFields()
      setCurrentSteps([])
      actionRef.current?.reload()
    } catch (error: any) {
      console.error('创建任务失败:', error)
      message.error(error?.message || '创建任务失败')
    } finally {
      setLoading(false)
    }
  }

  // 创建一键任务
  const handleCreateOneClickTask = async (deviceId: number) => {
    try {
      setLoading(true)
      await taskService.createOneClickTask(deviceId)
      message.success('一键任务创建成功')
      actionRef.current?.reload()
    } catch (error: any) {
      console.error('创建一键任务失败:', error)
      message.error(error?.message || '创建一键任务失败')
    } finally {
      setLoading(false)
    }
  }

  // 执行任务
  const handleExecuteTask = async (task: taskService.Task) => {
    try {
      setLoading(true)

      // 更新任务状态为运行中
      await taskService.updateTask(task.uuid, {
        status: taskService.TaskStatus.RUNNING,
        start_time: toUTC(new Date().toISOString()),
      })

      // 通过WebSocket执行任务
      if (task.parameters?.steps) {
        await uavManager.executeTaskSteps(task.parameters.steps)
      }

      // 更新任务状态为完成
      await taskService.updateTask(task.uuid, {
        status: taskService.TaskStatus.COMPLETED,
        end_time: toUTC(new Date().toISOString()),
      })

      message.success('任务执行完成')
      actionRef.current?.reload()
    } catch (error: any) {
      console.error('执行任务失败:', error)

      // 更新任务状态为失败
      try {
        await taskService.updateTask(task.uuid, {
          status: taskService.TaskStatus.FAILED,
          end_time: toUTC(new Date().toISOString()),
        })
      } catch (updateError) {
        console.error('更新任务状态失败:', updateError)
      }

      message.error(error?.message || '执行任务失败')
      actionRef.current?.reload()
    } finally {
      setLoading(false)
    }
  }

  // 停止任务
  const handleStopTask = async (task: taskService.Task) => {
    try {
      setLoading(true)

      // 停止WebSocket任务执行
      uavManager.stopTask()

      // 更新任务状态为已取消
      await taskService.updateTask(task.uuid, {
        status: taskService.TaskStatus.CANCELLED,
        end_time: toUTC(new Date().toISOString()),
      })

      message.success('任务已停止')
      actionRef.current?.reload()
    } catch (error: any) {
      console.error('停止任务失败:', error)
      message.error(error?.message || '停止任务失败')
    } finally {
      setLoading(false)
    }
  }

  // 删除任务
  const handleDelete = async (taskUuid: string) => {
    try {
      setLoading(true)
      await taskService.deleteTask(taskUuid)
      message.success('任务删除成功')
      actionRef.current?.reload()
    } catch (error: any) {
      console.error('删除任务失败:', error)
      message.error(error?.message || '删除任务失败')
    } finally {
      setLoading(false)
    }
  }

  // 编辑任务
  const handleEditTask = (task: taskService.Task) => {
    setEditingTask(task)
    const steps = task.parameters?.steps || []
    setCurrentSteps(steps)
    setStepEditorVisible(true)
  }

  // 保存任务步骤
  const handleSaveSteps = async (steps: TaskStep[]) => {
    try {
      setLoading(true)
      if (editingTask) {
        // 更新现有任务
        await taskService.updateTask(editingTask.uuid, {
          parameters: { steps },
        })
        message.success('任务步骤更新成功')
        actionRef.current?.reload()
      } else {
        // 新建任务时保存步骤
        setCurrentSteps(steps)
        message.success('任务步骤已设置')
      }
      setStepEditorVisible(false)
      setEditingTask(null)
    } catch (error: any) {
      console.error('保存任务步骤失败:', error)
      message.error(error?.message || '保存任务步骤失败')
    } finally {
      setLoading(false)
    }
  }

  // 打开步骤编辑器（新建任务）
  const handleOpenStepEditor = () => {
    setEditingTask(null)
    setStepEditorVisible(true)
  }

  // 操作菜单
  const getActionMenu = (record: taskService.Task): MenuProps['items'] => [
    {
      key: 'execute',
      icon: <PlayCircleOutlined />,
      label: '执行任务',
      disabled: record.status === taskService.TaskStatus.RUNNING,
    },
    {
      key: 'stop',
      icon: <StopOutlined />,
      label: '停止任务',
      disabled: record.status !== taskService.TaskStatus.RUNNING,
    },
    {
      key: 'edit',
      icon: <EditOutlined />,
      label: '编辑任务',
      disabled: record.status === taskService.TaskStatus.RUNNING,
    },
    {
      key: 'delete',
      icon: <DeleteOutlined />,
      label: '删除任务',
      disabled: record.status === taskService.TaskStatus.RUNNING,
      danger: true,
    },
  ]

  // 处理操作菜单点击
  const handleActionClick = (key: string, record: taskService.Task) => {
    switch (key) {
      case 'execute':
        handleExecuteTask(record)
        break
      case 'stop':
        handleStopTask(record)
        break
      case 'edit':
        handleEditTask(record)
        break
      case 'delete':
        Modal.confirm({
          title: '确认删除',
          content: `确定要删除任务"${record.name}"吗？`,
          onOk: () => handleDelete(record.uuid),
        })
        break
    }
  }

  const columns: ProColumns<TaskWithDevice>[] = [
    {
      title: '任务名称',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
    },
    {
      title: '任务类型',
      dataIndex: 'task_type',
      key: 'task_type',
      render: (taskType: string) => {
        const typeInfo = taskService.TaskTypeMap[taskType as taskService.TaskType]
        return <Tag color={typeInfo?.color}>{typeInfo?.text || taskType}</Tag>
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const statusInfo = taskService.TaskStatusMap[status as taskService.TaskStatus]
        return <Tag color={statusInfo?.color}>{statusInfo?.text || status}</Tag>
      },
    },
    {
      title: '关联设备',
      dataIndex: 'device_name',
      key: 'device_name',
      ellipsis: true,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '任务步骤',
      dataIndex: 'parameters',
      key: 'steps',
      ellipsis: true,
      render: (parameters: any) => {
        const steps = parameters?.steps || []
        if (steps.length === 0) return '无步骤'
        return `共${steps.length}个步骤`
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
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Space>
          <Button
            type='primary'
            size='small'
            icon={<PlayCircleOutlined />}
            onClick={() => handleExecuteTask(record)}
            disabled={record.status === taskService.TaskStatus.RUNNING}
            loading={loading}
          >
            执行
          </Button>
          <Dropdown
            menu={{
              items: getActionMenu(record),
              onClick: ({ key }) => handleActionClick(key, record),
            }}
            trigger={['click']}
          >
            <Button size='small' icon={<MoreOutlined />} />
          </Dropdown>
        </Space>
      ),
    },
  ]

  React.useEffect(() => {
    fetchDevices()
  }, [])

  return (
    <PageContainer
      header={{
        title: '飞行任务',
      }}
    >
      <ProTable<TaskWithDevice>
        actionRef={actionRef}
        rowKey='id'
        request={fetchTasks}
        columns={columns}
        search={false}
        dateFormatter='string'
        toolBarRender={() => [
          <Button
            key='oneclick'
            type='primary'
            icon={<ThunderboltOutlined />}
            onClick={() => {
              if (devices.length === 0) {
                message.warning('请先添加设备')
                return
              }
              // 使用第一个设备创建一键任务
              handleCreateOneClickTask(devices[0].id)
            }}
            loading={loading}
          >
            一键任务
          </Button>,
          <Button
            key='create'
            type='primary'
            icon={<PlusOutlined />}
            onClick={() => {
              if (devices.length === 0) {
                message.warning('请先添加设备')
                return
              }
              setCurrentSteps([])
              setCreateModalVisible(true)
            }}
          >
            新建任务
          </Button>,
        ]}
      />

      <Modal
        title='新建任务'
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false)
          createForm.resetFields()
        }}
        onOk={() => createForm.submit()}
        confirmLoading={loading}
      >
        <Form form={createForm} layout='vertical' onFinish={handleCreate}>
          <Form.Item
            name='name'
            label='任务名称'
            rules={[{ required: true, message: '请输入任务名称' }]}
          >
            <Input placeholder='请输入任务名称' />
          </Form.Item>

          <Form.Item
            name='task_type'
            label='任务类型'
            rules={[{ required: true, message: '请选择任务类型' }]}
          >
            <Select placeholder='请选择任务类型'>
              <Select.Option value={taskService.TaskType.MANUAL}>手动任务</Select.Option>
              <Select.Option value={taskService.TaskType.AUTO}>自动任务</Select.Option>
              <Select.Option value={taskService.TaskType.SCHEDULED}>定时任务</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name='device_id'
            label='关联设备'
            rules={[{ required: true, message: '请选择关联设备' }]}
          >
            <Select placeholder='请选择关联设备'>
              {devices.map((device) => (
                <Select.Option key={device.id} value={device.id}>
                  {device.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name='description' label='任务描述'>
            <Input.TextArea rows={3} placeholder='请输入任务描述' />
          </Form.Item>

          <Form.Item label='任务步骤'>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#666' }}>
                {currentSteps.length > 0 ? `已设置 ${currentSteps.length} 个步骤` : '未设置步骤'}
              </span>
              <Button icon={<SettingOutlined />} onClick={handleOpenStepEditor}>
                编辑步骤
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>

      <TaskStepEditor
        visible={stepEditorVisible}
        onCancel={() => {
          setStepEditorVisible(false)
          setEditingTask(null)
        }}
        onOk={handleSaveSteps}
        initialSteps={currentSteps}
        title={editingTask ? `编辑任务步骤 - ${editingTask.name}` : '设置任务步骤'}
      />
    </PageContainer>
  )
}

export default TasksIndex
