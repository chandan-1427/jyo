export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[13px] font-medium text-muted">{label}</label>
      {children}
    </div>
  );
}