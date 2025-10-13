import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import editorReducer from '../features/editor/editorSlice';
import { editorAPI } from '../features/editor/editorApi';

export const store = configureStore({
  reducer: {
    editor: editorReducer,
    [editorAPI.reducerPath]: editorAPI.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types (RTK Query with Blob responses)
        ignoredActions: [
          editorAPI.reducerPath + '/executeQuery/fulfilled',
          editorAPI.reducerPath + '/executeMutation/fulfilled',
        ],
        // Ignore these paths in the state (all RTK Query cache)
        ignoredPaths: [
          editorAPI.reducerPath,
        ],
      },
    }).concat(editorAPI.middleware),
});

// Enable refetchOnFocus/refetchOnReconnect behaviors
setupListeners(store.dispatch);

// Export types
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;