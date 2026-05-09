import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const NAV_LINKS = [
  { label: "Feed", path: "/feed" },
  { label: "Post Food", path: "/create" },
  { label: "My Posts", path: "/my-posts" },
  { label: "My Requests", path: "/my-requests" },
  { label: "Profile", path: "/profile" },
];

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="w-7 h-7 rounded-full bg-neutral-800 text-white flex items-center justify-center text-[11px] font-semibold select-none shrink-0">
      {initials}
    </div>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    navigate("/");
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="bg-white font-work sticky top-0 z-50 border-b border-neutral-100">

      {/* ── Single row: brand | links (center) | user (right) ── */}
      <div className="max-w-5xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">

        {/* Left — Brand */}
        <Link
          to="/feed"
          className="font-geist font-semibold text-[1.35rem] sm:text-[1.15rem] text-neutral-900 tracking-tight"
        >
          Jyo<span className="text-[#2D6A4F]">.</span>
        </Link>

        {/* Desktop center nav */}
        <div className="hidden sm:flex items-center gap-0.5">
          {NAV_LINKS.map(({ label, path }) => (
            <Link
              key={path}
              to={path}
              className={`px-3 py-1.5 rounded-md text-md transition-colors duration-150 ${
                isActive(path)
                  ? "bg-neutral-100 text-neutral-900 font-medium"
                  : "text-neutral-500 hover:text-neutral-800 hover:bg-neutral-50"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Desktop right user */}
        <div className="hidden sm:flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Avatar name={user?.name ?? "U"} />

            <span className="text-md text-neutral-500">
              {user?.name}
            </span>
          </div>

          <span className="text-neutral-200 select-none">|</span>

          <button
            onClick={handleLogout}
            className="px-3 py-1.5 rounded-md text-md cursor-pointer text-neutral-400 hover:text-red-500 hover:bg-red-100/40 transition-colors duration-150"
          >
            Log out
          </button>
        </div>

        {/* Mobile menu button */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="sm:hidden w-9 h-9 flex items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 transition-colors"
          aria-label="Toggle menu"
        >
          {menuOpen ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* ── Mobile drawer ── */}
      {menuOpen && (
        <div className="sm:hidden border-t border-neutral-100 bg-white">

          {/* User row */}
          <div className="px-4 py-3 flex items-center gap-2.5 border-b border-neutral-100">
            <Avatar name={user?.name ?? "U"} />
            <span className="text-md text-neutral-600">{user?.name}</span>
          </div>

          {/* Nav links */}
          <div className="px-2 py-2">
            {NAV_LINKS.map(({ label, path }) => (
              <Link
                key={path}
                to={path}
                onClick={() => setMenuOpen(false)}
                className={`flex items-center px-3 py-2 rounded-md text-md transition-colors ${
                  isActive(path)
                    ? "bg-neutral-100 text-neutral-900 font-medium"
                    : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800"
                }`}
              >
                {label}
              </Link>
            ))}
          </div>

          {/* Log out */}
          <div className="px-2 py-2 border-t border-neutral-100">
            <button
              onClick={handleLogout}
              className="flex w-full items-center px-3 py-2 rounded-md text-md text-red-500 hover:bg-red-50 transition-colors"
            >
              Log out
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}