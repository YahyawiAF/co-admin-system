import React, { useState } from "react";
import type { ReactElement } from "react";
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
  Stepper,
  Step,
  StepLabel,
} from "@mui/material";
import { 
  useResetPasswordMutation,
  useVerifyResetCodeMutation,
  useResetPasswordWithPhoneMutation
} from "../../api/auth.repo";
import AuthLayout from "../../layouts/Auth";
import Logo from "../../vendor/logo.svg";
import { useRouter } from "next/router";
import { FetchBaseQueryError } from "@reduxjs/toolkit/query";
import { SerializedError } from "@reduxjs/toolkit";

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

const steps = ['Verify Code', 'Reset Password'];

function ResetPassword() {
  const router = useRouter();
  const { token, phone } = router.query;
  const isPhoneReset = !!phone;

  const [activeStep, setActiveStep] = useState(isPhoneReset ? 0 : 1);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const [verifyCode, { 
    isLoading: isVerifying, 
    error: verifyError 
  }] = useVerifyResetCodeMutation();
  
  const [resetPassword, { 
    isLoading: isResetting, 
    isSuccess, 
    error: resetError 
  }] = useResetPasswordMutation();
  
  const [resetPasswordWithPhone, { 
    isLoading: isResettingPhone 
  }] = useResetPasswordWithPhoneMutation();

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await verifyCode({ 
        phoneNumber: phone as string, 
        code 
      }).unwrap();
      setActiveStep(1);
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
      if (isPhoneReset) {
        await resetPasswordWithPhone({ 
          phoneNumber: phone as string, 
          newPassword 
        }).unwrap();
      } else {
        await resetPassword({ 
          token: token as string, 
          newPassword 
        }).unwrap();
      }
      router.push("/login");
    } catch (err) {
      console.error("Password reset failed:", err);
    }
  };

  const getErrorMessage = (
    error: FetchBaseQueryError | SerializedError | undefined
  ): string => {
    if (error) {
      if ("status" in error) {
        return `Error ${error.status}: ${JSON.stringify(error.data)}`;
      } else {
        return error.message || "An unknown error occurred.";
      }
    }
    return "";
  };

  return (
    <React.Fragment>
      <Brand />
      <Wrapper>
        <Helmet title="Reset Password" />

        <Typography component="h1" variant="h4" align="center" gutterBottom>
          Reset Password
        </Typography>
        
        {isPhoneReset && (
          <Box sx={{ width: '100%', marginBottom: 3 }}>
            <Stepper activeStep={activeStep}>
              {steps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>
          </Box>
        )}

        {activeStep === 0 ? (
          <Form onSubmit={handleVerifyCode}>
            <Typography component="h2" variant="body1" align="center" gutterBottom>
              Enter the verification code sent to {phone}
            </Typography>
            <TextField
              fullWidth
              label="Verification Code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              margin="normal"
              required
            />
            <Button
              fullWidth
              type="submit"
              variant="contained"
              color="primary"
              disabled={isVerifying}
              sx={{ marginTop: 2 }}
            >
              {isVerifying ? <CircularProgress size={24} /> : "Verify Code"}
            </Button>
            {verifyError && (
              <Alert severity="error" sx={{ marginTop: 2 }}>
                {getErrorMessage(verifyError)}
              </Alert>
            )}
          </Form>
        ) : (
          <Form onSubmit={handleResetPassword}>
            <Typography component="h2" variant="body1" align="center" gutterBottom>
              Enter your new password
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
            <Button
              fullWidth
              type="submit"
              variant="contained"
              color="primary"
              disabled={isResetting || isResettingPhone}
              sx={{ marginTop: 2 }}
            >
              {(isResetting || isResettingPhone) ? (
                <CircularProgress size={24} />
              ) : (
                "Reset Password"
              )}
            </Button>
            {isSuccess && (
              <Alert severity="success" sx={{ marginTop: 2 }}>
                Password has been reset successfully
              </Alert>
            )}
            {resetError && (
              <Alert severity="error" sx={{ marginTop: 2 }}>
                {getErrorMessage(resetError)}
              </Alert>
            )}
          </Form>
        )}
      </Wrapper>
    </React.Fragment>
  );
}

ResetPassword.getLayout = function getLayout(page: ReactElement) {
  return <AuthLayout>{page}</AuthLayout>;
};

export default ResetPassword;