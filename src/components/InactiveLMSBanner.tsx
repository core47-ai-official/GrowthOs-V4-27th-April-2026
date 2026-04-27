import React from 'react';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

interface InactiveLMSBannerProps {
  show: boolean;
}

export const InactiveLMSBanner: React.FC<InactiveLMSBannerProps> = ({ show }) => {
  if (!show) return null;

  return (
    <Alert className="mb-6 bg-gradient-to-r from-orange-50 to-orange-50/50 border-2 border-orange-200">
      <AlertTriangle className="h-4 w-4 text-orange-600" />
      <AlertDescription className="text-orange-800 font-medium">
        Please clear your fees to access recordings, assignments, and other learning materials.
      </AlertDescription>
    </Alert>
  );
};