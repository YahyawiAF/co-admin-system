import React, { useState, useEffect, useRef } from "react";
import {
  useGetMessagesQuery,
  useSendMessageMutation,
} from "src/api/messagesApi";
import { initializePusher } from "src/api/pusher.service";
import {
  Box,
  TextField,
  Button,
  IconButton,
  Avatar,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  CircularProgress,
  Snackbar,
  Alert,
  AppBar,
  Toolbar,
  Tooltip,
  useTheme,
} from "@mui/material";
import {
  Send as SendIcon,
  AttachFile as AttachFileIcon,
  Delete as DeleteIcon,
  BrokenImage as BrokenImageIcon,
} from "@mui/icons-material";
import { Power } from "react-feather";
import imageCompression from "browser-image-compression";
import { useRouter } from "next/router";
import { useDispatch } from "react-redux";
import { signOut } from "src/redux/authSlice";
import { useLogoutMutation } from "src/api/auth.repo";
import RoleProtectedRoute from "src/components/auth/ProtectedRoute";
import FixedBottomNavigation from "src/components/bottomNavigation/BottomNavigation";

interface Message {
  id: string;
  content?: string;
  imageBase64?: string;
  imageUrl?: string;
  createdAt: string;
  sender: {
    id: string;
    fullname?: string;
    img?: string;
  };
}

