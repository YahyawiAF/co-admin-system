import * as React from "react";
import Avatar from "@mui/material/Avatar";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import { User } from "react-feather";
import CircularProgress from "@mui/material/CircularProgress";

interface AccountInfoProps {
  name: string;
  email?: string;
  phone?: string;
  img?: string;
  isUploading: boolean;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function AccountInfo({
  name,
  email,
  phone,
  img,
  isUploading,
  onImageUpload,
}: AccountInfoProps): React.JSX.Element {
  const profileImageInputRef = React.useRef<HTMLInputElement>(null);

  return (
    <Card>
      <CardContent>
        <Stack spacing={2} sx={{ alignItems: "center" }}>
          <Box sx={{ position: "relative" }}>
            <Avatar
              src={img}
              sx={{
                height: "120px",
                width: "120px",
                bgcolor: img ? "transparent" : "primary.main",
                cursor: isUploading ? "default" : "pointer",
                opacity: isUploading ? 0.6 : 1,
                transition: "opacity 0.2s ease-in-out",
                "&:hover": {
                  opacity: isUploading ? 0.6 : 0.8,
                },
              }}
              onClick={() => !isUploading && profileImageInputRef.current?.click()}
            >
              {!img && <User size={60} />}
            </Avatar>
            <input
              accept="image/*"
              style={{ display: "none" }}
              id="profile-image-upload"
              type="file"
              ref={profileImageInputRef}
              onChange={onImageUpload}
              disabled={isUploading}
            />
            {isUploading && (
              <CircularProgress
                size={30}
                sx={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                }}
              />
            )}
          </Box>
          <Stack spacing={1} sx={{ textAlign: "center" }}>
            <Typography variant="h5">{name || "Utilisateur"}</Typography>
            {email && (
              <Typography color="text.secondary" variant="body2">
                {email}
              </Typography>
            )}
            {phone && (
              <Typography color="text.secondary" variant="body2">
                {phone}
              </Typography>
            )}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}