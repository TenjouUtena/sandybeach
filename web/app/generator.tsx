"use client";

import { useState } from "react";
import useSWR from "swr";

type Kind = "t2i" | "i2i";

type JobStatus = {
  id: string;
  kind: Kind;
  status: "PENDING" | "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  error: string | null;
  outputUrl: string | null;
  prompt: string;
  createdAt: string;
  completedAt: string | null;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function Generator() {
  const [kind, setKind] = useState<Kind>("t2i");
  const [jobId, setJobId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <Tabs kind={kind} onChange={setKind} />
      {kind === "t2i" ? (
        <T2IForm onSubmitted={setJobId} />
      ) : (
        <I2IForm onSubmitted={setJobId} />
      )}
      {jobId && <JobPanel jobId={jobId} />}
    </div>
  );
}

function Tabs({
  kind,
  onChange,
}: {
  kind: Kind;
  onChange: (k: Kind) => void;
}) {
  const base =
    "px-4 py-2 text-sm font-medium border-b-2 transition-colors";
  return (
    <div className="flex border-b border-zinc-200 dark:border-zinc-800">
      <button
        type="button"
        onClick={() => onChange("t2i")}
        className={
          base +
          (kind === "t2i"
            ? " border-zinc-900 dark:border-zinc-100"
            : " border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100")
        }
      >
        Text → Image
      </button>
      <button
        type="button"
        onClick={() => onChange("i2i")}
        className={
          base +
          (kind === "i2i"
            ? " border-zinc-900 dark:border-zinc-100"
            : " border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100")
        }
      >
        Image → Image
      </button>
    </div>
  );
}

type CommonState = {
  prompt: string;
  negative: string;
  steps: number;
  guidance: number;
  seed: string;
  width: string;
  height: string;
  loraScale: number;
};

const defaults: CommonState = {
  prompt: "",
  negative: "",
  steps: 35,
  guidance: 5.0,
  seed: "",
  width: "",
  height: "",
  loraScale: 0.8,
};

function CommonFields({
  state,
  setState,
  disabled,
}: {
  state: CommonState;
  setState: (s: CommonState) => void;
  disabled: boolean;
}) {
  return (
    <>
      <Field label="Prompt">
        <textarea
          required
          rows={3}
          value={state.prompt}
          onChange={(e) => setState({ ...state, prompt: e.target.value })}
          disabled={disabled}
          className="input"
        />
      </Field>
      <Field label="Negative prompt">
        <textarea
          rows={2}
          value={state.negative}
          onChange={(e) => setState({ ...state, negative: e.target.value })}
          disabled={disabled}
          className="input"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Steps">
          <input
            type="number"
            value={state.steps}
            onChange={(e) =>
              setState({ ...state, steps: Number(e.target.value) })
            }
            min={1}
            max={100}
            disabled={disabled}
            className="input"
          />
        </Field>
        <Field label="Guidance">
          <input
            type="number"
            step="0.1"
            value={state.guidance}
            onChange={(e) =>
              setState({ ...state, guidance: Number(e.target.value) })
            }
            disabled={disabled}
            className="input"
          />
        </Field>
        <Field label="LoRA scale">
          <input
            type="number"
            step="0.05"
            value={state.loraScale}
            onChange={(e) =>
              setState({ ...state, loraScale: Number(e.target.value) })
            }
            disabled={disabled}
            className="input"
          />
        </Field>
        <Field label="Seed">
          <input
            type="text"
            placeholder="random"
            value={state.seed}
            onChange={(e) => setState({ ...state, seed: e.target.value })}
            disabled={disabled}
            className="input"
          />
        </Field>
        <Field label="Width">
          <input
            type="text"
            placeholder="auto"
            value={state.width}
            onChange={(e) => setState({ ...state, width: e.target.value })}
            disabled={disabled}
            className="input"
          />
        </Field>
        <Field label="Height">
          <input
            type="text"
            placeholder="auto"
            value={state.height}
            onChange={(e) => setState({ ...state, height: e.target.value })}
            disabled={disabled}
            className="input"
          />
        </Field>
      </div>
    </>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </span>
      {children}
    </label>
  );
}

function paramsFromState(s: CommonState, extra: { strength?: number } = {}) {
  const intOrNull = (v: string) => (v.trim() === "" ? null : Number(v));
  return {
    steps: s.steps,
    guidance: s.guidance,
    seed: intOrNull(s.seed),
    width: intOrNull(s.width),
    height: intOrNull(s.height),
    loraScale: s.loraScale,
    ...extra,
  };
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`${r.status}: ${t}`);
  }
  return r.json();
}

