import OpenAI from "openai";
import { NextResponse } from "next/server";

import { DEFAULT_TRANSCRIBE_MODEL } from "@/lib/whisper";

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Audio file is required" }, { status: 400 });
    }

    const model = String(formData.get("model") || process.env.TRANSCRIBE_MODEL || DEFAULT_TRANSCRIBE_MODEL);
    const language = formData.get("language");
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const transcript = await client.audio.transcriptions.create({
      file,
      model,
      ...(typeof language === "string" && language ? { language } : {}),
    });

    return NextResponse.json({ text: transcript.text, model });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Transcription failed" },
      { status: 500 },
    );
  }
}
