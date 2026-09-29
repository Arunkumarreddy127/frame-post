import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import type { User } from "../types";

type AppShellProps = {
  children: React.ReactNode;
  user: User;
  onLogout: () => Promise<void>;
  pageTitle: string;
  backTo?: string;
};

export function AppShell({
  children,
  user,
  onLogout,
  pageTitle,
  backTo = "/home",
}: AppShellProps) {
  return (
    <div className="shell app-shell">
      <Header
        username={user.username}
        pageTitle={pageTitle}
        onLogout={onLogout}
      />
      <div className="app-body">
        <Sidebar backTo={backTo} />
        <main className="app-main">{children}</main>
      </div>
    </div>
  );
}
