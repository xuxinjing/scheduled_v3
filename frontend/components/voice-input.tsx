"use client";

import { Mic, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";

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
    if (autoStartLockRef.current || isRecording || isTranscribing || disabled) return;
    autoStartLockRef.current = true;
    void startRecording().catch((error) => {
      onError?.(error instanceof Error ? error.message : "Unable to start microphone");
    });
  }, [autoStart, disabled, isRecording, isTranscribing, onError]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      audioContextRef.current?.close().catch(() => undefined);
      recognitionRef.current?.stop();
    };
  }, []);

  async function startRecording() {
    if (disabled || isRecording || isTranscribing) return;

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
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };

    recorder.onstop = async () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
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
        if (!response.ok || !payload.text) throw new Error(payload.error || "Transcription failed");
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

  /* ─── Fullscreen variant ─── */
  if (variant === "fullscreen") {
    return (
      <div className="flex flex-col items-center justify-center">
        {/* Outer ring */}
        <div className="flex h-[140px] w-[140px] items-center justify-center rounded-full bg-white/50 shadow-[0_0_0_1px_rgba(0,0,0,0.04),0_8px_32px_rgba(0,0,0,0.08)]">
          <button
            type="button"
            disabled={disabled || isTranscribing}
            onClick={isRecording ? stopRecording : () => void startRecording()}
            className={cn(
              "flex h-[80px] w-[80px] items-center justify-center rounded-full transition-all duration-300",
              isRecording
                ? "bg-[hsl(var(--danger))] text-white shadow-[0_4px_16px_rgba(220,38,38,0.3)]"
                : "bg-white text-[#1d1d1f] shadow-[0_2px_12px_rgba(0,0,0,0.08)]",
            )}
          >
            {isRecording ? (
              <Square className="h-6 w-6" fill="currentColor" />
            ) : (
              <Mic className="h-7 w-7" strokeWidth={1.6} />
            )}
          </button>
        </div>

        {/* Waveform bars */}
        <div className="mt-6 flex items-end gap-1.5">
          {bars.map((bar, index) => (
            <span
              key={index}
              className={cn(
                "w-[5px] rounded-full transition-all duration-150",
                isRecording ? "bg-[hsl(var(--primary))]" : "bg-[#d2d2d7]",
              )}
              style={{ height: `${14 + bar * 36}px` }}
            />
          ))}
        </div>

        {/* Status text */}
        <p className="mt-6 text-[22px] font-semibold tracking-[-0.02em] text-[#1d1d1f]">
          {isRecording ? "Listening\u2026" : isTranscribing ? "Transcribing\u2026" : "Tap to record"}
        </p>
        <p className="mt-1.5 text-center text-[15px] text-[#86868b]">
          {isRecording
            ? "Tap the button when done."
            : "We\u2019ll turn your voice into schedule instructions."}
        </p>
      </div>
    );
  }

  /* ─── Inline variant (compact, matches send button size) ─── */
  return (
    <button
      type="button"
      disabled={disabled || isTranscribing}
      onClick={isRecording ? stopRecording : () => void startRecording()}
      className={cn(
        "flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-full transition-all",
        isRecording
          ? "bg-[hsl(var(--danger))] text-white"
          : "bg-[#f0f0f2] text-[#86868b] hover:bg-[#e4e4e7] active:bg-[#dadadd]",
      )}
      aria-label={isRecording ? "Stop recording" : "Voice input"}
    >
      {isRecording ? (
        <Square className="h-3.5 w-3.5" fill="currentColor" />
      ) : (
        <Mic className="h-4 w-4" strokeWidth={2} />
      )}
    </button>
  );
}
