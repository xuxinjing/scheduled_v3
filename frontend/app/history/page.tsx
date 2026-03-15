import { HistoryList } from "@/components/history-list";

export default function HistoryPage() {
  return (
    <div className="mx-auto w-full max-w-[860px] space-y-4 pt-8">
      <div className="px-1">
        <h1 className="text-[28px] font-bold tracking-[-0.02em] text-[#1d1d1f]">History</h1>
        <p className="mt-1 text-[15px] text-[#86868b]">
          Open any previous week, download the workbook, or inspect details.
        </p>
      </div>
      <HistoryList />
    </div>
  );
}
