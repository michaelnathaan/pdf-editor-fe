// API Response Types
export interface FileUploadResponse {
  id: string;
  filename: string;
  original_filename: string;
  file_size: number;
  page_count: number;
  mime_type: string;
  uploaded_at: string;
}

export interface SessionCreateResponse {
  session_id: string;
  file_id: string;
  session_token: string;
  editor_url: string;
  expires_at: string;
  permissions: {
    can_edit: boolean;
    can_download: boolean;
  };
}

export interface ImageUploadResponse {
  id: string;
  session_id: string;
  original_filename: string;
  stored_filename: string;
  file_size: number;
  mime_type: string;
  width: number;
  height: number;
  uploaded_at: string;
  image_url: string;
}

export interface OperationResponse {
  id: string;
  session_id: string;
  operation_order: number;
  operation_type: OperationType;
  operation_data: OperationData;
  created_at: string;
}

// Operation Types
export type OperationType = 'add_image' | 'move_image' | 'resize_image' | 'delete_image' | 'rotate_image';

export interface Position {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OperationData {
  page: number;
  image_id: string;
  image_path?: string;
  position?: Position;
  old_position?: Position;
  new_position?: Position;
  old_size?: { width: number; height: number };
  new_size?: { width: number; height: number };
  rotation?: number;
  opacity?: number;
}

// Canvas Image Object
export interface CanvasImage {
  id: string;
  imageId: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  url: string;
}

// Editor State
export interface EditorState {
  fileId: string | null;
  sessionId: string | null;
  sessionToken: string | null;
  fileName: string | null;
  pageCount: number;
  currentPage: number;
  zoom: number;
  images: CanvasImage[];
  operations: OperationResponse[];
  isLoading: boolean;
  error: string | null;
}