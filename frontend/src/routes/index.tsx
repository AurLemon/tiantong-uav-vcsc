import React from 'react'
import { Navigate } from 'react-router-dom'
import {
  DashboardOutlined,
  DatabaseOutlined,
  UserOutlined,
  SafetyOutlined,
  TableOutlined,
  RadarChartOutlined,
  RocketOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'

// 导入页面组件
import Login from '@/pages/user/login'
import Dashboard from '@/pages/admin/dashboard'
import DevicesIndex from '@/pages/admin/devices/index'
import DeviceDetail from '@/pages/admin/devices/$deviceId'
import DeviceEdit from '@/pages/admin/devices/edit/$deviceId'
import DeviceLive from '@/pages/admin/devices/live/$deviceId'
import TasksIndex from '@/pages/admin/tasks/index'
import UsersIndex from '@/pages/admin/users/index'
import PermissionsIndex from '@/pages/admin/permissions/index'
import CollectionData from '@/pages/admin/collection-data'
import PredictionData from '@/pages/admin/prediction-data'
import WarningCases from '@/pages/admin/warning-cases'
import WarningCaseDetail from '@/pages/admin/warning-cases/$id'
import IntelligentPrediction from '@/pages/admin/intelligent-prediction'
import NotFound from '@/pages/common/404'

// 菜单配置（用于侧边栏渲染）
export const menuItems = [
  {
    key: 'dashboard',
    path: '/admin/dashboard',
    name: '仪表盘',
    icon: <DashboardOutlined />,
  },
  {
    key: 'devices',
    path: '/admin/devices',
    name: '设备管理',
    icon: <RadarChartOutlined />,
  },
  {
    key: 'tasks',
    path: '/admin/tasks',
    name: '飞行任务',
    icon: <RocketOutlined />,
  },
  {
    key: 'intelligent-prediction',
    path: '/admin/intelligent-prediction',
    name: '智能预测',
    icon: <ThunderboltOutlined />,
  },
  {
    key: 'collection-data',
    path: '/admin/collection-data',
    name: '采集数据',
    icon: <DatabaseOutlined />,
  },
  {
    key: 'prediction-data',
    path: '/admin/prediction-data',
    name: '预报数据',
    icon: <TableOutlined />,
  },
  {
    key: 'warning-cases',
    path: '/admin/warning-cases',
    name: '风险个例',
    icon: <SafetyOutlined />,
  },
  {
    key: 'users',
    path: '/admin/users',
    name: '用户管理',
    icon: <UserOutlined />,
  },
  {
    key: 'permissions',
    path: '/admin/permissions',
    name: '权限管理',
    icon: <SafetyOutlined />,
  },
]

// 路由配置（用于React Router）
export const routes = [
  {
    path: '/user/login',
    element: <Login />,
  },
  {
    path: '/admin/dashboard',
    element: <Dashboard />,
  },
  {
    path: '/admin/devices',
    element: <DevicesIndex />,
  },
  {
    path: '/admin/devices/edit/:deviceId',
    element: <DeviceEdit />,
  },
  {
    path: '/admin/devices/live/:deviceId',
    element: <DeviceLive />,
  },
  {
    path: '/admin/devices/:deviceId',
    element: <DeviceDetail />,
  },
  {
    path: '/admin/tasks',
    element: <TasksIndex />,
  },
  {
    path: '/admin/intelligent-prediction',
    element: <IntelligentPrediction />,
  },
  {
    path: '/admin/collection-data',
    element: <CollectionData />,
  },
  {
    path: '/admin/prediction-data',
    element: <PredictionData />,
  },
  {
    path: '/admin/warning-cases',
    element: <WarningCases />,
  },
  {
    path: '/admin/warning-cases/:id',
    element: <WarningCaseDetail />,
  },
  {
    path: '/admin/users',
    element: <UsersIndex />,
  },
  {
    path: '/admin/permissions',
    element: <PermissionsIndex />,
  },
  {
    path: '/',
    element: <Navigate to='/admin/dashboard' replace />,
  },
  {
    path: '*',
    element: <NotFound />,
  },
]

export default routes
