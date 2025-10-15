import { useEffect, useRef, useState } from 'react';
import { Box, Paper, CircularProgress, Typography } from '@mui/material';
import * as pdfjsLib from 'pdfjs-dist';
import * as fabric from 'fabric';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store/store';
import { addImage, updateImage } from '../features/editor/editorSlice';
import { useAddOperationMutation } from '../features/editor/editorApi';
import { CanvasImage } from '../types';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface PDFCanvasProps {
  pdfUrl: string;
  selectedImage: { id: string; url: string; width: number; height: number } | null;
}

export default function PDFCanvas({ pdfUrl, selectedImage }: PDFCanvasProps) {
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

  // 1) Load PDF document (sets ref and pdfLoaded)
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

  // 2) Render PDF page whenever PDF is loaded, page changes, or zoom changes
  useEffect(() => {
    const renderPage = async () => {
      if (!pdfLoaded || !pdfDocRef.current || !pdfCanvasRef.current) return;

      try {
        const page = await pdfDocRef.current.getPage(currentPage + 1);
        const viewport = page.getViewport({ scale: zoom });

        const canvas = pdfCanvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) return;

        // set canvas pixel size
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        // set pageWidth state for fabric init
        setPageWidth(viewport.width);

        const renderContext = {
          canvasContext: context,
          viewport,
          canvas,
        };

        await page.render(renderContext).promise;

        // sync Fabric dimensions if initialized
        if (fabricCanvasRef.current) {
          fabricCanvasRef.current.setDimensions({ width: viewport.width, height: viewport.height });
          const el = fabricCanvasRef.current.getElement();
          if (el) {
            el.width = viewport.width;
            el.height = viewport.height;
          }
          fabricCanvasRef.current.requestRenderAll();
        }
      } catch (err) {
        console.error('Error rendering PDF page:', err);
      }
    };

    renderPage();
  }, [pdfLoaded, currentPage, zoom]);

  // 3) Initialize Fabric.js canvas AFTER we know pageWidth (so the overlay sizes correctly)
  useEffect(() => {
    if (!pdfCanvasRef.current || pageWidth === 0) return;
    if (fabricCanvasRef.current) return;

    const fabricEl = document.getElementById('fabric-canvas') as HTMLCanvasElement | null;
    if (!fabricEl) return;

    const fabricCanvas = new fabric.Canvas(fabricEl, {
      selection: true,
      preserveObjectStacking: true,
    });

    // ensure canvas element size is synced
    fabricCanvas.setDimensions({ width: pageWidth, height: pdfCanvasRef.current!.height });
    const el = fabricCanvas.getElement();
    if (el) {
      el.width = pageWidth;
      el.height = pdfCanvasRef.current!.height;
    }

    fabricCanvasRef.current = fabricCanvas;

    return () => {
      fabricCanvas.dispose();
      fabricCanvasRef.current = null;
    };
  }, [pageWidth]);

  // 4) Add selected image to Fabric canvas
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
          left: 100 + (img.width * scale) / 2,  // position center at 100,100 visually
          top: 100 + (img.height * scale) / 2,
          originX: 'center',
          originY: 'center',
          cornerSize: 10,
          transparentCorners: false,
          borderColor: '#2196f3',
          cornerColor: '#2196f3',
        });


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

        // fire operation (no await so UI doesn't block)
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
      } catch (err) {
        console.error('Error loading image into fabric:', err);
      }
    })();
  }, [selectedImage, pageWidth, sessionId, sessionToken, currentPage, addOperation, dispatch]);

  // 5) Re-render stored images for the current page
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
          img.set({
            left: canvasImg.x + (canvasImg.width / 2),
            top: canvasImg.y + (canvasImg.height / 2),
            originX: 'center',
            originY: 'center',
            scaleX: canvasImg.width / (img.width || 1),
            scaleY: canvasImg.height / (img.height || 1),
            angle: canvasImg.rotation,
            opacity: canvasImg.opacity,
            cornerSize: 10,
            transparentCorners: false,
            borderColor: '#2196f3',
            cornerColor: '#2196f3',
          });
          canvas.add(img);
        } catch (err) {
          console.error('Error rendering stored image:', err);
        }
      }
      canvas.requestRenderAll();
    })();
  }, [currentPage, images]);

  // 6) Handle object modified (move/resize/rotate) — includes rotation in operation data
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    // debounce map so we can coalesce quick successive modifications per object
    const debounceTimers = new Map<string, number>();

    const getObjectSrc = (obj: any): string | undefined => {
      // try recommended API, fallback to internal element src
      try {
        if (typeof obj.getSrc === 'function') return obj.getSrc();
      } catch { }
      return obj._originalElement?.src || obj._element?.src || undefined;
    };

    const round = (n: number, p = 2) => Math.round((n + Number.EPSILON) * Math.pow(10, p)) / Math.pow(10, p);

    const handleObjectModified = (e: any) => {
      const obj = e.target as fabric.Object;
      if (!obj || !sessionId || !sessionToken) return;

      // Find image by matching object URL (more reliable than matching x coordinates)
      const src = getObjectSrc(obj);
      if (!src) return;

      const canvasImg = images.find(
        (img) => img.page === currentPage && img.url === src
      );
      if (!canvasImg) return;

      // Capture new transformed values
      const newX = (obj.left ?? 0) - ((obj.width ?? 0) * (obj.scaleX ?? 1)) / 2;
      const newY = (obj.top ?? 0) - ((obj.height ?? 0) * (obj.scaleY ?? 1)) / 2;
      const newWidth = ((obj.width ?? 0) * (obj.scaleX ?? 1)) as number;
      const newHeight = ((obj.height ?? 0) * (obj.scaleY ?? 1)) as number;
      const newRotation = (obj.angle ?? 0) as number;

      // Capture old values from Redux (before modification)
      const oldX = canvasImg.x;
      const oldY = canvasImg.y;
      const oldWidth = canvasImg.width;
      const oldHeight = canvasImg.height;

      // Debounce per-image so rapid drags / rotations don't flood the backend
      const key = canvasImg.id;
      if (debounceTimers.has(key)) {
        window.clearTimeout(debounceTimers.get(key));
      }

      const timer = window.setTimeout(() => {
        // Update Redux immediately
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

        // Send operation to backend (now including rotation)
        addOperation({
          sessionId,
          sessionToken,
          operationType: 'move_image',
          operationData: {
            page: currentPage,
            image_id: canvasImg.imageId,
            old_position: {
              x: round(oldX),
              y: round(oldY),
              width: round(oldWidth),
              height: round(oldHeight),
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
      }, 300); // 300ms debounce — change if needed

      debounceTimers.set(key, timer);
    };

    canvas.on('object:modified', handleObjectModified);

    return () => {
      // clear any pending timers
      for (const t of debounceTimers.values()) clearTimeout(t);
      canvas.off('object:modified', handleObjectModified);
    };
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
    <Paper elevation={3} sx={{ p: 2, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 600, bgcolor: '#f5f5f5', overflow: 'auto' }}>
      <Box ref={containerRef} sx={{ position: 'relative', display: 'inline-block' }}>
        {/* PDF canvas (background) */}
        <canvas
          ref={pdfCanvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            zIndex: 0,
          }}
        />

        {/* Fabric overlay (foreground) */}
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
