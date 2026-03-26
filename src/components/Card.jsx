export default function Card({ children, className = "" }) {
  return <div className={`app-panel p-5 md:p-6 ${className}`}>{children}</div>;
}
