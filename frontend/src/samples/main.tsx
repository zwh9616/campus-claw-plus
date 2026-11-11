import { createRoot } from 'react-dom/client'
import { AccountSample, LoginSample } from '../components/IdentitySamples'
import type { SampleState } from '../components/IdentitySamples'
import { MaterialSample } from './MaterialSamples'
import type { MaterialState } from './MaterialSamples'
import '../sample-theme.css'

if (import.meta.env.MODE !== 'samples' || import.meta.env.PROD) throw new Error('Samples are test-only')
const params = new URLSearchParams(location.search)
const state: SampleState = params.get('state') === 'loading' ? 'loading' : params.get('state') === 'error' ? 'error' : 'normal'
const root = document.getElementById('root')
if (!root) throw new Error('Missing sample root')
const page = params.get('page')
const materials = page === 'materials' || page === 'material-detail'
const materialState: MaterialState = params.get('state') === 'empty' ? 'empty' : state
createRoot(root).render(<><aside className="sample-banner">样板审查 · 隔离合成数据 · 未连接真实认证或资料服务</aside>{materials ? <MaterialSample state={materialState} role={params.get('role') === 'student' ? 'student' : 'teacher'} detail={page === 'material-detail'} long={params.get('long') === '1'} recordId={params.get('material')} /> : page === 'account' ? <AccountSample state={state} long={params.get('long') === '1'} /> : <LoginSample state={state} />}</>)
