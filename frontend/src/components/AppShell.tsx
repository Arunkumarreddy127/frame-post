import { Header } from "./Header";
import { PageSidebar } from "./PageSidebar";
import { Sidebar } from "./Sidebar";
import type { User } from "../types";

type AppShellProps = {
  children: React.ReactNode;
  user: User;
  onLogout: () => Promise<void>;
  pageTitle: string;
  backTo?: string;
  sidebar?: "global" | "page";
  pageId?: string;
};

export function AppShell({
  children,
  user,
  onLogout,
  pageTitle,
  backTo = "/home",
  sidebar = "global",
  pageId,
}: AppShellProps) {
  return (
    <div className="shell app-shell">
      <Header
        username={user.username}
        pageTitle={pageTitle}
        onLogout={onLogout}
      />
      <div className="app-body">
        {sidebar === "page" ? (
          <PageSidebar pageId={pageId} backTo={backTo} />
        ) : (
          <Sidebar backTo={backTo} />
        )}
        <main className="app-main">{children}</main>
      </div>
    </div>
  );
}
