import { useState, useEffect } from 'react';
import { Box, Grid, Typography } from '@mui/material';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import Toolbar from './Toolbar';
import PageNavigator from './PageNavigator';
import ImageUpload from './ImageUpload';
import PDFCanvas from './PDFCanvas';
import { useLazyDownloadOriginalPDFQuery } from '../features/editor/editorApi';

export default function Editor() {
  const { fileId, fileName } = useSelector((state: RootState) => state.editor);
  const [downloadPDF, { data: pdfBlob }] = useLazyDownloadOriginalPDFQuery();
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [selectedImage, setSelectedImage] = useState<{
    id: string;
    url: string;
    width: number;
    height: number;
  } | null>(null);
  const [undoStack, setUndoStack] = useState<any[]>([]);
  const [redoStack, setRedoStack] = useState<any[]>([]);

  // Download PDF when component mounts
  useEffect(() => {
    if (fileId) {
      downloadPDF(fileId);
    }
  }, [fileId, downloadPDF]);

  // Create blob URL from PDF data
  useEffect(() => {
    if (pdfBlob) {
      const url = URL.createObjectURL(pdfBlob);
      setPdfUrl(url);

      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [pdfBlob]);

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    
    const lastOperation = undoStack[undoStack.length - 1];
    setRedoStack([...redoStack, lastOperation]);
    setUndoStack(undoStack.slice(0, -1));
    
    // TODO: Implement actual undo logic with backend
    console.log('Undo:', lastOperation);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    
    const lastRedo = redoStack[redoStack.length - 1];
    setUndoStack([...undoStack, lastRedo]);
    setRedoStack(redoStack.slice(0, -1));
    
    // TODO: Implement actual redo logic with backend
    console.log('Redo:', lastRedo);
  };

  const handleImageSelect = (imageData: {
    id: string;
    url: string;
    width: number;
    height: number;
  }) => {
    setSelectedImage(imageData);
  };

  return (
    <Box>
      {/* File Info */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          Editing: {fileName}
        </Typography>
      </Box>

      {/* Toolbar */}
      <Toolbar
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
      />

      {/* Page Navigator */}
      <PageNavigator />

      {/* Main Content - Using Grid2 for MUI v7 */}
      <Grid container spacing={2}>
        {/* Left Sidebar - Image Upload */}
        <Grid size={{ xs: 12, md: 3 }}>
          <ImageUpload onImageSelect={handleImageSelect} />
        </Grid>

        {/* Center - PDF Canvas */}
        <Grid size={{ xs: 12, md: 9 }}>
          {pdfUrl ? (
            <PDFCanvas pdfUrl={pdfUrl} selectedImage={selectedImage} />
          ) : (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: 600,
              }}
            >
              <Typography>Loading PDF...</Typography>
            </Box>
          )}
        </Grid>
      </Grid>
    </Box>
  );
}