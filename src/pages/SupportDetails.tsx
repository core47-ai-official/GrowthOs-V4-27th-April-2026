import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageCircle, Facebook, Mail, Phone, ExternalLink, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { RoleGuard } from '@/components/RoleGuard';

interface SupportDetailsData {
  whatsappGroupLink: string | null;
  facebookCommunityLink: string | null;
  batchName: string | null;
  companyWhatsapp: string | null;
  companyEmail: string | null;
  companyPhone: string | null;
}

const SupportDetailsContent = () => {
  const { user } = useAuth();
  const [data, setData] = useState<SupportDetailsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [noBatch, setNoBatch] = useState(false);

  useEffect(() => {
    const fetchSupportDetails = async () => {
      if (!user?.id) return;
      try {
        // Get student record
        const { data: studentData } = await supabase
          .from('students')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!studentData?.id) {
          setNoBatch(true);
          setLoading(false);
          return;
        }

        // Get the student's batch from enrollments
        const { data: enrollment } = await supabase
          .from('course_enrollments')
          .select('batch_id')
          .eq('student_id', studentData.id)
          .not('batch_id', 'is', null)
          .limit(1)
          .maybeSingle();

        let batchInfo: any = null;
        if (enrollment?.batch_id) {
          const { data: batch } = await supabase
            .from('batches')
            .select('name, whatsapp_group_link, facebook_community_link')
            .eq('id', enrollment.batch_id)
            .single();
          batchInfo = batch;
        }

        // Get company settings
        const { data: companySettings } = await supabase
          .from('company_settings')
          .select('primary_phone, secondary_phone, company_email')
          .limit(1)
          .maybeSingle();

        if (!enrollment?.batch_id) {
          setNoBatch(true);
        }

        setData({
          whatsappGroupLink: (batchInfo as any)?.whatsapp_group_link || null,
          facebookCommunityLink: (batchInfo as any)?.facebook_community_link || null,
          batchName: batchInfo?.name || null,
          companyWhatsapp: companySettings?.secondary_phone || null,
          companyEmail: companySettings?.company_email || null,
          companyPhone: companySettings?.primary_phone || null,
        });
      } catch (error) {
        console.error('Error fetching support details:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSupportDetails();
  }, [user?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (noBatch && !data?.companyEmail && !data?.companyPhone) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Card>
          <CardContent className="pt-6 text-center">
            <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-semibold mb-2">No Batch Assigned Yet</h3>
            <p className="text-muted-foreground">
              Support details will be available once you are assigned to a batch. Please contact your admin for assistance.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const whatsappLink = data?.companyWhatsapp
    ? `https://wa.me/${data.companyWhatsapp.replace(/[^0-9]/g, '')}`
    : null;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Support Details</h1>
        {data?.batchName && (
          <p className="text-muted-foreground mt-1">Batch: {data.batchName}</p>
        )}
      </div>

      {/* Group Links */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5" />
            Your Group Links
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data?.whatsappGroupLink ? (
            <Button asChild variant="outline" className="w-full justify-start gap-3">
              <a href={data.whatsappGroupLink} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="w-5 h-5 text-green-600" />
                <span className="flex-1 text-left">WhatsApp Group</span>
                <ExternalLink className="w-4 h-4 text-muted-foreground" />
              </a>
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">WhatsApp group link not configured for your batch.</p>
          )}

          {data?.facebookCommunityLink ? (
            <Button asChild variant="outline" className="w-full justify-start gap-3">
              <a href={data.facebookCommunityLink} target="_blank" rel="noopener noreferrer">
                <Facebook className="w-5 h-5 text-blue-600" />
                <span className="flex-1 text-left">Facebook Community</span>
                <ExternalLink className="w-4 h-4 text-muted-foreground" />
              </a>
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">Facebook community link not configured for your batch.</p>
          )}
        </CardContent>
      </Card>

      {/* Contact Support */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Phone className="w-5 h-5" />
            Contact Support
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data?.companyWhatsapp && whatsappLink && (
            <Button asChild variant="outline" className="w-full justify-start gap-3">
              <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="w-5 h-5 text-green-600" />
                <span className="flex-1 text-left">WhatsApp: {data.companyWhatsapp}</span>
                <ExternalLink className="w-4 h-4 text-muted-foreground" />
              </a>
            </Button>
          )}

          {data?.companyEmail && (
            <Button asChild variant="outline" className="w-full justify-start gap-3">
              <a href={`mailto:${data.companyEmail}`}>
                <Mail className="w-5 h-5 text-primary" />
                <span className="flex-1 text-left">Email: {data.companyEmail}</span>
              </a>
            </Button>
          )}

          {data?.companyPhone && (
            <Button asChild variant="outline" className="w-full justify-start gap-3">
              <a href={`tel:${data.companyPhone}`}>
                <Phone className="w-5 h-5 text-primary" />
                <span className="flex-1 text-left">Phone: {data.companyPhone}</span>
              </a>
            </Button>
          )}

          {!data?.companyWhatsapp && !data?.companyEmail && !data?.companyPhone && (
            <p className="text-sm text-muted-foreground">No contact details configured. Please reach out to your admin.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const SupportDetails = () => (
  <RoleGuard allowedRoles={['student']}>
    <SupportDetailsContent />
  </RoleGuard>
);

export default SupportDetails;
