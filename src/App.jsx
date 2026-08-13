import { useRoomStore } from './store/roomStore'
import Onboarding from './components/Onboarding'
import Workspace from './components/Workspace'
import './App.css'

export default function App() {
  const onboarded = useRoomStore((s) => s.onboarded)
  return onboarded ? <Workspace /> : <Onboarding />
}
