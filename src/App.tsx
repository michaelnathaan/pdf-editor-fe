import { Box, Container, Paper, Typography } from '@mui/material';
import { Routes, Route } from 'react-router-dom';
import FileUploader from './components/FileUploader';
import EditorPage from './pages/EditorPage';

function App() {
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

        <Routes>
          <Route path="/" element={<FileUploader />} />
          <Route path="/edit/:sessionId" element={<EditorPage />} />
        </Routes>
      </Container>
    </Box>
  );
}

export default App;