interface HeaderProps {
  totalRecords: number;
}

export function Header({ totalRecords }: HeaderProps) {
  return (
    <header className="mb-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Logo/Icon */}
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent to-emerald-600 flex items-center justify-center shadow-glow">
            <svg className="w-7 h-7 text-midnight-950" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          
          <div>
            <h1 className="text-2xl font-bold text-white font-display tracking-tight">
              Cost Scraper
            </h1>
            <p className="text-slate-400 text-sm">
              Project Cost Analytics & Forecasting
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="hidden md:flex items-center gap-6">
          <div className="text-right">
            <div className="text-2xl font-bold text-accent font-mono">
              {totalRecords.toLocaleString()}
            </div>
            <div className="text-xs text-slate-500 uppercase tracking-wider">
              Total Records
            </div>
          </div>
          
          <div className="w-px h-10 bg-midnight-600" />
          
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Connected</span>
          </div>
        </div>
      </div>
    </header>
  );
}

