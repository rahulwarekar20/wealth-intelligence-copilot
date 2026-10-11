"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/lib/api";

export default function Sidebar() {
  const pathname = usePathname();

  const handleLogout = () => logout();

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: "📊" },
    { href: "/strategy", label: "Analyse Portfolio", icon: "🧠" },
    { href: "/chat", label: "Ask Copilot", icon: "💬" },
    { href: "/upload", label: "Documents", icon: "📄" },
  ];

  return (
    <aside className="w-56 min-h-screen bg-gray-900 border-r border-gray-800 flex flex-col fixed left-0 top-0">

      {/* Logo */}
      <div className="px-5 py-6 border-b border-gray-800 text-center">
        <p className="text-teal-400 font-bold text-base leading-tight">
          Wealth Intelligence Copilot
        </p>
        <p className="text-teal-600 text-xs font-semibold tracking-widest mt-1">(WIC)</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              pathname === item.href
                ? "bg-teal-600 text-white"
                : "text-gray-400 hover:bg-teal-600 hover:text-white"
            }`}
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-gray-800">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-red-900 hover:text-red-300 transition-all w-full"
        >
          <span>🚪</span>
          Logout
        </button>
      </div>
    </aside>
  );
}