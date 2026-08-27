import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { X, Camera, Image as ImageIcon, Loader2, AlertCircle } from 'lucide-react';

interface QrScannerProps {
  isOpen: boolean;
  onScan: (data: string) => void;
  onClose: () => void;
}

export const QrScanner: React.FC<QrScannerProps> = ({ isOpen, onScan, onClose }) => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // File fallback input
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Reset states
    setHasPermission(null);
    setLoading(true);
    setErrorMsg('');

    let stream: MediaStream | null = null;

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        
        streamRef.current = stream;
        setHasPermission(true);
        setLoading(false);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true'); // inline play on iOS/Android
          videoRef.current.play().catch(err => {
            console.error("Video play failed:", err);
          });
        }
      } catch (err: any) {
        console.error('Camera access error:', err);
        setHasPermission(false);
        setLoading(false);
        setErrorMsg(
          err.name === 'NotAllowedError' 
            ? 'Camera access denied. Please grant camera permission in your browser/device settings to scan QR codes.'
            : 'Could not access the camera. You can still upload a photo of the QR code using the Gallery option below.'
        );
      }
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  // QR Decoding Loop
  useEffect(() => {
    if (!isOpen || !hasPermission || loading) return;

    const tick = () => {
      if (!videoRef.current || !canvasRef.current) {
        animationFrameRef.current = requestAnimationFrame(tick);
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
        // Set canvas sizing matching video aspect ratio
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Draw video frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Get Image Data for decoding
        try {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert'
          });

          if (code && code.data) {
            // Success scan! Play a small vibration if supported
            if (navigator.vibrate) {
              navigator.vibrate(100);
            }
            onScan(code.data);
            return; // Stop requesting frames on success
          }
        } catch (e) {
          // imageData reading could fail if video size is invalid momentarily
        }
      }

      animationFrameRef.current = requestAnimationFrame(tick);
    };

    animationFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isOpen, hasPermission, loading, onScan]);

  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }
  };

  // Gallery fallback handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          try {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height);
            if (code && code.data) {
              onScan(code.data);
            } else {
              alert('Could not find any QR code in this image. Please try another photo.');
            }
          } catch (err) {
            console.error('Error parsing QR image file:', err);
            alert('Failed to parse QR code from selected file.');
          } finally {
            setLoading(false);
          }
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  return (
    <div id="qr-scanner-modal" className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/95 p-4 md:p-6 backdrop-blur-md animate-fade-in select-none">
      {/* Invisible Canvas for reading frames */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Header Controls */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-10">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
          <span className="text-white text-xs font-bold uppercase tracking-widest text-slate-300">Live QR Scanner</span>
        </div>
        <button 
          onClick={() => { stopCamera(); onClose(); }}
          className="p-2.5 rounded-full bg-slate-900/85 hover:bg-slate-800 text-slate-300 hover:text-white transition-all active:scale-95 cursor-pointer border border-slate-800"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Scanner Container */}
      <div className="w-full max-w-sm flex flex-col items-center gap-6 mt-12">
        <div className="relative w-full aspect-square max-w-[320px] rounded-2xl overflow-hidden border-2 border-slate-800 bg-slate-900 flex items-center justify-center shadow-2xl">
          {/* Camera Video Stream */}
          {hasPermission && (
            <video 
              ref={videoRef} 
              className="absolute inset-0 w-full h-full object-cover" 
              playsInline 
              muted 
            />
          )}

          {/* Views Overlay (Loader, Permission Block) */}
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 gap-3 text-slate-300 z-10">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-xs font-bold uppercase tracking-wider">Activating Camera...</p>
            </div>
          )}

          {!hasPermission && !loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 p-6 text-center text-slate-300 gap-3 z-10">
              <AlertCircle className="w-10 h-10 text-rose-500" />
              <p className="text-xs font-bold uppercase tracking-wider text-rose-400">Camera Unavailable</p>
              <p className="text-xs text-slate-400 leading-relaxed max-w-[260px]">{errorMsg || "Camera access requested but unavailable."}</p>
            </div>
          )}

          {/* HUD Target Overlay (Green bracket outline & animation scan bar) */}
          {hasPermission && !loading && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
              {/* Overlay shading */}
              <div className="absolute inset-0 bg-black/40" />

              {/* Viewfinder cut-out */}
              <div className="relative w-48 h-48 border-2 border-white/20 rounded-xl overflow-hidden shadow-[0_0_0_999px_rgba(0,0,0,0.4)]">
                {/* Scanner corner accents */}
                <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-primary" />
                <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-primary" />
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-primary" />
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-primary" />

                {/* Pulsing red/green scanning laser line */}
                <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_8px_#34d399] absolute top-0 animate-[scan_2s_ease-in-out_infinite]" />
              </div>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="text-center px-4 max-w-xs space-y-2">
          <p className="text-white font-medium text-sm">Center the patient QR Code in frame</p>
          <p className="text-slate-400 text-xs">The scanner will instantly recognize the code and open the patient record details.</p>
        </div>

        {/* Action / Fallbacks Grid */}
        <div className="w-full grid grid-cols-1 gap-2.5 mt-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2.5 w-full py-3 px-4 bg-slate-900 border border-slate-800 hover:bg-slate-800 active:scale-98 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
          >
            <ImageIcon className="w-4 h-4 text-slate-400" />
            Upload QR Code image
          </button>
          
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*,image/heic,image/heif,.heic,.heif" 
            onChange={handleFileChange} 
          />
        </div>
      </div>
    </div>
  );
};
