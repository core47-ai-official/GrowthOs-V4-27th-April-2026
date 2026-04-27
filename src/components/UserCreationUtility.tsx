import React, { useState } from 'react';
import { useUserManagement } from '@/hooks/useUserManagement';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { TEST_DATA } from '@/config/text-content';

const usersToCreate = TEST_DATA.SAMPLE_USERS.map(user => ({
  target_email: user.email,
  target_password: user.password,
  target_role: user.role,
  target_full_name: user.name
}));

export const UserCreationUtility = () => {
  const { createUser, loading } = useUserManagement();
  const { toast } = useToast();
  const [createdUsers, setCreatedUsers] = useState<string[]>([]);

  const createAllUsers = async () => {
    let successCount = 0;
    let failCount = 0;

    for (const userData of usersToCreate) {
      try {
        const success = await createUser(userData);
        if (success) {
          successCount++;
          setCreatedUsers(prev => [...prev, userData.target_email]);
        } else {
          failCount++;
        }
      } catch (error) {
        failCount++;
      }
    }

    toast({
      title: "User Creation Complete",
      description: `Successfully created ${successCount} users. ${failCount} failed.`,
      variant: successCount > 0 ? "default" : "destructive"
    });
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Create System Users</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {usersToCreate.map((user, index) => (
            <div key={index} className="flex justify-between items-center p-2 bg-muted rounded">
              <div>
                <span className="font-medium">{user.target_role}</span>
                <span className="text-muted-foreground ml-2">{user.target_email}</span>
              </div>
              {createdUsers.includes(user.target_email) && (
                <span className="text-green-600 text-sm">✓ Created</span>
              )}
            </div>
          ))}
        </div>
        
        <Button 
          onClick={createAllUsers} 
          disabled={loading}
          className="w-full"
        >
          {loading ? 'Creating Users...' : 'Create All Users'}
        </Button>
      </CardContent>
    </Card>
  );
};