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
  onTranscriptPreview?: (text: string) => void;
  onError?: (message: string) => void;
  autoStart?: boolean;
  variant?: "inline" | "fullscreen";
};

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

export function VoiceInput({
  disabled,
  onTranscript,
  onRecordingStateChange,
  onTranscriptPreview,
  onError,
  autoStart = false,
  variant = "inline",
}: VoiceInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [bars, setBars] = useState<number[]>([0.18, 0.24, 0.28, 0.22, 0.2, 0.16]);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const autoStartLockRef = useRef(false);

  useEffect(() => {
    onRecordingStateChange?.({ isRecording, isTranscribing });
  }, [isRecording, isTranscribing, onRecordingStateChange]);

  useEffect(() => {
    if (!autoStart) {
      autoStartLockRef.current = false;
      return;
    }
    if (autoStartLockRef.current || isRecording || isTranscribing || disabled) {
      return;
    }
    autoStartLockRef.current = true;
    void startRecording().catch((error) => {
      onError?.(error instanceof Error ? error.message : "Unable to start microphone");
    });
  }, [autoStart, disabled, isRecording, isTranscribing, onError]);

  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      audioContextRef.current?.close().catch(() => undefined);
      recognitionRef.current?.stop();
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
    onTranscriptPreview?.("");

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

    const SpeechRecognitionCtor =
      typeof window !== "undefined"
        ? ((window as Window & { SpeechRecognition?: new () => BrowserSpeechRecognition; webkitSpeechRecognition?: new () => BrowserSpeechRecognition })
            .SpeechRecognition ??
            (window as Window & { webkitSpeechRecognition?: new () => BrowserSpeechRecognition }).webkitSpeechRecognition)
        : undefined;

    if (SpeechRecognitionCtor) {
      const recognition = new SpeechRecognitionCtor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      recognition.onresult = (event) => {
        const text = Array.from(event.results)
          .map((result) => result[0]?.transcript ?? "")
          .join(" ")
          .trim();
        onTranscriptPreview?.(text);
      };
      recognition.onerror = (event) => {
        if (event.error !== "no-speech" && event.error !== "aborted") {
          onError?.(`Speech recognition error: ${event.error}`);
        }
      };
      recognition.onend = () => {
        recognitionRef.current = null;
      };
      recognitionRef.current = recognition;
      recognition.start();
    }

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    recorder.onstop = async () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      recognitionRef.current?.stop();
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
        onTranscriptPreview?.(payload.text);
        await onTranscript(payload.text);
        onTranscriptPreview?.("");
      } catch (error) {
        onError?.(error instanceof Error ? error.message : "Transcription failed");
        throw error;
      } finally {
        setIsTranscribing(false);
      }
    };

    recorder.start();
    setIsRecording(true);
  }

  function stopRecording() {
    recognitionRef.current?.stop();
    recorderRef.current?.stop();
    setIsRecording(false);
  }

  if (variant === "fullscreen") {
    return (
      <div className="flex flex-col items-center justify-center">
        <div className="flex h-[160px] w-[160px] items-center justify-center rounded-full bg-white/48 backdrop-blur-xl shadow-[0_24px_60px_rgba(15,23,42,0.10)]">
          <Button
            type="button"
            size="icon"
            disabled={disabled || isTranscribing}
            onClick={isRecording ? stopRecording : startRecording}
            className={cn(
              "h-[108px] w-[108px] rounded-full border-[#d7dfed] bg-white/82 text-[#0f172a] shadow-[0_14px_30px_rgba(15,23,42,0.08)] hover:bg-white",
              isRecording && "border-[hsl(var(--danger))] bg-[hsl(var(--danger))] text-white hover:bg-[hsl(var(--danger))]",
            )}
          >
            {isRecording ? <Square className="h-9 w-9" /> : <Mic className="h-9 w-9" />}
          </Button>
        </div>

        <div className="mt-8 flex items-end gap-2">
          {bars.map((bar, index) => (
            <span
              key={index}
              className={cn(
                "w-2 rounded-full bg-[hsl(var(--primary))] transition-all duration-150",
                isRecording ? "opacity-100" : "opacity-45",
              )}
              style={{ height: `${20 + bar * 48}px` }}
            />
          ))}
        </div>

        <p className="mt-8 text-[26px] font-semibold tracking-[-0.03em] text-[#111827]">
          {isRecording ? "Listening..." : isTranscribing ? "Transcribing..." : "Ready to record"}
        </p>
        <p className="mt-2 text-center text-[15px] text-[#667085]">
          {isRecording ? "Speak naturally. Tap the center button when you are done." : "We will turn your voice note into schedule instructions."}
        </p>
      </div>
    );
  }

  return (
    <div className="apple-panel flex-1 rounded-[24px] p-4">
      <div className="flex items-center gap-4">
        <Button
          type="button"
          size="icon"
          disabled={disabled || isTranscribing}
          onClick={isRecording ? stopRecording : startRecording}
          className={cn(
            "h-[60px] w-[60px] rounded-full border-[#dbe2ec] bg-[#dde3ee] text-[#0f172a] shadow-none hover:bg-[#d6dde8]",
            isRecording && "border-[hsl(var(--danger))] bg-[hsl(var(--danger))] hover:bg-[hsl(var(--danger))]",
          )}
        >
          {isRecording ? <Square className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </Button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#111827]">
            {isRecording ? "Listening now" : isTranscribing ? "Transcribing audio" : "Speak the weekly changes"}
          </p>
          <p className="mt-1 text-sm text-[#667085]">
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
