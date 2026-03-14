import { HistoryList } from "@/components/history-list";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function HistoryPage() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
          <CardDescription>
            Open any previous week, download the workbook, or inspect validation details.
          </CardDescription>
        </CardHeader>
      </Card>
      <HistoryList />
    </div>
  );
}
