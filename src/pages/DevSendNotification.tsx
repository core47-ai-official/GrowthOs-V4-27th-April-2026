import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Beaker, Send } from "lucide-react";

export default function DevSendNotification() {
  const [keys, setKeys] = useState<string[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [payload, setPayload] = useState<string>("{}");
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('notification_templates').select('key').order('key');
      if (!error && data) setKeys(data.map((d: any) => d.key));
    })();
  }, []);

  const send = async () => {
    try {
      let payloadJson: any = {};
      try { payloadJson = JSON.parse(payload || '{}'); } catch (e) { throw new Error('Invalid JSON'); }
      const { data, error } = await supabase.rpc('send_test_notification', { template_key: selected, payload: payloadJson });
      if (error) throw error;
      toast({ title: 'Sent', description: 'Test notification sent to current user' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to send', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-2"><Beaker className="h-7 w-7"/> Send Test Notification</h1>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Compose</CardTitle>
          <CardDescription>Select a template and provide payload JSON</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Template</label>
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select template"/></SelectTrigger>
              <SelectContent>
                {keys.map(k => (<SelectItem key={k} value={k}>{k}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Payload (JSON)</label>
            <Textarea rows={8} value={payload} onChange={e => setPayload(e.target.value)} />
          </div>
          <Button onClick={send} disabled={!selected}><Send className="h-4 w-4 mr-2"/>Send</Button>
        </CardContent>
      </Card>
    </div>
  );
}
