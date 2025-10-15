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

  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const fabricCanvasElementRef = useRef<HTMLCanvasElement>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  console.log('PDFCanvas render - selectedImage:', selectedImage);
  console.log('PDFCanvas render - fabricCanvasRef.current:', !!fabricCanvasRef.current);

  // 1. Load PDF document
  useEffect(() => {
    const loadPDF = async () => {
      try {
        console.log('Loading PDF from:', pdfUrl);
        setLoading(true);
        setError(null);

        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        const pdf = await loadingTask.promise;
        pdfDocRef.current = pdf;

        console.log('PDF loaded successfully, pages:', pdf.numPages);
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
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy();
        pdfDocRef.current = null;
      }
    };
  }, [pdfUrl]);

  // 2. Initialize Fabric.js canvas (after PDF canvas is rendered)
  useEffect(() => {
    // Wait for both PDF canvas to exist AND have dimensions
    if (!pdfCanvasRef.current || pageWidth === 0) {
      console.log('⏳ Waiting for PDF canvas to render before initializing Fabric');
      console.log('  - pdfCanvasRef.current exists:', !!pdfCanvasRef.current);
      console.log('  - pageWidth:', pageWidth);
      return;
    }

    // Only initialize once
    if (fabricCanvasRef.current) {
      console.log('✅ Fabric already initialized');
      return;
    }

    console.log('🎨 Initializing Fabric canvas');
    console.log('  - Width:', pageWidth);
    console.log('  - Height:', pdfCanvasRef.current.height);

    const fabricCanvas = new fabric.Canvas('fabric-canvas', {
      selection: true,
      preserveObjectStacking: true,
      width: pageWidth,
      height: pdfCanvasRef.current.height,
    });

    fabricCanvasRef.current = fabricCanvas;
    console.log('✅ Fabric canvas initialized with dimensions:', pageWidth, 'x', pdfCanvasRef.current.height);

    // Log actual DOM positions
    setTimeout(() => {
      if (pdfCanvasRef.current && containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const pdfRect = pdfCanvasRef.current.getBoundingClientRect();
        const fabricElement = document.getElementById('fabric-canvas');
        const fabricRect = fabricElement?.getBoundingClientRect();

        console.log('📏 DOM Measurements:');
        console.log('  Container:', {
          top: containerRect.top,
          left: containerRect.left,
          width: containerRect.width,
          height: containerRect.height,
        });
        console.log('  PDF Canvas:', {
          top: pdfRect.top,
          left: pdfRect.left,
          width: pdfRect.width,
          height: pdfRect.height,
        });
        console.log('  Fabric Canvas:', fabricRect ? {
          top: fabricRect.top,
          left: fabricRect.left,
          width: fabricRect.width,
          height: fabricRect.height,
        } : 'NOT FOUND');

        // Check if they overlap
        if (pdfRect && fabricRect) {
          const topDiff = Math.abs(pdfRect.top - fabricRect.top);
          const leftDiff = Math.abs(pdfRect.left - fabricRect.left);
          console.log('  ⚠️ Position Difference:');
          console.log('    Top difference:', topDiff, 'px');
          console.log('    Left difference:', leftDiff, 'px');

          if (topDiff > 5 || leftDiff > 5) {
            console.error('❌ CANVASES ARE NOT ALIGNED!');
          } else {
            console.log('✅ Canvases are aligned');
          }
        }
      }
    }, 100);

    return () => {
      console.log('🗑️ Disposing Fabric canvas');
      fabricCanvas.dispose();
      fabricCanvasRef.current = null;
    };
  }, [pageWidth]);

  // 3. Render PDF page
  useEffect(() => {
    const renderPage = async () => {
      if (!pdfDocRef.current || !pdfCanvasRef.current) {
        console.log('⏳ Cannot render - missing refs');
        return;
      }

      try {
        console.log(`📄 Rendering page ${currentPage + 1} with zoom ${zoom}`);
        const page = await pdfDocRef.current.getPage(currentPage + 1);
        const viewport = page.getViewport({ scale: zoom });

        const canvas = pdfCanvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        console.log('📐 PDF canvas dimensions:', viewport.width, 'x', viewport.height);
        setPageWidth(viewport.width);

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
          canvas: canvas,
        };

        await page.render(renderContext).promise;
        console.log('✅ PDF page rendered');

        // Resize Fabric canvas to match PDF
        if (fabricCanvasRef.current) {
          fabricCanvasRef.current.setDimensions({
            width: viewport.width,
            height: viewport.height,
          });
          fabricCanvasRef.current.setZoom(1);
          console.log('🔄 Fabric canvas resized to:', viewport.width, 'x', viewport.height);
        }
      } catch (err) {
        console.error('❌ Error rendering page:', err);
      }
    };

    renderPage();
  }, [currentPage, zoom]);

  // 4. Add selected image to canvas
  useEffect(() => {
    console.log('🖼️ selectedImage effect triggered');
    console.log('  - selectedImage:', selectedImage);
    console.log('  - fabricCanvasRef.current exists:', !!fabricCanvasRef.current);
    console.log('  - pageWidth:', pageWidth);

    if (!selectedImage) {
      console.log('  ℹ️ No selected image');
      return;
    }

    if (!fabricCanvasRef.current) {
      console.log('  ⏳ Fabric canvas not ready yet');
      return;
    }

    if (!sessionId || !sessionToken) {
      console.log('  ⚠️ Missing session');
      return;
    }

    console.log('🚀 Adding image to canvas...');

    fabric.FabricImage.fromURL(
      selectedImage.url,
      {
        crossOrigin: 'anonymous'
      }
    ).then((img: fabric.FabricImage) => {
      console.log('✅ Image loaded from URL');

      if (!fabricCanvasRef.current) {
        console.log('  ⚠️ Fabric canvas disposed while loading');
        return;
      }

      // Scale image to reasonable size
      const maxWidth = pageWidth * 0.3;
      const scale = maxWidth / (img.width || 1);

      console.log('📏 Image sizing:');
      console.log('  - Original size:', img.width, 'x', img.height);
      console.log('  - Scaling factor:', scale);
      console.log('  - Final size:', maxWidth, 'x', (img.height || 0) * scale);

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

      console.log('✅ Image added to Fabric canvas');
      console.log('  - Canvas object count:', fabricCanvasRef.current.getObjects().length);
      console.log('  - Image position:', { left: img.left, top: img.top });
      console.log('  - Image size:', {
        width: (img.width || 0) * (img.scaleX || 1),
        height: (img.height || 0) * (img.scaleY || 1)
      });

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
      console.log('💾 Image saved to Redux');

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
      console.log('📤 Operation sent to backend');
    }).catch((err) => {
      console.error('❌ Error loading image from URL:', err);
    });
  }, [selectedImage]);

  // 5. Render images on current page
  useEffect(() => {
    if (!fabricCanvasRef.current) return;

    console.log('🔄 Re-rendering images for page', currentPage);
    const canvas = fabricCanvasRef.current;
    canvas.clear();

    const pageImages = images.filter((img) => img.page === currentPage);
    console.log('  - Page images count:', pageImages.length);

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

  // 6. Handle object modifications
  useEffect(() => {
    if (!fabricCanvasRef.current) return;

    const canvas = fabricCanvasRef.current;

    const handleObjectModified = (e: any) => {
      const obj = e.target as fabric.FabricImage;
      if (!obj || !sessionId || !sessionToken) return;

      console.log('🖱️ Object modified:', {
        left: obj.left,
        top: obj.top,
        width: (obj.width || 0) * (obj.scaleX || 1),
        height: (obj.height || 0) * (obj.scaleY || 1),
      });

      const canvasImg = images.find(
        (img) => img.page === currentPage && Math.abs(img.x - (obj.left || 0)) < 5
      );

      if (canvasImg) {
        const newX = obj.left || 0;
        const newY = obj.top || 0;
        const newWidth = (obj.width || 0) * (obj.scaleX || 1);
        const newHeight = (obj.height || 0) * (obj.scaleY || 1);

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
        overflow: 'auto',
      }}
    >
      <Box
        ref={containerRef}
        sx={{
          position: 'relative',
          display: 'inline-block',
          border: '5px solid yellow',
          boxShadow: '0 0 10px yellow',
        }}
      >
        {/* PDF Canvas - positioned absolutely at (0,0) */}
        <canvas
          ref={pdfCanvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            border: '3px solid red',
            boxSizing: 'border-box',
            zIndex: 0,
          }}
        />

        {/* Fabric.js Canvas Overlay - on top of PDF */}
        {pageWidth > 0 && (
          <canvas
            id="fabric-canvas"
            width={pageWidth}
            height={pdfCanvasRef.current?.height || 0}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              border: '3px solid blue',
              boxSizing: 'border-box',
              pointerEvents: 'auto',
              zIndex: 1,
            }}
          />
        )}
      </Box>

    </Paper>
  );
}