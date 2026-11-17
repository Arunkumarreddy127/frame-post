import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { ChatPanel } from "./ChatPanel";
import { Header } from "./Header";
import { PageSidebar } from "./PageSidebar";
import { Sidebar } from "./Sidebar";
import { WorkspaceTabs } from "./WorkspaceTabs";
import { useFilesWorkspaceContext } from "./files/FilesWorkspaceProvider";
import type { User } from "../types";

const CHAT_OPEN_KEY = "framepost.chatPanelOpen";

type AppShellProps = {
  children: React.ReactNode;
  user: User;
  onLogout: () => Promise<void>;
  pageTitle: string;
  backTo?: string;
  sidebar?: "global" | "page";
  pageId?: string;
  pageName?: string;
  pageProfileImageUrl?: string | null;
  pageNameLoading?: boolean;
  pageNameError?: string;
  chatPanel?: boolean;
};

const WorkspaceShellContext = createContext(false);

export function WorkspaceAppShell({
  children,
  user,
  onLogout,
  pageTitle,
  backTo,
  sidebar,
  pageId,
  pageName,
  pageProfileImageUrl,
  pageNameLoading,
  pageNameError,
  chatPanel,
}: AppShellProps) {
  return (
    <AppShell
      user={user}
      onLogout={onLogout}
      pageTitle={pageTitle}
      backTo={backTo ?? (pageId ? "/pages" : "/home")}
      sidebar={sidebar ?? (pageId ? "page" : "global")}
      pageId={pageId}
      pageName={pageName}
      pageProfileImageUrl={pageProfileImageUrl}
      pageNameLoading={pageNameLoading}
      pageNameError={pageNameError}
      chatPanel={chatPanel}
    >
      <WorkspaceShellContext.Provider value>
        {children}
      </WorkspaceShellContext.Provider>
    </AppShell>
  );
}

export function AppShell(props: AppShellProps) {
  const isNested = useContext(WorkspaceShellContext);
  return isNested ? <>{props.children}</> : <RenderedAppShell {...props} />;
}

function RenderedAppShell({
  children,
  user,
  onLogout,
  backTo = "/home",
  sidebar = "global",
  pageId,
  pageName,
  pageProfileImageUrl,
  pageNameLoading,
  pageNameError,
  chatPanel = true,
}: AppShellProps) {
  const { filesExplorer, creationsExplorer } = useFilesWorkspaceContext();
  const [chatOpen, setChatOpen] = useState(() => {
    const stored = window.localStorage.getItem(CHAT_OPEN_KEY);
    // First visit: keep the content area roomy on narrower screens.
    return stored === null ? window.innerWidth >= 1280 : stored !== "false";
  });

  useEffect(() => {
    window.localStorage.setItem(CHAT_OPEN_KEY, String(chatOpen));
  }, [chatOpen]);

  const showChat = chatPanel && chatOpen;

  return (
    <div className="shell app-shell">
      <Header
        username={user.username}
        chatPanel={chatPanel}
        chatOpen={showChat}
        onToggleChat={() => setChatOpen((current) => !current)}
        onLogout={onLogout}
      />
      <div
        className={`app-body${showChat ? " has-chat" : ""}`}
      >
        {sidebar === "page" ? (
          <PageSidebar
            pageId={pageId}
            pageName={pageName}
            pageProfileImageUrl={pageProfileImageUrl}
            pageNameLoading={pageNameLoading}
            filesExplorer={filesExplorer}
            creationsExplorer={creationsExplorer}
          />
        ) : (
          <Sidebar
            backTo={backTo}
            filesExplorer={filesExplorer}
            creationsExplorer={creationsExplorer}
          />
        )}
        <main className="app-main">
          <div className="app-main-surface">
            <WorkspaceTabs />
            {pageNameError && sidebar === "page" && (
              <p className="page-workspace-error error" role="alert">
                Unable to load page name: {pageNameError}
              </p>
            )}
            {children}
          </div>
        </main>
        {chatPanel && (
          <aside className="app-chat" hidden={!chatOpen}>
            <ChatPanel pageId={pageId} />
          </aside>
        )}
      </div>
    </div>
  );
}
