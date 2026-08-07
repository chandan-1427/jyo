import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import DemoBanner from "./DemoBanner";

export default function Layout() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <DemoBanner />
      <main className="max-w-4xl mx-auto px-4 pt-6 pb-24 sm:pb-6">
        <Outlet />
      </main>
    </div>
  );
}