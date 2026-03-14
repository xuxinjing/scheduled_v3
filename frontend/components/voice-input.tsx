"use client";

import { Mic, Square, Waves } from "lucide-react";
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
  const [bars, setBars] = useState<number[]>([0.25, 0.4, 0.55, 0.35, 0.6, 0.45]);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
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
    analyserRef.current = analyser;
    audioContextRef.current = audioContext;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(dataArray);
      const next = Array.from({ length: 6 }, (_, index) => {
        const slice = dataArray.slice(index * 5, index * 5 + 5);
        const avg = slice.reduce((sum, value) => sum + value, 0) / Math.max(slice.length, 1);
        return Math.max(0.18, avg / 255);
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
      setBars([0.2, 0.32, 0.48, 0.34, 0.42, 0.26]);
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
    <div className="rounded-[1.75rem] border border-[hsl(var(--border))] bg-white/80 p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-[hsl(var(--muted-foreground))]">Voice capture</p>
          <p className="text-sm text-[hsl(var(--foreground))]">
            {isRecording ? "Recording chef notes..." : isTranscribing ? "Transcribing..." : "Tap to speak naturally"}
          </p>
        </div>
        <Button
          type="button"
          size="icon"
          disabled={disabled || isTranscribing}
          onClick={isRecording ? stopRecording : startRecording}
          className={cn(
            "h-14 w-14 shadow-glow",
            isRecording && "bg-[hsl(var(--danger))] hover:bg-[hsl(var(--danger))]",
          )}
        >
          {isRecording ? <Square className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </Button>
      </div>
      <div className="flex items-end gap-2 rounded-full bg-[hsl(var(--muted))] px-3 py-3">
        <Waves className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
        {bars.map((bar, index) => (
          <span
            key={index}
            className={cn("w-2 rounded-full bg-[hsl(var(--primary))] transition-all", isRecording && "animate-wave")}
            style={{
              height: `${20 + bar * 28}px`,
              animationDelay: `${index * 0.08}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
