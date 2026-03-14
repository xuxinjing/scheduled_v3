import { HistoryDetailShell } from "@/components/history-detail-shell";

type Params = {
  params: Promise<{
    scheduleId: string;
  }>;
};

export default async function HistoryDetailPage({ params }: Params) {
  const { scheduleId } = await params;
  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-5 px-4 pt-8 md:px-0">
      <div className="content-panel rounded-[24px] p-6">
        <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#2563eb]">Run detail</p>
        <h1 className="mt-1 text-[32px] font-semibold tracking-[-0.04em] text-[#111827]">Saved schedule review</h1>
        <p className="mt-2 max-w-[760px] text-[15px] leading-7 text-[#667085]">
          Review one saved run, including warnings, validator output, and downloadable artifacts.
        </p>
      </div>
      <HistoryDetailShell scheduleId={scheduleId} />
    </div>
  );
}
