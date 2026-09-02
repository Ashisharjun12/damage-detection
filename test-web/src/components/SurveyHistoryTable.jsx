import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { deleteSurvey } from '@/api/client';
import { cn } from '@/lib/utils';

function statusVariant(status) {
  if (status === 'COMPLETED') return 'default';
  if (status === 'FAILED') return 'destructive';
  if (status === 'REVIEW_REQUIRED' || status === 'PARTIAL') return 'outline';
  if (status === 'QUEUED' || status === 'PROCESSING') return 'secondary';
  return 'secondary';
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function formatScore(value) {
  if (value == null) return '—';
  return String(value);
}

export function SurveyHistoryTable({ surveys = [], onDeleted }) {
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteSurvey(pendingDelete);
      setPendingDelete(null);
      onDeleted?.();
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete survey');
    } finally {
      setDeleting(false);
    }
  };

  if (surveys.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No surveys yet. Upload images to start.</p>
    );
  }

  return (
    <>
      {deleteError && (
        <p className="mb-4 text-sm text-destructive">{deleteError}</p>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Preview</TableHead>
            <TableHead>Survey</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Images</TableHead>
            <TableHead>Score</TableHead>
            <TableHead>Parts</TableHead>
            <TableHead>Damages</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {surveys.map((s) => (
            <TableRow key={s.survey_id}>
              <TableCell>
                {s.thumbnail_url ? (
                  <img
                    src={s.thumbnail_url}
                    alt=""
                    className="size-12 rounded border object-cover"
                  />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <Link
                  to={`/surveys/${s.survey_id}`}
                  className="font-mono text-sm hover:underline"
                >
                  {s.survey_id.slice(-8)}
                </Link>
              </TableCell>
              <TableCell>
                <Badge variant={statusVariant(s.status)}>{s.status}</Badge>
              </TableCell>
              <TableCell>{s.image_count}</TableCell>
              <TableCell className="font-medium">
                {formatScore(s.overall_damage_score)}
              </TableCell>
              <TableCell>{s.parts_affected ?? '—'}</TableCell>
              <TableCell>{s.total_damages ?? '—'}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDate(s.createdAt)}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Link
                    to={`/surveys/${s.survey_id}`}
                    className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
                  >
                    <Eye className="size-4" />
                    View
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setPendingDelete(s.survey_id)}
                  >
                    <Trash2 className="size-4" />
                    Delete
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete survey?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the survey, its report, and uploaded files from storage. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleting}
              onClick={confirmDelete}
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
