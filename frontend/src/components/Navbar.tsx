import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const navLinks = [
  { label: "Feed", path: "/feed" },
  { label: "Post Food", path: "/create" },
  { label: "My Posts", path: "/my-posts" },
  { label: "My Requests", path: "/my-requests" },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">

        {/* Brand */}
        <Link
          to="/feed"
          className="text-xl font-bold text-orange-500"
        >
          Jyos
        </Link>

        {/* Desktop links */}
        <div className="hidden sm:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`text-sm font-medium transition ${
                isActive(link.path)
                  ? "text-orange-500"
                  : "text-gray-500 hover:text-orange-400"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right side — user + logout */}
        <div className="hidden sm:flex items-center gap-4">
          <span className="text-sm text-gray-400">{user?.name}</span>
          <button
            onClick={handleLogout}
            className="text-sm font-medium text-orange-500 hover:text-orange-600 transition"
          >
            Logout
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          className="sm:hidden text-gray-500 hover:text-orange-400 transition"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? "✕" : "☰"}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="sm:hidden bg-white border-t border-gray-100 px-4 py-4 flex flex-col gap-4">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              onClick={() => setMenuOpen(false)}
              className={`text-sm font-medium transition ${
                isActive(link.path)
                  ? "text-orange-500"
                  : "text-gray-500 hover:text-orange-400"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <div className="border-t border-gray-100 pt-4 flex items-center justify-between">
            <span className="text-sm text-gray-400">{user?.name}</span>
            <button
              onClick={handleLogout}
              className="text-sm font-medium text-orange-500 hover:text-orange-600 transition"
            >
              Logout
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}