import React, { useState, useEffect } from "react"; // Added useEffect
import type { ReactElement } from "react";
import { useRouter } from "next/router"; // Added useRouter
import styled from "@emotion/styled";
import { Helmet } from "react-helmet-async";
import {
  Paper,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Alert,
  Box,
  Tabs,
  Tab,
  Stepper,
  Step,
  StepLabel,
} from "@mui/material";
import { 
  useForgotPasswordMutation,
  useVerifyResetCodeMutation,
  useResetPasswordWithPhoneMutation
} from "../../api/auth.repo";
import AuthLayout from "../../layouts/Auth";
import Logo from "../../vendor/logo.svg";
import { isValidPhoneNumber } from "libphonenumber-js";

const Brand = styled(Logo)`
  fill: ${(props) => props.theme.palette.primary.main};
  width: 64px;
  height: 64px;
  margin-bottom: 32px;
`;

const Wrapper = styled(Paper)`
  padding: ${(props) => props.theme.spacing(6)};
  ${(props) => props.theme.breakpoints.up("md")} {
    padding: ${(props) => props.theme.spacing(10)};
  }
`;

const Form = styled.form`
  margin-top: ${(props) => props.theme.spacing(3)};
`;

const steps = ['Enter Phone', 'Verify Code', 'New Password'];

