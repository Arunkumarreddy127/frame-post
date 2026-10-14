import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import type { ShellRouteProps } from "../types";
import { RunningHubWorkflow, listRunningHubWorkflows } from "../runninghubApi";

type CreatePageProps = ShellRouteProps & {
  pageId?: string;
};

type CreateItem = {
  label: string;
  description: string;
  to: string;
};

const copilotItems: CreateItem[] = [
  {
    label: "Image",
    description: "Generate images with GPT image models.",
    to: "/create/gpt-image-gen",
  },
];

export function CreatePage({ user, onLogout, pageId }: CreatePageProps) {
  const { pageId: routePageId } = useParams<{ pageId?: string }>();
  const activePageId = pageId ?? routePageId;
  const [workflows, setWorkflows] = useState<RunningHubWorkflow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    listRunningHubWorkflows()
      .then(setWorkflows)
      .catch((caught: Error) => setLoadError(caught.message));
  }, []);

  const rhItems: CreateItem[] = workflows.map((workflow) => ({
    label: workflow.label,
    description: workflow.description,
    to: `/create/rh/${workflow.key}`,
  }));

  const sections: { heading: string; items: CreateItem[] }[] = [
    { heading: "Copilot", items: copilotItems },
    { heading: "RH", items: rhItems },
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
      <div className="create-sections">
        {loadError ? <p className="status error">{loadError}</p> : null}
        {sections.map((section) => (
          <section className="panel create-section" key={section.heading}>
            <h3>{section.heading}</h3>
            <ul className="create-list">
              {section.items.map((item) => (
                <li key={item.to}>
                  <Link
                    className="create-item"
                    to={activePageId ? `/pages/${activePageId}${item.to}` : item.to}
                  >
                    <span className="create-item-text">
                      <strong>{item.label}</strong>
                      <span>{item.description}</span>
                    </span>
                    <span className="create-item-action">Open</span>
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
