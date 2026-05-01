import { useState } from 'react';
import Sidebar from './Sidebar';
import { MdMenu, MdClose } from 'react-icons/md';

export default function Layout({ children, title }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-[100dvh] bg-gray-50 overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:flex md:flex-shrink-0">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="relative flex flex-col w-72 z-50">
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-4 md:px-6 py-3 sm:py-4 flex items-center gap-3 sm:gap-4 safe-area-top">
          <button
            className="md:hidden text-gray-500 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation"
          >
            <MdMenu size={22} />
          </button>
          <h2 className="text-base sm:text-lg font-heading font-bold text-brand-navy truncate">{title}</h2>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 overscroll-contain">
          {children}
        </main>
      </div>
    </div>
  );
}
