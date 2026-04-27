import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Batch {
  id: string;
  name: string;
  course_id: string | null;
  pathway_id: string | null;
  start_date: string;
  timezone: string;
  default_session_time: string;
  status: 'draft' | 'active' | 'completed';
  created_by: string | null;
  created_at: string;
  updated_at: string;
  course?: {
    id: string;
    title: string;
  } | null;
  pathway?: {
    id: string;
    name: string;
  } | null;
  _count?: {
    enrollments: number;
  };
}

export interface BatchFormData {
  name: string;
  course_id: string;
  pathway_id: string;
  start_date: string;
  timezone: string;
  default_session_time: string;
  status: 'draft' | 'active' | 'completed';
  whatsapp_group_link?: string;
  facebook_community_link?: string;
}

export function useBatches(courseId?: string) {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchBatches = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('batches')
        .select(`
          *,
          course:courses(id, title),
          pathway:learning_pathways(id, name)
        `)
        .order('start_date', { ascending: false });
      
      if (courseId) {
        query = query.eq('course_id', courseId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Get enrollment counts for each batch
      const batchesWithCounts = await Promise.all(
        (data || []).map(async (batch) => {
          const { count } = await supabase
            .from('course_enrollments')
            .select('*', { count: 'exact', head: true })
            .eq('batch_id', batch.id);
          
          return {
            ...batch,
            _count: { enrollments: count || 0 }
          };
        })
      );

      setBatches(batchesWithCounts as Batch[]);
    } catch (error) {
      console.error('Error fetching batches:', error);
      toast({
        title: "Error",
        description: "Failed to fetch batches",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [courseId, toast]);

  const createBatch = async (formData: BatchFormData) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('batches')
        .insert({
          ...formData,
          created_by: userData?.user?.id
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Success",
        description: "Batch created successfully"
      });

      await fetchBatches();
      return data;
    } catch (error: any) {
      console.error('Error creating batch:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create batch",
        variant: "destructive"
      });
      throw error;
    }
  };

  const updateBatch = async (id: string, formData: Partial<BatchFormData>) => {
    try {
      const { data, error } = await supabase
        .from('batches')
        .update(formData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        // Check for the specific error about start date
        if (error.message?.includes('Batch start date cannot be changed')) {
          toast({
            title: "Cannot Update",
            description: "Batch start date cannot be changed after it has started.",
            variant: "destructive"
          });
          return null;
        }
        throw error;
      }

      toast({
        title: "Success",
        description: "Batch updated successfully"
      });

      await fetchBatches();
      return data;
    } catch (error: any) {
      console.error('Error updating batch:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update batch",
        variant: "destructive"
      });
      throw error;
    }
  };

  const deleteBatch = async (id: string) => {
    try {
      const { error } = await supabase
        .from('batches')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Batch deleted successfully"
      });

      await fetchBatches();
    } catch (error: any) {
      console.error('Error deleting batch:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete batch",
        variant: "destructive"
      });
      throw error;
    }
  };

  const canEditStartDate = (batch: Batch) => {
    const startDate = new Date(batch.start_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return startDate > today;
  };

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  return {
    batches,
    loading,
    fetchBatches,
    createBatch,
    updateBatch,
    deleteBatch,
    canEditStartDate
  };
}
