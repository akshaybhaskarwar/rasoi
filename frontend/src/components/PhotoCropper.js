import { useState, useRef, useEffect, useCallback } from 'react';
import { RotateCw, RotateCcw, Check, X, ZoomIn, ZoomOut } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

const VIEWPORT_SIZE = 280;
const OUTPUT_SIZE = 800;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

export default function PhotoCropper({ open, imageSrc, onCrop, onCancel }) {
  const imgRef = useRef(null);
  const viewportRef = useRef(null);
  const dragState = useRef(null);

  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [processing, setProcessing] = useState(false);

  // Reset state when a new image is loaded
  useEffect(() => {
    if (open && imageSrc) {
      setZoom(1);
      setRotation(0);
      setPan({ x: 0, y: 0 });
    }
  }, [open, imageSrc]);

  const handleImageLoad = () => {
    const img = imgRef.current;
    if (img) {
      setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
    }
  };

  // Display scale: image fits inside viewport so the smaller dim fills it (cover behaviour)
  const baseScale = naturalSize.w && naturalSize.h
    ? Math.max(VIEWPORT_SIZE / naturalSize.w, VIEWPORT_SIZE / naturalSize.h)
    : 1;

  // Pointer handlers for panning
  const onPointerDown = (e) => {
    e.preventDefault();
    const point = getPoint(e);
    dragState.current = { startX: point.x, startY: point.y, panX: pan.x, panY: pan.y };
  };

  const onPointerMove = (e) => {
    if (!dragState.current) return;
    e.preventDefault();
    const point = getPoint(e);
    const dx = point.x - dragState.current.startX;
    const dy = point.y - dragState.current.startY;
    setPan({ x: dragState.current.panX + dx, y: dragState.current.panY + dy });
  };

  const onPointerUp = () => {
    dragState.current = null;
  };

  // Pinch-zoom state
  const pinchState = useRef(null);

  const onTouchStart = (e) => {
    if (e.touches.length === 2) {
      const d = touchDistance(e.touches);
      pinchState.current = { startDist: d, startZoom: zoom };
      dragState.current = null;
    } else if (e.touches.length === 1) {
      onPointerDown(e);
    }
  };

  const onTouchMove = (e) => {
    if (e.touches.length === 2 && pinchState.current) {
      e.preventDefault();
      const d = touchDistance(e.touches);
      const nextZoom = clamp(
        pinchState.current.startZoom * (d / pinchState.current.startDist),
        MIN_ZOOM,
        MAX_ZOOM
      );
      setZoom(nextZoom);
    } else if (e.touches.length === 1) {
      onPointerMove(e);
    }
  };

  const onTouchEnd = (e) => {
    if (e.touches.length === 0) {
      pinchState.current = null;
      onPointerUp();
    }
  };

  const onWheel = (e) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.002;
    setZoom((z) => clamp(z + delta * z, MIN_ZOOM, MAX_ZOOM));
  };

  const rotateLeft = () => setRotation((r) => r - 90);
  const rotateRight = () => setRotation((r) => r + 90);

  const handleApply = useCallback(async () => {
    if (!imgRef.current || !naturalSize.w) return;
    setProcessing(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // White background to avoid transparency artifacts on JPEG
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

      const outputScale = OUTPUT_SIZE / VIEWPORT_SIZE;
      // Mirror the CSS transform (translate -> rotate -> scale) in canvas space
      ctx.translate(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2);
      ctx.translate(pan.x * outputScale, pan.y * outputScale);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(zoom * outputScale, zoom * outputScale);

      const dispW = naturalSize.w * baseScale;
      const dispH = naturalSize.h * baseScale;
      ctx.drawImage(imgRef.current, -dispW / 2, -dispH / 2, dispW, dispH);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      const base64 = dataUrl.split(',')[1];
      onCrop({ dataUrl, base64 });
    } finally {
      setProcessing(false);
    }
  }, [pan, rotation, zoom, baseScale, naturalSize, onCrop]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="max-w-md p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Adjust photo</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4">
          {/* Viewport */}
          <div
            ref={viewportRef}
            className="relative overflow-hidden bg-black rounded-xl select-none touch-none"
            style={{ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE, cursor: 'grab' }}
            onMouseDown={onPointerDown}
            onMouseMove={onPointerMove}
            onMouseUp={onPointerUp}
            onMouseLeave={onPointerUp}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onWheel={onWheel}
          >
            {imageSrc && (
              <img
                ref={imgRef}
                src={imageSrc}
                alt="Crop preview"
                onLoad={handleImageLoad}
                draggable={false}
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: naturalSize.w * baseScale,
                  height: naturalSize.h * baseScale,
                  marginLeft: -(naturalSize.w * baseScale) / 2,
                  marginTop: -(naturalSize.h * baseScale) / 2,
                  transform: `translate(${pan.x}px, ${pan.y}px) rotate(${rotation}deg) scale(${zoom})`,
                  transformOrigin: 'center',
                  willChange: 'transform',
                  pointerEvents: 'none',
                  userSelect: 'none',
                }}
              />
            )}
            {/* Grid overlay */}
            <div className="pointer-events-none absolute inset-0 border-2 border-white/80 rounded-xl" />
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute left-1/3 top-0 bottom-0 border-l border-white/30" />
              <div className="absolute left-2/3 top-0 bottom-0 border-l border-white/30" />
              <div className="absolute top-1/3 left-0 right-0 border-t border-white/30" />
              <div className="absolute top-2/3 left-0 right-0 border-t border-white/30" />
            </div>
          </div>

          {/* Zoom slider */}
          <div className="w-full flex items-center gap-3">
            <ZoomOut className="w-4 h-4 text-gray-500 shrink-0" />
            <Slider
              value={[zoom]}
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.01}
              onValueChange={(v) => setZoom(v[0])}
              className="flex-1"
            />
            <ZoomIn className="w-4 h-4 text-gray-500 shrink-0" />
          </div>

          {/* Rotation controls */}
          <div className="flex items-center justify-center gap-3 w-full">
            <Button type="button" variant="outline" size="sm" onClick={rotateLeft}>
              <RotateCcw className="w-4 h-4 mr-1" /> Left
            </Button>
            <span className="text-xs text-gray-500 min-w-[48px] text-center">{((rotation % 360) + 360) % 360}°</span>
            <Button type="button" variant="outline" size="sm" onClick={rotateRight}>
              <RotateCw className="w-4 h-4 mr-1" /> Right
            </Button>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 w-full pt-2">
            <Button type="button" variant="outline" onClick={onCancel} disabled={processing}>
              <X className="w-4 h-4 mr-1" /> Cancel
            </Button>
            <Button type="button" onClick={handleApply} disabled={processing || !naturalSize.w}>
              <Check className="w-4 h-4 mr-1" /> Apply
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}

function getPoint(e) {
  if (e.touches && e.touches[0]) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  return { x: e.clientX, y: e.clientY };
}

function touchDistance(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.hypot(dx, dy);
}
