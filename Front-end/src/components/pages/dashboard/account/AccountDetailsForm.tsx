import * as React from "react";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActions from "@mui/material/CardActions";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import OutlinedInput from "@mui/material/OutlinedInput";
import Grid from "@mui/material/Unstable_Grid2";
import { useFormik } from "formik";
import * as Yup from "yup";
import CircularProgress from "@mui/material/CircularProgress";
import FormHelperText from "@mui/material/FormHelperText";

interface AccountDetailsFormProps {
  username: string;
  email?: string;
  phone?: string;
  onUpdate: (data: { username: string; email: string; phone?: string }) => Promise<void>;
}

const validationSchema = Yup.object({
  fullname: Yup.string().required("Full name is required").trim(),  email: Yup.string().email("Invalid email").required("Email is required"),
  phone: Yup.string().matches(/^[0-9]+$/, "Invalid phone number").nullable(),
});

export function AccountDetailsForm({ username, email, phone, onUpdate }: AccountDetailsFormProps): React.JSX.Element {
  const nameParts = username.split(" ");
  const initialFirstName = nameParts[0] || "";

  const formik = useFormik({
    initialValues: {
      fullname: username || "",
      email: email || "",
      phone: phone || "",
    },
    validationSchema,
    enableReinitialize: true,
    onSubmit: async (values) => {
      try {
        await onUpdate({
          username: values.fullname.trim(), // Envoyer le nom complet
          email: values.email.trim(),
          phone: values.phone?.trim() || undefined,
        });
      } catch (error) {
        console.error("Update error:", error);
      }
    },
  });

  const hasChanged = 
  formik.values.fullname !== username ||
    formik.values.email !== (email || "") ||
    formik.values.phone !== (phone || "");

  return (
    <form onSubmit={formik.handleSubmit}>
      <Card>
        <CardHeader subheader="The information can be edited" title="Profile" />
        <Divider />
        <CardContent>
          <Grid container spacing={3}>
            <Grid md={6} xs={12}>
              <FormControl fullWidth error={!!(formik.touched.fullname && formik.errors.fullname)}>
                <InputLabel>First name</InputLabel>
                <OutlinedInput
                  name="fullname"
                  label="Full name"
                  value={formik.values.fullname}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                />
                {formik.touched.fullname && formik.errors.fullname && (
                  <FormHelperText>{formik.errors.fullname}</FormHelperText>
                )}
              </FormControl>
            </Grid>
            <Grid md={6} xs={12}>
              
            </Grid>
            <Grid md={6} xs={12}>
              <FormControl fullWidth error={!!(formik.touched.email && formik.errors.email)}>
                <InputLabel>Email address</InputLabel>
                <OutlinedInput
                  name="email"
                  label="Email address"
                  value={formik.values.email}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                />
                {formik.touched.email && formik.errors.email && (
                  <FormHelperText>{formik.errors.email}</FormHelperText>
                )}
              </FormControl>
            </Grid>
            <Grid md={6} xs={12}>
              <FormControl fullWidth error={!!(formik.touched.phone && formik.errors.phone)}>
                <InputLabel>Phone number</InputLabel>
                <OutlinedInput
                  name="phone"
                  label="Phone number"
                  value={formik.values.phone}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  type="tel"
                />
                {formik.touched.phone && formik.errors.phone && (
                  <FormHelperText>{formik.errors.phone}</FormHelperText>
                )}
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
        <Divider />
        <CardActions sx={{ justifyContent: "flex-end" }}>
          <Button
            variant="contained"
            type="submit"
            disabled={formik.isSubmitting || !hasChanged || !formik.isValid}
          >
            {formik.isSubmitting ? (
              <CircularProgress size={24} sx={{ color: "inherit" }} />
            ) : (
              "Save details"
            )}
          </Button>
        </CardActions>
      </Card>
    </form>
  );
}