import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { EditorState, CanvasImage, OperationResponse } from '../../types';

const initialState: EditorState = {
  fileId: null,
  sessionId: null,
  sessionToken: null,
  fileName: null,
  pageCount: 0,
  currentPage: 0,
  zoom: 1.0,
  images: [],
  operations: [],
  isLoading: false,
  error: null,
};

const editorSlice = createSlice({
  name: 'editor',
  initialState,
  reducers: {
    setFile: (state, action: PayloadAction<{ fileId: string; fileName: string; pageCount: number }>) => {
      state.fileId = action.payload.fileId;
      state.fileName = action.payload.fileName;
      state.pageCount = action.payload.pageCount;
    },
    setCurrentPage: (state, action: PayloadAction<number>) => {
      state.currentPage = action.payload;
    },
    setZoom: (state, action: PayloadAction<number>) => {
      state.zoom = action.payload;
    },
    addImage: (state, action: PayloadAction<CanvasImage>) => {
      state.images.push(action.payload);
    },
    updateImage: (state, action: PayloadAction<{ id: string; updates: Partial<CanvasImage> }>) => {
      const index = state.images.findIndex(img => img.id === action.payload.id);
      if (index !== -1) {
        state.images[index] = { ...state.images[index], ...action.payload.updates };
      }
    },
    removeImage: (state, action: PayloadAction<string>) => {
      state.images = state.images.filter(img => img.id !== action.payload);
    },
    addOperation: (state, action: PayloadAction<OperationResponse>) => {
      state.operations.push(action.payload);
    },
    setOperations: (state, action: PayloadAction<OperationResponse[]>) => {
      state.operations = action.payload;
    },
    clearOperations: (state) => {
      state.operations = [];
      state.images = [];
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    resetEditor: () => {
      return initialState;
    },
    setSession: (state, action: PayloadAction<{
      sessionId: string;
      sessionToken: string;
    }>) => {
      state.sessionId = action.payload.sessionId;
      state.sessionToken = action.payload.sessionToken;
    },
    setFileInfo: (state, action: PayloadAction<{
      fileId: string;
      fileName: string;
      pageCount: number
    }>) => {
      state.fileId = action.payload.fileId;
      state.fileName = action.payload.fileName;
      state.pageCount = action.payload.pageCount;
    },
  },
});

export const {
  setFile,
  setCurrentPage,
  setZoom,
  addImage,
  updateImage,
  removeImage,
  addOperation,
  setOperations,
  clearOperations,
  setLoading,
  setError,
  resetEditor,
  setSession,
  setFileInfo
} = editorSlice.actions;

export default editorSlice.reducer;