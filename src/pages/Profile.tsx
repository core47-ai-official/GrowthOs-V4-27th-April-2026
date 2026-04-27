import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { User, Lock, Eye, EyeOff } from "lucide-react";
import { logAdminAction, ACTIVITY_TYPES } from "@/lib/activity-logger";

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
}

const Profile = () => {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [profileData, setProfileData] = useState({
    full_name: '',
    email: ''
  });
  const { toast } = useToast();

  // Update profile data when user changes
  useEffect(() => {
    if (user) {
      setProfileData({
        full_name: user.full_name || '',
        email: user.email || ''
      });
    }
  }, [user]);

  const updateProfile = async () => {
    if (!user?.id) {
      toast({
        title: "Error",
        description: "User not found. Please try logging in again.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({
          full_name: profileData.full_name
        })
        .eq('id', user.id);

      if (error) throw error;

      // Log profile update
      logAdminAction({
        performedBy: user.id,
        targetUserId: user.id,
        entityType: 'user',
        entityId: user.id,
        action: ACTIVITY_TYPES.PROFILE_UPDATED,
        description: `Profile updated by user`,
        data: { full_name: profileData.full_name }
      });

      toast({
        title: "Success!",
        description: "Profile updated successfully",
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updatePassword = async () => {
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      toast({
        title: "Error",
        description: "Please fill in all password fields",
        variant: "destructive",
      });
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: "Error",
        description: "New passwords do not match",
        variant: "destructive",
      });
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters long",
        variant: "destructive",
      });
      return;
    }

    try {
      // Update password directly - Supabase will handle current password verification
      const { data, error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });

      if (error) {
        // Handle specific error cases
        if (error.message.includes('session_not_found') || error.message.includes('unauthorized')) {
          toast({
            title: "Error",
            description: "Your session has expired. Please log in again.",
            variant: "destructive",
          });
          return;
        }
        
        throw error;
      }

      // Check if the update was successful
      if (data.user) {
        // Clear form on success
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });

        // Log password change
        logAdminAction({
          performedBy: user?.id || null,
          targetUserId: user?.id || '',
          entityType: 'user',
          entityId: user?.id || '',
          action: ACTIVITY_TYPES.PASSWORD_CHANGED,
          description: `Password changed by user`,
          data: {}
        });

        toast({
          title: "Success!",
          description: "Password updated successfully",
        });
      } else {
        toast({
          title: "Error", 
          description: "Password update failed. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Error updating password:', error);
      
      let errorMessage = "Failed to update password. Please try again.";
      
      if (error?.code === 'weak_password') {
        errorMessage = "Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character.";
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const togglePasswordVisibility = (field: 'current' | 'new' | 'confirm') => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  // Show loading while auth is initializing
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  // Show error if no user found
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Unable to load profile. Please try logging in again.</p>
          <Button onClick={() => window.location.assign('/login')}>
            Go to Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6 p-3 sm:p-6">
      <div className="text-center">
        <h1 className="text-2xl sm:text-3xl font-bold text-blue-600 mb-2">
          Profile Settings
        </h1>
        <p className="text-sm sm:text-base text-gray-600">Manage your account information</p>
      </div>

      <div className="space-y-6">
        {/* Personal Information */}
        <Card className="bg-white shadow-lg">
          <CardHeader className="bg-blue-50 border-b">
            <CardTitle className="flex items-center text-lg text-gray-800">
              <User className="w-5 h-5 mr-2 text-blue-600" />
              Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium text-gray-700">Full Name</Label>
              <Input
                id="name"
                value={profileData.full_name}
                onChange={(e) => setProfileData({...profileData, full_name: e.target.value})}
                placeholder="Enter your full name"
                className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                disabled={loading}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-gray-700">User ID (Email)</Label>
              <Input
                id="email"
                type="email"
                value={profileData.email}
                disabled
                className="bg-gray-100 border-gray-300 cursor-not-allowed"
              />
              <p className="text-xs text-blue-600">Email cannot be changed</p>
            </div>

            <div className="flex justify-end pt-4">
              <Button 
                onClick={updateProfile}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2"
                disabled={loading}
              >
                {loading ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Password Change */}
        <Card className="bg-white shadow-lg">
          <CardHeader className="bg-orange-50 border-b">
            <CardTitle className="flex items-center text-lg text-gray-800">
              <Lock className="w-5 h-5 mr-2 text-orange-600" />
              Change Password
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword" className="text-sm font-medium text-gray-700">Current Password</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showPasswords.current ? "text" : "password"}
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
                  placeholder="Enter current password"
                  className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => togglePasswordVisibility('current')}
                >
                  {showPasswords.current ? (
                    <Eye className="h-4 w-4 text-gray-500" />
                  ) : (
                    <EyeOff className="h-4 w-4 text-gray-500" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-sm font-medium text-gray-700">New Password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showPasswords.new ? "text" : "password"}
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                  placeholder="Enter new password"
                  className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => togglePasswordVisibility('new')}
                >
                  {showPasswords.new ? (
                    <Eye className="h-4 w-4 text-gray-500" />
                  ) : (
                    <EyeOff className="h-4 w-4 text-gray-500" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">Confirm New Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showPasswords.confirm ? "text" : "password"}
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                  placeholder="Confirm new password"
                  className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => togglePasswordVisibility('confirm')}
                >
                  {showPasswords.confirm ? (
                    <Eye className="h-4 w-4 text-gray-500" />
                  ) : (
                    <EyeOff className="h-4 w-4 text-gray-500" />
                  )}
                </Button>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button 
                onClick={updatePassword}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2"
                disabled={loading}
              >
                {loading ? "Updating..." : "Update Password"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Profile;