function ForgetPassword() {
  const router = useRouter(); // Initialize router
  const [activeTab, setActiveTab] = useState(0);
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [smsSent, setSmsSent] = useState(false);
  const [verificationStep, setVerificationStep] = useState(0);

  const [forgotPassword, { isLoading: isSending, error: sendError }] = useForgotPasswordMutation();
  const [verifyCode, { isLoading: isVerifying, error: verifyError }] = useVerifyResetCodeMutation();
  const [resetPassword, { isLoading: isResetting, error: resetError, isSuccess: resetSuccess }] = useResetPasswordWithPhoneMutation();

  // Navigate to login after successful password reset
  useEffect(() => {
    if (resetSuccess) {
      router.push('/login');
    }
  }, [resetSuccess, router]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    setVerificationStep(0);
    setSmsSent(false);
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await forgotPassword({ identifier: activeTab === 0 ? email : phoneNumber }).unwrap();
      setSmsSent(true);
      if (activeTab === 1) {
        setVerificationStep(1); // Move to verification step for phone
      } else {
        router.push('/client/login'); // Navigate to login for email
      }
    } catch (err) {
      console.error("Failed to send reset instructions:", err);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await verifyCode({ phoneNumber, code }).unwrap();
      setVerificationStep(2); // Move to password reset step
    } catch (err) {
      console.error("Code verification failed:", err);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      alert("Passwords don't match");
      return;
    }
    try {
      await resetPassword({ phoneNumber, newPassword }).unwrap();
      // Navigation is handled by useEffect when resetSuccess is true
    } catch (err) {
      console.error("Password reset failed:", err);
    }
  };

  const getErrorMessage = (error: any): string => {
    if (error?.data?.message) return error.data.message;
    return "An error occurred. Please try again.";
  };

  const renderPhoneResetForm = () => {
    switch (verificationStep) {
      case 0: // Initial phone input
        return (
          <Form onSubmit={handleSendCode}>
            <TextField
              fullWidth
              label="Phone Number"
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              margin="normal"
              required
              placeholder="+225XXXXXXXXX"
              error={phoneNumber ? !isValidPhoneNumber(phoneNumber) : false}
              helperText={phoneNumber && !isValidPhoneNumber(phoneNumber) ? "Invalid phone number" : ""}
            />
            {sendError && (
              <Alert severity="error" sx={{ marginTop: 2 }}>
                {getErrorMessage(sendError)}
              </Alert>
            )}
            <Button
              fullWidth
              type="submit"
              variant="contained"
              color="primary"
              disabled={isSending || !phoneNumber || !isValidPhoneNumber(phoneNumber)}
              sx={{ marginTop: 2 }}
            >
              {isSending ? <CircularProgress size={24} /> : "Send Verification Code"}
            </Button>
          </Form>
        );
      case 1: // Code verification
        return (
          <Form onSubmit={handleVerifyCode}>
            <Typography variant="body1" gutterBottom>
              Enter the verification code sent to {phoneNumber}
            </Typography>
            <TextField
              fullWidth
              label="Verification Code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              margin="normal"
              required
            />
            {verifyError && (
              <Alert severity="error" sx={{ marginTop: 2 }}>
                {getErrorMessage(verifyError)}
              </Alert>
            )}
            <Button
              fullWidth
              type="submit"
              variant="contained"
              color="primary"
              disabled={isVerifying || code.length < 6}
              sx={{ marginTop: 2 }}
            >
              {isVerifying ? <CircularProgress size={24} /> : "Verify Code"}
            </Button>
          </Form>
        );
      case 2: // New password
        return (
          <Form onSubmit={handleResetPassword}>
            <Typography variant="body1" gutterBottom>
              Create a new password for {phoneNumber}
            </Typography>
            <TextField
              fullWidth
              label="New Password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              margin="normal"
              required
            />
            <TextField
              fullWidth
              label="Confirm Password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              margin="normal"
              required
            />
            {resetError && (
              <Alert severity="error" sx={{ marginTop: 2 }}>
                {getErrorMessage(resetError)}
              </Alert>
            )}
            {resetSuccess && (
              <Alert severity="success" sx={{ marginTop: 2 }}>
                Password has been reset successfully! Redirecting to login...
              </Alert>
            )}
            <Button
              fullWidth
              type="submit"
              variant="contained"
              color="primary"
              disabled={isResetting || newPassword !== confirmPassword || !newPassword}
              sx={{ marginTop: 2 }}
            >
              {isResetting ? <CircularProgress size={24} /> : "Reset Password"}
            </Button>
          </Form>
        );
      default:
        return null;
    }
  };

  return (
    <React.Fragment>
      <Brand />
      <Wrapper>
        <Helmet title="Forget Password" />

        <Typography component="h1" variant="h4" align="center" gutterBottom>
          Forget Password
        </Typography>
        <Typography component="h2" variant="body1" align="center">
          {activeTab === 0 
            ? "Enter your email to reset your password" 
            : "Reset your password using your phone number"}
        </Typography>

        <Box sx={{ borderBottom: 1, borderColor: 'divider', marginTop: 2 }}>
          <Tabs value={activeTab} onChange={handleTabChange} centered>
            <Tab label="Email" />
            <Tab label="Phone" />
          </Tabs>
        </Box>

        {activeTab === 1 && smsSent && (
          <Box sx={{ width: '100%', marginTop: 3 }}>
            <Stepper activeStep={verificationStep} alternativeLabel>
              {steps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>
          </Box>
        )}

        {activeTab === 0 ? (
          <Form onSubmit={handleSendCode}>
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              margin="normal"
              required
            />
            {sendError && (
              <Alert severity="error" sx={{ marginTop: 2 }}>
                {getErrorMessage(sendError)}
              </Alert>
            )}
            <Button
              fullWidth
              type="submit"
              variant="contained"
              color="primary"
              disabled={isSending || !email}
              sx={{ marginTop: 2 }}
            >
              {isSending ? <CircularProgress size={24} /> : "Send Reset Link"}
            </Button>
            {smsSent && (
              <Alert severity="success" sx={{ marginTop: 2 }}>
                Reset instructions sent to your email! Redirecting to login...
              </Alert>
            )}
          </Form>
        ) : (
          renderPhoneResetForm()
        )}
      </Wrapper>
    </React.Fragment>
  );
}

ForgetPassword.getLayout = function getLayout(page: ReactElement) {
  return <AuthLayout>{page}</AuthLayout>;
};

export default ForgetPassword;