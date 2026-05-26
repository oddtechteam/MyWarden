import { type ReactNode } from 'react'
import Sidebar from './Sidebar'

interface LayoutProps {
  children: ReactNode
  title?: string
}

export default function Layout({ children, title }: LayoutProps) {
  return (
    <div className="min-h-screen bg-slate-900 flex">
      <Sidebar />
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        {title && (
          <header className="h-16 border-b border-slate-800/60 flex items-center px-8 shrink-0 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-30">
            <h1 className="text-slate-100 font-semibold text-lg">{title}</h1>
          </header>
        )}
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  )
}
