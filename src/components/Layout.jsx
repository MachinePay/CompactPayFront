import Sidebar from "./Sidebar";

export default function Layout({ children }) {
  return (
    <div className="app-shell flex min-h-screen flex-col gap-4 p-4 lg:flex-row lg:p-5">
      <Sidebar />
      <main className="flex-1 overflow-hidden rounded-[28px] bg-white/36 p-2">
        {children}
      </main>
    </div>
  );
}
