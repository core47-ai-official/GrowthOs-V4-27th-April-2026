import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Ban, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export interface SuspensionConfirmData {
  note: string;
  autoUnsuspendDate?: Date;
  scheduleSuspendDate?: Date;
}

interface SuspensionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentName: string;
  onConfirm: (data: SuspensionConfirmData) => void;
  loading?: boolean;
}

export function SuspensionDialog({ open, onOpenChange, studentName, onConfirm, loading }: SuspensionDialogProps) {
  const [note, setNote] = useState('');
  const [autoUnsuspendDate, setAutoUnsuspendDate] = useState<Date | undefined>();
  const [scheduleSuspendDate, setScheduleSuspendDate] = useState<Date | undefined>();

  const handleConfirm = () => {
    onConfirm({ note, autoUnsuspendDate, scheduleSuspendDate });
    setNote('');
    setAutoUnsuspendDate(undefined);
    setScheduleSuspendDate(undefined);
  };

  const handleOpenChange = (value: boolean) => {
    if (!value) {
      setNote('');
      setAutoUnsuspendDate(undefined);
      setScheduleSuspendDate(undefined);
    }
    onOpenChange(value);
  };

  const isScheduled = !!scheduleSuspendDate;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Ban className="w-5 h-5" />
            Suspend Student
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            You are about to suspend <span className="font-semibold text-foreground">{studentName}</span>. This will revoke their LMS access.
          </p>

          <div className="space-y-2">
            <Label htmlFor="suspension-note">Reason for Suspension</Label>
            <Textarea
              id="suspension-note"
              placeholder="e.g. Overdue payment, Policy violation..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Auto-Unsuspend Date <span className="text-xs text-muted-foreground">(optional)</span></Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !autoUnsuspendDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {autoUnsuspendDate ? format(autoUnsuspendDate, 'PPP') : 'Select date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={autoUnsuspendDate}
                  onSelect={setAutoUnsuspendDate}
                  disabled={(date) => date <= new Date()}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            {autoUnsuspendDate && (
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => setAutoUnsuspendDate(undefined)}>
                Clear date
              </Button>
            )}
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-500" />
              Schedule Suspend Date
              <span className="text-xs text-muted-foreground">(optional)</span>
            </Label>
            <p className="text-xs text-muted-foreground">
              Student remains active until this date, then gets automatically suspended.
            </p>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !scheduleSuspendDate && "text-muted-foreground",
                    scheduleSuspendDate && "border-amber-300 bg-amber-50 dark:bg-amber-950/20"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {scheduleSuspendDate ? format(scheduleSuspendDate, 'PPP') : 'Select date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={scheduleSuspendDate}
                  onSelect={setScheduleSuspendDate}
                  disabled={(date) => date <= new Date()}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            {scheduleSuspendDate && (
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => setScheduleSuspendDate(undefined)}>
                Clear date
              </Button>
            )}
          </div>

          {isScheduled && (
            <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-3">
              <p className="text-sm text-amber-800 dark:text-amber-300 font-medium">
                ⏳ Scheduled Mode: Student will remain active and be automatically suspended on {format(scheduleSuspendDate!, 'PPP')}.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant={isScheduled ? "default" : "destructive"}
            onClick={handleConfirm}
            disabled={loading}
            className={isScheduled ? "bg-amber-600 hover:bg-amber-700 text-white" : ""}
          >
            {loading
              ? (isScheduled ? 'Scheduling...' : 'Suspending...')
              : (isScheduled ? 'Schedule Suspension' : 'Confirm Suspension')
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
