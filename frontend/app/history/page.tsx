import { HistoryList } from "@/components/history-list";

export default function HistoryPage() {
  return (
    <div className="mx-auto w-full max-w-[1040px] space-y-5 px-4 pt-8 md:px-0">
      <div className="content-panel rounded-[24px] p-6">
        <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#2563eb]">History</p>
        <h1 className="mt-1 text-[32px] font-semibold tracking-[-0.04em] text-[#111827]">Previous schedule runs</h1>
        <p className="mt-2 max-w-[760px] text-[15px] leading-7 text-[#667085]">
          Open any previous week, download the workbook, or inspect validation details.
        </p>
      </div>
      <HistoryList />
    </div>
  );
}
