import { useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Box, CircularProgress, Alert } from '@mui/material';
import Editor from '../components/Editor';
import { setFileInfo, setSession } from '../features/editor/editorSlice';
import { useGetSessionInfoQuery } from '../features/editor/editorApi';

export default function EditorPage() {
    const { sessionId } = useParams<{ sessionId: string }>();
    const [searchParams] = useSearchParams();
    const sessionToken = searchParams.get('session_token');
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const { data: sessionInfo, isLoading, error } = useGetSessionInfoQuery(
        {
            sessionId: sessionId!,
            sessionToken: sessionToken!
        },
        { skip: !sessionId || !sessionToken }
    );

    useEffect(() => {
        if (!sessionId || !sessionToken) {
            console.error('Missing session ID or token');
            navigate('/');
            return;
        }
    }, [sessionId, sessionToken, navigate]);

    useEffect(() => {
        if (sessionInfo) {
            // Check expiration or completed status
            const now = new Date();
            const expiresAt = new Date(sessionInfo.expires_at);

            if (sessionInfo.status === "completed") {
                alert("This session is already completed.");
                window.close();

                setTimeout(() => {
                    navigate("/");
                }, 100);
                return;
            }

            if (expiresAt <= now) {
                alert("This session has expired");
                window.close();

                setTimeout(() => {
                    navigate("/");
                }, 100);
                return;
            }

            dispatch(setSession({
                sessionId: sessionInfo.id,
                sessionToken: sessionInfo.session_token,
            }));

            dispatch(setFileInfo({
                fileId: sessionInfo.file_id,
                fileName: sessionInfo.file_name,
                pageCount: sessionInfo.page_count || 0,
            }));
        }
    }, [sessionInfo, dispatch, navigate]);

    useEffect(() => {
        if (sessionInfo) {
            // Set session data in Redux
            dispatch(setSession({
                sessionId: sessionInfo.id,
                sessionToken: sessionInfo.session_token,
            }));

            if (sessionInfo) {
                dispatch(setSession({
                    sessionId: sessionInfo.id,
                    sessionToken: sessionInfo.session_token,
                }));

                dispatch(setFileInfo({
                    fileId: sessionInfo.file_id,
                    fileName: sessionInfo.file_name,
                    pageCount: sessionInfo.page_count || 0, // ✅ add this
                }));
            }
        }
    }, [sessionInfo, dispatch]);

    if (isLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        const errorMessage = 'data' in error && typeof error.data === 'object' && error.data !== null && 'detail' in error.data
            ? String(error.data.detail)
            : 'Failed to load session';

        return (
            <Alert severity="error" sx={{ mb: 2 }}>
                {errorMessage}
            </Alert>
        );
    }

    if (
        sessionInfo?.status === "completed" ||
        (sessionInfo?.expires_at && new Date(sessionInfo.expires_at) <= new Date())
    ) {
        const errorMessage =
            sessionInfo?.status === "completed"
                    ? "This session has already been completed."
                    : (sessionInfo?.expires_at && new Date(sessionInfo.expires_at) <= new Date())
                        ? "This session has expired."
                        : "Failed to load session.";
        setTimeout(() => {
            try {
                window.close();
            } catch {
                navigate('/');
            }
        }, 100);

        return (
            <Alert severity="error" sx={{ mb: 2 }}>
                {errorMessage}
            </Alert>
        );
    }


    if (!sessionInfo) {
        return null;
    }

    return <Editor />;
}