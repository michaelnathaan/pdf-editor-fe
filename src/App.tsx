import { Box, Container, Paper, Typography } from '@mui/material';
import { useSelector } from 'react-redux';
import type { RootState } from './store/store';
import FileUploader from './components/FileUploader';
import Editor from './components/Editor';

function App() {
  const { fileId, sessionId } = useSelector((state: RootState) => state.editor);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', py: 3 }}>
      <Container maxWidth="xl">
        <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            PDF Editor
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Upload a PDF and add images to it
          </Typography>
        </Paper>

        {!fileId || !sessionId ? (
          <FileUploader />
        ) : (
          <Editor />
        )}
      </Container>
    </Box>
  );
}

export default App;