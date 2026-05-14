export default function SplashScreen() {
  return (
    <div className="min-h-screen bg-white font-geist font-medium tracking-wide flex flex-col items-center justify-center gap-4">
      <div className="flex flex-col items-center gap-3 animate-pulse">
        <h1 className="font-geist font-semibold text-5xl text-neutral-900 tracking-tight">
          Jyo<span className="text-[#2D6A4F]">.</span>
        </h1>
        
        <p className="text-sm text-neutral-400 tracking-wide">
          Loading...
        </p>
      </div>
    </div>
  );
}