import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Award, 
  Download, 
  Calendar, 
  ExternalLink,
  Trophy,
  CheckCircle
} from "lucide-react";

interface Certificate {
  id: string;
  track: string;
  certificate_url: string;
  issued_at: string;
  downloaded: boolean;
}

const Certificates = () => {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchCertificates();
  }, []);

  const fetchCertificates = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Certificates table doesn't exist yet, show empty for now
      setCertificates([]);
    } catch (error) {
      console.error('Error fetching certificates:', error);
      toast({
        title: "Error",
        description: "Failed to load certificates",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadCertificate = async (certificate: Certificate) => {
    try {
      // TODO: Mark as downloaded when certificates table exists

      // Open certificate URL
      window.open(certificate.certificate_url, '_blank');
      
      // Update local state
      setCertificates(prev => 
        prev.map(cert => 
          cert.id === certificate.id 
            ? { ...cert, downloaded: true }
            : cert
        )
      );

      toast({
        title: "Certificate Downloaded",
        description: "Your certificate has been opened in a new tab",
      });
    } catch (error) {
      console.error('Error downloading certificate:', error);
      toast({
        title: "Error",
        description: "Failed to download certificate",
        variant: "destructive",
      });
    }
  };

  const availableTracks = [
    { 
      name: "E-commerce Foundations", 
      description: "Complete all basic modules and assignments",
      requirements: "• Watch all foundation videos\n• Complete 5 assignments\n• Maintain 80%+ average on assignments"
    },
    { 
      name: "Product Research Specialist", 
      description: "Master product research and selection",
      requirements: "• Complete product research modules\n• Submit winning product analysis\n• Achieve mentor approval"
    },
    { 
      name: "Shopify Store Builder", 
      description: "Build and launch a complete store",
      requirements: "• Set up functional Shopify store\n• Complete theme customization\n• Process test transactions"
    },
    { 
      name: "Marketing Master", 
      description: "Execute successful marketing campaigns",
      requirements: "• Launch Facebook ad campaign\n• Achieve target ROAS\n• Document case study"
    },
    { 
      name: "E-commerce Graduate", 
      description: "Complete the entire program",
      requirements: "• Earn all previous certificates\n• Generate first $1000 in sales\n• Mentor recommendation"
    }
  ];

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
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 text-orange-800">
            <Award className="w-5 h-5" />
            <span className="font-semibold">Coming Soon</span>
          </div>
          <p className="text-orange-700 text-sm mt-1">
            Certificate generation system is planned for v2.0. Track your progress here for now.
          </p>
        </div>
        <h1 className="text-3xl font-bold mb-2">Certificates & Achievements</h1>
        <p className="text-muted-foreground">
          Track your progress and prepare for upcoming certificate features
        </p>
      </div>

      {/* Earned Certificates */}
      {certificates.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-600" />
            Your Certificates
          </h2>
          <div className="grid gap-4">
            {certificates.map((certificate) => (
              <Card key={certificate.id} className="border-l-4 border-l-yellow-500">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-yellow-100 rounded-full">
                        <Award className="w-6 h-6 text-yellow-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{certificate.track}</h3>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Calendar className="w-4 h-4" />
                          <span>Issued on {new Date(certificate.issued_at).toLocaleDateString()}</span>
                          {certificate.downloaded && (
                            <Badge variant="secondary" className="ml-2">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Downloaded
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button 
                      onClick={() => downloadCertificate(certificate)}
                      className="flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      {certificate.downloaded ? 'Download Again' : 'Download'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Available Certificate Tracks */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Certificate Tracks</h2>
        <div className="grid gap-4">
          {availableTracks.map((track) => {
            const isEarned = certificates.some(cert => cert.track === track.name);
            
            return (
              <Card key={track.name} className={`${isEarned ? 'border-green-200 bg-green-50' : ''}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {isEarned ? (
                        <CheckCircle className="w-6 h-6 text-green-600" />
                      ) : (
                        <Award className="w-6 h-6 text-gray-400" />
                      )}
                      <div>
                        <CardTitle className={isEarned ? 'text-green-800' : ''}>{track.name}</CardTitle>
                        <p className={`text-sm ${isEarned ? 'text-green-700' : 'text-gray-600'}`}>
                          {track.description}
                        </p>
                      </div>
                    </div>
                    {isEarned && (
                      <Badge className="bg-green-100 text-green-800">
                        <Trophy className="w-3 h-3 mr-1" />
                        Earned
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Requirements:</h4>
                    <div className="text-sm text-gray-600 whitespace-pre-line bg-gray-50 p-3 rounded">
                      {track.requirements}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {certificates.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Award className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium mb-2">No Certificates Yet</h3>
            <p className="text-gray-600 mb-4">
              Complete course requirements to earn your first certificate
            </p>
            <Button>
              <ExternalLink className="w-4 h-4 mr-2" />
              View Requirements
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Certificates;