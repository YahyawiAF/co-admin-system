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
  onUpdate: (data: {
    username: string;
    email: string;
    phone?: string;
  }) => Promise<void>;
  phoneDisabled: boolean;
}

// Validation schema modifié : Email n'est plus requis
const validationSchema = Yup.object({
  firstName: Yup.string().trim(),
  lastName: Yup.string().trim(),
  email: Yup.string().email("Invalid email").nullable(), // Email non requis
  phone: Yup.string()
    .matches(/^[0-9]+$/, "Invalid phone number")
    .nullable(),
});

export function AccountDetailsForm({
  username,
  email,
  phone,
  onUpdate,
  phoneDisabled,
}: AccountDetailsFormProps): React.JSX.Element {
  const nameParts = username.split(" ");
  const initialFirstName = nameParts[0] || "";
  const initialLastName = nameParts.slice(1).join(" ") || "";

  const formik = useFormik({
    initialValues: {
      firstName: initialFirstName,
      lastName: initialLastName,
      email: email || "",
      phone: phone || "",
    },
    validationSchema,
    enableReinitialize: true,
    onSubmit: async (values) => {
      try {
        await onUpdate({
          username: `${values.firstName.trim()} ${values.lastName.trim()}`, // Envoie le nom complet
          email: values.email?.trim(),
          phone: values.phone?.trim() || undefined,
        });
      } catch (error) {
        console.error("Update error:", error);
      }
    },
  });

  const hasChanged =
    formik.values.firstName !== initialFirstName ||
    formik.values.lastName !== initialLastName ||
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
              <FormControl
                fullWidth
                error={!!(formik.touched.firstName && formik.errors.firstName)}
              >
                <InputLabel>First name</InputLabel>
                <OutlinedInput
                  name="firstName"
                  label="First name"
                  value={formik.values.firstName}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                />
                {formik.touched.firstName && formik.errors.firstName && (
                  <FormHelperText>{formik.errors.firstName}</FormHelperText>
                )}
              </FormControl>
            </Grid>
            <Grid md={6} xs={12}>
              <FormControl
                fullWidth
                error={!!(formik.touched.lastName && formik.errors.lastName)}
              >
                <InputLabel>Last name</InputLabel>
                <OutlinedInput
                  name="lastName"
                  label="Last name"
                  value={formik.values.lastName}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                />
                {formik.touched.lastName && formik.errors.lastName && (
                  <FormHelperText>{formik.errors.lastName}</FormHelperText>
                )}
              </FormControl>
            </Grid>
            <Grid md={6} xs={12}>
              <FormControl
                fullWidth
                error={!!(formik.touched.email && formik.errors.email)}
              >
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
              <FormControl
                fullWidth
                error={!!(formik.touched.phone && formik.errors.phone)}
              >
                <InputLabel>Phone number</InputLabel>
                <OutlinedInput
                  name="phone"
                  label="Phone number"
                  value={formik.values.phone}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  disabled={phoneDisabled}
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
