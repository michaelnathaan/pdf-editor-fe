import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Box,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import { AddPhotoAlternate } from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { useUploadImageMutation } from '../features/editor/editorApi';

interface UploadedImage {
  id: string;
  filename: string;
  url: string;
  width: number;
  height: number;
}

interface ImageUploadProps {
  onImageSelect: (imageData: { id: string; url: string; width: number; height: number }) => void;
}

export default function ImageUpload({ onImageSelect }: ImageUploadProps) {
  const { sessionId, sessionToken } = useSelector((state: RootState) => state.editor);
  const [uploadImage, { isLoading }] = useUploadImageMutation();
  const [error, setError] = useState<string | null>(null);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0 || !sessionId || !sessionToken) return;

    const file = acceptedFiles[0];

    if (file.size > 10 * 1024 * 1024) {
      setError('Image size must be less than 10MB');
      return;
    }

    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await uploadImage({
        sessionId,
        sessionToken,
        formData,
      }).unwrap();

      const newImage = {
        id: response.id,
        filename: response.original_filename,
        url: response.image_url,
        width: response.width,
        height: response.height,
      };

      setUploadedImages((prev) => [...prev, newImage]);
      onImageSelect({
        id: newImage.id,
        url: newImage.url,
        width: newImage.width,
        height: newImage.height,
      });

      // DON'T auto-select - let user click to add
      console.log('Image uploaded:', newImage.filename);

    } catch (err: any) {
      console.error('Image upload error:', err);
      setError(err?.data?.detail || 'Failed to upload image');
    }
  }, [sessionId, sessionToken, uploadImage]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp']
    },
    maxFiles: 1,
    disabled: isLoading,
  });

  // const handleRemoveImage = (id: string) => {
  //   setUploadedImages((prev) => prev.filter((img) => img.id !== id));
  // };

  return (
    <Paper elevation={2} sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h6" gutterBottom>
        Images
      </Typography>

      <Box
        {...getRootProps()}
        sx={{
          border: '2px dashed',
          borderColor: isDragActive ? 'primary.main' : 'grey.300',
          borderRadius: 1,
          p: 2,
          textAlign: 'center',
          bgcolor: isDragActive ? 'action.hover' : 'background.paper',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          mb: 2,
          '&:hover': {
            borderColor: isLoading ? 'grey.300' : 'primary.main',
          },
        }}
      >
        <input {...getInputProps()} />

        {isLoading ? (
          <CircularProgress size={40} />
        ) : (
          <Box>
            <AddPhotoAlternate sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              {isDragActive ? 'Drop image here' : 'Click or drag image'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              JPG, PNG, GIF, WebP (Max 10MB)
            </Typography>
          </Box>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {uploadedImages.length > 0 && (
        <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
          <Typography variant="subtitle2" gutterBottom>
            Uploaded Image History ({uploadedImages.length})
          </Typography>
          <List dense>
            {uploadedImages.map((image) => (
              <ListItem
                key={image.id}
                // secondaryAction={
                //   <IconButton
                //     edge="end"
                //     size="small"
                //     onClick={(e) => {
                //       e.stopPropagation();
                //       handleRemoveImage(image.id);
                //     }}
                //   >
                //     <Delete fontSize="small" />
                //   </IconButton>
                // }
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  mb: 1,
                  cursor: 'pointer',
                  '&:hover': {
                    bgcolor: 'action.hover',
                    borderColor: 'primary.main',
                  },
                }}
                // onClick={() => handleImageClick(image)}
              >
                <ListItemText
                  primary={image.filename}
                  secondary={`${image.width} × ${image.height}px`}
                  primaryTypographyProps={{
                    variant: 'body2',
                    noWrap: true,
                  }}
                  secondaryTypographyProps={{
                    variant: 'caption',
                  }}
                />
              </ListItem>
            ))}
          </List>
        </Box>
      )}
    </Paper>
  );
}