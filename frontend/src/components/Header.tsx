import { Link } from "react-router-dom";
import { MessageSquare } from "lucide-react";
import { UserInfo } from "./UserInfo";

type HeaderProps = {
  username: string;
  chatPanel: boolean;
  chatOpen: boolean;
  onToggleChat: () => void;
  onLogout: () => Promise<void>;
};

export function Header({
  username,
  chatPanel,
  chatOpen,
  onToggleChat,
  onLogout,
}: HeaderProps) {
  return (
    <header className="app-header">
      <div className={`app-header-inner${chatOpen ? " has-chat" : ""}`}>
        <LinkBrand />
        <div className="app-header-main">
          <div className="app-header-right">
            <UserInfo username={username} onLogout={onLogout} />
            {chatPanel && (
              <button
                type="button"
                className={`chat-toggle${chatOpen ? " active" : ""}`}
                aria-pressed={chatOpen}
                aria-label={chatOpen ? "Hide chat" : "Show chat"}
                title={chatOpen ? "Hide chat" : "Show chat"}
                onClick={onToggleChat}
              >
                <MessageSquare size={17} strokeWidth={2} aria-hidden="true" />
                <span>Chat</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function LinkBrand() {
  return (
    <Link className="brand-mark" to="/home" aria-label="Framepost home">
      FRAMEPOST
    </Link>
  );
}
