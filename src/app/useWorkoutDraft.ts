import { useEffect, useRef, useState } from "react";
import { workoutSchema, type Workout } from "../domain/schema";
import { storageNamespace } from "../storage/db";
import {
  readDraft,
  writeDraft,
  clearDraft,
  advanceDraftBase,
} from "../storage/workout-draft";
export function useWorkoutDraft(
  id: string,
  existing: Workout | undefined,
  create: () => Workout,
  onSave: (w: Workout, expected: string) => Promise<boolean>,
) {
  const namespace = useRef(storageNamespace()).current;
  const [tabId] = useState(() => {
    try {
      const token =
        sessionStorage.getItem("pet-draft-tab") ?? crypto.randomUUID();
      sessionStorage.setItem("pet-draft-tab", token);
      return token;
    } catch {
      return "storage-unavailable";
    }
  });
  const draftId = namespace + ":" + tabId + ":" + id;
  const [initial] = useState(() => {
    try {
      const draft = readDraft(localStorage, draftId);
      if (draft) {
        // Refresh can interrupt draft cleanup after the durable save succeeds.
        // Identical content with a newer save time needs no conflict review.
        if (
          existing &&
          JSON.stringify({
            ...existing,
            updatedAt: draft.workout.updatedAt,
          }) === JSON.stringify(draft.workout)
        )
          draft.base = JSON.stringify(existing);
        return { ...draft, restored: true, error: "" };
      }
    } catch {
      return {
        workout: existing ?? create(),
        base: JSON.stringify(existing ?? null),
        restored: false,
        error:
          "Could not restore the local draft. Export your stored backup before clearing browser data.",
      };
    }
    return {
      workout: existing ?? create(),
      base: JSON.stringify(existing ?? null),
      restored: false,
      error: "",
    };
  });
  const [w, setW] = useState(initial.workout),
    [message, setMessage] = useState(
      initial.restored ? "Restored unfinished entry" : "",
    ),
    [error, setError] = useState(initial.error),
    [remoteChanged, setRemoteChanged] = useState(
      initial.restored && initial.base !== JSON.stringify(existing ?? null),
    ),
    [revision, setRevision] = useState(0);
  const latest = useRef(w),
    base = useRef(initial.base),
    dirty = useRef(initial.restored),
    busy = useRef(false),
    inFlight = useRef<string | null>(null),
    mounted = useRef(true),
    saveCallback = useRef(onSave);
  saveCallback.current = onSave;
  const flush = useRef<() => void>(() => {});
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      flush.current();
    };
  }, []);
  function persist(next: Workout) {
    try {
      writeDraft(localStorage, draftId, next, base.current);
      setError("");
    } catch {
      setError(
        "Local draft could not be saved. Keep this page open and export this entry.",
      );
    }
  }
  function update(change: Partial<Workout> | ((w: Workout) => Workout)) {
    const next =
      typeof change === "function"
        ? change(latest.current)
        : { ...latest.current, ...change };
    latest.current = next;
    dirty.current = true;
    persist(next);
    setW(next);
    setMessage("Saving…");
  }
  const signature = JSON.stringify(existing ?? null);
  useEffect(() => {
    if (signature === base.current || signature === inFlight.current) return;
    if (dirty.current) {
      setRemoteChanged(true);
      return;
    }
    base.current = signature;
    if (existing) {
      latest.current = existing;
      setW(existing);
    }
  }, [signature]);
  async function save() {
    if (busy.current || remoteChanged || namespace !== storageNamespace())
      return;
    busy.current = true;
    const snapshot = latest.current,
      previous = base.current;
    let next = snapshot;
    let ok = false;
    try {
      // Storage parses records into schema order. Track that same representation
      // so our own save cannot look like an incoming edit after adding a field.
      next = workoutSchema.parse({
        ...snapshot,
        updatedAt: new Date().toISOString(),
      });
      inFlight.current = JSON.stringify(next);
      ok = await saveCallback.current(next, previous);
    } catch {
      ok = false;
    }
    if (ok) {
      base.current = JSON.stringify(next);
      if (latest.current === snapshot) {
        dirty.current = false;
        latest.current = next;
        if (mounted.current) setW(next);
        try {
          clearDraft(localStorage, draftId, snapshot);
        } catch {
          /* The durable workout is already saved. */
        }
      } else {
        try {
          advanceDraftBase(
            localStorage,
            draftId,
            latest.current,
            previous,
            base.current,
          );
        } catch {
          if (mounted.current)
            setError(
              "Latest changes could not be retained locally. Export this entry.",
            );
        }
      }
      if (mounted.current) {
        setMessage(dirty.current ? "Saving…" : "Saved on this device");
        setError("");
      }
    } else if (mounted.current) {
      setMessage("");
      setError("Save failed. Your entry is retained; retry or export it.");
    }
    inFlight.current = null;
    busy.current = false;
    if (ok && dirty.current && mounted.current) setRevision((v) => v + 1);
  }
  useEffect(() => {
    if (!dirty.current || remoteChanged) return;
    const timer = setTimeout(() => void save(), 600);
    return () => clearTimeout(timer);
  }, [w, revision, remoteChanged]);
  flush.current = () => {
    if (dirty.current) void save();
  };
  function acceptIncomingBase() {
    base.current = signature;
    setRemoteChanged(false);
    persist(latest.current);
    setRevision((v) => v + 1);
  }
  return { w, update, save, message, error, remoteChanged, acceptIncomingBase };
}
