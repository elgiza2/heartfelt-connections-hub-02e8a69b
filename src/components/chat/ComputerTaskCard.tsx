/**
 * @doc Silent in-chat surface for a Computer Agent task.
 *
 * Deliberately chrome-less: while the computer works it is a single quiet
 * progress line — no labels, no icons, no buttons. The narration lives in the
 * thinking trace above it, so this surface only carries what the task actually
 * produced (text + files) once it is finished.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  computerErrorMessage,
  pollComputerTask,
  stopComputerTask,
  type ComputerTask,
  type ComputerEvent,
} from "@/lib/computer/client";
import ThinkingTrace from "@/components/chat/ThinkingTrace";
import ChatMessage from "@/components/chat/ChatMessage";

import { clearActiveComputerRun, setActiveComputerRun } from "@/lib/computer/activeRun";

interface Props {
  taskId: string;
}

const POLL_MS = 3000;
const TASK_TIMEOUT_MS = 15 * 60 * 1000;

export default function ComputerTaskCard({ taskId }: Props) {
  const [task, setTask] = useState<ComputerTask | null>(null);
  const [events, setEvents] = useState<ComputerEvent[]>([]);
  const [timedOut, setTimedOut] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const deadline = Date.now() + TASK_TIMEOUT_MS;

    const tick = async () => {
      try {
        if (Date.now() >= deadline) {
          setTimedOut(true);
          clearActiveComputerRun(taskId);
          await stopComputerTask(taskId).catch(() => undefined);
          return;
        }
        const res = await pollComputerTask(taskId);
        if (cancelled) return;
        setTask(res.task);
        setEvents(res.events ?? []);
        const finished = res.task.status === "done" || res.task.status === "failed";
        if (finished) clearActiveComputerRun(taskId);
        else {
          setActiveComputerRun(taskId);
          timer.current = setTimeout(tick, POLL_MS);
        }
      } catch {
        if (!cancelled) timer.current = setTimeout(tick, POLL_MS * 2);
      }
    };
    void tick();

    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
      clearActiveComputerRun(taskId);
    };
  }, [taskId]);

  const running = !timedOut && (!task || task.status === "pending" || task.status === "running");
  const files = task?.files ?? [];
  const traceSteps = useMemo(() => events.map((event) => event.title).filter(Boolean), [events]);
  const traceText = useMemo(
    () => events.map((event) => event.detail).filter((value): value is string => !!value).join("\n\n"),
    [events],
  );
  const liveUrl = task?.live_url ? `${task.live_url}${task.live_url.includes("?") ? "&" : "?"}view_only=true` : null;

  if (running) {
    return (
      <div className="my-2 flex flex-col gap-2.5">
        <ThinkingTrace
          active
          status={task?.progress || events.at(-1)?.title || ""}
          steps={traceSteps}
          text={traceText}
          tool="browser"
          className="mb-0"
        />
        <div className="overflow-hidden rounded-2xl border border-border/40 bg-foreground/[0.04]">
          <div className="relative aspect-[16/10] w-full">
            {liveUrl ? (
              <iframe
                src={liveUrl}
                title="Megsy Computer"
                className="absolute inset-0 h-full w-full border-0"
                allow="clipboard-read; clipboard-write"
                sandbox="allow-scripts allow-same-origin allow-forms"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-foreground/[0.06] via-foreground/[0.02] to-transparent motion-safe:animate-pulse" />
            )}
          </div>
        </div>
      </div>
    );
  }

  if (timedOut || task?.status === "failed") {
    return (
      <p className="my-2 text-[13px] leading-relaxed text-destructive">
        {timedOut ? "المهمة استغرقت وقتًا أطول من المتوقع وتم إيقافها." : computerErrorMessage(task.error)}
      </p>
    );
  }

  if (!task?.result_text && files.length === 0) return null;

  return (
    <div className="my-1">
      {task?.result_text && <ChatMessage role="assistant" content={task.result_text} />}


      {files.length > 0 && (
        <div className="mt-2 space-y-2">
          {files.map((f) => {
            const isImage = /\.(png|jpe?g|webp|gif|avif)$/i.test(f.url) || f.type?.startsWith("image/");
            const isVideo = /\.(mp4|webm|mov)$/i.test(f.url) || f.type?.startsWith("video/");
            return (
              <div key={f.url} className="overflow-hidden rounded-xl border border-border/40">
                {isImage ? (
                  <img src={f.url} alt={f.name} loading="lazy" className="max-h-64 w-full object-cover" />
                ) : isVideo ? (
                  <video src={f.url} controls className="max-h-64 w-full" />
                ) : (
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate px-3 py-2 text-[12.5px] text-foreground/85 hover:bg-foreground/5"
                  >
                    {f.name}
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
