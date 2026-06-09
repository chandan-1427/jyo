import { Logo } from "./ui/Logo";

export default function SplashScreen() {
  return (
    <div className="min-h-screen  font-medium tracking-wide flex flex-col items-center justify-center gap-4">
      <div className="flex flex-col items-center gap-3 animate-pulse">
        <Logo />
        
        <p className="text-sm text-neutral-400 tracking-wide">
          Loading...
        </p>
      </div>
    </div>
  );
}