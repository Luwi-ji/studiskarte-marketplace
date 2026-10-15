import { BottomNav } from "@/components/bottom-nav";

/** Pages reached from the bottom tabs. Content stops above the tab bar and the home bar. */
export default function TabsLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <div className="flex flex-1 flex-col pb-[calc(4rem+env(safe-area-inset-bottom))]">{children}</div>
      <BottomNav />
    </>
  );
}
