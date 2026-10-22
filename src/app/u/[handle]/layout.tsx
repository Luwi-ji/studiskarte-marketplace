import type { ReactNode } from "react";
import { WithTabBar } from "@/components/tab-bar";

/** Profiles keep the tab bar, so "Me" (your own profile) stays one tap from everything else. */
export default function ProfileLayout({ children }: { children: ReactNode }) {
  return <WithTabBar>{children}</WithTabBar>;
}
