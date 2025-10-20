import { useState } from 'react';
import {
  Box,
  Paper,
  IconButton,
  Tooltip,
  // Divider,
  Button,
  // CircularProgress,
  Snackbar,
  Alert,
  Typography,
} from '@mui/material';
import {
  ChevronLeft,
  ChevronRight,
  // ZoomIn,
  // ZoomOut,
  // Undo,
  // Redo,
  // Save,
  Download,
  RestartAlt,
} from '@mui/icons-material';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store/store';
import { setZoom, clearOperations, setCurrentPage } from '../features/editor/editorSlice';
import {
  useCommitSessionMutation,
  useLazyDownloadEditedPDFQuery,
  useClearOperationsMutation,
} from '../features/editor/editorApi';

interface ToolbarProps {
  // onUndo: () => void;
  // onRedo: () => void;
  // canUndo: boolean;
  // canRedo: boolean;
}

export default function Toolbar({ }: ToolbarProps) {
  const dispatch = useDispatch();
  const { zoom, fileId, sessionId, sessionToken, fileName } = useSelector(
    (state: RootState) => state.editor
  );

  const [commitSession] = useCommitSessionMutation();
  const [downloadPDF] = useLazyDownloadEditedPDFQuery();
  const [clearOps] = useClearOperationsMutation();

  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });

  const { currentPage, pageCount } = useSelector((state: RootState) => state.editor);

  const handlePrevPage = () => {
    if (currentPage > 0) {
      dispatch(setCurrentPage(currentPage - 1));
    }
  };

  const handleNextPage = () => {
    if (currentPage < pageCount - 1) {
      dispatch(setCurrentPage(currentPage + 1));
    }
  };


  // const handleZoomIn = () => {
  //   if (zoom < 3) {
  //     dispatch(setZoom(Math.min(zoom + 0.25, 3)));
  //   }
  // };

  // const handleZoomOut = () => {
  //   if (zoom > 0.5) {
  //     dispatch(setZoom(Math.max(zoom - 0.25, 0.5)));
  //   }
  // };

  // const handleSave = async () => {
  //   if (!fileId || !sessionId || !sessionToken) return;

  //   try {
  //     await commitSession({ fileId, sessionId, sessionToken }).unwrap();
  //     setSnackbar({
  //       open: true,
  //       message: 'PDF saved successfully!',
  //       severity: 'success',
  //     });
  //   } catch (error: any) {
  //     setSnackbar({
  //       open: true,
  //       message: error?.data?.detail || 'Failed to save PDF',
  //       severity: 'error',
  //     });
  //   }
  // };

  const handleDownload = async () => {
    if (!sessionId || !sessionToken) return;

    try {
      if (fileId) {
        await commitSession({ fileId, sessionId, sessionToken }).unwrap();
        const result = await downloadPDF({ fileId, sessionId, sessionToken }).unwrap();
        const url = window.URL.createObjectURL(result);
        const a = document.createElement('a');
        a.href = url;
        a.download = `edited_${fileName || 'document.pdf'}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }

      setSnackbar({
        open: true,
        message: 'PDF downloaded successfully!',
        severity: 'success',
      });

      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error: any) {
      setSnackbar({
        open: true,
        message: error?.data?.detail || 'Failed to download PDF',
        severity: 'error',
      });
    }
  };

  const handleReset = async () => {
    if (!sessionId || !sessionToken) return;

    if (window.confirm('Are you sure you want to reset all changes?')) {
      try {
        await clearOps({ sessionId, sessionToken }).unwrap();
        dispatch(clearOperations());
        setSnackbar({
          open: true,
            message: 'All changes reset',
            severity: 'success',
          });
        } catch (error) {
          setSnackbar({
            open: true,
            message: 'Failed to reset changes',
            severity: 'error',
          });
        }
      }
    };

    return (
      <>
        <Paper
          elevation={2}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            p: 1,
            mb: 2,
        }}
      >
        {/* <Tooltip title="Zoom Out">
          <span>
            <IconButton onClick={handleZoomOut} disabled={zoom <= 0.5}>
              <ZoomOut />
            </IconButton>
          </span>
        </Tooltip>

        <Box sx={{ minWidth: 60, textAlign: 'center', fontSize: '0.875rem' }}>
          {Math.round(zoom * 100)}%
        </Box>

        <Tooltip title="Zoom In">
          <span>
            <IconButton onClick={handleZoomIn} disabled={zoom >= 3}>
              <ZoomIn />
            </IconButton>
          </span>
        </Tooltip> */}

        {/* <Divider orientation="vertical" flexItem sx={{ mx: 1 }} /> */}

        {/* <Tooltip title="Undo">
          <span>
            <IconButton onClick={onUndo} disabled={!canUndo}>
              <Undo />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title="Redo">
          <span>
            <IconButton onClick={onRedo} disabled={!canRedo}>
              <Redo />
            </IconButton>
          </span>
        </Tooltip> */}

        {/* <Divider orientation="vertical" flexItem sx={{ mx: 1 }} /> */}

        <Tooltip title="Reset All Changes">
          <IconButton onClick={handleReset} color="error">
            <RestartAlt />
          </IconButton>
        </Tooltip>
        <IconButton
          onClick={handlePrevPage}
          disabled={currentPage === 0}
          size="small"
        >
          <ChevronLeft />
        </IconButton>

        <Typography variant="body2">
          Page {currentPage + 1} of {pageCount}
        </Typography>

        <IconButton
          onClick={handleNextPage}
          disabled={currentPage === pageCount - 1}
          size="small"
        >
          <ChevronRight />
        </IconButton>

        <Box sx={{ flexGrow: 1 }} />

        {/* <Button
          variant="contained"
          startIcon={isSaving ? <CircularProgress size={20} /> : <Save />}
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </Button> */}

        <Button
          variant="outlined"
          startIcon={<Download />}
          onClick={handleDownload}
        >
          Save and Download
        </Button>
      </Paper>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}