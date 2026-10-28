function BrandMark() {
  return <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <path d="M5 7c4-1 8 0 11 3 3-3 7-4 11-3v18c-4-1-8 0-11 3-3-3-7-4-11-3V7Z"
      stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M16 10v18M9 12l3 1M20 13l3-1M9 17l3 1M20 18l3-1"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
}

export function HomePage() {
  const isHome = window.location.pathname === '/'
  return <div className="page-shell">
    <header className="site-header">
      <a className="brand" href="/" aria-label="CampusClawPlus 首页">
        <span className="brand-mark"><BrandMark /></span>
        <span>CampusClaw<span className="brand-plus">Plus</span></span>
      </a>
      <span className="edition"><span>第 7 课</span><span>项目启动</span></span>
    </header>
    <main>
      {isHome ? <section className="welcome-layout" aria-labelledby="welcome-title">
        <div>
          <p className="greeting">Hello World <span aria-hidden="true">✦</span></p>
          <h1 id="welcome-title">课堂，<br />从这里开始。</h1>
          <p className="welcome-copy">CampusClawPlus 的起点。<br />一个准备好继续生长的课堂教学项目。</p>
        </div>
        <aside className="notebook" aria-label="当前项目阶段">
          <div className="book-tab" aria-hidden="true" />
          <p className="notebook-label">项目启动阶段</p>
          <h2>先搭好起点，<br />再一起向前。</h2>
          <p>前端页面与后端服务的最小骨架正在这里建立。教学功能将在后续迭代中逐步实现。</p>
          <div className="ruled-lines" aria-hidden="true"><span /><span /><span /></div>
        </aside>
      </section> : <section className="not-found">
        <p className="greeting">404</p><h1>这一页还不存在。</h1>
        <p>请检查地址，或返回项目的起点。</p><a className="button" href="/">返回首页</a>
      </section>}
    </main>
    <footer className="site-footer"><span>CampusClawPlus</span><span>一起，把课堂准备好。</span></footer>
  </div>
}
