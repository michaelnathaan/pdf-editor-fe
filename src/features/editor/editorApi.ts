import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type {
    FileUploadResponse,
    SessionCreateResponse,
    ImageUploadResponse,
    OperationResponse,
    OperationData,
    OperationType,
} from '../../types';

const API_KEY = 'ANpJbVcp8H'; // TODO: Move to env variable

export const editorAPI = createApi({
  reducerPath: 'editorAPI',
  baseQuery: fetchBaseQuery({ baseUrl: 'http://localhost:8000/api/v1' }),
  tagTypes: ['File', 'Session', 'Operations', 'Images'],
  endpoints: (builder) => ({
    // Upload PDF file
    uploadFile: builder.mutation<FileUploadResponse, FormData>({
      query: (formData) => ({
        url: '/files/upload',
        method: 'POST',
        body: formData,
        headers: {
          'X-API-Key': API_KEY,
        },
      }),
      invalidatesTags: ['File'],
    }),

    // Get file info
    getFile: builder.query<FileUploadResponse, string>({
      query: (fileId) => ({
        url: `/files/${fileId}`,
        headers: {
          'X-API-Key': API_KEY,
        },
      }),
      providesTags: ['File'],
    }),

    // Create editing session
    createSession: builder.mutation<
      SessionCreateResponse,
      { fileId: string; expiresInHours?: number; callbackUrl?: string }
    >({
      query: ({ fileId, expiresInHours = 24, callbackUrl }) => ({
        url: `/files/${fileId}/sessions`,
        method: 'POST',
        body: {
          expires_in_hours: expiresInHours,
          callback_url: callbackUrl,
          permissions: {
            can_edit: true,
            can_download: true,
          },
        },
        headers: {
          'X-API-Key': API_KEY,
        },
      }),
      invalidatesTags: ['Session'],
    }),

    // Upload image to session
    uploadImage: builder.mutation<
      ImageUploadResponse,
      { sessionId: string; sessionToken: string; formData: FormData }
    >({
      query: ({ sessionId, sessionToken, formData }) => ({
        url: `/sessions/${sessionId}/images?session_token=${sessionToken}`,
        method: 'POST',
        body: formData,
      }),
      invalidatesTags: ['Images'],
    }),

    // Get image
    getImage: builder.query<Blob, { sessionId: string; imageId: string; sessionToken: string }>({
      query: ({ sessionId, imageId, sessionToken }) => ({
        url: `/sessions/${sessionId}/images/${imageId}?session_token=${sessionToken}`,
        responseHandler: (response) => response.blob(),
      }),
      providesTags: ['Images'],
    }),

    // Add operation
    addOperation: builder.mutation<
      OperationResponse,
      {
        sessionId: string;
        sessionToken: string;
        operationType: OperationType;
        operationData: OperationData;
      }
    >({
      query: ({ sessionId, sessionToken, operationType, operationData }) => ({
        url: `/sessions/${sessionId}/operations?session_token=${sessionToken}`,
        method: 'POST',
        body: {
          operation_type: operationType,
          operation_data: operationData,
        },
      }),
      invalidatesTags: ['Operations'],
    }),

    // Get all operations
    getOperations: builder.query<
      { operations: OperationResponse[]; total: number },
      { sessionId: string; sessionToken: string }
    >({
      query: ({ sessionId, sessionToken }) => ({
        url: `/sessions/${sessionId}/operations?session_token=${sessionToken}`,
      }),
      providesTags: ['Operations'],
    }),

    // Delete operation (undo)
    deleteOperation: builder.mutation<
      void,
      { sessionId: string; operationId: string; sessionToken: string }
    >({
      query: ({ sessionId, operationId, sessionToken }) => ({
        url: `/sessions/${sessionId}/operations/${operationId}?session_token=${sessionToken}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Operations'],
    }),

    // Clear all operations
    clearOperations: builder.mutation<void, { sessionId: string; sessionToken: string }>({
      query: ({ sessionId, sessionToken }) => ({
        url: `/sessions/${sessionId}/operations?session_token=${sessionToken}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Operations'],
    }),

    // Commit session (save edited PDF)
    commitSession: builder.mutation<
      {
        session_id: string;
        file_id: string;
        status: string;
        edited_file_path: string;
        edited_file_size: number;
        download_url: string;
        completed_at: string;
      },
      { fileId: string; sessionId: string; sessionToken: string }
    >({
      query: ({ fileId, sessionId, sessionToken }) => ({
        url: `/files/${fileId}/sessions/${sessionId}/commit?session_token=${sessionToken}`,
        method: 'POST',
      }),
      invalidatesTags: ['Session'],
    }),

    // Download edited PDF
    downloadEditedPDF: builder.query<Blob, { fileId: string; sessionId: string; sessionToken: string }>({
      query: ({ fileId, sessionId, sessionToken }) => ({
        url: `/files/${fileId}/sessions/${sessionId}/download?session_token=${sessionToken}`,
        responseHandler: (response) => response.blob(),
      }),
    }),

    // Download original PDF
    downloadOriginalPDF: builder.query<Blob, string>({
      query: (fileId) => ({
        url: `/files/${fileId}/download`,
        headers: {
          'X-API-Key': API_KEY,
        },
        responseHandler: (response) => response.blob(),
      }),
    }),
  }),
});

export const {
  useUploadFileMutation,
  useGetFileQuery,
  useCreateSessionMutation,
  useUploadImageMutation,
  useGetImageQuery,
  useAddOperationMutation,
  useGetOperationsQuery,
  useDeleteOperationMutation,
  useClearOperationsMutation,
  useCommitSessionMutation,
  useLazyDownloadEditedPDFQuery,
  useLazyDownloadOriginalPDFQuery,
} = editorAPI;