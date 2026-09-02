import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SurveyHistoryTable } from '@/components/SurveyHistoryTable';
import { listSurveys } from '@/api/client';

export function SurveyListPage() {
  const [surveys, setSurveys] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadSurveys = useCallback(() => {
    setLoading(true);
    setError('');
    return listSurveys()
      .then((res) => setSurveys(res.data ?? []))
      .catch((err) => setError(err.message || 'Failed to load surveys'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadSurveys();
  }, [loadSurveys]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Survey history</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          View results, scores, and annotated scans. Delete old surveys when no longer needed.
        </p>
      </div>

      {error && (
        <Card className="border-destructive/50">
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All surveys</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : (
            <SurveyHistoryTable surveys={surveys} onDeleted={loadSurveys} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
