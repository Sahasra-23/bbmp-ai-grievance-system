export default function FormField({ label, id, error, children }) {
  return (
    <label htmlFor={id} className="block">
      <span className="mb-2 block text-sm font-bold text-slate-700">{label}</span>
      {children}
      {error ? <span className="mt-2 block text-sm font-semibold text-rose-700">{error}</span> : null}
    </label>
  );
}
