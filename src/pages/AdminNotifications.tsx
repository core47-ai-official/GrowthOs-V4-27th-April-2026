import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, Save, RefreshCw, Edit3, Eye, CheckCircle2 } from "lucide-react";

interface TemplateRow {
  id: string;
  key: string;
  title_md: string;
  body_md: string;
  variables: string[];
  active: boolean;
  updated_at: string;
}

export default function AdminNotifications() {
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [selected, setSelected] = useState<TemplateRow | null>(null);
  const [samplePayload, setSamplePayload] = useState<string>('{}');
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchTemplates = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('notification_templates')
      .select('*')
      .order('key');
    setLoading(false);
    if (error) {
      toast({ title: 'Error', description: 'Failed to load templates', variant: 'destructive' });
      return;
    }
    setTemplates((data as any) || []);
  };

  useEffect(() => { fetchTemplates(); }, []);

  const startNew = () => {
    setSelected({ id: '', key: '', title_md: '', body_md: '', variables: [], active: true, updated_at: new Date().toISOString() });
  };

  const saveTemplate = async () => {
    if (!selected) return;
    try {
      if (!selected.key) throw new Error('Key is required');
      if (selected.id) {
        const { error } = await supabase
          .from('notification_templates')
          .update({ key: selected.key, title_md: selected.title_md, body_md: selected.body_md, variables: selected.variables, active: selected.active })
          .eq('id', selected.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('notification_templates')
          .insert({ key: selected.key, title_md: selected.title_md, body_md: selected.body_md, variables: selected.variables, active: selected.active });
        if (error) throw error;
      }
      toast({ title: 'Saved', description: 'Template saved successfully' });
      setSelected(null);
      fetchTemplates();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to save template', variant: 'destructive' });
    }
  };

  const toggleActive = async (row: TemplateRow) => {
    const { error } = await supabase
      .from('notification_templates')
      .update({ active: !row.active })
      .eq('id', row.id);
    if (error) {
      toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' });
    } else {
      fetchTemplates();
    }
  };

  const renderPreview = () => {
    if (!selected) return null;
    let payload: any = {};
    try { payload = JSON.parse(samplePayload || '{}'); } catch {}
    const interp = (t?: string) => (t || '').replace(/\{(.*?)\}/g, (_, k) => String(payload[k] ?? ''));
    return (
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Eye className="h-4 w-4"/> Preview</CardTitle>
          <CardDescription>Rendered with sample payload</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="font-medium">{interp(selected.title_md)}</div>
            <div className="text-sm text-muted-foreground whitespace-pre-wrap">{interp(selected.body_md)}</div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Notifications Templates</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchTemplates}><RefreshCw className="h-4 w-4 mr-2"/>Refresh</Button>
          <Button onClick={startNew}><Plus className="h-4 w-4 mr-2"/>New Template</Button>
        </div>
      </header>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">Existing Templates</CardTitle>
            <CardDescription>Click edit to modify</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div>Loading…</div>
            ) : (
              <div className="space-y-2">
                {templates.map(t => (
                  <div key={t.id} className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{t.key}</span>
                        {t.active ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground line-clamp-1">{t.title_md}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => toggleActive(t)}>
                        <CheckCircle2 className="h-4 w-4 mr-2"/>{t.active ? 'Disable' : 'Enable'}
                      </Button>
                      <Button size="sm" onClick={() => setSelected(t)}><Edit3 className="h-4 w-4 mr-2"/>Edit</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">Editor</CardTitle>
            <CardDescription>Create or update a template</CardDescription>
          </CardHeader>
          <CardContent>
            {!selected ? (
              <div className="text-sm text-muted-foreground">Select a template to edit or click New Template.</div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Key</label>
                  <Input value={selected.key} onChange={e => setSelected({ ...selected, key: e.target.value })} placeholder="e.g., invoice_due" />
                </div>
                <div>
                  <label className="text-sm font-medium">Title (Markdown)</label>
                  <Input value={selected.title_md} onChange={e => setSelected({ ...selected, title_md: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium">Body (Markdown)</label>
                  <Textarea value={selected.body_md} onChange={e => setSelected({ ...selected, body_md: e.target.value })} rows={6} />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch checked={selected.active} onCheckedChange={(v) => setSelected({ ...selected, active: v })} />
                    <span className="text-sm">Active</span>
                  </div>
                  <Button onClick={saveTemplate}><Save className="h-4 w-4 mr-2"/>Save</Button>
                </div>
                <div>
                  <label className="text-sm font-medium">Sample payload (JSON)</label>
                  <Textarea value={samplePayload} onChange={e => setSamplePayload(e.target.value)} rows={4} />
                </div>
                {renderPreview()}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
