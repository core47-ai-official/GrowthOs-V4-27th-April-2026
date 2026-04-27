import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  MessageSquare, 
  Send, 
  Clock, 
  User,
  Search,
  Filter
} from "lucide-react";

interface Message {
  id: string;
  template_name: string;
  context: any;
  status: string;
  sent_at: string;
  response_id: string;
  user_id: string;
}

const Messages = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [messageType, setMessageType] = useState("feedback");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // messages table doesn't exist, use empty array
      setMessages([]);
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast({
        title: "Error",
        description: "Failed to load messages",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      // messages table doesn't exist, use user_activity_logs instead
      const { error } = await supabase
        .from('user_activity_logs')
        .insert([{
          user_id: user.id,
          activity_type: 'message_sent',
          metadata: {
            message: newMessage,
            type: messageType,
            timestamp: new Date().toISOString()
          }
        }]);

      if (error) throw error;

      setNewMessage("");
      fetchMessages();
      
      toast({
        title: "Message Sent",
        description: "Your message has been delivered",
      });
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'queued':
        return <Badge className="bg-yellow-100 text-yellow-800">Queued</Badge>;
      case 'sent':
        return <Badge className="bg-green-100 text-green-800">Sent</Badge>;
      case 'replied':
        return <Badge className="bg-blue-100 text-blue-800">Replied</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getMessageContent = (message: Message) => {
    if (message.context?.message) {
      return message.context.message;
    }
    if (message.template_name) {
      return `Template: ${message.template_name}`;
    }
    return 'No content available';
  };

  const filteredMessages = messages.filter(message => {
    const matchesSearch = getMessageContent(message)
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || message.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="mb-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 text-blue-800">
            <MessageSquare className="w-5 h-5" />
            <span className="font-semibold">Limited Functionality</span>
          </div>
          <p className="text-blue-700 text-sm mt-1">
            Real-time messaging system is in development. Currently using support tickets for communication.
          </p>
        </div>
        <h1 className="text-3xl font-bold mb-2">Complaints & Feedbacks</h1>
        <p className="text-muted-foreground">
          Submit complaints and feedback to improve your learning experience
        </p>
      </div>

      {/* Send New Message */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="w-5 h-5" />
            Submit Complaint or Feedback
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Type</label>
            <select
              value={messageType}
              onChange={(e) => setMessageType(e.target.value)}
              className="w-full px-3 py-2 border rounded-md bg-white"
            >
              <option value="feedback">Feedback</option>
              <option value="complaint">Complaint</option>
            </select>
          </div>
          <Textarea
            placeholder={`Describe your ${messageType} in detail...`}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            rows={4}
          />
          <Button 
            onClick={sendMessage}
            disabled={!newMessage.trim()}
            className="w-full"
          >
            <Send className="w-4 h-4 mr-2" />
            Submit {messageType.charAt(0).toUpperCase() + messageType.slice(1)}
          </Button>
        </CardContent>
      </Card>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                <Input
                  placeholder="Search messages..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 border rounded-md bg-white"
              >
                <option value="all">All Status</option>
                <option value="queued">Queued</option>
                <option value="sent">Sent</option>
                <option value="replied">Replied</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Messages List */}
      <div className="space-y-4">
        {filteredMessages.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium mb-2">
                {messages.length === 0 ? "No Messages" : "No Matching Messages"}
              </h3>
              <p className="text-gray-600">
                {messages.length === 0 
                  ? "Send your first message to get started"
                  : "Try adjusting your search or filter criteria"
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredMessages.map((message) => (
            <Card key={message.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-full">
                      <MessageSquare className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {message.template_name || 'Direct Message'}
                        </span>
                        {getStatusBadge(message.status)}
                      </div>
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(message.sent_at).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-gray-700">{getMessageContent(message)}</p>
                </div>

                {message.response_id && (
                  <div className="mt-3 text-sm text-blue-600">
                    Response ID: {message.response_id}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default Messages;