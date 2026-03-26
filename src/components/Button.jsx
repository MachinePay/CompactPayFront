export default function Button({ children, className = "", ...props }) {
  return (
    <button
      className={`px-4 py-2 rounded bg-primary text-white hover:bg-blue-600 transition ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
