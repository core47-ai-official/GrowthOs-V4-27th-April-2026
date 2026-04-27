import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { ENV_CONFIG } from "@/lib/env-config";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Loader2, ArrowLeft, Mail, Lock, CheckCircle2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { FieldError } from "@/components/ui/error-message";
// Capture URL params IMMEDIATELY before Supabase or React can clear them
const capturedParams = {
  tokenHash: new URLSearchParams(window.location.search).get('token_hash'),
  type: new URLSearchParams(window.location.search).get('type'),
  code: new URLSearchParams(window.location.search).get('code'),
  error: new URLSearchParams(window.location.search).get('error'),
  errorCode: new URLSearchParams(window.location.search).get('error_code'),
  errorDescription: new URLSearchParams(window.location.search).get('error_description'),
  hash: window.location.hash,
};
console.log('[ResetPassword] Captured params at module level:', capturedParams);

const ResetPassword = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  const [isCheckingToken, setIsCheckingToken] = useState(true);
  const [linkError, setLinkError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const {
    toast
  } = useToast();
  const navigate = useNavigate();

  // Check if we're in password reset mode (user clicked link from email)
  useEffect(() => {
    let resolved = false;
    const markResolved = (mode: boolean, error?: string) => {
      if (resolved) return;
      resolved = true;
      console.log('[ResetPassword] markResolved called:', { mode, error });
      if (error) setLinkError(error);
      if (mode) setIsResetMode(true);
      setIsCheckingToken(false);
    };

    // Listen for PASSWORD_RECOVERY event from Supabase auto-exchange
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[ResetPassword] Auth event:', event);
      if (event === 'PASSWORD_RECOVERY') {
        window.history.replaceState({}, document.title, window.location.pathname);
        markResolved(true);
      }
    });

    const handlePasswordResetToken = async () => {
      try {
        const hashStr = capturedParams.hash.substring(1);
        const hashParams = new URLSearchParams(hashStr);

        console.log('[ResetPassword] Using captured params:', capturedParams);

        // Check for error parameters
        const error = capturedParams.error || hashParams.get('error');
        const errorCode = capturedParams.errorCode || hashParams.get('error_code');
        const errorDescription = capturedParams.errorDescription || hashParams.get('error_description');

        if (error || errorCode === 'otp_expired') {
          const desc = errorDescription || 'Email link is invalid or has expired';
          window.history.replaceState({}, document.title, window.location.pathname);
          markResolved(false, decodeURIComponent(desc.replace(/\+/g, ' ')));
          return;
        }

        // Handle token_hash flow (link goes directly to our app, not Supabase /verify)
        if (capturedParams.tokenHash && capturedParams.type === 'recovery') {
          console.log('[ResetPassword] token_hash found, verifying OTP...');
          window.history.replaceState({}, document.title, window.location.pathname);
          const { error: otpError } = await supabase.auth.verifyOtp({
            token_hash: capturedParams.tokenHash,
            type: 'recovery',
          });
          if (otpError) {
            console.error('[ResetPassword] OTP verification error:', otpError);
            markResolved(false, "This password reset link has expired or is invalid. Please request a new one.");
          } else {
            console.log('[ResetPassword] OTP verification successful!');
            markResolved(true);
          }
          return;
        }

        // Legacy: hash-based recovery token (implicit flow)
        const accessToken = hashParams.get('access_token');
        const hashType = hashParams.get('type');
        if (accessToken && hashType === 'recovery') {
          markResolved(true);
          return;
        }

        // Legacy: code-based PKCE flow
        const code = capturedParams.code;
        if (code) {
          console.log('[ResetPassword] Code found, exchanging...');
          const { data, error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
          window.history.replaceState({}, document.title, window.location.pathname);
          if (exchangeErr) {
            console.error('[ResetPassword] Exchange error:', exchangeErr);
            markResolved(false, "This password reset link has expired or is invalid. Please request a new one.");
          } else if (data.session) {
            markResolved(true);
          } else {
            markResolved(false, "This password reset link has expired or is invalid. Please request a new one.");
          }
          return;
        }

        // No recovery indicators — check existing session
        const { data: existingSession } = await supabase.auth.getSession();
        if (existingSession.session) {
          markResolved(true);
          return;
        }

        // Show request form
        markResolved(false);
      } catch (err) {
        console.error('[ResetPassword] Token handling error:', err);
        markResolved(false, "An error occurred while processing your reset link. Please try again.");
      }
    };

    handlePasswordResetToken();

    return () => subscription.unsubscribe();
  }, []);
  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError("");
    if (!email) {
      setEmailError("Email is required");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setEmailError("Please enter a valid email address");
      return;
    }
    setIsLoading(true);
    try {
      const {
        error
      } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${ENV_CONFIG.SITE_URL || window.location.origin}/reset-password`
      });
      if (error) {
        console.error('Reset password error:', error);
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive"
        });
        return;
      }
      setEmailSent(true);
      toast({
        title: "Email Sent",
        description: "Check your inbox for the password reset link."
      });
    } catch (error: any) {
      console.error('Reset password error:', error);
      toast({
        title: "Error",
        description: "Failed to send reset email. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setConfirmPasswordError("");
    if (!password) {
      setPasswordError("Password is required");
      return;
    }
    if (password.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      setConfirmPasswordError("Passwords do not match");
      return;
    }
    setIsLoading(true);
    try {
      // Get current user before updating password
      const { data: { user } } = await supabase.auth.getUser();
      
      const {
        error
      } = await supabase.auth.updateUser({
        password: password
      });
      if (error) {
        console.error('Update password error:', error);
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive"
        });
        return;
      }
      
      // Sync password_display in users table so admins can see current password
      if (user?.id) {
        const { error: syncError } = await supabase
          .from('users')
          .update({ 
            password_display: password,
            is_temp_password: false,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);
        
        if (syncError) {
          console.error('Error syncing password display:', syncError);
          // Don't fail the whole operation, password was still updated
        }
      }
      
      toast({
        title: "Password Updated",
        description: "Your password has been successfully reset. You can now login with your new password."
      });

      // Sign out and redirect to login
      await supabase.auth.signOut();
      navigate('/');
    } catch (error: any) {
      console.error('Update password error:', error);
      toast({
        title: "Error",
        description: "Failed to update password. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  return <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-700 to-emerald-600 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-20 w-72 h-72 bg-blue-400/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-emerald-400/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>
      
      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJtIDEwIDAgbCAwIDEwIG0gMCAwIGwgMTAgMCBtIDAgMTAgbCAxMCAwIG0gMTAgMCBsIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2ZmZmZmZiIgc3Ryb2tlLXdpZHRoPSIwLjUiIG9wYWNpdHk9IjAuMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-30"></div>
      
      <Card className="w-full max-w-lg relative z-10 shadow-2xl border-0 bg-white/95 backdrop-blur-xl overflow-hidden animate-fade-in">
        {/* Decorative header gradient */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-emerald-500"></div>
        
        <CardHeader className="text-center pb-6 pt-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-emerald-500 rounded-full flex items-center justify-center">
            {isResetMode ? <Lock className="w-8 h-8 text-white" /> : emailSent ? <CheckCircle2 className="w-8 h-8 text-white" /> : <Mail className="w-8 h-8 text-white" />}
          </div>
          
          <CardTitle className="text-2xl font-bold text-gray-900">
            {isResetMode ? "Set New Password" : emailSent ? "Check Your Email" : "Reset Password"}
          </CardTitle>
          
          <CardDescription className="text-gray-600 mt-2">
            {isResetMode ? "Enter your new password below" : emailSent ? "We've sent a password reset link to your email address" : "Enter your email and we'll send you a reset link"}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="px-8 pb-8">
          {isCheckingToken ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-4" />
              <p className="text-gray-600">Verifying your reset link...</p>
            </div>
          ) : linkError ? (
            <div className="text-center space-y-6">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-800 text-sm">{linkError}</p>
              </div>
              
              <Button 
                variant="outline" 
                onClick={() => {
                  setLinkError("");
                  setIsResetMode(false);
                }} 
                className="w-full"
              >
                Request a new reset link
              </Button>
              
              <Link to="/" className="flex items-center justify-center gap-2 text-sm text-gray-600 hover:text-blue-600 transition-colors">
                <ArrowLeft className="w-4 h-4" />
                Back to Login
              </Link>
            </div>
          ) : emailSent && !isResetMode ? <div className="text-center space-y-6">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                <p className="text-emerald-800 text-sm">
                  A password reset link has been sent to <strong>{email}</strong>. Please check your inbox and spam folder.
                </p>
              </div>
              
              <Button variant="outline" onClick={() => setEmailSent(false)} className="w-full">
                Try a different email
              </Button>
              
              <Link to="/" className="flex items-center justify-center gap-2 text-sm text-gray-600 hover:text-blue-600 transition-colors">
                <ArrowLeft className="w-4 h-4" />
                Back to Login
              </Link>
            </div> : isResetMode ? <form onSubmit={handleUpdatePassword} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                  New Password
                </Label>
                <div className="relative">
                  <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={e => {
                setPassword(e.target.value);
                if (passwordError) setPasswordError("");
              }} className={`h-12 pl-4 pr-12 border-2 transition-all duration-200 rounded-lg ${passwordError ? 'border-destructive' : 'border-gray-200 focus:border-blue-500'}`} placeholder="••••••••" required />
                  <Button type="button" variant="ghost" size="sm" className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 hover:bg-gray-100" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff className="h-4 w-4 text-gray-500" /> : <Eye className="h-4 w-4 text-gray-500" />}
                  </Button>
                </div>
                <FieldError error={passwordError} />
                <p className="text-xs text-gray-500">Must be at least 8 characters</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">
                  Confirm Password
                </Label>
                <Input id="confirmPassword" type={showPassword ? "text" : "password"} value={confirmPassword} onChange={e => {
              setConfirmPassword(e.target.value);
              if (confirmPasswordError) setConfirmPasswordError("");
            }} className={`h-12 pl-4 pr-4 border-2 transition-all duration-200 rounded-lg ${confirmPasswordError ? 'border-destructive' : 'border-gray-200 focus:border-blue-500'}`} placeholder="••••••••" required />
                <FieldError error={confirmPasswordError} />
              </div>
              
              <Button type="submit" className="w-full h-12 bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-700 hover:to-emerald-700 text-white font-semibold transition-all duration-300 rounded-lg" disabled={isLoading}>
                {isLoading ? <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Updating Password...</span>
                  </div> : "Update Password"}
              </Button>
            </form> : <form onSubmit={handleRequestReset} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                  Email Address
                </Label>
                <Input id="email" type="email" value={email} onChange={e => {
              setEmail(e.target.value);
              if (emailError) setEmailError("");
            }} className={`h-12 pl-4 pr-4 border-2 transition-all duration-200 rounded-lg ${emailError ? 'border-destructive' : 'border-gray-200 focus:border-blue-500'}`} placeholder="your@email.com" required />
                <FieldError error={emailError} />
              </div>
              
              <Button type="submit" className="w-full h-12 bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-700 hover:to-emerald-700 text-white font-semibold transition-all duration-300 rounded-lg" disabled={isLoading}>
                {isLoading ? <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Sending...</span>
                  </div> : "Send Reset Link"}
              </Button>
              
              <Link to="/" className="flex items-center justify-center gap-2 text-sm text-gray-600 hover:text-blue-600 transition-colors mt-4">
                <ArrowLeft className="w-4 h-4" />
                Back to Login
              </Link>
            </form>}
        </CardContent>
      </Card>
    </div>;
};
export default ResetPassword;