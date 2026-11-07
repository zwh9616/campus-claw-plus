import { createRoot } from 'react-dom/client'
import { AccountSample, LoginSample } from '../components/IdentitySamples'
import type { SampleState } from '../components/IdentitySamples'
import '../sample-theme.css'

if (import.meta.env.MODE !== 'samples' || import.meta.env.PROD) throw new Error('Samples are test-only')
const params = new URLSearchParams(location.search)
const state: SampleState = params.get('state') === 'loading' ? 'loading' : params.get('state') === 'error' ? 'error' : 'normal'
const root = document.getElementById('root')
if (!root) throw new Error('Missing sample root')
createRoot(root).render(<><aside className="sample-banner">样板审查 · 隔离合成数据 · 未连接真实认证服务</aside>{params.get('page') === 'account' ? <AccountSample state={state} long={params.get('long') === '1'} /> : <LoginSample state={state} />}</>)
