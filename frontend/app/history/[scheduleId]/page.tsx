import { HistoryDetailShell } from "@/components/history-detail-shell";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Params = {
  params: Promise<{
    scheduleId: string;
  }>;
};

export default async function HistoryDetailPage({ params }: Params) {
  const { scheduleId } = await params;
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Schedule detail</CardTitle>
          <CardDescription>
            Review one saved run, including warnings, validator output, and downloadable artifacts.
          </CardDescription>
        </CardHeader>
      </Card>
      <HistoryDetailShell scheduleId={scheduleId} />
    </div>
  );
}
