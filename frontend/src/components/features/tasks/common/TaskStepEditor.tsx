import React, { useState, useEffect } from 'react'
import { Modal, Form, Table, Button, Select, InputNumber, Space, Popconfirm, message } from 'antd'
import { PlusOutlined, DeleteOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons'

export interface TaskStep {
  id: string
  step_type: string
  parameters: any
  timeout?: number
  description?: string
}

interface TaskStepEditorProps {
  visible: boolean
  onCancel: () => void
  onOk: (steps: TaskStep[]) => void
  initialSteps?: TaskStep[]
  title?: string
}

// 步骤类型定义
type StepTypeConfig = 
  | { label: string; hasValue: false }
  | { label: string; hasValue: true; unit: string; paramKey: string }

const STEP_TYPES: Record<string, StepTypeConfig> = {
  takeoff: { label: '起飞', hasValue: false },
  landing: { label: '降落', hasValue: false },
  move_forward: { label: '前进', hasValue: true, unit: '米', paramKey: 'distance' },
  move_backward: { label: '后退', hasValue: true, unit: '米', paramKey: 'distance' },
  move_left: { label: '左移', hasValue: true, unit: '米', paramKey: 'distance' },
  move_right: { label: '右移', hasValue: true, unit: '米', paramKey: 'distance' },
  move_up: { label: '上升', hasValue: true, unit: '米', paramKey: 'distance' },
  move_down: { label: '下降', hasValue: true, unit: '米', paramKey: 'distance' },
  move_to_height: { label: '飞到指定高度', hasValue: true, unit: '米', paramKey: 'height' },
  move_to_heading: { label: '转向', hasValue: true, unit: '度', paramKey: 'heading' },
  wait: { label: '等待', hasValue: true, unit: '秒', paramKey: 'duration' },
  photo: { label: '拍照', hasValue: false },
  hover: { label: '悬停', hasValue: true, unit: '秒', paramKey: 'duration' },
}

const TaskStepEditor: React.FC<TaskStepEditorProps> = ({
  visible,
  onCancel,
  onOk,
  initialSteps = [],
  title = '编辑任务步骤',
}) => {
  const [steps, setSteps] = useState<TaskStep[]>([])
  const [form] = Form.useForm()

  useEffect(() => {
    if (visible) {
      setSteps(initialSteps.length > 0 ? [...initialSteps] : [])
    }
  }, [visible, initialSteps])

  // 添加新步骤
  const addStep = () => {
    const newStep: TaskStep = {
      id: Date.now().toString(),
      step_type: 'takeoff',
      parameters: {},
      timeout: 30,
    }
    setSteps([...steps, newStep])
  }

  // 删除步骤
  const deleteStep = (id: string) => {
    setSteps(steps.filter((step) => step.id !== id))
  }

  // 移动步骤
  const moveStep = (index: number, direction: 'up' | 'down') => {
    const newSteps = [...steps]
    const targetIndex = direction === 'up' ? index - 1 : index + 1

    if (targetIndex >= 0 && targetIndex < newSteps.length) {
      ;[newSteps[index], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[index]]
      setSteps(newSteps)
    }
  }

  // 更新步骤
  const updateStep = (id: string, field: string, value: any) => {
    setSteps(
      steps.map((step) => {
        if (step.id === id) {
          if (field === 'step_type') {
            // 当步骤类型改变时，重置参数
            const stepType = STEP_TYPES[value as keyof typeof STEP_TYPES]
            return {
              ...step,
              step_type: value,
              parameters: stepType?.hasValue ? { [(stepType as any).paramKey]: 0 } : {},
            }
          } else if (field.startsWith('parameters.')) {
            const paramKey = field.split('.')[1]
            return {
              ...step,
              parameters: {
                ...step.parameters,
                [paramKey]: value,
              },
            }
          } else {
            return {
              ...step,
              [field]: value,
            }
          }
        }
        return step
      })
    )
  }

  // 获取步骤描述
  const getStepDescription = (step: TaskStep) => {
    const stepType = STEP_TYPES[step.step_type as keyof typeof STEP_TYPES]
    if (!stepType) return step.step_type

    if (stepType.hasValue) {
      const value = step.parameters[(stepType as any).paramKey] || 0
      return `${stepType.label} ${value}${(stepType as any).unit}`
    }
    return stepType.label
  }

  const handleOk = () => {
    if (steps.length === 0) {
      message.warning('请至少添加一个步骤')
      return
    }
    onOk(steps)
  }

  const columns = [
    {
      title: '序号',
      dataIndex: 'index',
      key: 'index',
      width: 60,
      render: (_: any, __: any, index: number) => index + 1,
    },
    {
      title: '操作类型',
      dataIndex: 'step_type',
      key: 'step_type',
      width: 150,
      render: (value: string, record: TaskStep) => (
        <Select
          value={value}
          style={{ width: '100%' }}
          onChange={(newValue) => updateStep(record.id, 'step_type', newValue)}
        >
          {Object.entries(STEP_TYPES).map(([key, config]) => (
            <Select.Option key={key} value={key}>
              {config.label}
            </Select.Option>
          ))}
        </Select>
      ),
    },
    {
      title: '数值',
      dataIndex: 'parameters',
      key: 'parameters',
      width: 120,
      render: (parameters: any, record: TaskStep) => {
        const stepType = STEP_TYPES[record.step_type as keyof typeof STEP_TYPES]
        if (!stepType?.hasValue) return '-'

        const value = parameters[(stepType as any).paramKey] || 0
        return (
          <InputNumber
            value={value}
            min={0}
            max={(stepType as any).paramKey === 'heading' ? 360 : undefined}
            step={(stepType as any).paramKey === 'heading' ? 1 : 0.1}
            style={{ width: '100%' }}
            onChange={(newValue) =>
              updateStep(record.id, `parameters.${(stepType as any).paramKey}`, newValue || 0)
            }
            addonAfter={(stepType as any).unit}
          />
        )
      },
    },
    {
      title: '超时时间(秒)',
      dataIndex: 'timeout',
      key: 'timeout',
      width: 120,
      render: (value: number, record: TaskStep) => (
        <InputNumber
          value={value || 30}
          min={1}
          max={300}
          style={{ width: '100%' }}
          onChange={(newValue) => updateStep(record.id, 'timeout', newValue || 30)}
        />
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_: any, record: TaskStep, index: number) => (
        <Space>
          <Button
            size='small'
            icon={<ArrowUpOutlined />}
            disabled={index === 0}
            onClick={() => moveStep(index, 'up')}
          />
          <Button
            size='small'
            icon={<ArrowDownOutlined />}
            disabled={index === steps.length - 1}
            onClick={() => moveStep(index, 'down')}
          />
          <Popconfirm
            title='确定删除这个步骤吗？'
            onConfirm={() => deleteStep(record.id)}
            okText='确定'
            cancelText='取消'
          >
            <Button size='small' danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <Modal
      title={title}
      open={visible}
      onCancel={onCancel}
      onOk={handleOk}
      width={800}
      okText='确定'
      cancelText='取消'
      zIndex={1001}
    >
      <div style={{ marginBottom: 16 }}>
        <Button type='primary' icon={<PlusOutlined />} onClick={addStep}>
          添加步骤
        </Button>
        <span style={{ marginLeft: 16, color: '#666' }}>共 {steps.length} 个步骤</span>
      </div>

      <Table
        columns={columns}
        dataSource={steps}
        rowKey='id'
        pagination={false}
        size='small'
        scroll={{ y: 400 }}
        locale={{ emptyText: '暂无步骤，请点击"添加步骤"开始编辑' }}
      />

      {steps.length > 0 && (
        <div style={{ marginTop: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
          <div style={{ fontWeight: 'bold', marginBottom: 8 }}>任务预览：</div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            {steps.map((step, index) => (
              <span key={step.id}>
                {index + 1}. {getStepDescription(step)}
                {index < steps.length - 1 ? ' → ' : ''}
              </span>
            ))}
          </div>
        </div>
      )}
    </Modal>
  )
}

export default TaskStepEditor
