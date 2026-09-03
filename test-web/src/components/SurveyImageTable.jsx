import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

function Thumb({ src, alt, large = false }) {
  const sizeClass = large ? 'size-28' : 'size-16';
  if (!src) {
    return (
      <div
        className={`flex ${sizeClass} items-center justify-center rounded-md border bg-muted text-xs text-muted-foreground`}
      >
        —
      </div>
    );
  }
  return (
    <a href={src} target="_blank" rel="noopener noreferrer" className="block">
      <img
        src={src}
        alt={alt}
        className={`${sizeClass} rounded-md border object-cover transition-opacity hover:opacity-90`}
      />
    </a>
  );
}

function statusBadgeVariant(status) {
  if (status === 'COMPLETED') return 'default';
  if (status === 'FAILED') return 'destructive';
  if (status === 'REVIEW_REQUIRED') return 'outline';
  if (status === 'SKIPPED_DUPLICATE') return 'secondary';
  return 'secondary';
}

export function SurveyImageTable({ surveyImages = [], reportImages = [] }) {
  const reportById = new Map(reportImages.map((img) => [img.image_id, img]));

  const rows = surveyImages.map((surveyImg) => {
    const reportImg = reportById.get(surveyImg.image_id);
    return {
      image_id: surveyImg.image_id,
      originalUrl: surveyImg.url,
      annotatedUrl: reportImg?.annotated_image_url,
      viewAngle: reportImg?.view_angle ?? '—',
      damages: reportImg?.damages ?? [],
      processingStatus: reportImg?.processing_status ?? 'PENDING',
      errorCode: reportImg?.error_code,
      userMessage: reportImg?.user_message,
      canonicalImageId: reportImg?.canonical_image_id,
    };
  });

  if (rows.length === 0 && reportImages.length > 0) {
    reportImages.forEach((img) => {
      rows.push({
        image_id: img.image_id,
        originalUrl: img.url,
        annotatedUrl: img.annotated_image_url,
        viewAngle: img.view_angle ?? '—',
        damages: img.damages ?? [],
        processingStatus: img.processing_status ?? 'PENDING',
        errorCode: img.error_code,
        userMessage: img.user_message,
        canonicalImageId: img.canonical_image_id,
      });
    });
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No images in this survey.</p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Original</TableHead>
          <TableHead>Annotated</TableHead>
          <TableHead>View (AI)</TableHead>
          <TableHead>Damages</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.image_id}>
            <TableCell>
              <Thumb src={row.originalUrl} alt={`${row.image_id} original`} />
            </TableCell>
            <TableCell>
              <Thumb
                src={row.annotatedUrl}
                alt={`${row.image_id} annotated`}
                large
              />
              {!row.annotatedUrl && row.damages.length > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  No annotated file (check R2 on damage-ai)
                </p>
              )}
            </TableCell>
            <TableCell className="font-medium">{row.viewAngle}</TableCell>
            <TableCell>
              <div className="max-w-xs space-y-1">
                <p className="text-sm font-medium">{row.damages.length} found</p>
                {row.damages.length > 0 && (
                  <ul className="space-y-0.5 text-xs text-muted-foreground">
                    {row.damages.map((d, i) => (
                      <li key={d.instance_id ?? i}>
                        {d.part_name} · {d.damage_type} · {d.severity} ·{' '}
                        {d.recommendation}
                        {d.verification_status === 'pending_review' && (
                          <Badge variant="outline" className="ml-1 text-[10px]">
                            pending review
                          </Badge>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </TableCell>
            <TableCell>
              <div className="space-y-1">
                <Badge variant={statusBadgeVariant(row.processingStatus)}>
                  {row.processingStatus}
                </Badge>
                {row.processingStatus === 'SKIPPED_DUPLICATE' &&
                  row.canonicalImageId && (
                    <p className="text-xs text-muted-foreground">
                      Duplicate — see {row.canonicalImageId}
                    </p>
                  )}
                {row.errorCode && (
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    {row.errorCode}
                    {row.userMessage ? ` — ${row.userMessage}` : ''}
                  </p>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
