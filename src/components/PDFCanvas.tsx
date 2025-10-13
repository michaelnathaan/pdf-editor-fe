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
  const [pageHeight, setPageHeight] = useState<number>(0);

  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load PDF document
  useEffect(() => {
    const loadPDF = async () => {
      try {
        setLoading(true);
        setError(null);

        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        const pdf = await loadingTask.promise;
        pdfDocRef.current = pdf;

        setLoading(false);
      } catch (err: any) {
        console.error('Error loading PDF:', err);
        setError(err.message || 'Failed to load PDF');
        setLoading(false);
      }
    };

    if (pdfUrl) {
      loadPDF();
    }

    return () => {
      pdfDocRef.current?.destroy();
    };
  }, [pdfUrl]);

  // Render PDF page
  useEffect(() => {
    const renderPage = async () => {
      if (!pdfDocRef.current || !pdfCanvasRef.current) return;

      try {
        const page = await pdfDocRef.current.getPage(currentPage + 1);
        const viewport = page.getViewport({ scale: zoom });

        const canvas = pdfCanvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        setPageWidth(viewport.width);
        setPageHeight(viewport.height);

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
          canvas: canvas, // Add canvas property for pdfjs-dist v5+
        };

        await page.render(renderContext).promise;

        // Initialize or resize Fabric canvas to match PDF
        if (fabricCanvasRef.current) {
          fabricCanvasRef.current.width = viewport.width;
          fabricCanvasRef.current.height = viewport.height;
          fabricCanvasRef.current.setZoom(1); // Zoom is handled by PDF viewport
        }
      } catch (err) {
        console.error('Error rendering page:', err);
      }
    };

    renderPage();
  }, [currentPage, zoom, pdfDocRef.current]);

  // Initialize Fabric.js canvas
  useEffect(() => {
    if (!pdfCanvasRef.current) return;

    // Create Fabric canvas overlay
    const fabricCanvas = new fabric.Canvas('fabric-canvas', {
      selection: true,
      preserveObjectStacking: true,
    });

    fabricCanvasRef.current = fabricCanvas;

    return () => {
      fabricCanvas.dispose();
    };
  }, []);

  // Add selected image to canvas
  useEffect(() => {
    if (!selectedImage || !fabricCanvasRef.current || !sessionId || !sessionToken) return;

    fabric.FabricImage.fromURL(
      selectedImage.url,
      {
        crossOrigin: 'anonymous'
      }
    ).then((img: fabric.FabricImage) => {
      if (!fabricCanvasRef.current) return;

      // Scale image to reasonable size
      const maxWidth = pageWidth * 0.3;
      const scale = maxWidth / (img.width || 1);

      img.scale(scale);
      img.set({
        left: 100,
        top: 100,
        cornerSize: 10,
        transparentCorners: false,
        borderColor: '#2196f3',
        cornerColor: '#2196f3',
      });

      fabricCanvasRef.current.add(img);
      fabricCanvasRef.current.setActiveObject(img);
      fabricCanvasRef.current.renderAll();

      // Save to Redux
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

      // Send operation to backend
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
    });
  }, [selectedImage, currentPage, pageWidth, sessionId, sessionToken, dispatch, addOperation]);

  // Render images on current page
  useEffect(() => {
    if (!fabricCanvasRef.current) return;

    const canvas = fabricCanvasRef.current;
    canvas.clear();

    // Filter images for current page
    const pageImages = images.filter((img) => img.page === currentPage);

    pageImages.forEach((canvasImg) => {
      fabric.FabricImage.fromURL(
        canvasImg.url,
        {
          crossOrigin: 'anonymous'
        }
      ).then((img: fabric.FabricImage) => {
        if (!fabricCanvasRef.current) return;

        img.set({
          left: canvasImg.x,
          top: canvasImg.y,
          scaleX: canvasImg.width / (img.width || 1),
          scaleY: canvasImg.height / (img.height || 1),
          angle: canvasImg.rotation,
          opacity: canvasImg.opacity,
          cornerSize: 10,
          transparentCorners: false,
          borderColor: '#2196f3',
          cornerColor: '#2196f3',
        });

        fabricCanvasRef.current?.add(img);
        fabricCanvasRef.current?.renderAll();
      });
    });
  }, [currentPage, images]);

  // Handle object modifications
  useEffect(() => {
    if (!fabricCanvasRef.current) return;

    const canvas = fabricCanvasRef.current;

    const handleObjectModified = (e: any) => {
      const obj = e.target as fabric.FabricImage;
      if (!obj || !sessionId || !sessionToken) return;

      // Find corresponding image in Redux
      const canvasImg = images.find(
        (img) => img.page === currentPage && Math.abs(img.x - (obj.left || 0)) < 5
      );

      if (canvasImg) {
        const newX = obj.left || 0;
        const newY = obj.top || 0;
        const newWidth = (obj.width || 0) * (obj.scaleX || 1);
        const newHeight = (obj.height || 0) * (obj.scaleY || 1);

        // Update Redux
        dispatch(
          updateImage({
            id: canvasImg.id,
            updates: {
              x: newX,
              y: newY,
              width: newWidth,
              height: newHeight,
              rotation: obj.angle || 0,
            },
          })
        );

        // Send update operation to backend
        addOperation({
          sessionId,
          sessionToken,
          operationType: 'move_image',
          operationData: {
            page: currentPage,
            image_id: canvasImg.imageId,
            old_position: {
              x: canvasImg.x,
              y: canvasImg.y,
              width: canvasImg.width,
              height: canvasImg.height,
            },
            new_position: {
              x: newX,
              y: newY,
              width: newWidth,
              height: newHeight,
            },
          },
        });
      }
    };

    canvas.on('object:modified', handleObjectModified);

    return () => {
      canvas.off('object:modified', handleObjectModified);
    };
  }, [images, currentPage, sessionId, sessionToken, dispatch, addOperation]);

  if (loading) {
    return (
      <Paper
        elevation={3}
        sx={{
          p: 2,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 600,
        }}
      >
        <CircularProgress />
      </Paper>
    );
  }

  if (error) {
    return (
      <Paper
        elevation={3}
        sx={{
          p: 2,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 600,
        }}
      >
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
        position: 'relative',
        overflow: 'auto',
      }}
    >
      <Box ref={containerRef} sx={{ position: 'relative' }}>
        {/* PDF Canvas */}
        <canvas ref={pdfCanvasRef} style={{ display: 'block' }} />

        {/* Fabric.js Canvas Overlay */}
        <canvas
          id="fabric-canvas"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            pointerEvents: 'auto',
          }}
        />
      </Box>
    </Paper>
  );
}