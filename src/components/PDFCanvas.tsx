import { useEffect, useRef, useState } from 'react';
import { Box, Paper, CircularProgress, Typography } from '@mui/material';
import * as pdfjsLib from 'pdfjs-dist';
import * as fabric from 'fabric';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store/store';
import { addImage, removeImage, updateImage } from '../features/editor/editorSlice';
import { useAddOperationMutation } from '../features/editor/editorApi';
import { CanvasImage } from '../types';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface PDFCanvasProps {
  pdfUrl: string;
  selectedImage: { id: string; url: string; width: number; height: number } | null;
  onImageAdded?: () => void;
}

export default function PDFCanvas({ pdfUrl, selectedImage, onImageAdded }: PDFCanvasProps) {
  const dispatch = useDispatch();
  const { currentPage, zoom, images, sessionId, sessionToken } = useSelector(
    (state: RootState) => state.editor
  );

  const [addOperation] = useAddOperationMutation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageWidth, setPageWidth] = useState<number>(0);
  const [pdfLoaded, setPdfLoaded] = useState(false);

  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 🔹 Hide default blue Fabric.js control dots and add custom icons
  function setupCustomControls(object: fabric.Object) {
    if (!object?.controls) return;

    // Common style for all custom control points
    const drawCustomCircle = (
      ctx: CanvasRenderingContext2D,
      left: number,
      top: number,
      style: string
    ) => {
      ctx.save();
      ctx.fillStyle = style;
      ctx.beginPath();
      ctx.arc(left, top, 6, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    };

    // Helper for icon-based rotation
    const drawRotateIcon = (
      ctx: CanvasRenderingContext2D,
      left: number,
      top: number
    ) => {
      ctx.save();
      ctx.translate(left, top);
      ctx.beginPath();
      ctx.strokeStyle = '#2196f3';
      ctx.lineWidth = 2;
      ctx.arc(0, 0, 7, 0.3, 2.6 * Math.PI);
      ctx.moveTo(6, -3);
      ctx.lineTo(9, 0);
      ctx.lineTo(6, 3);
      ctx.stroke();
      ctx.restore();
    };

    // Apply uniform custom styles to all corner controls
    const controls = object.controls;
    Object.keys(controls).forEach((key) => {
      const ctrl = controls[key];
      if (!ctrl) return;
      ctrl.render = (ctx, left, top) => {
        if (key === 'mtr') {
          drawRotateIcon(ctx, left, top + 1); // rotation control
        } else {
          drawCustomCircle(ctx, left, top, '#2196f3'); // red circle for resize
        }
      };
    });

    // Optional: customize corner size and no borders
    object.set({
      cornerColor: 'transparent',
      borderColor: 'transparent',
      transparentCorners: true,
      borderOpacityWhenMoving: 0,
      cornerSize: 12,
    });
  }

  // 1) Load PDF document
  useEffect(() => {
    let cancelled = false;

    const loadPDF = async () => {
      try {
        setLoading(true);
        setError(null);
        setPdfLoaded(false);

        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        const pdf = await loadingTask.promise;
        if (cancelled) {
          pdf.destroy?.();
          return;
        }
        pdfDocRef.current = pdf;
        setPdfLoaded(true);
      } catch (err: any) {
        console.error('Error loading PDF:', err);
        setError(err?.message || 'Failed to load PDF');
      } finally {
        setLoading(false);
      }
    };

    if (pdfUrl) loadPDF();

    return () => {
      cancelled = true;
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy();
        pdfDocRef.current = null;
      }
      setPdfLoaded(false);
    };
  }, [pdfUrl]);

  // 2) Render PDF page
  useEffect(() => {
    const renderPage = async () => {
      if (!pdfLoaded || !pdfDocRef.current || !pdfCanvasRef.current) return;

      try {
        const page = await pdfDocRef.current.getPage(currentPage + 1);
        const viewport = page.getViewport({ scale: zoom });

        const canvas = pdfCanvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        setPageWidth(viewport.width);

        const renderContext = { canvasContext: context, viewport, canvas };
        await page.render(renderContext).promise;

        if (fabricCanvasRef.current) {
          fabricCanvasRef.current.setDimensions({
            width: viewport.width,
            height: viewport.height,
          });
          fabricCanvasRef.current.requestRenderAll();
        }
      } catch (err) {
        console.error('Error rendering PDF page:', err);
      }
    };

    renderPage();
  }, [pdfLoaded, currentPage, zoom]);

  // 3) Initialize Fabric.js
  useEffect(() => {
    if (!pdfCanvasRef.current || pageWidth === 0) return;
    if (fabricCanvasRef.current) return;

    const fabricEl = document.getElementById('fabric-canvas') as HTMLCanvasElement | null;
    if (!fabricEl) return;

    const fabricCanvas = new fabric.Canvas(fabricEl, {
      selection: true,
      preserveObjectStacking: true,
    });

    fabricCanvas.setDimensions({
      width: pageWidth,
      height: pdfCanvasRef.current!.height,
    });

    fabricCanvasRef.current = fabricCanvas;

    return () => {
      fabricCanvas.dispose();
      fabricCanvasRef.current = null;
    };
  }, [pageWidth]);

  // 4) Add selected image
  useEffect(() => {
    if (!selectedImage || !fabricCanvasRef.current || !sessionId || !sessionToken) return;

    (async () => {
      try {
        const img = await (fabric as any).Image.fromURL(selectedImage.url, { crossOrigin: 'anonymous' });
        if (!fabricCanvasRef.current) return;

        const canvas = fabricCanvasRef.current;
        const maxWidth = pageWidth * 0.3 || 200;
        const scale = maxWidth / (img.width || 1);

        img.scale(scale);
        img.set({
          left: 100 + (img.width * scale) / 2,
          top: 100 + (img.height * scale) / 2,
          originX: 'center',
          originY: 'center',
          cornerSize: 10,
        });

        setupCustomControls(img); // 🔹 Apply custom dots

        (img as any).imageId = selectedImage.id;
        (img as any).canvasImageId = `canvas-${Date.now()}`;

        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.requestRenderAll();

        const canvasImage: CanvasImage = {
          id: `canvas-${Date.now()}`,
          imageId: selectedImage.id,
          page: currentPage,
          x: img.left || 0,
          y: img.top || 0,
          width: (img.width || 0) * (img.scaleX || 1),
          height: (img.height || 0) * (img.scaleY || 1),
          rotation: img.angle || 0,
          opacity: img.opacity || 1,
          url: selectedImage.url,
        };

        dispatch(addImage(canvasImage));

        addOperation({
          sessionId,
          sessionToken,
          operationType: 'add_image',
          operationData: {
            page: currentPage,
            image_id: selectedImage.id,
            image_path: `/app/storage/temp/${sessionId}/${selectedImage.id}_image.png`,
            position: {
              x: canvasImage.x,
              y: canvasImage.y,
              width: canvasImage.width,
              height: canvasImage.height,
            },
            rotation: canvasImage.rotation,
            opacity: canvasImage.opacity,
          },
        });

        if (onImageAdded) onImageAdded();
      } catch (err) {
        console.error('Error loading image into fabric:', err);
      }
    })();
  }, [selectedImage, pageWidth, sessionId, sessionToken, currentPage, addOperation, dispatch]);

  // 5) Re-render stored images
  useEffect(() => {
    if (!fabricCanvasRef.current) return;

    const canvas = fabricCanvasRef.current;
    canvas.clear();

    const pageImages = images.filter((img) => img.page === currentPage);
    if (pageImages.length === 0) {
      canvas.requestRenderAll();
      return;
    }

    (async () => {
      for (const canvasImg of pageImages) {
        try {
          const img = await (fabric as any).Image.fromURL(canvasImg.url, { crossOrigin: 'anonymous' });
          (img as any).imageId = canvasImg.imageId;
          (img as any).canvasImageId = canvasImg.id;
          img.set({
            left: canvasImg.x + canvasImg.width / 2,
            top: canvasImg.y + canvasImg.height / 2,
            originX: 'center',
            originY: 'center',
            scaleX: canvasImg.width / (img.width || 1),
            scaleY: canvasImg.height / (img.height || 1),
            angle: canvasImg.rotation,
            opacity: canvasImg.opacity,
          });
          setupCustomControls(img);
          canvas.add(img);
        } catch (err) {
          console.error('Error rendering stored image:', err);
        }
      }
      canvas.requestRenderAll();
    })();
  }, [currentPage, images]);

  // 6) Handle modifications (move/resize)
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const debounceTimers = new Map<string, number>();

    const getObjectSrc = (obj: any): string | undefined => {
      try {
        if (typeof obj.getSrc === 'function') return obj.getSrc();
      } catch { }
      return obj._originalElement?.src || obj._element?.src || undefined;
    };

    const round = (n: number, p = 2) => Math.round((n + Number.EPSILON) * Math.pow(10, p)) / Math.pow(10, p);

    const handleObjectModified = (e: any) => {
      const obj = e.target as fabric.Object;
      if (!obj || !sessionId || !sessionToken) return;

      const src = getObjectSrc(obj);
      if (!src) return;

      const canvasImg = images.find((img) => img.page === currentPage && img.url === src);
      if (!canvasImg) return;

      const newX = (obj.left ?? 0) - ((obj.width ?? 0) * (obj.scaleX ?? 1)) / 2;
      const newY = (obj.top ?? 0) - ((obj.height ?? 0) * (obj.scaleY ?? 1)) / 2;
      const newWidth = ((obj.width ?? 0) * (obj.scaleX ?? 1)) as number;
      const newHeight = ((obj.height ?? 0) * (obj.scaleY ?? 1)) as number;
      const newRotation = (obj.angle ?? 0) as number;

      const key = canvasImg.id;
      if (debounceTimers.has(key)) {
        window.clearTimeout(debounceTimers.get(key));
      }

      const timer = window.setTimeout(() => {
        dispatch(
          updateImage({
            id: canvasImg.id,
            updates: {
              x: round(newX),
              y: round(newY),
              width: round(newWidth),
              height: round(newHeight),
              rotation: round(newRotation),
            },
          })
        );

        addOperation({
          sessionId,
          sessionToken,
          operationType: 'move_image',
          operationData: {
            page: currentPage,
            image_id: canvasImg.imageId,
            old_position: {
              x: round(canvasImg.x),
              y: round(canvasImg.y),
              width: round(canvasImg.width),
              height: round(canvasImg.height),
            },
            new_position: {
              x: round(newX),
              y: round(newY),
              width: round(newWidth),
              height: round(newHeight),
            },
            rotation: round(newRotation),
          },
        });

        debounceTimers.delete(key);
      }, 300);

      debounceTimers.set(key, timer);
    };

    canvas.on('object:modified', handleObjectModified);

    return () => {
      for (const t of debounceTimers.values()) clearTimeout(t);
      canvas.off('object:modified', handleObjectModified);
    };
  }, [images, currentPage, sessionId, sessionToken, dispatch, addOperation]);

  // 7) Handle delete key
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const activeObject = canvas.getActiveObject();
        if (!activeObject) return;

        const canvasImgId = (activeObject as any).canvasImageId;
        if (!canvasImgId) return;

        const canvasImg = images.find((img) => img.id === canvasImgId);
        if (!canvasImg) return;

        canvas.remove(activeObject);
        canvas.requestRenderAll();

        dispatch(removeImage(canvasImg.id));

        if (sessionId && sessionToken) {
          addOperation({
            sessionId,
            sessionToken,
            operationType: 'delete_image',
            operationData: {
              page: currentPage,
              image_id: canvasImg.imageId,
              position: {
                x: canvasImg.x,
                y: canvasImg.y,
                width: canvasImg.width,
                height: canvasImg.height,
              },
            },
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [images, currentPage, sessionId, sessionToken, dispatch, addOperation]);

  if (loading) {
    return (
      <Paper elevation={3} sx={{ p: 2, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 600 }}>
        <CircularProgress />
      </Paper>
    );
  }

  if (error) {
    return (
      <Paper elevation={3} sx={{ p: 2, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 600 }}>
        <Typography color="error">{error}</Typography>
      </Paper>
    );
  }

  return (
    <Paper
      elevation={3}
      sx={{
        p: 2,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 600,
        bgcolor: '#f5f5f5',
        overflow: 'auto',
      }}
    >
      <Box ref={containerRef} sx={{ position: 'relative', display: 'inline-block' }}>
        <canvas
          ref={pdfCanvasRef}
          style={{ position: 'absolute', top: 0, left: 0, zIndex: 0 }}
        />
        {pageWidth > 0 && (
          <canvas
            id="fabric-canvas"
            width={pageWidth}
            height={pdfCanvasRef.current?.height || 0}
            style={{ position: 'absolute', top: 0, left: 0, zIndex: 1, pointerEvents: 'auto' }}
          />
        )}
      </Box>
    </Paper>
  );
}
