import React, { createContext, useContext, useState, ReactNode } from 'react'

export interface InitialState {
  currentUser?: any
  settings?: any
  loading?: boolean
  fetchUserInfo?: () => Promise<any>
}

interface GlobalContextType {
  initialState: InitialState
  setInitialState: (state: InitialState | ((prev: InitialState) => InitialState)) => void
}

const GlobalContext = createContext<GlobalContextType | undefined>(undefined)

export const GlobalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [initialState, setInitialState] = useState<InitialState>({
    loading: true,
  })

  return (
    <GlobalContext.Provider value={{ initialState, setInitialState }}>
      {children}
    </GlobalContext.Provider>
  )
}

export const useModel = (namespace: string): GlobalContextType => {
  const context = useContext(GlobalContext)
  if (!context) {
    throw new Error('useModel must be used within a GlobalProvider')
  }

  if (namespace === '@@initialState') {
    return context
  }

  return context
}

export default GlobalContext
