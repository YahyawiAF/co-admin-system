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
  img?: string;
  onUpdate: (data: {
    username: string;
    email?: string;
    phone?: string;
    img?: string;
  }) => Promise<void>;
  phoneDisabled: boolean;
}

const validationSchema = Yup.object({
  username: Yup.string()
    .trim()
    .min(2, "Le nom doit contenir au moins 2 caractères")
    .required("Le nom est requis"),
  email: Yup.string().email("Email invalide").nullable(),
  phone: Yup.string()
    .matches(/^[0-9]+$/, "Numéro de téléphone invalide")
    .nullable(),
});

export function AccountDetailsForm({
  username,
  email,
  phone,
  img,
  onUpdate,
  phoneDisabled,
}: AccountDetailsFormProps): React.JSX.Element {
  const formik = useFormik({
    initialValues: {
      username: username || "",
      email: email || "",
      phone: phone || "",
      img: img || "",
    },
    validationSchema,
    enableReinitialize: true,
    onSubmit: async (values) => {
      try {
        await onUpdate({
          username: values.username.trim(),
          email: values.email?.trim() || undefined,
          phone: values.phone?.trim() || undefined,
          img: values.img || undefined,
        });
      } catch (error) {
        console.error("Update error:", error);
      }
    },
  });

  const hasChanged =
    formik.values.username !== username ||
    formik.values.email !== (email || "") ||
    formik.values.phone !== (phone || "") ||
    formik.values.img !== (img || "");

  return (
    <form onSubmit={formik.handleSubmit}>
      <Card>
        <CardHeader
          subheader="The information can be modified."
          title="Profil"
        />
        <Divider />
        <CardContent>
          <Grid container spacing={3}>
            <Grid md={6} xs={12}>
              <FormControl
                fullWidth
                error={!!(formik.touched.username && formik.errors.username)}
              >
                <InputLabel>Full Name</InputLabel>
                <OutlinedInput
                  name="username"
                  label="Nom complet"
                  value={formik.values.username}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                />
                {formik.touched.username && formik.errors.username && (
                  <FormHelperText>{formik.errors.username}</FormHelperText>
                )}
              </FormControl>
            </Grid>
            <Grid md={6} xs={12}>
              <FormControl
                fullWidth
                error={!!(formik.touched.email && formik.errors.email)}
              >
                <InputLabel>Adresse email</InputLabel>
                <OutlinedInput
                  name="email"
                  label="Adresse email"
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
                <InputLabel>Phone Number</InputLabel>
                <OutlinedInput
                  name="phone"
                  label="Numéro de téléphone"
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
              "Save Changes"
            )}
          </Button>
        </CardActions>
      </Card>
    </form>
  );
}