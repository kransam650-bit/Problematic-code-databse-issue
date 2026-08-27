import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Check, X, RefreshCw, Sparkles, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';

interface Point {
  x: number;
  y: number;
}

interface QuadrangleCropperProps {
  imageSrc: string;
  onCropComplete: (croppedDataUrl: string) => void;
  onCancel: () => void;
  label?: string;
  aspect?: number;
  onAspectChange?: (aspect: number | undefined) => void;
}

export function QuadrangleCropper({ 
  imageSrc, 
  onCropComplete, 
  onCancel, 
  label = 'Photo',
  aspect,
  onAspectChange
}: QuadrangleCropperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  
  // Normalized corners [TL, TR, BR, BL] relative to the image size (0.0 to 1.0)
  const [corners, setCorners] = useState<Point[]>([
    { x: 0.1, y: 0.1 },  // Top-Left
    { x: 0.9, y: 0.1 },  // Top-Right
    { x: 0.9, y: 0.9 },  // Bottom-Right
    { x: 0.1, y: 0.9 }   // Bottom-Left
  ]);

  const [overlayDims, setOverlayDims] = useState({ left: 0, top: 0, width: 0, height: 0 });
  const [activeHandleIndex, setActiveHandleIndex] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isWarping, setIsWarping] = useState(false);
  const loupeCanvasRef = useRef<HTMLCanvasElement>(null);

  // Render magnified Loupe when dragging a corner handle
  useEffect(() => {
    if (activeHandleIndex === null || !imgRef.current || !imgLoaded) return;
    const canvas = loupeCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = imgRef.current;
    const activeCorner = corners[activeHandleIndex];
    const srcX = activeCorner.x * img.naturalWidth;
    const srcY = activeCorner.y * img.naturalHeight;

    const zoomSize = Math.max(30, Math.min(img.naturalWidth, img.naturalHeight) * 0.12);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(
      img,
      srcX - zoomSize / 2,
      srcY - zoomSize / 2,
      zoomSize,
      zoomSize,
      0,
      0,
      canvas.width,
      canvas.height
    );

    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();

    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, 4, 0, Math.PI * 2);
    ctx.fill();
  }, [activeHandleIndex, corners, imgLoaded]);

  // Measure and align overlay with the image rendering
  const updateOverlayDims = useCallback(() => {
    if (!imgRef.current || !containerRef.current) return;
    const img = imgRef.current;
    const parent = containerRef.current;
    
    const imgRect = img.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();
    
    setOverlayDims({
      left: imgRect.left - parentRect.left,
      top: imgRect.top - parentRect.top,
      width: imgRect.width,
      height: imgRect.height
    });
  }, []);

  useEffect(() => {
    window.addEventListener('resize', updateOverlayDims);
    // Observe container resize to keep dimensions in sync
    let resizeObserver: ResizeObserver | null = null;
    if (containerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        updateOverlayDims();
      });
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateOverlayDims);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [updateOverlayDims]);

  const handleImageLoad = () => {
    setImgLoaded(true);
    // Small timeout to ensure browser has performed layout on the image element
    setTimeout(updateOverlayDims, 50);
  };

  // Reset corners to original square layout
  const resetCorners = () => {
    setCorners([
      { x: 0.1, y: 0.1 },
      { x: 0.9, y: 0.1 },
      { x: 0.9, y: 0.9 },
      { x: 0.1, y: 0.9 }
    ]);
  };

  // Pointer drag logic
  const handlePointerDown = (index: number, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setActiveHandleIndex(index);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (activeHandleIndex === null || !overlayDims.width || !overlayDims.height) return;
    e.preventDefault();
    e.stopPropagation();

    const overlayEl = e.currentTarget as HTMLElement;
    const rect = overlayEl.getBoundingClientRect();
    
    // Normalized coordinates relative to the overlay element (the image's visible bounding box)
    let nx = (e.clientX - rect.left) / rect.width;
    let ny = (e.clientY - rect.top) / rect.height;

    // Constrain inside the image area (0 to 1)
    nx = Math.max(0, Math.min(1, nx));
    ny = Math.max(0, Math.min(1, ny));

    setCorners(prev => {
      const next = [...prev];
      next[activeHandleIndex] = { x: nx, y: ny };
      return next;
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (activeHandleIndex !== null) {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      setActiveHandleIndex(null);
    }
  };

  // Quick bilinear warp for real-time preview (low res for instant render)
  const warpImageQuick = useCallback((
    img: HTMLImageElement,
    pts: Point[],
    destW: number,
    destH: number
  ): HTMLCanvasElement | null => {
    const canvas = document.createElement('canvas');
    canvas.width = destW;
    canvas.height = destH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Draw source onto temporary offscreen canvas to get pixel access
    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = img.naturalWidth;
    srcCanvas.height = img.naturalHeight;
    const srcCtx = srcCanvas.getContext('2d');
    if (!srcCtx) return null;
    srcCtx.drawImage(img, 0, 0);

    let srcData;
    try {
      srcData = srcCtx.getImageData(0, 0, img.naturalWidth, img.naturalHeight);
    } catch (err) {
      console.error('Failed to read image pixel data (CORS issue?):', err);
      return null;
    }

    const srcPixels = srcData.data;
    const destData = ctx.createImageData(destW, destH);
    const destPixels = destData.data;

    const [p0, p1, p2, p3] = pts;

    for (let dy = 0; dy < destH; dy++) {
      const v = dy / (destH - 1 || 1);
      const oneMinusV = 1 - v;

      for (let dx = 0; dx < destW; dx++) {
        const u = dx / (destW - 1 || 1);
        const oneMinusU = 1 - u;

        // Bilinear coefficients
        const c00 = oneMinusU * oneMinusV;
        const c10 = u * oneMinusV;
        const c11 = u * v;
        const c01 = oneMinusU * v;

        // Map to source image pixel space
        const sx = Math.round(c00 * p0.x + c10 * p1.x + c11 * p2.x + c01 * p3.x);
        const sy = Math.round(c00 * p0.y + c10 * p1.y + c11 * p2.y + c01 * p3.y);

        // Clamping to valid image range
        const x = Math.max(0, Math.min(img.naturalWidth - 1, sx));
        const y = Math.max(0, Math.min(img.naturalHeight - 1, sy));

        const srcIdx = (y * img.naturalWidth + x) * 4;
        const destIdx = (dy * destW + dx) * 4;

        destPixels[destIdx] = srcPixels[srcIdx];
        destPixels[destIdx + 1] = srcPixels[srcIdx + 1];
        destPixels[destIdx + 2] = srcPixels[srcIdx + 2];
        destPixels[destIdx + 3] = srcPixels[srcIdx + 3];
      }
    }

    ctx.putImageData(destData, 0, 0);
    return canvas;
  }, []);

  // Update live preview in real time as corners are adjusted
  useEffect(() => {
    if (!imgRef.current || !imgLoaded) return;

    let active = true;
    const triggerPreviewWarp = () => {
      if (!active || !imgRef.current) return;
      const img = imgRef.current;
      const srcW = img.naturalWidth;
      const srcH = img.naturalHeight;

      // Map normalized corners to original image pixel coordinates
      const pxCorners = corners.map(c => ({
        x: c.x * srcW,
        y: c.y * srcH
      }));

      // Low resolution preview (180x240) is incredibly responsive (sub-ms processing)
      const previewW = 180;
      const previewH = 240;

      const canvas = warpImageQuick(img, pxCorners, previewW, previewH);
      if (canvas && active) {
        setPreviewUrl(canvas.toDataURL('image/jpeg', 0.65));
      }
    };

    const animFrame = requestAnimationFrame(triggerPreviewWarp);

    return () => {
      active = false;
      cancelAnimationFrame(animFrame);
    };
  }, [corners, imgLoaded, warpImageQuick]);

  // High-resolution save operation when clicking save
  const handleSave = async () => {
    if (!imgRef.current || !imgLoaded) return;
    setIsWarping(true);

    // Yield control for loading indicator to render nicely
    setTimeout(() => {
      try {
        const img = imgRef.current!;
        const srcW = img.naturalWidth;
        const srcH = img.naturalHeight;

        const pxCorners = corners.map(c => ({
          x: c.x * srcW,
          y: c.y * srcH
        }));

        // Calculate bounding box in pixel space to preserve optimal resolution
        const xs = pxCorners.map(p => p.x);
        const ys = pxCorners.map(p => p.y);
        const bW = Math.max(...xs) - Math.min(...xs);
        const bH = Math.max(...ys) - Math.min(...ys);

        // Normalize destination image resolution to max width 1080px to save storage space
        const targetW = Math.min(1080, Math.max(360, Math.round(bW)));
        const targetH = Math.round(targetW * (bH / bW || 1));

        const canvas = warpImageQuick(img, pxCorners, targetW, targetH);
        if (canvas) {
          const croppedResult = canvas.toDataURL('image/jpeg', 0.82);
          onCropComplete(croppedResult);
        } else {
          alert('Could not crop the image. Please try again.');
        }
      } catch (error) {
        console.error('Error saving cropped image:', error);
        alert('An error occurred while cropping the photo.');
      } finally {
        setIsWarping(false);
      }
    }, 50);
  };

  // Convert normalized corner to SVG coordinate string
  const getPolygonPointsStr = () => {
    return corners
      .map(c => `${c.x * overlayDims.width},${c.y * overlayDims.height}`)
      .join(' ');
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-white rounded-2xl overflow-hidden">
      {/* Dynamic Header */}
      <div className="p-4 bg-slate-950 flex justify-between items-center border-b border-slate-800 shrink-0">
        <div>
          <h4 className="font-bold text-slate-100 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-400" />
            Perspective Document Cropper
          </h4>
          <p className="text-xs text-slate-400 mt-0.5">Drag the 4 green corners to align with the paper/photo edges</p>
        </div>
        <button 
          onClick={resetCorners}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer select-none"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Reset Corners
        </button>
      </div>

      {/* Main Workspace split into Canvas and Live Preview */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row relative">
        {/* Left Side: Draggable Canvas */}
        <div 
          ref={containerRef}
          className="flex-1 relative bg-slate-950 flex items-center justify-center p-4 min-h-[300px] select-none"
        >
          <img 
            ref={imgRef}
            src={imageSrc} 
            alt="Source document" 
            onLoad={handleImageLoad}
            className="max-w-full max-h-[50vh] md:max-h-[58vh] object-contain opacity-95 rounded-lg select-none pointer-events-none shadow-xl border border-slate-800"
            referrerPolicy="no-referrer"
          />

          {imgLoaded && overlayDims.width > 0 && (
            <div 
              className="absolute pointer-events-auto cursor-default"
              style={{
                left: `${overlayDims.left}px`,
                top: `${overlayDims.top}px`,
                width: `${overlayDims.width}px`,
                height: `${overlayDims.height}px`
              }}
              onPointerMove={handlePointerMove}
            >
              {/* SVG Overlay containing the highlighted selection region */}
              <svg 
                className="w-full h-full absolute inset-0 pointer-events-none select-none"
                viewBox={`0 0 ${overlayDims.width} ${overlayDims.height}`}
              >
                {/* Semi-transparent dimmed mask outside selection */}
                <path
                  d={`
                    M 0,0 L ${overlayDims.width},0 L ${overlayDims.width},${overlayDims.height} L 0,${overlayDims.height} Z 
                    M ${corners[0].x * overlayDims.width},${corners[0].y * overlayDims.height} 
                    L ${corners[1].x * overlayDims.width},${corners[1].y * overlayDims.height} 
                    L ${corners[2].x * overlayDims.width},${corners[2].y * overlayDims.height} 
                    L ${corners[3].x * overlayDims.width},${corners[3].y * overlayDims.height} Z
                  `}
                  fill="rgba(15, 23, 42, 0.65)"
                  fillRule="evenodd"
                />
                
                {/* Border line connecting the corners */}
                <polygon
                  points={getPolygonPointsStr()}
                  fill="rgba(59, 130, 246, 0.08)"
                  stroke="#10b981"
                  strokeWidth="2.5"
                  strokeDasharray="4 2"
                  className="drop-shadow-lg"
                />
              </svg>

              {/* Interactive handles at each corner with touch target padding */}
              {corners.map((corner, idx) => {
                const cornerName = ['Top-Left', 'Top-Right', 'Bottom-Right', 'Bottom-Left'][idx];
                return (
                  <div
                    key={idx}
                    className="absolute -translate-x-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center cursor-pointer group z-20"
                    style={{
                      left: `${corner.x * 100}%`,
                      top: `${corner.y * 100}%`,
                      touchAction: 'none'
                    }}
                    onPointerDown={(e) => handlePointerDown(idx, e)}
                    onPointerUp={handlePointerUp}
                    title={cornerName}
                  >
                    {/* Concentric rings to make handle visible on dark & light areas */}
                    <div className={cn(
                      "w-4 h-4 rounded-full border-2 bg-white flex items-center justify-center shadow-lg transition-transform scale-110 md:group-hover:scale-125",
                      activeHandleIndex === idx ? "border-emerald-500 scale-125 bg-emerald-500" : "border-slate-800"
                    )}>
                      <div className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        activeHandleIndex === idx ? "bg-white" : "bg-emerald-500"
                      )} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Focused Crop Preview & Magnifying Loupe Card in Upper Left Corner */}
        {(activeHandleIndex !== null || previewUrl) && (
          <div className="absolute top-4 left-4 p-2.5 bg-slate-950/95 border border-slate-700/80 rounded-xl shadow-2xl flex flex-col items-center gap-1.5 z-40 backdrop-blur-md max-w-[130px] select-none pointer-events-none transition-all">
            {activeHandleIndex !== null ? (
              <>
                <span className="text-[9px] font-bold tracking-wider text-emerald-400 uppercase flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5 text-emerald-400 animate-pulse" />
                  Corner Zoom
                </span>
                <div className="w-[100px] h-[100px] bg-slate-900 border-2 border-emerald-500 rounded-lg overflow-hidden flex items-center justify-center relative shadow-inner">
                  <canvas ref={loupeCanvasRef} width={100} height={100} className="w-full h-full object-cover" />
                </div>
                <span className="text-[9px] font-bold text-slate-300">
                  {['Top-Left', 'Top-Right', 'Bottom-Right', 'Bottom-Left'][activeHandleIndex]}
                </span>
              </>
            ) : previewUrl ? (
              <>
                <span className="text-[9px] font-bold tracking-wider text-slate-400 uppercase flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5 text-blue-400 animate-pulse" />
                  Live Output
                </span>
                <div className="w-[100px] h-[133px] bg-slate-900 border border-slate-800 rounded-lg overflow-hidden flex items-center justify-center">
                  <img src={previewUrl} className="w-full h-full object-cover" alt="Cropped Preview" />
                </div>
              </>
            ) : null}
          </div>
        )}
      </div>

      {/* Ratio Selector Strip */}
      {onAspectChange && (
        <div className="px-4 py-3 bg-slate-950/90 border-t border-slate-800 flex items-center gap-2 overflow-x-auto shrink-0 select-none">
          <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mr-2 shrink-0">Ratio:</span>
          {[
            { label: 'Free (Perspective Crop)', value: undefined },
            { label: '1:1', value: 1 },
            { label: '4:3', value: 4/3 },
            { label: '3:4', value: 3/4 },
            { label: '16:9', value: 16/9 }
          ].map((r) => (
            <button
              key={r.label}
              onClick={() => onAspectChange(r.value)}
              className={cn(
                "px-4 py-2 rounded-full text-xs font-bold transition-all shrink-0 min-h-[36px] flex items-center justify-center cursor-pointer select-none",
                aspect === r.value ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" : "bg-slate-800 text-slate-400 hover:text-slate-200"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}

      {/* Action Footer */}
      <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-between items-center shrink-0">
        <button 
          onClick={onCancel}
          className="px-5 py-3 text-sm font-bold text-slate-400 hover:text-slate-200 transition-colors cursor-pointer select-none"
        >
          Cancel
        </button>
        <button 
          onClick={handleSave}
          disabled={isWarping || !imgLoaded}
          className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-emerald-600/10 flex items-center gap-2 cursor-pointer select-none disabled:opacity-50"
        >
          {isWarping ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Check className="w-4.5 h-4.5" strokeWidth={3} />
              Save Cropped Image
            </>
          )}
        </button>
      </div>
    </div>
  );
}
