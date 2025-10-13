import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Box, Paper, Typography, Button, CircularProgress, Alert } from '@mui/material';
import { CloudUpload as UploadIcon } from '@mui/icons-material';
import { useDispatch } from 'react-redux';
import { useUploadFileMutation, useCreateSessionMutation } from '../features/editor/editorApi';
import { setFile, setSession } from '../features/editor/editorSlice';

export default function FileUploader() {
  const dispatch = useDispatch();
  const [uploadFile, { isLoading: isUploading }] = useUploadFileMutation();
  const [createSession, { isLoading: isCreatingSession }] = useCreateSessionMutation();
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];

    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file');
      return;
    }

    if (file.size > 52428800) {
      setError('File size must be less than 50MB');
      return;
    }

    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const uploadResponse = await uploadFile(formData).unwrap();
      dispatch(setFile({
        fileId: uploadResponse.id,
        fileName: uploadResponse.original_filename,
        pageCount: uploadResponse.page_count,
      }));

      const sessionResponse = await createSession({
        fileId: uploadResponse.id,
      }).unwrap();

      dispatch(setSession({
        sessionId: sessionResponse.session_id,
        sessionToken: sessionResponse.session_token,
      }));

    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err?.data?.detail || 'Failed to upload file. Please try again.');
    }
  }, [uploadFile, createSession, dispatch]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    maxFiles: 1,
    disabled: isUploading || isCreatingSession,
  });

  const isLoading = isUploading || isCreatingSession;

  return (
    <Paper elevation={3} sx={{ p: 4 }}>
      <Box
        {...getRootProps()}
        sx={{
          border: '2px dashed',
          borderColor: isDragActive ? 'primary.main' : 'grey.300',
          borderRadius: 2,
          p: 6,
          textAlign: 'center',
          bgcolor: isDragActive ? 'action.hover' : 'background.paper',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s',
          '&:hover': {
            borderColor: isLoading ? 'grey.300' : 'primary.main',
            bgcolor: isLoading ? 'background.paper' : 'action.hover',
          },
        }}
      >
        <input {...getInputProps()} />
        
        {isLoading ? (
          <Box>
            <CircularProgress size={60} sx={{ mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              {isUploading ? 'Uploading PDF...' : 'Creating session...'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Please wait
            </Typography>
          </Box>
        ) : (
          <Box>
            <UploadIcon sx={{ fontSize: 80, color: 'primary.main', mb: 2 }} />
            <Typography variant="h5" gutterBottom>
              {isDragActive ? 'Drop PDF here' : 'Upload PDF File'}
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              Drag and drop your PDF file here, or click to browse
            </Typography>
            <Button variant="contained" component="span" size="large">
              Select PDF File
            </Button>
            <Typography variant="caption" display="block" sx={{ mt: 2 }} color="text.secondary">
              Maximum file size: 50MB
            </Typography>
          </Box>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
    </Paper>
  );
}