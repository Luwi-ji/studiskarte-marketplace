"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { canGoBackInApp } from "@/components/page-header";

export const EDIT_PROFILE = "/me/settings/profile";

export type ProfileInitial = {
  displayName: string;
  handle: string;
  pictureUrl: string | null;
  /** When the handle may be changed again, already formatted, or null if it may be changed now. */
  handleChangeOn: string | null;
};

type Draft = {
  initial: ProfileInitial;
  /** What the student has staged (or the saved value when nothing is staged). Nothing here is on the server until Save. */
  name: string;
  handle: string;
  /** The staged picture and a local link to show it by. */
  picture: { blob: Blob; previewUrl: string } | null;
  setName: (name: string) => void;
  setHandle: (handle: string) => void;
  setPicture: (blob: Blob | null) => void;
  nameChanged: boolean;
  handleChanged: boolean;
  dirty: boolean;
};

const DraftContext = createContext<Draft | null>(null);

/** The handle as the server stores it: no @, lowercase, trimmed. */
export function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^@/, "").toLowerCase();
}

/**
 * Holds the Edit profile page's unsaved changes while the student moves between it and the Display name and Handle
 * pages. It lives in the layout of /me/settings/profile, so it survives those navigations and is gone when the student
 * leaves the section.
 */
export function DraftProvider({ initial, children }: { initial: ProfileInitial; children: ReactNode }) {
  const [stagedName, setName] = useState<string | null>(null);
  const [stagedHandle, setHandle] = useState<string | null>(null);
  const [picture, setPictureState] = useState<Draft["picture"]>(null);
  const previewUrl = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    },
    [],
  );

  const setPicture = useCallback((blob: Blob | null) => {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = blob ? URL.createObjectURL(blob) : null;
    setPictureState(blob && previewUrl.current ? { blob, previewUrl: previewUrl.current } : null);
  }, []);

  const value = useMemo<Draft>(() => {
    const name = stagedName ?? initial.displayName;
    const handle = stagedHandle ?? initial.handle;
    const nameChanged = name.trim() !== initial.displayName;
    const handleChanged = normalizeHandle(handle) !== initial.handle;
    return { initial, name, handle, picture, setName, setHandle, setPicture, nameChanged, handleChanged, dirty: nameChanged || handleChanged || picture !== null };
  }, [initial, stagedName, stagedHandle, picture, setPicture]);

  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

export function useDraft(): Draft {
  const draft = useContext(DraftContext);
  if (!draft) throw new Error("useDraft outside the Edit profile layout");
  return draft;
}

/** Goes back one page, or to `fallback` when the page was opened directly (a reload, a link). */
export function useLeave(fallback: string): () => void {
  const router = useRouter();
  return useCallback(() => {
    if (canGoBackInApp()) router.back();
    else router.replace(fallback);
  }, [router, fallback]);
}
