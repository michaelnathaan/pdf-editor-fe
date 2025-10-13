import { Paper, IconButton, Typography } from '@mui/material';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store/store';
import { setCurrentPage } from '../features/editor/editorSlice';

export default function PageNavigator() {
  const dispatch = useDispatch();
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

  return (
    <Paper
      elevation={2}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        p: 1,
        mb: 2,
      }}
    >
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
    </Paper>
  );
}