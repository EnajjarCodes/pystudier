import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Lock, ArrowRight, Loader2, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import mascotWave from "@/assets/mascot-wave.png";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

interface AuthPageProps {
  onAuthSuccess: () => void;
}

type AuthMode = "login" | "signup" | "verify";

const AuthPage = ({ onAuthSuccess }: AuthPageProps) => {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const startResendCooldown = () => {
    setResendCooldown(60);
    const interval = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    if (mode === "signup" && !displayName.trim()) {
      toast.error("Please enter your name");
      return;
    }

    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: displayName.trim() },
          },
        });
        if (error) throw error;
        toast.success("A verification code has been sent to your email!");
        setMode("verify");
        startResendCooldown();
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onAuthSuccess();
      }
    } catch (err: any) {
      toast.error(err.message || "Authentication failed");
    }
    setLoading(false);
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) return;
    setVerifyLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
        type: "signup",
      });
      if (error) throw error;
      toast.success("Email verified! Welcome to Pystudier!");
      onAuthSuccess();
    } catch (err: any) {
      toast.error(err.message || "Invalid code. Please try again.");
      setOtpCode("");
    }
    setVerifyLoading(false);
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0) return;
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
      });
      if (error) throw error;
      toast.success("A new verification code has been sent!");
      startResendCooldown();
    } catch (err: any) {
      toast.error(err.message || "Failed to resend code");
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error(result.error.message || "Google sign-in failed");
      }
    } catch (err: any) {
      toast.error(err.message || "Google sign-in failed");
    }
    setGoogleLoading(false);
  };

  // OTP verification screen
  if (mode === "verify") {
    return (
      <div className="min-h-[100dvh] gradient-hero flex items-center justify-center p-4">
        <div className="max-w-md w-full flex flex-col items-center gap-6">
          <motion.img
            src={mascotWave}
            alt="Pylo"
            className="w-24 h-24 sm:w-32 sm:h-32 object-contain drop-shadow-lg"
            initial={{ scale: 0 }}
            animate={{ scale: 1, y: [0, -6, 0] }}
            transition={{ scale: { type: "spring", stiffness: 200 }, y: { duration: 3, repeat: Infinity } }}
          />

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full bg-card rounded-2xl shadow-elevated p-5 sm:p-6"
          >
            <h2 className="font-display font-bold text-lg text-foreground text-center mb-1">
              Verify your email
            </h2>
            <p className="text-xs text-muted-foreground text-center mb-5">
              We sent a 6-digit code to <span className="font-semibold text-foreground">{email}</span>
            </p>

            <div className="flex justify-center mb-5">
              <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode}>
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>

            <motion.button
              onClick={handleVerifyOtp}
              disabled={verifyLoading || otpCode.length !== 6}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-2.5 rounded-xl gradient-primary text-primary-foreground font-display font-bold text-sm shadow-soft disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {verifyLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Verify Code
              <ArrowRight className="w-4 h-4" />
            </motion.button>

            <div className="mt-4 text-center">
              <button
                onClick={handleResendCode}
                disabled={resendCooldown > 0}
                className="text-xs text-primary font-semibold hover:underline disabled:text-muted-foreground disabled:no-underline"
              >
                {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend code"}
              </button>
            </div>

            <p className="text-xs text-muted-foreground text-center mt-3">
              <button
                onClick={() => { setMode("signup"); setOtpCode(""); }}
                className="text-primary font-semibold hover:underline"
              >
                ← Back to sign up
              </button>
            </p>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] gradient-hero flex items-center justify-center p-4">
      <div className="max-w-md w-full flex flex-col items-center gap-6">
        <motion.img
          src={mascotWave}
          alt="Pylo"
          className="w-24 h-24 sm:w-32 sm:h-32 object-contain drop-shadow-lg"
          initial={{ scale: 0 }}
          animate={{ scale: 1, y: [0, -6, 0] }}
          transition={{ scale: { type: "spring", stiffness: 200 }, y: { duration: 3, repeat: Infinity } }}
        />

        <div className="flex items-center">
          <span className="text-2xl font-display font-black text-primary">Py</span>
          <span className="text-2xl font-display font-black text-coral">studier</span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full bg-card rounded-2xl shadow-elevated p-5 sm:p-6"
        >
          <h2 className="font-display font-bold text-lg text-foreground text-center mb-1">
            {mode === "login" ? "Welcome back!" : "Create your account"}
          </h2>
          <p className="text-xs text-muted-foreground text-center mb-4">
            {mode === "login" ? "Sign in to continue studying" : "Join Pystudier and start learning"}
          </p>


          {/* Google */}
          <button
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-border bg-background hover:bg-secondary transition-all font-display font-bold text-sm text-foreground disabled:opacity-50"
          >
            {googleLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            Continue with Google
          </button>

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-3">
            {mode === "signup" && (
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background text-foreground font-body text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground"
                />
              </div>
            )}
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background text-foreground font-body text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-border bg-background text-foreground font-body text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-2.5 rounded-xl gradient-primary text-primary-foreground font-display font-bold text-sm shadow-soft disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {mode === "login" ? "Sign In" : "Create Account"}
              <ArrowRight className="w-4 h-4" />
            </motion.button>
          </form>

          <p className="text-xs text-muted-foreground text-center mt-4">
            {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
            <button
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
              className="text-primary font-semibold hover:underline"
            >
              {mode === "login" ? "Sign Up" : "Sign In"}
            </button>
          </p>

          {mode === "signup" && (
            <p className="text-[10px] text-muted-foreground text-center mt-3">
              By signing up, you agree to our{" "}
              <Link to="/terms" className="text-primary hover:underline">Terms of Service</Link>
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default AuthPage;
