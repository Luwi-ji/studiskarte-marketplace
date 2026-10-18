import { REPORT_REASONS } from "@/lib/safety/report";
import { ReportButton, type ReportTarget } from "./report-button";

/** The report button for server pages: it hands the list of reasons to the form, which runs in the browser. */
export function ReportControl({ target, label, className }: { target: ReportTarget; label?: string; className?: string }) {
  return <ReportButton target={target} reasons={REPORT_REASONS} label={label} className={className} />;
}
