export default function EasyModeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <header className="p-4 flex justify-center">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-white">Claudia Coder</span>
          <span className="text-sm text-slate-400">Demo</span>
        </div>
      </header>
      <main className="container mx-auto px-4 pb-8">{children}</main>
    </div>
  )
}
