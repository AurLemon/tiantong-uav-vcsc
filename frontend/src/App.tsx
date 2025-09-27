import React, { useEffect } from 'react'
import { HelmetProvider } from 'react-helmet-async'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import lodash from 'lodash'
import logoSvg from '@/assets/resources/header_logo.svg'
import { App as AntdApp, ConfigProvider } from 'antd'
import { ProLayout, type Settings as LayoutSettings } from '@ant-design/pro-components'

import {
  Footer,
  AvatarDropdown,
  AvatarName,
  ToggleTheme,
  GraphqlPlayground,
  DeviceStatus,
} from '@/components'
import Login from '@/pages/user/login'
import Dashboard from '@/pages/admin/dashboard'
import DevicesIndex from '@/pages/admin/devices/index'
import DeviceDetail from '@/pages/admin/devices/$deviceId'
import DeviceCreate from '@/pages/admin/devices/create/index'
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

import { menuItems } from '@/routes'
import { currentUser as queryCurrentUser, fetchDynConfig } from '@/utils/api/api'
import defaultSettings from '../config/settings'
import { useModel } from '@/contexts/global/GlobalContext'

const isDev = process.env.NODE_ENV === 'development'
const loginPath = '/user/login'

const App: React.FC = () => {
  const { initialState, setInitialState } = useModel('@@initialState')
  const location = useLocation()
  const navigate = useNavigate()

  const fetchUserInfo = async () => {
    try {
      const msg = await queryCurrentUser({
        skipErrorHandler: true,
      })
      return msg.data || msg
    } catch (error) {
      navigate(loginPath)
    }
    return undefined
  }

  useEffect(() => {
    const initApp = async () => {
      try {
        const navTheme = localStorage.getItem('theme') ?? 'light'

        if (location.pathname !== loginPath) {
          const currentUser = await fetchUserInfo()
          setInitialState({
            fetchUserInfo,
            currentUser,
            settings: lodash.merge(defaultSettings as Partial<LayoutSettings>, null, {
              navTheme,
            }),
            loading: false,
          })
        } else {
          setInitialState({
            fetchUserInfo,
            settings: lodash.merge(defaultSettings as Partial<LayoutSettings>, null, {
              navTheme,
            }),
            loading: false,
          })
        }
      } catch (error) {
        console.error('Failed to initialize app:', error)
        const navTheme = localStorage.getItem('theme') ?? 'light'
        setInitialState({
          fetchUserInfo,
          settings: lodash.merge(defaultSettings as Partial<LayoutSettings>, { navTheme }),
          loading: false,
        })
      }
    }

    initApp()
  }, [location.pathname])

  useEffect(() => {
    if (
      !initialState.loading &&
      !initialState?.currentUser &&
      !location.pathname.startsWith('/user')
    ) {
      navigate(loginPath)
    }
  }, [initialState.currentUser, initialState.loading, location.pathname, navigate])

  if (initialState.loading) {
    return <div>Loading...</div>
  }

  if (location.pathname.startsWith('/user')) {
    return (
      <HelmetProvider>
        <Routes>
          <Route path='/user/login' element={<Login />} />
        </Routes>
      </HelmetProvider>
    )
  }

  const menuData = menuItems

  const processedMenuData = menuData

  return (
    <ConfigProvider>
      <AntdApp>
        <HelmetProvider>
          <ProLayout
            {...initialState?.settings}
            logo={logoSvg}
            location={location}
            route={{
              routes: processedMenuData,
            }}
            menuItemRender={(item, dom, { collapsed }) => {
              if (collapsed) {
                return (
                  <div
                    onClick={() => {
                      if (item.path) {
                        navigate(item.path)
                      }
                    }}
                    style={{ cursor: 'pointer', display: 'flex', justifyContent: 'center' }}
                  >
                    {item.icon}
                  </div>
                )
              }
              
              return (
                <div
                  onClick={() => {
                    if (item.path) {
                      navigate(item.path)
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center' }}>
                    {item.icon && (
                      <span style={{ marginRight: 8 }}>{item.icon}</span>
                    )}
                    {item.name}
                  </span>
                </div>
              )
            }}
            actionsRender={() => [
              <DeviceStatus key='DeviceStatus' />,
              <GraphqlPlayground key='GraphqlPlayground' />,
              <ToggleTheme key='ToggleTheme' />,
            ]}
            avatarProps={{
              title: <AvatarName />,
              render: (_, avatarChildren) => {
                return <AvatarDropdown>{avatarChildren}</AvatarDropdown>
              },
            }}
            footerRender={() => <Footer />}
            links={isDev ? [] : []}
            title='无人机智能气象预警系统'
            onMenuHeaderClick={() => navigate('/admin/dashboard')}
          >
            <Routes>
              <Route
                path='/'
                element={
                  initialState?.currentUser ? (
                    <Navigate to='/admin/dashboard' replace />
                  ) : (
                    <Navigate to='/user/login' replace />
                  )
                }
              />
              <Route path='/admin/dashboard' element={<Dashboard />} />
              <Route path='/admin/devices' element={<DevicesIndex />} />
              <Route path='/admin/devices/create' element={<DeviceCreate />} />
              <Route path='/admin/devices/edit/:deviceId' element={<DeviceEdit />} />
              <Route path='/admin/devices/live/:deviceId' element={<DeviceLive />} />
              <Route path='/admin/devices/:deviceId' element={<DeviceDetail />} />
              <Route path='/admin/tasks' element={<TasksIndex />} />
              <Route path='/admin/intelligent-prediction' element={<IntelligentPrediction />} />
              <Route path='/admin/collection-data' element={<CollectionData />} />
              <Route path='/admin/prediction-data' element={<PredictionData />} />
              <Route path='/admin/warning-cases' element={<WarningCases />} />
              <Route path='/admin/warning-cases/:id' element={<WarningCaseDetail />} />
              <Route path='/admin/users' element={<UsersIndex />} />
              <Route path='/admin/permissions' element={<PermissionsIndex />} />
              <Route path='*' element={<NotFound />} />
            </Routes>
          </ProLayout>
        </HelmetProvider>
      </AntdApp>
    </ConfigProvider>
  )
}

export default App
