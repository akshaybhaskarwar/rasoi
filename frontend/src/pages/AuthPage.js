import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, ChefHat, Loader2, ArrowRight, Home, Users, Mail, CheckCircle, KeyRound, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'हिन्दी (Hindi)' },
  { value: 'mr', label: 'मराठी (Marathi)' }
];

const CITIES = [
  'Pune', 'Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Kolkata', 'Hyderabad', 
  'Ahmedabad', 'Jaipur', 'Nagpur', 'Nashik', 'Aurangabad', 'Other'
];

const AuthPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, signup, createHousehold, joinHousehold, forgotPassword, resetPassword } = useAuth();
  
  // Auth state
  const [mode, setMode] = useState('login'); // login, signup, forgot, reset, household
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  
  // Form data
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [homeLanguage, setHomeLanguage] = useState('en');
  const [city, setCity] = useState('Pune');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  
  // Household
  const [householdMode, setHouseholdMode] = useState('create'); // create or join
  const [householdName, setHouseholdName] = useState('');
  const [kitchenCode, setKitchenCode] = useState('');
  const [createdCode, setCreatedCode] = useState('');

  // Check for reset token in URL on mount
  useEffect(() => {
    const token = searchParams.get('reset_token');
    if (token) {
      setResetToken(token);
      setMode('reset');
    }
  }, [searchParams]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    const result = await login(email, password);
    
    if (result.success) {
      toast.success('Welcome back!');
      navigate('/');
    } else {
      toast.error(result.error);
    }
    
    setLoading(false);
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    
    setLoading(true);
    
    const result = await signup(email, password, name, homeLanguage, city);
    
    if (result.success) {
      toast.success('Account created!');
      setMode('household'); // Move to household setup
    } else {
      toast.error(result.error);
    }
    
    setLoading(false);
  };

  const handleCreateHousehold = async () => {
    if (!householdName.trim()) {
      toast.error('Please enter a kitchen name');
      return;
    }
    
    setLoading(true);
    
    const result = await createHousehold(householdName);
    
    if (result.success) {
      setCreatedCode(result.data.kitchen_code);
      toast.success('Kitchen created!');
    } else {
      toast.error(result.error);
    }
    
    setLoading(false);
  };

  const handleJoinHousehold = async () => {
    if (!kitchenCode.trim() || kitchenCode.length !== 6) {
      toast.error('Please enter a valid 6-digit kitchen code');
      return;
    }
    
    setLoading(true);
    
    const result = await joinHousehold(kitchenCode.toUpperCase());
    
    if (result.success) {
      toast.success(result.data.message);
      navigate('/');
    } else {
      toast.error(result.error);
    }
    
    setLoading(false);
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    
    if (!email) {
      toast.error('Please enter your email address');
      return;
    }
    
    setLoading(true);
    
    const result = await forgotPassword(email);
    
    if (result.success) {
      setResetSent(true);
      toast.success('Reset instructions sent!');
    } else {
      // Still show success to not reveal if email exists
      setResetSent(true);
      toast.success('If this email exists, reset instructions have been sent');
    }
    
    setLoading(false);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    
    if (newPassword !== confirmNewPassword) {
      toast.error('Passwords do not match');
      return;
    }
    
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    
    setLoading(true);
    
    const result = await resetPassword(resetToken, newPassword);
    
    if (result.success) {
      setResetSuccess(true);
      toast.success('Password reset successful!');
    } else {
      toast.error(result.error || 'Failed to reset password');
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl border-0">
        {/* Header */}
        <CardHeader className="text-center pb-2">
          <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <ChefHat className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
            Rasoi-Sync
          </CardTitle>
          <CardDescription>
            {mode === 'login' && 'Welcome back to your kitchen'}
            {mode === 'signup' && 'Create your kitchen account'}
            {mode === 'forgot' && 'Reset your password'}
            {mode === 'household' && 'Set up your kitchen'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* Login Form */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  data-testid="login-email"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    data-testid="login-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    data-testid="toggle-password"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600"
                disabled={loading}
                data-testid="login-submit"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Sign In
              </Button>
              
              <div className="text-center space-y-2">
                <button
                  type="button"
                  onClick={() => setMode('forgot')}
                  className="text-sm text-orange-600 hover:underline"
                >
                  Forgot password?
                </button>
                <p className="text-sm text-gray-500">
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => setMode('signup')}
                    className="text-orange-600 hover:underline font-medium"
                    data-testid="goto-signup"
                  >
                    Sign up
                  </button>
                </p>
              </div>
            </form>
          )}

          {/* Signup Form */}
          {mode === 'signup' && (
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Your Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  data-testid="signup-name"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  data-testid="signup-email"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Home Language</Label>
                  <Select value={homeLanguage} onValueChange={setHomeLanguage}>
                    <SelectTrigger data-testid="signup-language">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map(lang => (
                        <SelectItem key={lang.value} value={lang.value}>
                          {lang.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>City</Label>
                  <Select value={city} onValueChange={setCity}>
                    <SelectTrigger data-testid="signup-city">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CITIES.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="signup-password">Password</Label>
                <div className="relative">
                  <Input
                    id="signup-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Min 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    data-testid="signup-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  data-testid="signup-confirm-password"
                />
              </div>
              
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600"
                disabled={loading}
                data-testid="signup-submit"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Create Account
              </Button>
              
              <p className="text-center text-sm text-gray-500">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-orange-600 hover:underline font-medium"
                  data-testid="goto-login"
                >
                  Sign in
                </button>
              </p>
            </form>
          )}

          {/* Household Setup */}
          {mode === 'household' && (
            <div className="space-y-6">
              {!createdCode ? (
                <>
                  {/* Toggle between create/join */}
                  <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
                    <button
                      onClick={() => setHouseholdMode('create')}
                      className={`flex-1 py-2 px-4 rounded-md font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                        householdMode === 'create'
                          ? 'bg-white shadow text-orange-600'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                      data-testid="household-create-tab"
                    >
                      <Home className="w-4 h-4" />
                      Create Kitchen
                    </button>
                    <button
                      onClick={() => setHouseholdMode('join')}
                      className={`flex-1 py-2 px-4 rounded-md font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                        householdMode === 'join'
                          ? 'bg-white shadow text-orange-600'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                      data-testid="household-join-tab"
                    >
                      <Users className="w-4 h-4" />
                      Join Kitchen
                    </button>
                  </div>

                  {householdMode === 'create' ? (
                    <div className="space-y-4">
                      <div className="text-center p-4 bg-orange-50 rounded-lg">
                        <Home className="w-8 h-8 text-orange-500 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">
                          Create your digital kitchen and get a code to share with family members
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Kitchen Name</Label>
                        <Input
                          placeholder="e.g., Sharma Family Kitchen"
                          value={householdName}
                          onChange={(e) => setHouseholdName(e.target.value)}
                          data-testid="household-name"
                        />
                      </div>
                      
                      <Button
                        onClick={handleCreateHousehold}
                        className="w-full bg-gradient-to-r from-orange-500 to-amber-500"
                        disabled={loading}
                        data-testid="create-household-btn"
                      >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Create Kitchen
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="text-center p-4 bg-blue-50 rounded-lg">
                        <Users className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">
                          Enter the 6-digit code shared by your family member
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Kitchen Code</Label>
                        <Input
                          placeholder="ABC123"
                          value={kitchenCode}
                          onChange={(e) => setKitchenCode(e.target.value.toUpperCase())}
                          maxLength={6}
                          className="text-center text-2xl tracking-widest font-mono"
                          data-testid="kitchen-code-input"
                        />
                      </div>
                      
                      <Button
                        onClick={handleJoinHousehold}
                        className="w-full bg-gradient-to-r from-blue-500 to-indigo-500"
                        disabled={loading || kitchenCode.length !== 6}
                        data-testid="join-household-btn"
                      >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Join Kitchen
                      </Button>
                    </div>
                  )}
                  
                  <button
                    onClick={() => navigate('/')}
                    className="w-full text-sm text-gray-500 hover:text-gray-700"
                  >
                    Skip for now
                  </button>
                </>
              ) : (
                /* Show created code */
                <div className="space-y-6 text-center">
                  <div className="p-6 bg-green-50 rounded-xl">
                    <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Home className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="font-bold text-lg text-green-800 mb-2">
                      Kitchen Created!
                    </h3>
                    <p className="text-sm text-green-700 mb-4">
                      Share this code with your family members:
                    </p>
                    <div className="bg-white p-4 rounded-lg border-2 border-dashed border-green-300">
                      <p className="text-3xl font-mono font-bold tracking-widest text-green-600">
                        {createdCode}
                      </p>
                    </div>
                    <p className="text-xs text-green-600 mt-3">
                      They can use this to join your kitchen
                    </p>
                  </div>
                  
                  <Button
                    onClick={() => navigate('/')}
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-500"
                    data-testid="enter-kitchen-btn"
                  >
                    Enter Kitchen
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Forgot Password */}
          {mode === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg mb-4">
                <p className="text-sm text-gray-600">
                  Enter your email address and we'll send you a link to reset your password
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="forgot-email">Email</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-orange-500 to-amber-500"
                disabled={loading}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Send Reset Link
              </Button>
              
              <button
                type="button"
                onClick={() => setMode('login')}
                className="w-full text-sm text-gray-500 hover:text-gray-700"
              >
                Back to login
              </button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthPage;
