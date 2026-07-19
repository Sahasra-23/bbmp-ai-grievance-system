export default function FormField({ label, id, error, children }) {
  return (
    <label htmlFor={id} className="block">
      <span className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-300">{label}</span>
      {children}
      {error ? <span className="mt-2 block text-sm font-semibold text-rose-750">{error}</span> : null}
    </label>
  );
}
