export default function Card({ children, className = "", ...props }) {
  return (
    <div className={`app-panel p-5 md:p-6 ${className}`} {...props}>
      {children}
    </div>
  );
}
