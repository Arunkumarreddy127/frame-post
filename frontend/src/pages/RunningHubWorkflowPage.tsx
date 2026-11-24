import {
  ArrowLeft,
  ArrowUp,
  ChevronDown,
  FolderOpen,
  Paperclip,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { initialValueFor } from "../components/DynamicInputField";
import { LibraryPicker } from "../components/library/LibraryPicker";
import { GenerationFeed } from "../components/generations/GenerationFeed";
import { getCatalog, getGeneration, startWorkflowGeneration } from "../generationApi";
import { useGenerationPages } from "../hooks/useGenerationPages";
import { errorMessage } from "../creationApi";
import {
  CreationTargetBanner,
  creationQuery,
} from "../components/creations/CreationTargetBanner";
import {
  findSecondsInput,
  latestOutput,
  parseCreationTool,
  secondsForInput,
  useShotTarget,
} from "../components/creations/shotTarget";
import type {
  CreationTool,
  InstanceType,
  MediaItem,
  ShellRouteProps,
  Workflow,
  WorkflowInput,
} from "../types";

function toolForWorkflow(workflow: Workflow): CreationTool {
  return workflow.tool;
}

type RunningHubWorkflowPageProps = ShellRouteProps & {
  pageId?: string;
  workflowKey?: string;
  embedded?: boolean;
  creationId?: string;
  shotId?: string | null;
  sceneId?: string | null;
  shotTool?: CreationTool | null;
  onGenerationTriggered?: () => void;
  onCreationItemAdded?: () => void;
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
  workflowKey: workflowKeyProp,
  embedded = false,
  creationId: creationIdProp,
  shotId: shotIdProp,
  sceneId: sceneIdProp,
  shotTool: shotToolProp,
  onGenerationTriggered,
  onCreationItemAdded,
}: RunningHubWorkflowPageProps) {
  const { pageId: routePageId, workflowKey: routeWorkflowKey = "" } = useParams<{
    pageId?: string;
    workflowKey?: string;
  }>();
  const [searchParams] = useSearchParams();
  const activePageId = pageId ?? routePageId;
  const workflowKey = workflowKeyProp ?? routeWorkflowKey;
  const creationId = creationIdProp ?? searchParams.get("creationId");
  const shotId = embedded ? (shotIdProp ?? null) : searchParams.get("shotId");
  const sceneId = embedded ? (sceneIdProp ?? null) : searchParams.get("sceneId");
  const shotTool = embedded
    ? (shotToolProp ?? null)
    : parseCreationTool(searchParams.get("tool"));
  const shotTarget = useShotTarget(activePageId, creationId, shotId);
  const createPath =
    (activePageId ? `/pages/${activePageId}/create` : "/create") +
    creationQuery(creationId, { shotId, sceneId, tool: shotTool });

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
  const restoredFrom = useRef("");
  const prefilledFor = useRef("");

  useEffect(() => {
    if (!workflow || !shotId || !shotTarget) return;
    const key = `${shotId}:${workflow.key}`;
    if (prefilledFor.current === key) return;
    prefilledFor.current = key;
    const { shot } = shotTarget;

    const promptName = workflow.inputs.find((input) => input.type === "textarea")?.name;
    const brief = shot.brief?.trim();
    if (promptName && brief) {
      setValues((current) => ({
        ...current,
        [promptName]: current[promptName]?.trim() ? current[promptName] : brief,
      }));
    }

    const secondsInput = findSecondsInput(workflow.inputs);
    const seconds = secondsInput ? secondsForInput(secondsInput, shot.durationSeconds) : null;
    if (secondsInput && seconds) {
      setValues((current) => ({ ...current, [secondsInput.name]: seconds }));
    }

    if (toolForWorkflow(workflow) === "VIDEO") {
      const imageInput = workflow.inputs.find((input) => input.type === "image");
      const frame = latestOutput(shot, "IMAGE");
      if (imageInput && frame) {
        setLibraryFiles((current) =>
          current[imageInput.name] ? current : { ...current, [imageInput.name]: frame },
        );
      }
    }
  }, [workflow, shotId, shotTarget]);

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
    Boolean(activePageId && workflow && !embedded),
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

  useEffect(() => {
    const generationId = searchParams.get("from");
    const resultKey = searchParams.get("result");
    const restoreKey = `${generationId ?? ""}:${resultKey ?? ""}`;
    if (!workflow || !generationId || !resultKey || restoredFrom.current === restoreKey) {
      return;
    }
    restoredFrom.current = restoreKey;
    let cancelled = false;
    getGeneration(generationId, activePageId)
      .then((generation) => {
        if (cancelled) return;
        if (
          generation.provider !== "RUNNINGHUB" ||
          generation.workflowKey !== workflowKey
        ) {
          throw new Error("This result belongs to a different workflow.");
        }
        const output = generation.outputs.some((item) => item.key === resultKey);
        const selectedInput = generation.inputFiles.find((item) => item.key === resultKey);
        if (!output && !selectedInput) {
          throw new Error("The selected result is no longer available.");
        }
        setValues((current) => ({ ...current, ...generation.inputs }));
        const restoredInstanceType = INSTANCE_TYPES.find(
          (item) => item.value === generation.instanceType,
        )?.value;
        if (restoredInstanceType) setInstanceType(restoredInstanceType);
        setFiles({});
        setLibraryFiles(
          Object.fromEntries(
            workflow.inputs
              .filter(isFileInput)
              .map((input) => [
                input.name,
                output
                  ? generation.inputFiles.find((item) => item.slot === input.name) ?? null
                  : input.name === selectedInput?.slot
                    ? selectedInput
                    : null,
              ]),
          ),
        );
        setError("");
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Unable to restore this generation");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activePageId, searchParams, workflow, workflowKey]);

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
        {
          creationId,
          shotId,
          sceneId,
          tool: shotId || sceneId ? toolForWorkflow(workflow) : undefined,
        },
      );
      prepend(created);
      onGenerationTriggered?.();
      if (creationId) onCreationItemAdded?.();
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

  const composer = (
    <>
      {!embedded && (
        <>
          <Link to={createPath} className="secondary-button">
            <ArrowLeft size={16} strokeWidth={1.8} aria-hidden="true" />
            Back to Create
          </Link>
          {creationId && (
            <CreationTargetBanner
              pageId={activePageId}
              creationId={creationId}
              shotId={shotId}
              sceneId={sceneId}
              tool={shotId || sceneId ? toolForWorkflow(workflow) : null}
            />
          )}
        </>
      )}
      {loadError ? <p className="status error">{loadError}</p> : null}
      {workflow ? (
        <div className="image-gen-layout">
          <form className="panel image-gen-form" onSubmit={handleSubmit}>
            <h2 className="app-page-title">{workflow.label}</h2>
            <p className="app-page-description">
              Configure inputs and settings to run this workflow.
            </p>
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
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" &&
                        (event.metaKey || event.ctrlKey)
                      ) {
                        event.preventDefault();
                        event.currentTarget.form?.requestSubmit();
                      }
                    }}
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
                    disabled={
                      submitting || !workflow.configured || !activePageId
                    }
                    title="Generate (Ctrl/⌘ + Enter)"
                  >
                    <ArrowUp size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>
            </section>
            {!activePageId && (
              <p className="status form-notice" role="note">
                Open this workflow from a page to generate. Choose a page, then
                Create → {workflow.label}.
              </p>
            )}
            {!workflow.configured && (
              <p className="error">
                This workflow is not configured on the server yet.
              </p>
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            {submitting && (
              <p className="status" role="status">
                Starting generation...
              </p>
            )}
          </form>

          {activePageId && !embedded ? (
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
    </>
  );
  return embedded ? (
    <div className="creation-generator">{composer}</div>
  ) : (
    <AppShell
      user={user}
      onLogout={onLogout}
      pageTitle={workflow?.label ?? "RunningHub workflow"}
      sidebar={activePageId ? "page" : "global"}
      pageId={activePageId}
      backTo={createPath}
    >
      {composer}
    </AppShell>
  );
}
