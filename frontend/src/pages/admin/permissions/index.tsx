import React, { useRef, useState } from 'react'
import { PageContainer, ProTable, ActionType, ProColumns } from '@ant-design/pro-components'
import { Button, Space, Tag, Modal, Form, Input, Select, Switch, Dropdown, App, Tabs } from 'antd'
import type { MenuProps } from 'antd'
import {
  PlusOutlined,
  MoreOutlined,
  EditOutlined,
  DeleteOutlined,
  SafetyOutlined,
  KeyOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import * as roleService from '@/utils/api/role'
import * as permissionService from '@/utils/api/permission'

const { TabPane } = Tabs

const PermissionsIndex: React.FC = () => {
  const navigate = useNavigate()
  const roleActionRef = useRef<ActionType>()
  const permissionActionRef = useRef<ActionType>()
  const [createRoleModalVisible, setCreateRoleModalVisible] = useState(false)
  const [editRoleModalVisible, setEditRoleModalVisible] = useState(false)
  const [permissionModalVisible, setPermissionModalVisible] = useState(false)
  const [createPermissionModalVisible, setCreatePermissionModalVisible] = useState(false)
  const [createRoleForm] = Form.useForm()
  const [editRoleForm] = Form.useForm()
  const [permissionForm] = Form.useForm()
  const [createPermissionForm] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [editingRole, setEditingRole] = useState<any>(null)
  const [permissions, setPermissions] = useState<any[]>([])
  const { message } = App.useApp()

  // 获取角色列表
  const fetchRoles = async (_params: any) => {
    try {
      const response = await roleService.getRoles()
      return {
        data: response || [],
        success: true,
        total: response?.length || 0,
      }
    } catch (error: any) {
      console.error('获取角色列表失败:', error)
      
      if (error?.response?.status === 401) {
        message.error('认证失败，请重新登录')
        setTimeout(() => {
          navigate('/user/login')
        }, 1500)
      } else {
        message.error(error?.message || '获取角色列表失败')
      }

      return {
        data: [],
        success: false,
        total: 0,
      }
    }
  }

  // 获取权限列表
  const fetchPermissions = async (_params: any) => {
    try {
      const response = await permissionService.getPermissions()
      setPermissions(response || [])
      return {
        data: response || [],
        success: true,
        total: response?.length || 0,
      }
    } catch (error: any) {
      console.error('获取权限列表失败:', error)
      message.error(error?.message || '获取权限列表失败')
      return {
        data: [],
        success: false,
        total: 0,
      }
    }
  }

  // 创建角色
  const handleCreateRole = async (values: any) => {
    setLoading(true)
    try {
      await roleService.createRole(values)
      message.success('角色创建成功')
      setCreateRoleModalVisible(false)
      createRoleForm.resetFields()
      roleActionRef.current?.reload()
    } catch (error: any) {
      message.error(error?.message || '角色创建失败')
    } finally {
      setLoading(false)
    }
  }

  // 更新角色
  const handleUpdateRole = async (values: any) => {
    if (!editingRole) return
    
    setLoading(true)
    try {
      await roleService.updateRole(editingRole.id, values)
      message.success('角色更新成功')
      setEditRoleModalVisible(false)
      editRoleForm.resetFields()
      setEditingRole(null)
      roleActionRef.current?.reload()
    } catch (error: any) {
      message.error(error?.message || '角色更新失败')
    } finally {
      setLoading(false)
    }
  }

  // 删除角色
  const handleDeleteRole = async (role: any) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除角色 "${role.name}" 吗？`,
      onOk: async () => {
        try {
          await roleService.deleteRole(role.id)
          message.success('角色删除成功')
          roleActionRef.current?.reload()
        } catch (error: any) {
          message.error(error?.message || '角色删除失败')
        }
      },
    })
  }

  // 编辑角色
  const handleEditRole = (role: any) => {
    setEditingRole(role)
    editRoleForm.setFieldsValue({
      name: role.name,
      description: role.description,
      is_active: role.is_active,
    })
    setEditRoleModalVisible(true)
  }

  // 管理角色权限
  const handleManagePermissions = (role: any) => {
    setEditingRole(role)
    permissionForm.setFieldsValue({
      permission_ids: role.permissions.map((p: any) => p.id),
    })
    setPermissionModalVisible(true)
  }

  // 分配权限
  const handleAssignPermissions = async (values: any) => {
    if (!editingRole) return
    
    setLoading(true)
    try {
      await roleService.assignRolePermissions(editingRole.id, values)
      message.success('权限分配成功')
      setPermissionModalVisible(false)
      permissionForm.resetFields()
      setEditingRole(null)
      roleActionRef.current?.reload()
    } catch (error: any) {
      message.error(error?.message || '权限分配失败')
    } finally {
      setLoading(false)
    }
  }

  // 创建权限
  const handleCreatePermission = async (values: any) => {
    setLoading(true)
    try {
      await permissionService.createPermission(values)
      message.success('权限创建成功')
      setCreatePermissionModalVisible(false)
      createPermissionForm.resetFields()
      permissionActionRef.current?.reload()
    } catch (error: any) {
      message.error(error?.message || '权限创建失败')
    } finally {
      setLoading(false)
    }
  }

  // 角色操作菜单
  const getRoleActionMenu = (role: any): MenuProps => ({
    items: [
      {
        key: 'edit',
        label: '编辑角色',
        icon: <EditOutlined />,
        onClick: () => handleEditRole(role),
      },
      {
        key: 'permissions',
        label: '管理权限',
        icon: <SafetyOutlined />,
        onClick: () => handleManagePermissions(role),
      },
      {
        type: 'divider',
      },
      {
        key: 'delete',
        label: '删除角色',
        icon: <DeleteOutlined />,
        danger: true,
        onClick: () => handleDeleteRole(role),
        disabled: role.name === 'admin' || role.name === 'user', // 禁止删除系统角色
      },
    ],
  })

  const roleColumns: ProColumns<any>[] = [
    {
      title: '角色名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          <span>{text}</span>
          {(record.name === 'admin' || record.name === 'user') && (
            <Tag color='orange'>系统角色</Tag>
          )}
        </Space>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '权限数量',
      dataIndex: 'permissions',
      key: 'permissions',
      render: (permissions: any[]) => (
        <Tag color='blue'>{permissions?.length || 0} 个权限</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (active: boolean) => (
        <Tag color={active ? 'green' : 'red'}>{active ? '启用' : '禁用'}</Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      valueType: 'dateTime',
      sorter: true,
    },
    {
      title: '操作',
      valueType: 'option',
      key: 'option',
      render: (_, record) => (
        <Space>
          <Button
            type='link'
            size='small'
            icon={<EditOutlined />}
            onClick={() => handleEditRole(record)}
          >
            编辑
          </Button>
          <Button
            type='link'
            size='small'
            icon={<SafetyOutlined />}
            onClick={() => handleManagePermissions(record)}
          >
            权限
          </Button>
          <Dropdown menu={getRoleActionMenu(record)} trigger={['click']}>
            <Button type='link' size='small' icon={<MoreOutlined />} />
          </Dropdown>
        </Space>
      ),
    },
  ]

  const permissionColumns: ProColumns<any>[] = [
    {
      title: '权限名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '资源',
      dataIndex: 'resource',
      key: 'resource',
      render: (text) => text && <Tag color='blue'>{text}</Tag>,
    },
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      render: (text) => text && <Tag color='green'>{text}</Tag>,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      valueType: 'dateTime',
      sorter: true,
    },
  ]

  React.useEffect(() => {
    fetchPermissions({})
  }, [])

  return (
    <PageContainer
      header={{
        title: '权限管理',
      }}
    >
      <Tabs defaultActiveKey='roles'>
        <TabPane tab='角色管理' key='roles'>
          <ProTable<any>
            actionRef={roleActionRef}
            rowKey='id'
            search={false}
            toolBarRender={() => [
              <Button
                type='primary'
                key='primary'
                icon={<PlusOutlined />}
                onClick={() => {
                  createRoleForm.resetFields()
                  setCreateRoleModalVisible(true)
                }}
              >
                添加角色
              </Button>,
            ]}
            request={fetchRoles}
            columns={roleColumns}
            pagination={{
              defaultPageSize: 10,
              showSizeChanger: true,
            }}
          />
        </TabPane>
        
        <TabPane tab='权限管理' key='permissions'>
          <ProTable<any>
            actionRef={permissionActionRef}
            rowKey='id'
            search={false}
            toolBarRender={() => [
              <Button
                type='primary'
                key='primary'
                icon={<PlusOutlined />}
                onClick={() => {
                  createPermissionForm.resetFields()
                  setCreatePermissionModalVisible(true)
                }}
              >
                添加权限
              </Button>,
            ]}
            request={fetchPermissions}
            columns={permissionColumns}
            pagination={{
              defaultPageSize: 10,
              showSizeChanger: true,
            }}
          />
        </TabPane>
      </Tabs>

      {/* 创建角色模态框 */}
      <Modal
        title='添加角色'
        open={createRoleModalVisible}
        onCancel={() => {
          setCreateRoleModalVisible(false)
          createRoleForm.resetFields()
        }}
        footer={null}
      >
        <Form form={createRoleForm} layout='vertical' onFinish={handleCreateRole}>
          <Form.Item
            name='name'
            label='角色名称'
            rules={[{ required: true, message: '请输入角色名称' }]}
          >
            <Input placeholder='请输入角色名称' />
          </Form.Item>
          <Form.Item name='description' label='角色描述'>
            <Input.TextArea placeholder='请输入角色描述' rows={3} />
          </Form.Item>
          <Form.Item name='is_active' label='启用状态' valuePropName='checked' initialValue={true}>
            <Switch />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type='primary' htmlType='submit' loading={loading}>
                创建角色
              </Button>
              <Button onClick={() => setCreateRoleModalVisible(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑角色模态框 */}
      <Modal
        title='编辑角色'
        open={editRoleModalVisible}
        onCancel={() => {
          setEditRoleModalVisible(false)
          editRoleForm.resetFields()
          setEditingRole(null)
        }}
        footer={null}
      >
        <Form form={editRoleForm} layout='vertical' onFinish={handleUpdateRole}>
          <Form.Item
            name='name'
            label='角色名称'
            rules={[{ required: true, message: '请输入角色名称' }]}
          >
            <Input placeholder='请输入角色名称' disabled={editingRole?.name === 'admin' || editingRole?.name === 'user'} />
          </Form.Item>
          <Form.Item name='description' label='角色描述'>
            <Input.TextArea placeholder='请输入角色描述' rows={3} />
          </Form.Item>
          <Form.Item name='is_active' label='启用状态' valuePropName='checked'>
            <Switch disabled={editingRole?.name === 'admin'} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type='primary' htmlType='submit' loading={loading}>
                更新角色
              </Button>
              <Button onClick={() => setEditRoleModalVisible(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 权限分配模态框 */}
      <Modal
        title={`管理角色权限 - ${editingRole?.name}`}
        open={permissionModalVisible}
        onCancel={() => {
          setPermissionModalVisible(false)
          permissionForm.resetFields()
          setEditingRole(null)
        }}
        footer={null}
        width={600}
      >
        <Form form={permissionForm} layout='vertical' onFinish={handleAssignPermissions}>
          <Form.Item name='permission_ids' label='权限'>
            <Select
              mode='multiple'
              placeholder='请选择权限'
              style={{ width: '100%' }}
              options={permissions.map(permission => ({
                label: `${permission.name} (${permission.description || '无描述'})`,
                value: permission.id,
              }))}
              optionFilterProp='label'
              showSearch
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type='primary' htmlType='submit' loading={loading}>
                保存权限
              </Button>
              <Button onClick={() => setPermissionModalVisible(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 创建权限模态框 */}
      <Modal
        title='添加权限'
        open={createPermissionModalVisible}
        onCancel={() => {
          setCreatePermissionModalVisible(false)
          createPermissionForm.resetFields()
        }}
        footer={null}
      >
        <Form form={createPermissionForm} layout='vertical' onFinish={handleCreatePermission}>
          <Form.Item
            name='name'
            label='权限名称'
            rules={[{ required: true, message: '请输入权限名称' }]}
          >
            <Input placeholder='例如: users.read' />
          </Form.Item>
          <Form.Item name='description' label='权限描述'>
            <Input placeholder='请输入权限描述' />
          </Form.Item>
          <Form.Item name='resource' label='资源'>
            <Input placeholder='例如: users' />
          </Form.Item>
          <Form.Item name='action' label='操作'>
            <Select placeholder='请选择操作'>
              <Select.Option value='read'>读取</Select.Option>
              <Select.Option value='write'>写入</Select.Option>
              <Select.Option value='delete'>删除</Select.Option>
              <Select.Option value='execute'>执行</Select.Option>
              <Select.Option value='control'>控制</Select.Option>
              <Select.Option value='assign'>分配</Select.Option>
              <Select.Option value='admin'>管理</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type='primary' htmlType='submit' loading={loading}>
                创建权限
              </Button>
              <Button onClick={() => setCreatePermissionModalVisible(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  )
}

export default PermissionsIndex
