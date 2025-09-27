import { useNavigate } from 'react-router-dom'

export const useNavigateWithState = () => {
  const navigate = useNavigate()

  const navigateWithState = (path: string, state?: any) => {
    navigate(path, { state })
  }

  return navigateWithState
}

export default useNavigateWithState
