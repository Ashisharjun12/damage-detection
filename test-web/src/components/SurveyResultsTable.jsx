import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

function recommendationVariant(recommendation) {
  if (recommendation === 'Replace') return 'destructive';
  return 'default';
}

export function SurveyResultsTable({ clusters = [] }) {
  if (!clusters.length) {
    return (
      <p className="text-sm text-muted-foreground">No damage clusters in report.</p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Part</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Severity</TableHead>
          <TableHead>Recommendation</TableHead>
          <TableHead>Location</TableHead>
          <TableHead>Evidence</TableHead>
          <TableHead>Review</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {clusters.map((cluster) => (
          <TableRow key={cluster.cluster_id}>
            <TableCell className="font-medium">{cluster.part_name}</TableCell>
            <TableCell>{cluster.damage_type}</TableCell>
            <TableCell>
              <Badge variant="outline">{cluster.severity}</Badge>
            </TableCell>
            <TableCell>
              <Badge variant={recommendationVariant(cluster.recommendation)}>
                {cluster.recommendation}
              </Badge>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {cluster.location_on_part ?? '—'}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {cluster.evidence_image_ids?.length ?? 0} image(s)
            </TableCell>
            <TableCell>
              {cluster.review_candidate ? (
                <Badge variant="outline">Review</Badge>
              ) : (
                <span className="text-sm text-muted-foreground">—</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
