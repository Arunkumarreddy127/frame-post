import {
  ArrowLeft,
  ArrowUp,
  ChevronDown,
  FolderOpen,
  Paperclip,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { initialValueFor } from "../components/DynamicInputField";
import { LibraryPicker } from "../components/library/LibraryPicker";
import { GenerationFeed } from "../components/generations/GenerationFeed";
import { getCatalog, startWorkflowGeneration } from "../generationApi";
import { useGenerationPages } from "../hooks/useGenerationPages";
import type {
  InstanceType,
  MediaItem,
  ShellRouteProps,
  Workflow,
  WorkflowInput,
} from "../types";

type RunningHubWorkflowPageProps = ShellRouteProps & {
  pageId?: string;
};

const INSTANCE_TYPES: { value: InstanceType; label: string }[] = [
  { value: "default", label: "Standard (24GB)" },
  { value: "plus", label: "Plus (48GB)" },
  { value: "ultra", label: "Ultra (84GB)" },
];

const MAX_PROMPT_LENGTH = 32000;

function isFileInput(input: WorkflowInput) {
  return input.type === "image" || input.type === "video";
}

function AttachmentThumb({
  file,
  kind,
}: {
  file: File;
  kind: "image" | "video";
}) {
  const [url, setUrl] = useState<string | null>(null);
  // Create inside the effect so StrictMode's mount/cleanup/mount cycle doesn't leave a revoked URL.
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  if (!url) return null;
  return kind === "video" ? (
    <video src={url} muted preload="metadata" aria-label={file.name} />
  ) : (
    <img src={url} alt={file.name} />
  );
}

export function RunningHubWorkflowPage({
  user,
  onLogout,
  pageId,
}: RunningHubWorkflowPageProps) {
  const { pageId: routePageId, workflowKey = "" } = useParams<{
    pageId?: string;
    workflowKey?: string;
  }>();
  const activePageId = pageId ?? routePageId;
  const createPath = activePageId ? `/pages/${activePageId}/create` : "/create";

  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [libraryFiles, setLibraryFiles] = useState<
    Record<string, MediaItem | null>
  >({});
  const [pickerFor, setPickerFor] = useState<WorkflowInput | null>(null);
  const [instanceType, setInstanceType] = useState<InstanceType>("default");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const {
    items,
    hasMore,
    loading,
    error: historyError,
    loadMore,
    prepend,
    update,
    removeWhere,
  } = useGenerationPages(
    { pageId: activePageId, provider: "RUNNINGHUB", workflowKey },
    Boolean(activePageId && workflow),
  );

  useEffect(() => {
    getCatalog()
      .then(({ runningHubWorkflows: all }) => {
        const match = all.find((item) => item.key === workflowKey) ?? null;
        setWorkflow(match);
        setLoadError(match ? null : "This RunningHub workflow does not exist.");
        if (match) {
          setValues(
            Object.fromEntries(
              match.inputs.map((input) => [input.name, initialValueFor(input)]),
            ),
          );
          setFiles({});
          setLibraryFiles({});
        }
      })
      .catch((caught: Error) => setLoadError(caught.message));
  }, [workflowKey]);

  const promptInput =
    workflow?.inputs.find((input) => input.type === "textarea") ?? null;
  const fileInputs = workflow?.inputs.filter(isFileInput) ?? [];
  const controls =
    workflow?.inputs.filter(
      (input) => !isFileInput(input) && input !== promptInput,
    ) ?? [];
  const attached = fileInputs.filter(
    (input) => files[input.name] || libraryFiles[input.name],
  );

  function setFile(input: WorkflowInput, file: File | null) {
    setFiles((current) => ({ ...current, [input.name]: file }));
    if (file) setLibraryFiles((current) => ({ ...current, [input.name]: null }));
    if (!file && fileRefs.current[input.name]) {
      fileRefs.current[input.name]!.value = "";
    }
  }

  function setLibraryFile(input: WorkflowInput, item: MediaItem | null) {
    setLibraryFiles((current) => ({ ...current, [input.name]: item }));
    if (item) setFile(input, null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activePageId || !workflow) {
      setError("Open this workflow from a page to generate.");
      return;
    }
    const missing = workflow.inputs.find((input) => {
      if (!input.required) return false;
      if (isFileInput(input)) {
        return !files[input.name] && !libraryFiles[input.name];
      }
      return !(values[input.name] ?? "").trim();
    });
    if (missing) {
      setError(`${missing.label} is required.`);
      return;
    }

    const cleanValues: Record<string, string> = {};
    const cleanFiles: Record<string, File> = {};
    const libraryKeys: Record<string, string> = {};
    for (const input of workflow.inputs) {
      if (isFileInput(input)) {
        const file = files[input.name];
        const library = libraryFiles[input.name];
        if (file) cleanFiles[input.name] = file;
        else if (library) libraryKeys[input.name] = library.key;
      } else if ((values[input.name] ?? "").trim() !== "") {
        cleanValues[input.name] = values[input.name].trim();
      }
    }

    setSubmitting(true);
    setError(null);
    try {
      const created = await startWorkflowGeneration(
        activePageId,
        workflow.key,
        {
          values: cleanValues,
          files: cleanFiles,
          libraryKeys,
          instanceType,
        },
      );
      prepend(created);
      fileInputs.forEach((input) => {
        setFile(input, null);
        setLibraryFile(input, null);
      });
      if (promptInput) {
        setValues((current) => ({ ...current, [promptInput.name]: "" }));
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to start the generation",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function renderControl(input: WorkflowInput) {
    const value = values[input.name] ?? "";
    const onChange = (next: string) =>
      setValues((current) => ({ ...current, [input.name]: next }));
    return (
      <label className="image-gen-control" key={input.name}>
        <span className="image-gen-control-label">{input.label}</span>
        <div className="image-gen-select-wrapper">
          {input.type === "select" ? (
            <>
              <select
                value={value}
                onChange={(event) => onChange(event.target.value)}
                disabled={submitting}
              >
                {(input.options ?? []).map((option) => (
                  <option key={String(option)} value={String(option)}>
                    {String(option)}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="image-gen-select-icon"
                size={14}
                aria-hidden="true"
              />
            </>
          ) : (
            <input
              type={input.type === "number" ? "number" : "text"}
              value={value}
              min={input.min ?? undefined}
              max={input.max ?? undefined}
              maxLength={input.maxLength ?? undefined}
              onChange={(event) => onChange(event.target.value)}
              disabled={submitting}
            />
          )}
        </div>
      </label>
    );
  }

  return (
    <AppShell
      user={user}
      onLogout={onLogout}
      pageTitle={workflow?.label ?? "RunningHub workflow"}
      sidebar={activePageId ? "page" : "global"}
      pageId={activePageId}
      backTo={createPath}
    >
      <Link to={createPath} className="secondary-button">
        <ArrowLeft size={16} strokeWidth={1.8} aria-hidden="true" />
        Back to Create
      </Link>
      {loadError ? <p className="status error">{loadError}</p> : null}
      {workflow ? (
        <div className="image-gen-layout">
          <form className="panel image-gen-form" onSubmit={handleSubmit}>
            <h2>{workflow.label}</h2>
            <section className="image-gen-section">
              <h3>{promptInput ? "Prompt" : "Source"}</h3>
              {/* GenerationComposer */}
              <div className="image-gen-prompt">
                {attached.length > 0 && (
                  <ul className="image-gen-attachments">
                    {attached.map((input) => (
                      <li key={input.name}>
                        {files[input.name] ? (
                          <AttachmentThumb
                            file={files[input.name]!}
                            kind={input.type as "image" | "video"}
                          />
                        ) : input.type === "video" ? (
                          <video
                            src={libraryFiles[input.name]!.url}
                            muted
                            preload="metadata"
                          />
                        ) : (
                          <img
                            src={libraryFiles[input.name]!.url}
                            alt={libraryFiles[input.name]!.name}
                            title="From Library"
                          />
                        )}
                        <button
                          type="button"
                          aria-label={`Remove ${
                            files[input.name]?.name ??
                            libraryFiles[input.name]!.name
                          }`}
                          onClick={() => {
                            setFile(input, null);
                            setLibraryFile(input, null);
                          }}
                        >
                          <X size={12} aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {promptInput ? (
                  <textarea
                    value={values[promptInput.name] ?? ""}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        [promptInput.name]: event.target.value,
                      }))
                    }
                    placeholder={`${promptInput.label}...`}
                    rows={6}
                    maxLength={promptInput.maxLength ?? MAX_PROMPT_LENGTH}
                    aria-label={promptInput.label}
                  />
                ) : (
                  attached.length === 0 && (
                    <p className="status">{workflow.description}</p>
                  )
                )}
                <div className="image-gen-prompt-actions">
                  {fileInputs.map((input) => (
                    <span key={input.name}>
                      <input
                        ref={(element) => {
                          fileRefs.current[input.name] = element;
                        }}
                        type="file"
                        accept={input.accept?.join(",")}
                        hidden
                        onChange={(event) =>
                          setFile(input, event.target.files?.[0] ?? null)
                        }
                      />
                      <button
                        type="button"
                        className="secondary-button"
                        aria-label={`Attach ${input.label}`}
                        title={input.label}
                        disabled={submitting}
                        onClick={() => fileRefs.current[input.name]?.click()}
                      >
                        <Paperclip size={16} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="secondary-button"
                        aria-label={`Choose ${input.label} from Library`}
                        title="Choose from Library"
                        disabled={submitting}
                        onClick={() => setPickerFor(input)}
                      >
                        <FolderOpen size={16} aria-hidden="true" />
                      </button>
                    </span>
                  ))}
                  <div style={{ flex: 1 }} />
                  {controls.map(renderControl)}
                  <label className="image-gen-control">
                    <span className="image-gen-control-label">GPU</span>
                    <div className="image-gen-select-wrapper">
                      <select
                        value={instanceType}
                        onChange={(event) =>
                          setInstanceType(event.target.value as InstanceType)
                        }
                        disabled={submitting}
                      >
                        {INSTANCE_TYPES.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        className="image-gen-select-icon"
                        size={14}
                        aria-hidden="true"
                      />
                    </div>
                  </label>
                  <button
                    type="submit"
                    className="primary-button"
                    aria-label="Generate"
                    disabled={submitting || !workflow.configured}
                  >
                    <ArrowUp size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>
            </section>
            {!workflow.configured && (
              <p className="error">
                This workflow is not configured on the server yet.
              </p>
            )}
            {error && <p className="error">{error}</p>}
            {submitting && <p className="status">Starting generation...</p>}
          </form>

          {activePageId ? (
            <GenerationFeed
              items={items}
              hasMore={hasMore}
              loading={loading}
              loadError={historyError}
              emptyMessage="Your generated results will appear here."
              onLoadMore={loadMore}
              onUpdate={update}
              onDeleted={(generation) =>
                removeWhere((item) => item.id === generation.id)
              }
            />
          ) : null}
        </div>
      ) : null}
      {pickerFor && (
        <LibraryPicker
          pageId={activePageId}
          accept={pickerFor.accept ?? []}
          limit={1}
          onClose={() => setPickerFor(null)}
          onSelect={([item]) => {
            setLibraryFile(pickerFor, item);
            setPickerFor(null);
          }}
        />
      )}
    </AppShell>
  );
}