function T2IForm({ onSubmitted }: { onSubmitted: (id: string) => void }) {
  const [state, setState] = useState<CommonState>(defaults);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { jobId } = await postJson<{ jobId: string }>("/api/jobs", {
        kind: "t2i",
        prompt: state.prompt,
        negativePrompt: state.negative,
        params: paramsFromState(state),
      });
      onSubmitted(jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <CommonFields
        state={state}
        setState={setState}
        disabled={submitting}
      />
      <SubmitButton submitting={submitting} label="Generate" />
      {error && <ErrorBox message={error} />}
    </form>
  );
}

function I2IForm({ onSubmitted }: { onSubmitted: (id: string) => void }) {
  const [state, setState] = useState<CommonState>(defaults);
  const [strength, setStrength] = useState(0.9);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file) {
      setError("pick an input image");
      return;
    }
    setSubmitting(true);
    try {
      const { key, uploadUrl } = await postJson<{
        key: string;
        uploadUrl: string;
      }>("/api/uploads/init-input", {
        contentType: file.type,
        sizeBytes: file.size,
      });
      const put = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!put.ok) {
        throw new Error(`upload failed: ${put.status}`);
      }
      const { jobId } = await postJson<{ jobId: string }>("/api/jobs", {
        kind: "i2i",
        prompt: state.prompt,
        negativePrompt: state.negative,
        inputR2Key: key,
        params: paramsFromState(state, { strength }),
      });
      onSubmitted(jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Input image">
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          disabled={submitting}
          className="text-sm"
        />
      </Field>
      <CommonFields
        state={state}
        setState={setState}
        disabled={submitting}
      />
      <Field label={`Strength (${strength.toFixed(2)})`}>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={strength}
          onChange={(e) => setStrength(Number(e.target.value))}
          disabled={submitting}
          className="w-full"
        />
      </Field>
      <SubmitButton submitting={submitting} label="Transform" />
      {error && <ErrorBox message={error} />}
    </form>
  );
}

function SubmitButton({
  submitting,
  label,
}: {
  submitting: boolean;
  label: string;
}) {
  return (
    <button
      type="submit"
      disabled={submitting}
      className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
    >
      {submitting ? "Submitting…" : label}
    </button>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
      {message}
    </div>
  );
}

function JobPanel({ jobId }: { jobId: string }) {
  const { data, error } = useSWR<JobStatus>(
    `/api/jobs/${jobId}`,
    fetcher,
    {
      refreshInterval: (latest) =>
        latest && (latest.status === "COMPLETED" || latest.status === "FAILED")
          ? 0
          : 2500,
    },
  );

  if (error) return <ErrorBox message={String(error)} />;
  if (!data) return <div className="text-sm text-zinc-500">Loading…</div>;

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-xs font-mono text-zinc-500">job {data.id}</div>
        <StatusBadge status={data.status} />
      </div>
      {data.status === "FAILED" && (
        <ErrorBox message={data.error ?? "failed"} />
      )}
      {data.status === "COMPLETED" && data.outputUrl && (
        <div className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={data.outputUrl}
            alt={data.prompt}
            className="w-full rounded border border-zinc-200 dark:border-zinc-800"
          />
          <a
            href={data.outputUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-zinc-500 underline"
          >
            open original
          </a>
        </div>
      )}
      {data.status !== "COMPLETED" && data.status !== "FAILED" && (
        <div className="flex h-64 items-center justify-center text-sm text-zinc-500">
          waiting on runpod… (cold starts can take 3–6 min)
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: JobStatus["status"] }) {
  const color =
    status === "COMPLETED"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
      : status === "FAILED"
        ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
        : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
  return (
    <span
      className={
        "rounded-full px-2 py-0.5 text-xs font-medium " + color
      }
    >
      {status}
    </span>
  );
}
