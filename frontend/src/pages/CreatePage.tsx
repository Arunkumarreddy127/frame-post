import { useEffect, useState, type ReactNode } from "react";
import { ChevronRight, Clapperboard, Image, Sparkles } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import type { ShellRouteProps, Workflow } from "../types";
import { getCatalog } from "../generationApi";
import { CreationTargetBanner, creationQuery } from "../components/creations/CreationTargetBanner";

type CreatePageProps = ShellRouteProps & {
  pageId?: string;
};

type CreateItem = {
  label: string;
  description: string;
  to: string;
  icon: ReactNode;
};

const copilotItems: CreateItem[] = [
  {
    label: "Image",
    description: "Generate images with GPT image models.",
    to: "/create/gpt-image-gen",
    icon: <Image size={20} strokeWidth={1.8} aria-hidden="true" />,
  },
];

export function CreatePage({ user, onLogout, pageId }: CreatePageProps) {
  const { pageId: routePageId } = useParams<{ pageId?: string }>();
  const activePageId = pageId ?? routePageId;
  const [searchParams] = useSearchParams();
  const creationId = searchParams.get("creationId");
  const query = creationQuery(creationId);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    getCatalog()
      .then((catalog) => setWorkflows(catalog.runningHubWorkflows))
      .catch((caught: Error) => setLoadError(caught.message));
  }, []);

  const rhItems: CreateItem[] = workflows.map((workflow) => ({
    label: workflow.label,
    description: workflow.description,
    to: `/create/rh/${workflow.key}`,
    icon:
      workflow.outputType === "video" ? (
        <Clapperboard size={20} strokeWidth={1.8} aria-hidden="true" />
      ) : (
        <Sparkles size={20} strokeWidth={1.8} aria-hidden="true" />
      ),
  }));

  const sections: { heading: string; items: CreateItem[] }[] = [
    { heading: "Image generation", items: copilotItems },
    { heading: "Workflows", items: rhItems },
  ];

  return (
    <AppShell
      user={user}
      onLogout={onLogout}
      pageTitle="Create"
      sidebar={activePageId ? "page" : "global"}
      pageId={activePageId}
      backTo={activePageId ? "/pages" : "/home"}
    >
      <header className="app-page-header">
        <div>
          <p className="eyebrow">Create</p>
          <h1 className="app-page-title">Create</h1>
          <p className="app-page-description">
            Choose an image generator or workflow to create new work.
          </p>
        </div>
      </header>
      {creationId && (
        <CreationTargetBanner pageId={activePageId} creationId={creationId} />
      )}
      <div className="create-sections">
        {loadError ? (
          <p className="error" role="alert">
            {loadError}
          </p>
        ) : null}
        {sections
          .filter((section) => section.items.length > 0)
          .map((section) => (
            <section className="create-section" key={section.heading}>
              <h3>{section.heading}</h3>
              <ul className="create-list">
                {section.items.map((item) => (
                  <li key={item.to}>
                    <Link
                      className="create-item"
                      to={
                        (activePageId
                          ? `/pages/${activePageId}${item.to}`
                          : item.to) + query
                      }
                    >
                      <span className="create-item-icon">{item.icon}</span>
                      <span className="create-item-text">
                        <strong>{item.label}</strong>
                        <span>{item.description}</span>
                      </span>
                      <ChevronRight
                        className="create-item-chevron"
                        size={18}
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
      </div>
    </AppShell>
  );
}