const Chat = () => {
  const theme = useTheme();
  const {
    data: initialMessages = [],
    isLoading,
    isError,
    refetch,
  } = useGetMessagesQuery();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [sendMessage] = useSendMessageMutation();
  const [newMessage, setNewMessage] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success" as "success" | "error" | "info" | "warning",
  });
  const [loadedImages, setLoadedImages] = useState<Record<string, boolean>>({});

  const router = useRouter();
  const dispatch = useDispatch();
  const [logout] = useLogoutMutation();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentUserId = sessionStorage.getItem("userID");

  // Initialisation des messages
  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  // Configuration Pusher
  useEffect(() => {
    const pusher = initializePusher();
    const channel = pusher.subscribe("chat");

    channel.bind("new-message", (newMsg: Message) => {
      console.log('New message received:', newMsg);
      setMessages((prev) => [...prev, {
        ...newMsg,
        imageBase64: newMsg.imageBase64 || newMsg.imageUrl
      }]);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    });

    return () => {
      channel.unbind_all();
      channel.unsubscribe();
      pusher.disconnect();
    };
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Gestion des images
  useEffect(() => {
    const initialLoadedImages = messages.reduce((acc, message) => {
      if (message.imageBase64 || message.imageUrl) {
        acc[message.id] = false;
      }
      return acc;
    }, {} as Record<string, boolean>);
    setLoadedImages(initialLoadedImages);
  }, [messages]);

  const handleSignOut = async () => {
    const accessToken = sessionStorage.getItem("accessToken");
    if (!accessToken) {
      router.replace("/client/login");
      return;
    }
    try {
      await logout().unwrap();
      sessionStorage.clear();
      dispatch(signOut());
      router.replace("/client/login");
    } catch (error) {
      console.error("Déconnexion échouée:", error);
      sessionStorage.clear();
      dispatch(signOut());
      router.replace("/client/login");
    }
  };

  const compressImage = async (file: File): Promise<string> => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      throw new Error("Only JPG, PNG and WEBP formats are accepted");
    }
    const MAX_FILE_SIZE_MB = 3;
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      throw new Error(`Image must not exceed ${MAX_FILE_SIZE_MB}MB`);
    }
    const options = {
      maxSizeMB: 0.2,
      maxWidthOrHeight: 800,
      useWebWorker: true,
      fileType: "image/webp",
      initialQuality: 0.6,
    };
    try {
      const compressedFile = await imageCompression(file, options);
      const imageUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(compressedFile);
      });
      if (!imageUrl.startsWith("data:image")) {
        throw new Error("Compressed image is not a valid image format");
      }
      return imageUrl;
    } catch (error) {
      console.error("Compression error:", error);
      throw new Error("Image compression failed");
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploading(true);
      const imageUrl = await compressImage(file);
      setImagePreview(imageUrl);
    } catch (error: any) {
      setSnackbar({
        open: true,
        message: error.message || "Image upload failed",
        severity: "error",
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
    } finally {
      setIsUploading(false);
    }
  };

   const handleSendMessage = async () => {
  if (!newMessage.trim() && !imagePreview) return;
  if (!currentUserId) {
    setSnackbar({
      open: true,
      message: "User not authenticated",
      severity: "error",
    });
    return;
  }

  try {
    setIsUploading(true);
    
    // Créez un objet séparé pour l'image
    const messageData: any = {
      content: newMessage.trim(),
      senderId: currentUserId,
    };

    // Si imagePreview existe, vérifiez sa taille
    if (imagePreview) {
      if (imagePreview.length > 1000000) { // ~1MB
        setSnackbar({
          open: true,
          message: "Image is too large. Please use a smaller image.",
          severity: "warning",
        });
        return;
      }
      messageData.imageBase64 = imagePreview;
    }

    console.log('Sending message data:', {
      ...messageData,
      imageBase64: messageData.imageBase64 ? '...' : null
    });

    const response = await sendMessage(messageData).unwrap();
    console.log('Message sent response:', response);

    setNewMessage("");
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";

    setSnackbar({
      open: true,
      message: "Message sent successfully",
      severity: "success",
    });
  } catch (error: any) {
    console.error("Failed to send message:", error);
    let errorMessage = "Failed to send message";
    if (error.data?.message) {
      errorMessage = error.data.message;
    } else if (error.error) {
      errorMessage = error.error;
    }
    
    setSnackbar({
      open: true,
      message: errorMessage,
      severity: "error",
    });
  } finally {
    setIsUploading(false);
  }
};

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) handleImageUpload(e);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const removeImagePreview = () => {
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (isError) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        Error loading messages
      </Alert>
    );
  }

  return (
    <Box sx={{ py: { xs: 3, md: 5 }, pb: { xs: 12, md: 14 }, flexGrow: 1 }}>
      {/* Header */}
      <AppBar
        position="static"
        color="inherit"
        elevation={0}
        sx={{
          borderBottom: `1px solid ${theme.palette.divider}`,
          backgroundColor: theme.palette.background.paper,
        }}
      >
        <Toolbar
          sx={{
            maxWidth: 1280,
            mx: "auto",
            width: "100%",
            px: { xs: 2, sm: 4 },
          }}
        >
          <Typography
            variant="h5"
            component="h1"
            fontWeight={500}
            sx={{ flexGrow: 1 }}
          >
            Chat
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Tooltip title="Sign out">
              <IconButton
                onClick={handleSignOut}
                color="inherit"
                sx={{
                  "&:hover": { backgroundColor: theme.palette.action.hover },
                }}
              >
                <Power size={20} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Account Settings">
              <IconButton
                onClick={() => router.push("/client/account")}
                sx={{ p: 0 }}
              >
                <Avatar
                  src={sessionStorage.getItem("img") || undefined}
                  alt={sessionStorage.getItem("username") || "User"}
                  sx={{
                    width: 32,
                    height: 32,
                    border: `2px solid ${theme.palette.primary.main}`,
                  }}
                />
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Box
        sx={{
          flexGrow: 1,
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
          p: 2,
        }}
      >
        <Paper
          sx={{
            flexGrow: 1,
            overflow: "auto",
            mb: 2,
            p: 2,
            backgroundColor: theme.palette.background.paper,
            borderRadius: 2,
          }}
        >
          <List>
            {messages.map((message: Message) => (
              <ListItem
                key={message.id}
                alignItems="flex-start"
                sx={{
                  flexDirection:
                    message.sender.id === currentUserId ? "row-reverse" : "row",
                }}
              >
                <ListItemAvatar>
                  <Avatar
                    src={message.sender.img}
                    alt={message.sender.fullname || "Anonymous"}
                    sx={{
                      alignSelf: "flex-start",
                      width: 40,
                      height: 40,
                    }}
                  />
                </ListItemAvatar>
                <Box
                  sx={{
                    maxWidth: "70%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems:
                      message.sender.id === currentUserId
                        ? "flex-end"
                        : "flex-start",
                  }}
                >
                  <Typography
                    variant="subtitle2"
                    sx={{
                      mb: 0.5,
                      color: "text.primary",
                      alignSelf:
                        message.sender.id === currentUserId
                          ? "flex-end"
                          : "flex-start",
                    }}
                  >
                    {message.sender.fullname || "Anonymous"}
                  </Typography>
                  <Paper
                    elevation={1}
                    sx={{
                      p: 1.5,
                      mb: 0.5,
                      backgroundColor:
                        message.sender.id === currentUserId
                          ? theme.palette.primary.light
                          : theme.palette.background.default,
                      color:
                        message.sender.id === currentUserId
                          ? theme.palette.primary.contrastText
                          : theme.palette.text.primary,
                      borderRadius:
                        message.sender.id === currentUserId
                          ? "18px 18px 4px 18px"
                          : "18px 18px 18px 4px",
                    }}
                  >
                    {message.content && (
                      <Typography variant="body1">{message.content}</Typography>
                    )}

                    {(message.imageBase64 || message.imageUrl) && (
                      <Box
                        sx={{
                          mt: 1,
                          position: "relative",
                          backgroundColor: "rgba(0,0,0,0.05)",
                          borderRadius: "8px",
                          overflow: "hidden",
                          minHeight: "100px",
                        }}
                      >
                        {!loadedImages[message.id] && (
                          <Box
                            sx={{
                              position: "absolute",
                              top: 0,
                              left: 0,
                              right: 0,
                              bottom: 0,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <CircularProgress size={24} />
                          </Box>
                        )}
                        <img
                          src={message.imageBase64 || message.imageUrl}
                          alt="Message attachment"
                          style={{
                            width: "100%",
                            maxHeight: "300px",
                            objectFit: "contain",
                            display: loadedImages[message.id]
                              ? "block"
                              : "none",
                          }}
                          onLoad={() =>
                            setLoadedImages((prev) => ({
                              ...prev,
                              [message.id]: true,
                            }))
                          }
                          onError={() =>
                            setLoadedImages((prev) => ({
                              ...prev,
                              [message.id]: false,
                            }))
                          }
                        />
                        {!loadedImages[message.id] &&
                          loadedImages[message.id] !== undefined && (
                            <Box
                              sx={{
                                width: "100%",
                                height: "100px",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                backgroundColor: "#f5f5f5",
                                color: "#999",
                              }}
                            >
                              <BrokenImageIcon sx={{ fontSize: 30, mb: 1 }} />
                              <Typography variant="caption">
                                Image not loaded
                              </Typography>
                            </Box>
                          )}
                      </Box>
                    )}
                  </Paper>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                      alignSelf:
                        message.sender.id === currentUserId
                          ? "flex-end"
                          : "flex-start",
                    }}
                  >
                    {new Date(message.createdAt).toLocaleDateString([], {
                      day: "numeric",
                      month: "numeric",
                    })}{" "}
                    {new Date(message.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Typography>
                </Box>
              </ListItem>
            ))}
            <div ref={messagesEndRef} />
          </List>
        </Paper>

        {/* Image Preview */}
        {imagePreview && (
          <Box
            sx={{
              position: "relative",
              mb: 1,
              p: 1,
              backgroundColor: theme.palette.background.paper,
              borderRadius: 1,
              boxShadow: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center" }}>
              {isUploading ? (
                <CircularProgress size={24} sx={{ mr: 2 }} />
              ) : (
                <img
                  src={imagePreview}
                  alt="Preview"
                  style={{
                    width: 60,
                    height: 60,
                    objectFit: "cover",
                    borderRadius: 4,
                    marginRight: 8,
                  }}
                />
              )}
              <Typography variant="body2" color="text.secondary">
                Image ready to send
              </Typography>
            </Box>
            <IconButton
              size="small"
              onClick={removeImagePreview}
              color="error"
              disabled={isUploading}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        )}

        {/* Message Input */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            p: 1,
            backgroundColor: theme.palette.background.paper,
            borderRadius: 1,
            boxShadow: 1,
          }}
        >
          <IconButton
            onClick={() => fileInputRef.current?.click()}
            color="primary"
            disabled={isUploading}
          >
            <AttachFileIcon />
          </IconButton>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/jpeg,image/png,image/webp"
            style={{ display: "none" }}
            disabled={isUploading}
          />

          <TextField
            fullWidth
            multiline
            maxRows={4}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            variant="outlined"
            size="small"
            disabled={isUploading}
          />

          <Button
            variant="contained"
            color="primary"
            onClick={handleSendMessage}
            disabled={(!newMessage.trim() && !imagePreview) || isUploading}
            endIcon={
              isUploading ? <CircularProgress size={20} /> : <SendIcon />
            }
            sx={{ height: "40px" }}
          >
            Send
          </Button>
        </Box>

        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
        >
          <Alert
            severity={snackbar.severity}
            onClose={() => setSnackbar({ ...snackbar, open: false })}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>

      {/* Bottom Navigation */}
      <FixedBottomNavigation />
    </Box>
  );
};

Chat.getLayout = function getLayout(page: React.ReactElement) {
  return (
    <RoleProtectedRoute allowedRoles={["USER"]}>{page}</RoleProtectedRoute>
  );
};

export default Chat;