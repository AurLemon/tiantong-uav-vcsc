import React, { useRef, useState } from 'react'
import { PageContainer, ProTable, ActionType, ProColumns } from '@ant-design/pro-components'
import { Button, Space, Tag, Modal, Form, Input, Select, Dropdown, App } from 'antd'
import type { MenuProps } from 'antd'
import {
  PlusOutlined,
  MoreOutlined,
  EditOutlined,
  DeleteOutlined,
  UserOutlined,
  KeyOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import * as userService from '@/utils/api/user'
import * as roleService from '@/utils/api/role'

interface UserWithRoles {
  id: number
  pid: string
  email: string
  name: string
  created_at: string
  updated_at: string
  roles: Array<{
    id: number
    name: string
    description?: string
  }>
}

const UsersIndex: React.FC = () => {
  const navigate = useNavigate()
  const actionRef = useRef<ActionType>()
  const [createModalVisible, setCreateModalVisible] = useState(false)
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [roleModalVisible, setRoleModalVisible] = useState(false)
  const [createForm] = Form.useForm()
  const [editForm] = Form.useForm()
  const [roleForm] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [editingUser, setEditingUser] = useState<UserWithRoles | null>(null)
  const [roles, setRoles] = useState<any[]>([])
  const { message } = App.useApp()

  // 获取用户列表
  const fetchUsers = async (_params: any) => {
    try {
      const response = await userService.getUsers()
      return {
        data: response || [],
        success: true,
        total: response?.length || 0,
      }
    } catch (error: any) {
      console.error('获取用户列表失败:', error)
      
      if (error?.response?.status === 401) {
        message.error('认证失败，请重新登录')
        setTimeout(() => {
          navigate('/user/login')
        }, 1500)
      } else {
        message.error(error?.message || '获取用户列表失败')
      }

      return {
        data: [],
        success: false,
        total: 0,
      }
    }
  }

  // 获取角色列表
  const fetchRoles = async () => {
    try {
      const response = await roleService.getRoles()
      setRoles(response || [])
    } catch (error) {
      console.error('获取角色列表失败:', error)
    }
  }

  // 创建用户
  const handleCreateUser = async (values: any) => {
    setLoading(true)
    try {
      await userService.createUser(values)
      message.success('用户创建成功')
      setCreateModalVisible(false)
      createForm.resetFields()
      actionRef.current?.reload()
    } catch (error: any) {
      message.error(error?.message || '用户创建失败')
    } finally {
      setLoading(false)
    }
  }

  // 更新用户
  const handleUpdateUser = async (values: any) => {
    if (!editingUser) return
    
    setLoading(true)
    try {
      await userService.updateUser(editingUser.id, values)
      message.success('用户更新成功')
      setEditModalVisible(false)
      editForm.resetFields()
      setEditingUser(null)
      actionRef.current?.reload()
    } catch (error: any) {
      message.error(error?.message || '用户更新失败')
    } finally {
      setLoading(false)
    }
  }

  // 删除用户
  const handleDeleteUser = async (user: UserWithRoles) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除用户 "${user.name}" 吗？`,
      onOk: async () => {
        try {
          await userService.deleteUser(user.id)
          message.success('用户删除成功')
          actionRef.current?.reload()
        } catch (error: any) {
          message.error(error?.message || '用户删除失败')
        }
      },
    })
  }

  // 编辑用户
  const handleEditUser = (user: UserWithRoles) => {
    setEditingUser(user)
    editForm.setFieldsValue({
      email: user.email,
      name: user.name,
    })
    setEditModalVisible(true)
  }

  // 管理用户角色
  const handleManageRoles = (user: UserWithRoles) => {
    setEditingUser(user)
    roleForm.setFieldsValue({
      role_ids: Array.isArray(user.roles) ? user.roles.map(role => role.id) : [],
    })
    setRoleModalVisible(true)
  }

  // 分配角色
  const handleAssignRoles = async (values: any) => {
    if (!editingUser) return
    
    setLoading(true)
    try {
      await userService.assignUserRoles(editingUser.id, values)
      message.success('角色分配成功')
      setRoleModalVisible(false)
      roleForm.resetFields()
      setEditingUser(null)
      actionRef.current?.reload()
    } catch (error: any) {
      message.error(error?.message || '角色分配失败')
    } finally {
      setLoading(false)
    }
  }

  // 操作菜单
  const getActionMenu = (user: UserWithRoles): MenuProps => ({
    items: [
      {
        key: 'edit',
        label: '编辑用户',
        icon: <EditOutlined />,
        onClick: () => handleEditUser(user),
      },
      {
        key: 'roles',
        label: '管理角色',
        icon: <UserOutlined />,
        onClick: () => handleManageRoles(user),
      },
      {
        type: 'divider',
      },
      {
        key: 'delete',
        label: '删除用户',
        icon: <DeleteOutlined />,
        danger: true,
        onClick: () => handleDeleteUser(user),
      },
    ],
  })

  const columns: ProColumns<UserWithRoles>[] = [
    {
      title: '用户名',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      ellipsis: true,
    },
    {
      title: '角色',
      dataIndex: 'roles',
      key: 'roles',
      render: (roles: any[]) => (
        <Space wrap>
          {Array.isArray(roles) ? roles.map(role => (
            <Tag key={role.id} color={role.name === 'admin' ? 'red' : 'blue'}>
              {role.name}
            </Tag>
          )) : null}
        </Space>
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
            onClick={() => handleEditUser(record)}
          >
            编辑
          </Button>
          <Dropdown menu={getActionMenu(record)} trigger={['click']}>
            <Button type='link' size='small' icon={<MoreOutlined />} />
          </Dropdown>
        </Space>
      ),
    },
  ]

  React.useEffect(() => {
    fetchRoles()
  }, [])

  return (
    <PageContainer
      header={{
        title: '用户管理',
      }}
    >
      <ProTable<UserWithRoles>
        actionRef={actionRef}
        rowKey='id'
        search={false}
        toolBarRender={() => [
          <Button
            type='primary'
            key='primary'
            icon={<PlusOutlined />}
            onClick={() => {
              createForm.resetFields()
              setCreateModalVisible(true)
            }}
          >
            添加用户
          </Button>,
        ]}
        request={fetchUsers}
        columns={columns}
        pagination={{
          defaultPageSize: 10,
          showSizeChanger: true,
        }}
      />

      {/* 创建用户模态框 */}
      <Modal
        title='添加用户'
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false)
          createForm.resetFields()
        }}
        footer={null}
      >
        <Form form={createForm} layout='vertical' onFinish={handleCreateUser}>
          <Form.Item
            name='email'
            label='邮箱'
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '请输入有效的邮箱地址' },
            ]}
          >
            <Input placeholder='请输入邮箱' />
          </Form.Item>
          <Form.Item
            name='name'
            label='用户名'
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder='请输入用户名' />
          </Form.Item>
          <Form.Item
            name='password'
            label='密码'
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password placeholder='请输入密码' />
          </Form.Item>
          <Form.Item name='role_ids' label='角色'>
            <Select
              mode='multiple'
              placeholder='请选择角色'
              options={roles.map(role => ({
                label: role.name,
                value: role.id,
              }))}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type='primary' htmlType='submit' loading={loading}>
                创建用户
              </Button>
              <Button onClick={() => setCreateModalVisible(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑用户模态框 */}
      <Modal
        title='编辑用户'
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false)
          editForm.resetFields()
          setEditingUser(null)
        }}
        footer={null}
      >
        <Form form={editForm} layout='vertical' onFinish={handleUpdateUser}>
          <Form.Item
            name='email'
            label='邮箱'
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '请输入有效的邮箱地址' },
            ]}
          >
            <Input placeholder='请输入邮箱' />
          </Form.Item>
          <Form.Item
            name='name'
            label='用户名'
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder='请输入用户名' />
          </Form.Item>
          <Form.Item name='password' label='密码（留空则不修改）'>
            <Input.Password placeholder='请输入新密码' />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type='primary' htmlType='submit' loading={loading}>
                更新用户
              </Button>
              <Button onClick={() => setEditModalVisible(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 角色管理模态框 */}
      <Modal
        title={`管理用户角色 - ${editingUser?.name}`}
        open={roleModalVisible}
        onCancel={() => {
          setRoleModalVisible(false)
          roleForm.resetFields()
          setEditingUser(null)
        }}
        footer={null}
      >
        <Form form={roleForm} layout='vertical' onFinish={handleAssignRoles}>
          <Form.Item name='role_ids' label='角色'>
            <Select
              mode='multiple'
              placeholder='请选择角色'
              options={roles.map(role => ({
                label: role.name,
                value: role.id,
              }))}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type='primary' htmlType='submit' loading={loading}>
                保存角色
              </Button>
              <Button onClick={() => setRoleModalVisible(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  )
}

export default UsersIndex
