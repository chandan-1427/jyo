import { Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";
import SplashScreen from "./components/SplashScreen";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Profile from "./pages/Profile";
import Feed from "./pages/Feed";
import PostDetail from "./pages/PostDetail";
import CreatePost from "./pages/CreatePost";
import MyPosts from "./pages/MyPosts";
import MyRequests from "./pages/MyRequests";
import NotFound from "./pages/NotFound";
import VerifyEmail from "./pages/VerifyEmail";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";

function AuthGuard() {
  const { user, loading } = useAuth();
  if (loading) return <SplashScreen />;
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}

function GuestGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <SplashScreen />;
  return !user ? <>{children}</> : <Navigate to="/feed" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<SplashScreen />}>
        <Routes>

          {/* Public */}
          <Route path="/" element={<Home />} />
          <Route path="/login"    element={<GuestGuard><Login /></GuestGuard>} />
          <Route path="/register" element={<GuestGuard><Register /></GuestGuard>} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Protected */}
          <Route element={<AuthGuard />}>
            <Route element={<Layout />}>
              <Route path="/feed"        element={<Feed />} />
              <Route path="/posts/:id"   element={<PostDetail />} />
              <Route path="/create"      element={<CreatePost />} />
              <Route path="/my-posts"    element={<MyPosts />} />
              <Route path="/my-requests" element={<MyRequests />} />
              <Route path="/profile"     element={<Profile />} />
            </Route>
          </Route>

          {/* Catches everything — logged in or not */}
          <Route path="*" element={<NotFound />} />

        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}