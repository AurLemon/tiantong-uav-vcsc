import Icon, { QuestionCircleOutlined } from '@ant-design/icons'
import { GrGraphQl } from 'react-icons/gr'
import { BsMoon, BsSun } from 'react-icons/bs'
import { useModel } from '@/contexts/global/GlobalContext'
import React from 'react'

export type SiderTheme = 'light' | 'dark'

export const ToggleTheme = () => {
  const { initialState, setInitialState } = useModel('@@initialState')

  return (
    <div>
      {initialState?.settings?.navTheme === 'realDark' ? (
        <Icon
          component={BsSun}
          style={{ fontSize: '18px', display: 'block' }}
          onClick={() => {
            setInitialState((s) => ({ ...s, settings: { ...s?.settings, navTheme: 'light' } }))
            localStorage.setItem('theme', 'light')
          }}
        />
      ) : (
        <Icon
          component={BsMoon}
          style={{ fontSize: '18px', display: 'block' }}
          onClick={() => {
            setInitialState((s) => ({ ...s, settings: { ...s?.settings, navTheme: 'realDark' } }))
            localStorage.setItem('theme', 'realDark')
          }}
        />
      )}
    </div>
  )
}

export const GraphqlPlayground = () => {
  return (
    <Icon
      component={GrGraphQl}
      style={{ fontSize: '18px', display: 'block' }}
      onClick={() => {
        window.open(`/api/graphql`)
      }}
    />
  )
}
