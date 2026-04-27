import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Eye, EyeOff, Copy, Key, Mail } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CredentialDisplayProps {
  email: string;
  password?: string;
  lmsUserId?: string;
  lmsPassword?: string;
  className?: string;
}

export function CredentialDisplay({ 
  email, 
  password, 
  lmsUserId, 
  lmsPassword, 
  className 
}: CredentialDisplayProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showLmsPassword, setShowLmsPassword] = useState(false);
  const { toast } = useToast();

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied!",
        description: `${label} copied to clipboard`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive"
      });
    }
  };

  const maskPassword = (pwd: string) => '•'.repeat(pwd.length);

  return (
    <Card className={className}>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Key className="w-4 h-4" />
          Login Credentials
        </div>
        
        {/* Email/Username */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Email:</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(email, 'Email')}
              className="h-6 p-1"
            >
              <Copy className="w-3 h-3" />
            </Button>
          </div>
          <div className="font-mono text-sm bg-muted/50 p-2 rounded border">
            {email}
          </div>
        </div>

        {/* System Password */}
        {password && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">System Password:</span>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPassword(!showPassword)}
                  className="h-6 p-1"
                >
                  {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(password, 'Password')}
                  className="h-6 p-1"
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            </div>
            <div className="font-mono text-sm bg-muted/50 p-2 rounded border">
              {showPassword ? password : maskPassword(password)}
            </div>
          </div>
        )}

        {/* LMS Credentials */}
        {(lmsUserId || lmsPassword) && (
          <div className="border-t pt-4 space-y-3">
            <div className="text-sm font-medium text-muted-foreground">LMS Credentials</div>
            
            {lmsUserId && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">LMS User ID:</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(lmsUserId, 'LMS User ID')}
                    className="h-6 p-1"
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
                <div className="font-mono text-sm bg-muted/50 p-2 rounded border">
                  {lmsUserId}
                </div>
              </div>
            )}

            {lmsPassword && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">LMS Password:</span>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowLmsPassword(!showLmsPassword)}
                      className="h-6 p-1"
                    >
                      {showLmsPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(lmsPassword, 'LMS Password')}
                      className="h-6 p-1"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                <div className="font-mono text-sm bg-muted/50 p-2 rounded border">
                  {showLmsPassword ? lmsPassword : maskPassword(lmsPassword)}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}