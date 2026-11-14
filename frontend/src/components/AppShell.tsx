import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
} from "react";
import { MessageSquare } from "lucide-react";
import { ChatPanel } from "./ChatPanel";
import { Header } from "./Header";
import { PageSidebar } from "./PageSidebar";
import { Sidebar } from "./Sidebar";
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
  filesExplorer?: React.ReactNode;
  chatPanel?: boolean;
};

type AppShellConfig = Pick<
  AppShellProps,
  "pageTitle" | "backTo" | "sidebar" | "pageId" | "filesExplorer" | "chatPanel"
>;

const WorkspaceShellConfigContext = createContext<
  ((config: AppShellConfig) => void) | null
>(null);

export function WorkspaceAppShell({
  children,
  user,
  onLogout,
  pageId,
}: Pick<AppShellProps, "children" | "user" | "onLogout" | "pageId">) {
  const [shellConfig, setShellConfig] = useState<AppShellConfig>({
    pageTitle: "Page workspace",
    backTo: "/pages",
    sidebar: "page",
    pageId,
    chatPanel: true,
  });
  const reportShellConfig = useCallback((config: AppShellConfig) => {
    setShellConfig((current) =>
      sameShellConfig(current, config) ? current : config,
    );
  }, []);

  return (
    <AppShell user={user} onLogout={onLogout} {...shellConfig} pageId={pageId}>
      <WorkspaceShellConfigContext.Provider value={reportShellConfig}>
        {children}
      </WorkspaceShellConfigContext.Provider>
    </AppShell>
  );
}

export function AppShell(props: AppShellProps) {
  const parentShellConfig = useContext(WorkspaceShellConfigContext);
  const config: AppShellConfig = {
    pageTitle: props.pageTitle,
    backTo: props.backTo ?? "/home",
    sidebar: props.sidebar ?? "global",
    pageId: props.pageId,
    filesExplorer: props.filesExplorer,
    chatPanel: props.chatPanel ?? true,
  };

  if (parentShellConfig) {
    return (
      <NestedAppShell
        config={config}
        reportShellConfig={parentShellConfig}
      >
        {props.children}
      </NestedAppShell>
    );
  }

  return <RenderedAppShell {...props} {...config} />;
}

function NestedAppShell({
  children,
  config,
  reportShellConfig,
}: {
  children: React.ReactNode;
  config: AppShellConfig;
  reportShellConfig: (config: AppShellConfig) => void;
}) {
  useLayoutEffect(() => {
    reportShellConfig(config);
  }, [config.pageTitle, config.backTo, config.sidebar, config.pageId, config.filesExplorer, config.chatPanel, reportShellConfig]);

  return <>{children}</>;
}

function sameShellConfig(left: AppShellConfig, right: AppShellConfig) {
  return (
    left.pageTitle === right.pageTitle &&
    left.backTo === right.backTo &&
    left.sidebar === right.sidebar &&
    left.pageId === right.pageId &&
    left.filesExplorer === right.filesExplorer &&
    left.chatPanel === right.chatPanel
  );
}

function RenderedAppShell({
  children,
  user,
  onLogout,
  pageTitle,
  backTo = "/home",
  sidebar = "global",
  pageId,
  filesExplorer,
  chatPanel = true,
}: AppShellProps) {
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
        pageTitle={pageTitle}
        onLogout={onLogout}
      />
      <div
        className={`app-body${showChat ? " has-chat" : ""}`}
      >
        {sidebar === "page" ? (
          <PageSidebar pageId={pageId} filesExplorer={filesExplorer} />
        ) : (
          <Sidebar backTo={backTo} filesExplorer={filesExplorer} />
        )}
        <main className="app-main">
          {chatPanel && (
            <div className="app-main-toolbar">
              <button
                type="button"
                className={`chat-toggle${chatOpen ? " active" : ""}`}
                aria-pressed={chatOpen}
                aria-label={chatOpen ? "Hide chat" : "Show chat"}
                title={chatOpen ? "Hide chat" : "Show chat"}
                onClick={() => setChatOpen((current) => !current)}
              >
                <MessageSquare size={17} strokeWidth={2} aria-hidden="true" />
                <span>Chat</span>
              </button>
            </div>
          )}
          {children}
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
