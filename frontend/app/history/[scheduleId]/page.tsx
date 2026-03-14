import { HistoryDetailShell } from "@/components/history-detail-shell";

type Params = {
  params: Promise<{
    scheduleId: string;
  }>;
};

export default async function HistoryDetailPage({ params }: Params) {
  const { scheduleId } = await params;
  return <HistoryDetailShell scheduleId={scheduleId} />;
}
