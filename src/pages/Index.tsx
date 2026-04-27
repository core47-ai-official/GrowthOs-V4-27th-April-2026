import { UserCreationUtility } from "@/components/UserCreationUtility";

const Index = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-4xl space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">System Setup</h1>
          <p className="text-xl text-muted-foreground">Create initial users for the system</p>
        </div>
        <UserCreationUtility />
      </div>
    </div>
  );
};

export default Index;
