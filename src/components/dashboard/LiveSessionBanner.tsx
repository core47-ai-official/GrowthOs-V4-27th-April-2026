import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Video } from "lucide-react";
import { format } from "date-fns";

interface LiveSessionBannerProps {
  session: {
    id: string;
    title: string;
    start_time: string;
    mentor_name: string;
    link?: string;
    description?: string;
  };
}

export const LiveSessionBanner: React.FC<LiveSessionBannerProps> = ({ session }) => {
  const isLive = new Date(session.start_time) <= new Date();

  return (
    <Card className="border-primary/30 bg-primary/5 shadow-sm hover:shadow-md transition-shadow duration-200 animate-fade-in">
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-violet-500/15 flex items-center justify-center flex-shrink-0">
              <Video className="w-5 h-5 text-violet-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-violet-600 uppercase tracking-wide">
                {isLive ? '🔴 Live Now' : 'Upcoming Live Session'}
              </p>
              <h3 className="text-base sm:text-lg font-semibold truncate">{session.title}</h3>
              <p className="text-sm text-muted-foreground">
                {format(new Date(session.start_time), 'EEEE, MMM dd · h:mm a')}
                {session.mentor_name && ` · Host: ${session.mentor_name}`}
              </p>
            </div>
          </div>
          {session.link && (
            <Button
              size="sm"
              className="bg-violet-600 hover:bg-violet-700 text-white flex-shrink-0"
              onClick={() => window.open(session.link, '_blank')}
            >
              <Video className="w-4 h-4 mr-1.5" />
              Join Session
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
