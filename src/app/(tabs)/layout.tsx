import { WithTabBar } from "@/components/tab-bar";

/** Pages reached from the bottom tabs. Content stops above the tab bar and the home bar. */
export default function TabsLayout({ children }: LayoutProps<"/">) {
  return <WithTabBar>{children}</WithTabBar>;
}
