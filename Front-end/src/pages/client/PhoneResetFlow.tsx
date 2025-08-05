import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { 
  useForgotPasswordMutation,
  useVerifyResetCodeMutation,
  useResetPasswordWithPhoneMutation
} from '../../api/auth.repo';
import {
  Box,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Alert,
  Stepper,
  Step,
  StepLabel,
  Paper
} from '@mui/material';

const steps = ['Enter Phone', 'Verify Code', 'New Password'];

const PhoneResetFlow = () => {
  const router = useRouter();
  const [activeStep, setActiveStep] = useState(0);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [forgotPassword, { isLoading: isSending }] = useForgotPasswordMutation();
  const [verifyCode, { isLoading: isVerifying, error: verifyError }] = useVerifyResetCodeMutation();
  const [resetPassword, { isLoading: isResetting, error: resetError, isSuccess }] = useResetPasswordWithPhoneMutation();

  const handleSendCode = async () => {
    try {
      await forgotPassword({ identifier: phoneNumber }).unwrap();
      setActiveStep(1);
    } catch (error) {
      console.error('Failed to send code:', error);
    }
  };

  const handleVerifyCode = async () => {
    try {
      await verifyCode({ phoneNumber, code }).unwrap();
      setActiveStep(2);
    } catch (error) {
      console.error('Code verification failed:', error);
    }
  };

  const handleResetPassword = async () => {
    if (newPassword !== confirmPassword) {
      alert("Passwords don't match");
      return;
    }

    try {
      await resetPassword({ phoneNumber, newPassword }).unwrap();
      router.push('/login');
    } catch (error) {
      console.error('Password reset failed:', error);
    }
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <>
            <Typography variant="body1" gutterBottom>
              Enter your phone number to receive a verification code
            </Typography>
            <TextField
              fullWidth
              label="Phone Number"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              margin="normal"
              placeholder="+225XXXXXXXXX"
            />
            <Button
              variant="contained"
              color="primary"
              onClick={handleSendCode}
              disabled={isSending || !phoneNumber}
              sx={{ mt: 2 }}
            >
              {isSending ? <CircularProgress size={24} /> : 'Send Code'}
            </Button>
          </>
        );
      case 1:
        return (
          <>
            <Typography variant="body1" gutterBottom>
              Enter the 6-digit code sent to {phoneNumber}
            </Typography>
            <TextField
              fullWidth
              label="Verification Code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              margin="normal"
            />
            {verifyError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                Invalid verification code
              </Alert>
            )}
            <Button
              variant="contained"
              color="primary"
              onClick={handleVerifyCode}
              disabled={isVerifying || code.length !== 6}
              sx={{ mt: 2 }}
            >
              {isVerifying ? <CircularProgress size={24} /> : 'Verify Code'}
            </Button>
          </>
        );
      case 2:
        return (
          <>
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
            />
            <TextField
              fullWidth
              label="Confirm Password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              margin="normal"
              sx={{ mb: 2 }}
            />
            {resetError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                Password reset failed
              </Alert>
            )}
            {isSuccess && (
              <Alert severity="success" sx={{ mb: 2 }}>
                Password reset successfully!
              </Alert>
            )}
            <Button
              variant="contained"
              color="primary"
              onClick={handleResetPassword}
              disabled={isResetting || newPassword !== confirmPassword}
              sx={{ mt: 2 }}
            >
              {isResetting ? <CircularProgress size={24} /> : 'Reset Password'}
            </Button>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <Paper sx={{ p: 4, maxWidth: 500, mx: 'auto' }}>
      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>
      
      {renderStepContent()}
    </Paper>
  );
};

export default PhoneResetFlow;