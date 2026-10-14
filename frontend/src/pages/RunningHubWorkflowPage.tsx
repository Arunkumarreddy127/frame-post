import { ArrowLeft, Clock3, Sparkles } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { DynamicInputField, initialValueFor } from "../components/DynamicInputField";
import type { ShellRouteProps } from "../types";
import {
  RunningHubGeneration,
  RunningHubInstanceType,
  RunningHubWorkflow,
  generateRunningHub,
  listRunningHubGenerations,
  listRunningHubWorkflows,
  subscribeToRunningHubGeneration,
} from "../runninghubApi";

type RunningHubWorkflowPageProps = ShellRouteProps & {
  pageId?: string;
};

const INSTANCE_TYPES: { value: RunningHubInstanceType; label: string; description: string; rateCoins: number }[] = [
  { value: "default", label: "Standard (24GB)", description: "0.2 coins/second", rateCoins: 0.2 },
  { value: "plus", label: "Plus (48GB)", description: "0.4 coins/second", rateCoins: 0.4 },
  { value: "ultra", label: "Ultra (84GB)", description: "Higher tier option", rateCoins: 0.6 },
];

export function RunningHubWorkflowPage({ user, onLogout, pageId }: RunningHubWorkflowPageProps) {
  const { pageId: routePageId, workflowKey = "" } = useParams<{ pageId?: string; workflowKey?: string }>();
  const activePageId = pageId ?? routePageId;
  const createPath = activePageId ? `/pages/${activePageId}/create` : "/create";

  const [workflow, setWorkflow] = useState<RunningHubWorkflow | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [generations, setGenerations] = useState<RunningHubGeneration[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [instanceType, setInstanceType] = useState<RunningHubInstanceType>("default");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = generations.find((item) => item.id === selectedId) ?? generations[0] ?? null;
  const processingKey = generations
    .filter((item) => item.status === "PROCESSING")
    .map((item) => item.id)
    .join(",");

  useEffect(() => {
    listRunningHubWorkflows()
      .then((all) => {
        const match = all.find((item) => item.key === workflowKey) ?? null;
        setWorkflow(match);
        if (!match) setLoadError("This RunningHub workflow does not exist.");
        if (match) {
          setValues(Object.fromEntries(match.inputs.map((input) => [input.name, initialValueFor(input)])));
        }
      })
      .catch((caught: Error) => setLoadError(caught.message));
  }, [workflowKey]);

  useEffect(() => {
    if (!activePageId || !workflow) return;
    listRunningHubGenerations(activePageId, workflow.key)
      .then((items) => {
        setGenerations(items);
        setSelectedId(items[0]?.id ?? null);
      })
      .catch((caught: Error) => setError(caught.message));
  }, [activePageId, workflow]);

  useEffect(() => {
    if (!activePageId || !workflow || !processingKey) return;
    const closers = processingKey.split(",").map((id) =>
      subscribeToRunningHubGeneration(activePageId, workflow.key, id, (updated) => {
        setGenerations((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      }),
    );
    return () => closers.forEach((close) => close());
  }, [activePageId, workflow, processingKey]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activePageId || !workflow) {
      setError("Open this workflow from a page to generate.");
      return;
    }
    const missing = workflow.inputs.find((input) => {
      if (!input.required) return false;
      if (input.type === "image" || input.type === "video") return !files[input.name];
      return !(values[input.name] ?? "").trim();
    });
    if (missing) {
      setError(`${missing.label} is required.`);
      return;
    }

    const cleanValues: Record<string, string> = {};
    const cleanFiles: Record<string, File> = {};
    for (const input of workflow.inputs) {
      if (input.type === "image" || input.type === "video") {
        const file = files[input.name];
        if (file) cleanFiles[input.name] = file;
      } else if ((values[input.name] ?? "").trim() !== "") {
        cleanValues[input.name] = values[input.name].trim();
      }
    }

    setSubmitting(true);
    setError(null);
    try {
      const created = await generateRunningHub(activePageId, workflow.key, {
        values: cleanValues,
        files: cleanFiles,
        instanceType,
      });
      setGenerations((current) => [created, ...current]);
      setSelectedId(created.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to start the generation");
    } finally {
      setSubmitting(false);
    }
  }

  const title = workflow?.label ?? "RunningHub workflow";

  return (
    <AppShell
      user={user}
      onLogout={onLogout}
      pageTitle={title}
      sidebar={activePageId ? "page" : "global"}
      pageId={activePageId}
      backTo={createPath}
    >
      <div className="workflow-page">
        <div className="workflow-breadcrumb">
          <Link to={createPath} className="workflow-back-link">
            <ArrowLeft size={16} strokeWidth={1.8} aria-hidden="true" />
            Back to Create
          </Link>
          <span className="workflow-breadcrumb-separator">/</span>
          <span>RunningHub</span>
        </div>

        {loadError ? <p className="status error">{loadError}</p> : null}

        {workflow ? (
          <div className="workflow-layout">
            <section className="workflow-form-card">
              <div className="workflow-card-heading">
                <div className="workflow-icon">
                  <Sparkles size={18} strokeWidth={2} aria-hidden="true" />
                </div>
                <div>
                  <p className="eyebrow">AI video creation</p>
                  <h1>{workflow.label}</h1>
                  <p className="workflow-description">{workflow.description}</p>
                </div>
              </div>
              {!workflow.configured ? (
                <p className="status error">This workflow is not configured on the server yet.</p>
              ) : null}
              <form className="workflow-form" onSubmit={handleSubmit}>
                {workflow.inputs.map((input) => (
                  <DynamicInputField
                    key={input.name}
                    input={input}
                    value={values[input.name] ?? ""}
                    file={files[input.name] ?? null}
                    onValueChange={(value) => setValues((current) => ({ ...current, [input.name]: value }))}
                    onFileChange={(file) => setFiles((current) => ({ ...current, [input.name]: file }))}
                  />
                ))}
                
                <div className="form-field">
                  <label htmlFor="instance-type" className="form-label">
                    GPU Tier <span className="required-badge">*</span>
                  </label>
                  <select
                    id="instance-type"
                    className="form-select"
                    value={instanceType}
                    onChange={(e) => setInstanceType(e.target.value as RunningHubInstanceType)}
                  >
                    {INSTANCE_TYPES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label} - {option.description}
                      </option>
                    ))}
                  </select>
                  <span className="form-hint">
                    Select the GPU tier. Higher tiers support larger models but cost more per second.
                  </span>
                </div>

                {error ? <p className="status error">{error}</p> : null}
                <div className="workflow-form-footer">
                  <span className="workflow-cost">Generation may take a few minutes</span>
                  <button type="submit" className="primary-button workflow-submit" disabled={submitting || !workflow.configured}>
                    {submitting ? "Starting..." : `Generate ${workflow.outputType}`}
                    {!submitting ? <Sparkles size={15} aria-hidden="true" /> : null}
                  </button>
                </div>
              </form>
            </section>

            <section className="workflow-result-card">
              <div className="workflow-result-heading">
                <div>
                  <p className="eyebrow">Output</p>
                  <h2>Generated result</h2>
                </div>
                {selected ? <span className={`generation-status generation-status-${selected.status.toLowerCase()}`}>{selected.status.toLowerCase()}</span> : null}
              </div>
              {selected ? (
                <>
                  {selected.status === "PROCESSING" ? (
                    <div className="result-placeholder result-processing">
                      <span className="result-loader" />
                      <strong>Creating your video</strong>
                      <span>Generating on RunningHub. This can take several minutes.</span>
                    </div>
                  ) : null}
                  {selected.status === "FAILED" ? <p className="status error">{selected.error ?? "Generation failed"}</p> : null}
                  {selected.status === "COMPLETED" && selected.resultUrl ? (
                    <div className="result-media">
                      {selected.resultType === "image" ? (
                        <img src={selected.resultUrl} alt="Generated result" />
                      ) : (
                        <video src={selected.resultUrl} controls />
                      )}
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="result-placeholder">
                  <div className="result-placeholder-icon"><Sparkles size={22} aria-hidden="true" /></div>
                  <strong>Your generated video will appear here</strong>
                  <span>Upload an image and describe the motion you want to create.</span>
                </div>
              )}
            </section>
          </div>
        ) : null}

        {generations.length > 0 ? (
          <section className="workflow-history">
            <div className="workflow-history-heading">
              <div>
                <p className="eyebrow">Recent activity</p>
                <h2>Generation history</h2>
              </div>
              <Clock3 size={18} aria-hidden="true" />
            </div>
            <div className="workflow-history-list">
              {generations.map((item) => (
                <button type="button" className={`workflow-history-item ${selectedId === item.id ? "active" : ""}`} key={item.id} onClick={() => setSelectedId(item.id)}>
                  <span className={`generation-status generation-status-${item.status.toLowerCase()}`}>{item.status.toLowerCase()}</span>
                  <span className="workflow-history-copy">
                    <strong>{(item.inputs.prompt ?? "Image to video generation").slice(0, 60)}</strong>
                    <span>{new Date(item.createdAt).toLocaleString()}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
