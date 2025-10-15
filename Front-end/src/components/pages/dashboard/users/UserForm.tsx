import React, { useState, useEffect } from "react";
import {
  Box,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Alert,
  CircularProgress,
} from "@mui/material";
import { User, Role } from "src/types/shared";
import {
  useCreateUserMutation,
  useUpdateUserMutation,
} from "src/api/user.repo";

interface UserFormProps {
  handleClose: () => void;
  selectItem?: User | null;
}

const UserForm: React.FC<UserFormProps> = ({ handleClose, selectItem }) => {
  const [formData, setFormData] = useState({
    fullname: "",
    email: "",
    phoneNumber: "",
    role: Role.MEMBER,
    password: "",
    confirmPassword: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [createUser] = useCreateUserMutation();
  const [updateUser] = useUpdateUserMutation();

  useEffect(() => {
    if (selectItem) {
      setFormData({
        fullname: selectItem.fullname || "",
        email: selectItem.email || "",
        phoneNumber: selectItem.phoneNumber || "",
        role: selectItem.role,
        password: "",
        confirmPassword: "",
      });
    }
  }, [selectItem]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.fullname.trim()) {
      newErrors.fullname = "Full name is required";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Email is invalid";
    }

    if (!selectItem && !formData.password) {
      newErrors.password = "Password is required";
    }

    if (!selectItem && formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    if (formData.password && formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange =
    (field: string) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setFormData((prev) => ({
        ...prev,
        [field]: event.target.value,
      }));

      // Clear error when user starts typing
      if (errors[field]) {
        setErrors((prev) => ({
          ...prev,
          [field]: "",
        }));
      }
    };

  const handleRoleChange = (event: any) => {
    setFormData((prev) => ({
      ...prev,
      role: event.target.value as Role,
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const userData = {
        fullname: formData.fullname,
        email: formData.email,
        phoneNumber: formData.phoneNumber,
        role: formData.role,
        ...(formData.password && { password: formData.password }),
      };

      if (selectItem) {
        await updateUser({
          id: selectItem.id,
          data: userData,
        }).unwrap();
      } else {
        await createUser(userData as User).unwrap();
      }

      handleClose();
    } catch (error: any) {
      console.error("Error saving user:", error);
      // Handle error (you might want to show a toast or alert)
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
      <Typography variant="h6" gutterBottom>
        {selectItem ? "Edit User" : "Create New User"}
      </Typography>

      <TextField
        fullWidth
        label="Full Name"
        value={formData.fullname}
        onChange={handleInputChange("fullname")}
        error={!!errors.fullname}
        helperText={errors.fullname}
        margin="normal"
        required
      />

      <TextField
        fullWidth
        label="Email"
        type="email"
        value={formData.email}
        onChange={handleInputChange("email")}
        error={!!errors.email}
        helperText={errors.email}
        margin="normal"
        required
      />

      <TextField
        fullWidth
        label="Phone Number"
        value={formData.phoneNumber}
        onChange={handleInputChange("phoneNumber")}
        margin="normal"
      />

      <FormControl fullWidth margin="normal">
        <InputLabel>Role</InputLabel>
        <Select value={formData.role} label="Role" onChange={handleRoleChange}>
          {Object.values(Role).map((role) => (
            <MenuItem key={role} value={role}>
              {role.replace("_", " ")}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {!selectItem && (
        <>
          <TextField
            fullWidth
            label="Password"
            type="password"
            value={formData.password}
            onChange={handleInputChange("password")}
            error={!!errors.password}
            helperText={errors.password}
            margin="normal"
            required
          />

          <TextField
            fullWidth
            label="Confirm Password"
            type="password"
            value={formData.confirmPassword}
            onChange={handleInputChange("confirmPassword")}
            error={!!errors.confirmPassword}
            helperText={errors.confirmPassword}
            margin="normal"
            required
          />
        </>
      )}

      <Box sx={{ display: "flex", gap: 2, mt: 3 }}>
        <Button
          type="button"
          variant="outlined"
          onClick={handleClose}
          fullWidth
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="contained"
          fullWidth
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <CircularProgress size={24} />
          ) : selectItem ? (
            "Update User"
          ) : (
            "Create User"
          )}
        </Button>
      </Box>
    </Box>
  );
};

export default UserForm;
