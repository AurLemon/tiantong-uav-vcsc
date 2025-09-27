import { outLogin } from '@/utils/api/api'
import { LogoutOutlined, SettingOutlined, UserOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useModel } from '@/contexts/global/GlobalContext'
import { Spin } from 'antd'
import { createStyles } from 'antd-style'
import { stringify } from 'querystring'
import type { MenuInfo } from 'rc-menu/lib/interface'
import React, { useCallback } from 'react'
import { flushSync } from 'react-dom'
import HeaderDropdown from '../HeaderDropdown'

export type GlobalHeaderRightProps = {
  menu?: boolean
  children?: React.ReactNode
}

export const AvatarName = () => {
  const { initialState } = useModel('@@initialState')
  const { currentUser } = initialState || {}
  return <span style={{ marginLeft: 0 }}>{currentUser?.name}</span>
}

const useStyles = createStyles(({ token }) => {
  return {
    action: {
      display: 'flex',
      height: '48px',
      marginLeft: 'auto',
      overflow: 'hidden',
      alignItems: 'center',
      padding: '0 8px',
      cursor: 'pointer',
      borderRadius: token.borderRadius,
      '&:hover': {
        backgroundColor: token.colorBgTextHover,
      },
    },
  }
})

export const AvatarDropdown: React.FC<GlobalHeaderRightProps> = ({ menu, children }) => {
  const navigate = useNavigate()

  /**
   * 退出登录，并且将当前的 url 保存
   */
  const loginOut = async () => {
    // await outLogin();
    localStorage.clear()
    if (window.location.pathname !== '/user/login') {
      navigate('/user/login', { replace: true })
    }
  }
  const { styles } = useStyles()

  const { initialState, setInitialState } = useModel('@@initialState')

  const onMenuClick = useCallback(
    (event: MenuInfo) => {
      const { key } = event
      if (key === 'logout') {
        flushSync(() => {
          setInitialState((s) => ({ ...s, currentUser: undefined }))
        })
        loginOut()
        return
      }
      navigate(`/account/${key}`)
    },
    [setInitialState, navigate]
  )

  const loading = (
    <span className={styles.action}>
      <Spin
        size='small'
        style={{
          marginLeft: 8,
          marginRight: 8,
        }}
      />
    </span>
  )

  if (!initialState) {
    return loading
  }

  const { currentUser } = initialState

  if (!currentUser || !currentUser.name) {
    return loading
  }

  const menuItems = [
    ...(menu
      ? [
          {
            key: 'center',
            icon: <UserOutlined />,
            label: '个人中心',
          },
          {
            key: 'settings',
            icon: <SettingOutlined />,
            label: '个人设置',
          },
          {
            type: 'divider' as const,
          },
        ]
      : []),
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
    },
  ]

  return (
    <HeaderDropdown
      menu={{
        selectedKeys: [],
        onClick: onMenuClick,
        items: menuItems,
      }}
    >
      {children}
    </HeaderDropdown>
  )
}
