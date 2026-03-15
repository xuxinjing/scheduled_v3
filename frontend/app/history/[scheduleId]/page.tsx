import { HistoryDetailShell } from "@/components/history-detail-shell";

type Params = {
  params: Promise<{
    scheduleId: string;
  }>;
};

export default async function HistoryDetailPage({ params }: Params) {
  const { scheduleId } = await params;
  return (
    <div className="mx-auto w-full max-w-[860px] space-y-4 pt-8">
      <div className="px-1">
        <h1 className="text-[28px] font-bold tracking-[-0.02em] text-[#1d1d1f]">Run detail</h1>
        <p className="mt-1 text-[15px] text-[#86868b]">
          Review warnings, validator output, and downloadable artifacts.
        </p>
      </div>
      <HistoryDetailShell scheduleId={scheduleId} />
    </div>
  );
}
