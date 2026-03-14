import { NextResponse } from "next/server";

import { getBackendUrl } from "@/lib/env";

type Params = {
  params: Promise<{
    scheduleId: string;
    artifactName: string;
  }>;
};

export async function GET(_: Request, { params }: Params) {
  try {
    const { scheduleId, artifactName } = await params;
    const response = await fetch(
      `${getBackendUrl()}/api/schedule/${scheduleId}/artifacts/${artifactName}`,
      {
        cache: "no-store",
      },
    );

    if (!response.body) {
      return NextResponse.json({ error: "Artifact download failed" }, { status: 502 });
    }

    const headers = new Headers();
    headers.set("Content-Type", response.headers.get("content-type") || "application/octet-stream");
    const disposition = response.headers.get("content-disposition");
    if (disposition) {
      headers.set("Content-Disposition", disposition);
    }

    return new Response(response.body, {
      status: response.status,
      headers,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Artifact download failed" },
      { status: 500 },
    );
  }
}
