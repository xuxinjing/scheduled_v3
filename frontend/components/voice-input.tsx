"use client";

import { Mic, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { DEFAULT_TRANSCRIBE_MODEL } from "@/lib/whisper";
import { cn } from "@/lib/utils";

type VoiceInputProps = {
  disabled?: boolean;
  onTranscript: (text: string) => Promise<void> | void;
  onRecordingStateChange?: (state: { isRecording: boolean; isTranscribing: boolean }) => void;
};

export function VoiceInput({ disabled, onTranscript, onRecordingStateChange }: VoiceInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [bars, setBars] = useState<number[]>([0.18, 0.24, 0.28, 0.22, 0.2, 0.16]);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    onRecordingStateChange?.({ isRecording, isTranscribing });
  }, [isRecording, isTranscribing, onRecordingStateChange]);

  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      audioContextRef.current?.close().catch(() => undefined);
    };
  }, []);

  async function startRecording() {
    if (disabled || isRecording || isTranscribing) {
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";
    const recorder = new MediaRecorder(stream, { mimeType });

    streamRef.current = stream;
    recorderRef.current = recorder;
    chunksRef.current = [];

    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    analyser.fftSize = 64;
    audioContextRef.current = audioContext;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(dataArray);
      const next = Array.from({ length: 6 }, (_, index) => {
        const slice = dataArray.slice(index * 5, index * 5 + 5);
        const avg = slice.reduce((sum, value) => sum + value, 0) / Math.max(slice.length, 1);
        return Math.max(0.16, avg / 255);
      });
      setBars(next);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    recorder.onstop = async () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      setBars([0.18, 0.24, 0.28, 0.22, 0.2, 0.16]);
      stream.getTracks().forEach((track) => track.stop());
      await audioContext.close().catch(() => undefined);
      const audioBlob = new Blob(chunksRef.current, { type: mimeType });
      const formData = new FormData();
      formData.append("file", audioBlob, "chef-note.webm");
      formData.append("model", DEFAULT_TRANSCRIBE_MODEL);
      setIsTranscribing(true);
      try {
        const response = await fetch("/api/transcribe", {
          method: "POST",
          body: formData,
        });
        const payload = (await response.json()) as { text?: string; error?: string };
        if (!response.ok || !payload.text) {
          throw new Error(payload.error || "Transcription failed");
        }
        await onTranscript(payload.text);
      } finally {
        setIsTranscribing(false);
      }
    };

    recorder.start();
    setIsRecording(true);
  }

  function stopRecording() {
    recorderRef.current?.stop();
    setIsRecording(false);
  }

  return (
    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--secondary))]/45 p-4">
      <div className="flex items-center gap-4">
        <Button
          type="button"
          size="icon"
          disabled={disabled || isTranscribing}
          onClick={isRecording ? stopRecording : startRecording}
          className={cn(
            "h-14 w-14 rounded-2xl shadow-none",
            isRecording && "border-[hsl(var(--danger))] bg-[hsl(var(--danger))] hover:bg-[hsl(var(--danger))]",
          )}
        >
          {isRecording ? <Square className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </Button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[hsl(var(--foreground))]">
            {isRecording ? "Listening now" : isTranscribing ? "Transcribing audio" : "Tap and speak the week naturally"}
          </p>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            {isRecording
              ? "Tap again to stop."
              : "Example: CDC is back, Chef is off Tuesday, Thursday through Saturday are peak."}
          </p>
          <div className="mt-3 flex items-end gap-1.5">
            {bars.map((bar, index) => (
              <span
                key={index}
                className={cn(
                  "w-1.5 rounded-full bg-[hsl(var(--primary))] transition-all duration-150",
                  isRecording ? "opacity-100" : "opacity-55",
                )}
                style={{ height: `${12 + bar * 26}px` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
