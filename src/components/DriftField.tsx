export default function DriftField() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div className="animate-drift absolute -left-24 top-1/4 h-72 w-72 rounded-full bg-signal/20 blur-[100px]" />
      <div className="animate-drift-slow absolute right-0 top-1/3 h-96 w-96 rounded-full bg-coral/10 blur-[120px]" />
      <div className="animate-drift absolute left-1/3 bottom-0 h-80 w-80 rounded-full bg-signal-dim/20 blur-[110px]" />
    </div>
  );
}
