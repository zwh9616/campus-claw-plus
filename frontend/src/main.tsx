import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './pages/App'
import './sample-theme.css'
import './app.css'

const root = document.getElementById('root')
if (!root) throw new Error('缺少页面挂载节点')
createRoot(root).render(<StrictMode><App /></StrictMode>)
