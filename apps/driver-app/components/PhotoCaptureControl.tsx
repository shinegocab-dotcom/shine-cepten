import React, { useEffect, useRef, useState } from 'react';
import { Camera, UploadCloud, X } from 'lucide-react';

interface CameraCaptureModalProps {
  open: boolean;
  title?: string;
  facingMode?: 'user' | 'environment';
  onClose: () => void;
  onCapture: (file: File) => void;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  open,
  title = 'Capture Real Photo',
  facingMode = 'user',
  onClose,
  onCapture,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setCameraError(null);
    setReady(false);

    const startCamera = async () => {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setCameraError('Live WebView preview unavailable here. Tap Open Device Camera below.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode },
          audio: false,
        });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setReady(true);
        }
      } catch (err) {
        setCameraError(
          err instanceof Error
            ? `Live camera preview paused (${err.message}). Use native Device Camera button below.`
            : 'Camera permission declined. Use native Device Camera or Gallery below.'
        );
      }
    };

    void startCamera();

    return () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [open, facingMode]);

  if (!open) return null;

  const handleTakeSnapshot = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `shine_captain_${Date.now()}.jpg`, {
          type: 'image/jpeg',
        });
        onCapture(file);
        onClose();
      },
      'image/jpeg',
      0.88
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-neutral-800 bg-[#1E1E1E] text-white shadow-xl">
        <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-[#F5C518]" />
            <h2 className="font-display text-sm font-bold">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close camera"
            className="flex min-h-[38px] min-w-[38px] items-center justify-center rounded-xl bg-neutral-800 text-neutral-300 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5">
          {cameraError ? (
            <div className="rounded-2xl border border-neutral-800 bg-[#141518] p-5 text-center">
              <Camera className="mx-auto h-7 w-7 text-[#F5C518]" />
              <p className="mt-2.5 text-xs font-medium text-neutral-300">{cameraError}</p>
              <div className="mt-4 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => nativeCameraInputRef.current?.click()}
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#F5C518] px-4 text-xs font-extrabold text-[#1E1E1E]"
                >
                  <Camera className="h-4 w-4" />
                  Open Android / Device Camera
                </button>
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl border border-neutral-700 px-4 text-xs font-semibold text-neutral-200"
                >
                  <UploadCloud className="h-4 w-4" />
                  Choose from Gallery / Files
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-neutral-800 bg-black">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  disabled={!ready}
                  onClick={handleTakeSnapshot}
                  className="flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-xl bg-[#F5C518] px-4 text-xs font-extrabold text-[#1E1E1E] disabled:opacity-40"
                >
                  <Camera className="h-4 w-4" />
                  {ready ? 'Click & Use Photo' : 'Starting Camera…'}
                </button>
                <button
                  type="button"
                  onClick={() => nativeCameraInputRef.current?.click()}
                  className="flex min-h-[46px] items-center justify-center gap-1.5 rounded-xl border border-neutral-700 px-3.5 text-xs font-semibold text-white hover:border-neutral-500"
                >
                  <Camera className="h-4 w-4 text-[#F5C518]" />
                  Native
                </button>
              </div>
            </div>
          )}

          {/* Direct native Android Camera capture input */}
          <input
            ref={nativeCameraInputRef}
            type="file"
            accept="image/*"
            capture={facingMode}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                onCapture(file);
                onClose();
              }
              e.target.value = '';
            }}
          />

          {/* Gallery fallback picker without capture lock */}
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                onCapture(file);
                onClose();
              }
              e.target.value = '';
            }}
          />
        </div>
      </div>
    </div>
  );
};

interface PhotoActionButtonsProps {
  onSelectFile: (file: File) => void;
  facingMode?: 'user' | 'environment';
  accept?: string;
  cameraTitle?: string;
  busy?: boolean;
  cameraLabel?: string;
  uploadLabel?: string;
}

export const PhotoActionButtons: React.FC<PhotoActionButtonsProps> = ({
  onSelectFile,
  facingMode = 'user',
  accept = 'image/*',
  cameraTitle = 'Click Real Photo',
  busy = false,
  cameraLabel = 'Click Photo',
  uploadLabel = 'Upload',
}) => {
  const [cameraOpen, setCameraOpen] = useState(false);

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => setCameraOpen(true)}
          className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-[#1E1E1E] px-3 text-xs font-semibold text-white transition-colors hover:bg-neutral-800 disabled:opacity-50 dark:bg-[#F5C518] dark:text-[#1E1E1E]"
        >
          <Camera className="h-3.5 w-3.5" />
          <span>{busy ? 'Compressing…' : cameraLabel}</span>
        </button>

        <label className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-neutral-300 bg-neutral-50 px-3 text-xs font-semibold text-[#1E1E1E] transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:bg-[#141518] dark:text-white dark:hover:bg-neutral-800">
          <UploadCloud className="h-3.5 w-3.5" />
          <span>{busy ? 'Saving…' : uploadLabel}</span>
          <input
            type="file"
            accept={accept}
            disabled={busy}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onSelectFile(f);
              e.target.value = '';
            }}
          />
        </label>
      </div>

      <CameraCaptureModal
        open={cameraOpen}
        title={cameraTitle}
        facingMode={facingMode}
        onClose={() => setCameraOpen(false)}
        onCapture={onSelectFile}
      />
    </>
  );
};
