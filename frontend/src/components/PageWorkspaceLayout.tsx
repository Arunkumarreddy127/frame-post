import { useEffect, useState } from "react";
import { Outlet, useParams } from "react-router-dom";
import { API_BASE_URL } from "../api";
import { WorkspaceAppShell } from "./AppShell";
import type { Page, ShellRouteProps } from "../types";

export function PageWorkspaceLayout({ user, onLogout }: ShellRouteProps) {
  const { pageId } = useParams<{ pageId: string }>();
  const [pageIdentity, setPageIdentity] = useState<{
    pageId: string;
    name?: string;
    error?: string;
  } | null>(null);
  const currentIdentity =
    pageIdentity?.pageId === pageId ? pageIdentity : null;
  const pageName = currentIdentity?.name;
  const pageNameError = currentIdentity?.error;
  const pageNameLoading = Boolean(pageId) && !pageName && !pageNameError;

  useEffect(() => {
    if (!pageId) return;

    const activePageId = pageId;
    let active = true;
    setPageIdentity({ pageId: activePageId });

    async function loadPageName() {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/pages/${activePageId}`,
          { credentials: "include" },
        );
        if (!response.ok) {
          throw new Error("Page not found");
        }
        const page: Page = await response.json();
        const name = page.name?.trim();
        if (!name) {
          throw new Error("Page name is unavailable");
        }
        if (active) {
          setPageIdentity({ pageId: activePageId, name });
        }
      } catch (caught) {
        if (!active) return;
        setPageIdentity({
          pageId: activePageId,
          error:
            caught instanceof Error
              ? caught.message
              : "Unable to load page name",
        });
      }
    }

    void loadPageName();
    return () => {
      active = false;
    };
  }, [pageId]);

  return (
    <WorkspaceAppShell
      user={user}
      onLogout={onLogout}
      pageId={pageId}
      pageName={pageName}
      pageNameLoading={pageNameLoading}
      pageNameError={pageNameError}
    >
      <Outlet />
    </WorkspaceAppShell>
  );
}
