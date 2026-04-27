import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Upload, File, FileText, Image as ImageIcon, FileArchive, FileAudio, FileVideo } from 'lucide-react';

interface RecordingAttachmentsManagerProps {
  recordingId: string;
}

interface Attachment {
  id: string;
  file_name: string;
  file_url: string;
  uploaded_at: string;
}

function getIconForFile(name: string) {
  const n = name.toLowerCase();
  if (n.match(/\.(png|jpe?g|gif|webp|svg)$/)) return <ImageIcon className="w-4 h-4" />;
  if (n.match(/\.(pdf)$/)) return <FileText className="w-4 h-4" />;
  if (n.match(/\.(zip|rar|7z)$/)) return <FileArchive className="w-4 h-4" />;
  if (n.match(/\.(mp3|wav|m4a|ogg)$/)) return <FileAudio className="w-4 h-4" />;
  if (n.match(/\.(mp4|mov|webm|mkv)$/)) return <FileVideo className="w-4 h-4" />;
  if (n.match(/\.(docx?|pptx?|xlsx?)$/)) return <FileText className="w-4 h-4" />;
  return <File className="w-4 h-4" />;
}

export function RecordingAttachmentsManager({ recordingId }: RecordingAttachmentsManagerProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [files, setFiles] = useState<FileList | null>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const BUCKET = 'recording-attachments';

  const fetchAttachments = async () => {
    const { data, error } = await supabase
      .from('recording_attachments' as any)
      .select('id, file_name, file_url, uploaded_at')
      .eq('recording_id', recordingId)
      .order('uploaded_at', { ascending: false }) as any;
    if (error) {
      console.error('Failed to load attachments', error);
      toast({ title: 'Error', description: 'Failed to load attachments', variant: 'destructive' });
      return;
    }
    setAttachments((data as Attachment[]) || []);
  };

  useEffect(() => {
    fetchAttachments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordingId]);

  const onUpload = async () => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const path = `${recordingId}/${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
          upsert: true,
          cacheControl: '3600',
        });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
        const publicUrl = pub.publicUrl;
        const { error: insErr } = await supabase
          .from('recording_attachments' as any)
          .insert({ recording_id: recordingId, file_name: file.name, file_url: publicUrl } as any);
        if (insErr) throw insErr;
      }
      toast({ title: 'Uploaded', description: 'Attachments uploaded successfully' });
      setFiles(null);
      await fetchAttachments();
    } catch (e: any) {
      console.error('Upload failed', e);
      toast({ title: 'Error', description: 'Failed to upload attachments', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const deleteAttachment = async (att: Attachment) => {
    if (!confirm('Delete this attachment?')) return;
    try {
      // Try deleting file from storage too (best-effort)
      const idx = att.file_url.indexOf(`${BUCKET}/`);
      if (idx > -1) {
        const path = att.file_url.substring(idx + `${BUCKET}/`.length);
        await supabase.storage.from(BUCKET).remove([path]);
      }
      const { error } = await supabase.from('recording_attachments' as any).delete().eq('id', att.id);
      if (error) throw error;
      setAttachments((prev) => prev.filter((a) => a.id !== att.id));
      toast({ title: 'Deleted', description: 'Attachment removed' });
    } catch (e: any) {
      console.error('Delete failed', e);
      toast({ title: 'Error', description: 'Failed to delete attachment', variant: 'destructive' });
    }
  };

  return (
    <div className="rounded-md border bg-card p-4 space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <Input type="file" multiple onChange={(e) => setFiles(e.target.files)} />
        <Button onClick={onUpload} disabled={uploading || !files || files.length === 0} className="hover-scale">
          <Upload className="w-4 h-4 mr-2" /> Upload
        </Button>
      </div>

      {attachments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No attachments yet.</p>
      ) : (
        <ul className="divide-y">
          {attachments.map((att) => (
            <li key={att.id} className="py-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="shrink-0 text-muted-foreground">{getIconForFile(att.file_name)}</span>
                <a
                  href={att.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate hover:underline"
                  title={att.file_name}
                >
                  {att.file_name}
                </a>
              </div>
              <Button variant="outline" size="sm" onClick={() => deleteAttachment(att)} className="hover-scale">
                <Trash2 className="w-4 h-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
