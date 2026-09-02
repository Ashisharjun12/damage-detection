import { useEffect, useState, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Circle,
  Clock,
  Play,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SurveyImageTable } from '@/components/SurveyImageTable';
import { SurveyResultsTable } from '@/components/SurveyResultsTable';
import { assessSurvey, getSurvey, isTerminalStatus } from '@/api/client';
import { normalizeM02Report } from '@/lib/normalizeM02Report';

const POLL_MS = 2000;

function statusVariant(status) {
  if (status === 'COMPLETED') return 'default';
  if (status === 'FAILED') return 'destructive';
  if (status === 'REVIEW_REQUIRED') return 'outline';
  if (status === 'QUEUED') return 'secondary';
  return 'secondary';
}

function QueueStatusCard({ status, jobId, polling }) {
  const steps = [
    { key: 'QUEUED', label: 'Queued', active: status === 'QUEUED' },
    {
      key: 'PROCESSING',
      label: 'Processing',
      active: status === 'PROCESSING' || (polling && status === 'QUEUED'),
    },
    {
      key: 'DONE',
      label: 'Complete',
      active: isTerminalStatus(status),
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Assessment progress</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          {steps.map((step, i) => (
            <div key={step.key} className="flex items-center gap-2 text-sm">
              {step.active ? (
                polling && step.key !== 'DONE' ? (
                  <Loader2 className="size-4 animate-spin text-primary" />
                ) : isTerminalStatus(status) && step.key === 'DONE' ? (
                  <CheckCircle2 className="size-4 text-primary" />
                ) : step.active ? (
                  <Clock className="size-4 text-primary" />
                ) : (
                  <Circle className="size-4 text-muted-foreground" />
                )
              ) : (
                <Circle className="size-4 text-muted-foreground" />
              )}
              <span className={step.active ? 'font-medium' : 'text-muted-foreground'}>
                {step.label}
              </span>
              {i < steps.length - 1 && (
                <span className="hidden text-muted-foreground sm:inline">→</span>
              )}
            </div>
          ))}
        </div>
        {jobId && (
          <p className="text-xs text-muted-foreground">Job ID: {jobId}</p>
        )}
        {polling && (status === 'QUEUED' || status === 'PROCESSING') && (
          <p className="text-xs text-muted-foreground">
            If stuck on Queued, run <code className="rounded bg-muted px-1">pnpm worker:dev</code> in damage-ai.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function SurveyDetailPage() {
  const { surveyId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [polling, setPolling] = useState(false);
  const [assessing, setAssessing] = useState(false);

  const loadSurvey = useCallback(async () => {
    const result = await getSurvey(surveyId);
    setData(result.data);
    const terminal = isTerminalStatus(result.data?.status);
    setPolling(!terminal && result.data?.assess_started_at != null);
    return result.data;
  }, [surveyId]);

  useEffect(() => {
    let cancelled = false;
    let timer;

    async function fetchLoop() {
      try {
        const survey = await loadSurvey();
        if (cancelled) return;

        const terminal = isTerminalStatus(survey?.status);
        const shouldPoll =
          !terminal &&
          (survey?.status === 'QUEUED' ||
            survey?.status === 'PROCESSING' ||
            survey?.assess_started_at);

        if (shouldPoll) {
          timer = setTimeout(fetchLoop, POLL_MS);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to load survey');
          setPolling(false);
        }
      }
    }

    fetchLoop();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [surveyId, loadSurvey]);

  const startAnalyzing = async () => {
    setAssessing(true);
    setError('');
    try {
      await assessSurvey(surveyId);
      setPolling(true);
      await loadSurvey();
    } catch (err) {
      setError(err.message || 'Failed to start assessment');
      await loadSurvey();
    } finally {
      setAssessing(false);
    }
  };

  const report = normalizeM02Report(data?.report);
  const status = data?.status;
  const canStart =
    data &&
    !report &&
    status === 'READY' &&
    data.images?.length > 0 &&
    !assessing;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/"
          className="inline-flex h-8 items-center gap-2 rounded-4xl px-3 text-sm font-medium hover:bg-muted"
        >
          <ArrowLeft className="size-4" />
          New upload
        </Link>
        <Link
          to="/surveys"
          className="inline-flex h-8 items-center rounded-4xl px-3 text-sm font-medium hover:bg-muted"
        >
          History
        </Link>
        {status && (
          <Badge variant={statusVariant(status)}>{status}</Badge>
        )}
        {polling && (
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Updating...
          </span>
        )}
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Survey</h1>
        <p className="mt-1 text-sm text-muted-foreground">ID: {surveyId}</p>
      </div>

      {error && (
        <Card className="border-destructive/50">
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {data?.assess_error && status === 'FAILED' && (
        <Card className="border-destructive/50">
          <CardContent className="pt-6 text-sm text-destructive">
            Assessment failed: {data.assess_error}
          </CardContent>
        </Card>
      )}

      {canStart && (
        <Card>
          <CardHeader>
            <CardTitle>Ready for analysis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {data.images.length} image(s) uploaded. Start analysis when ready.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {data.images.map((img) => (
                <img
                  key={img.image_id}
                  src={img.url}
                  alt={img.image_id}
                  className="rounded-lg border object-cover aspect-video"
                />
              ))}
            </div>
            <Button onClick={startAnalyzing} disabled={assessing}>
              <Play className="size-4" />
              {assessing ? 'Starting...' : 'Start analyzing'}
            </Button>
          </CardContent>
        </Card>
      )}

      {(polling || status === 'QUEUED' || status === 'PROCESSING') && !report && (
        <QueueStatusCard status={status} jobId={data?.job_id} polling={polling} />
      )}

      {report && (
        <Tabs defaultValue="results">
          <TabsList>
            <TabsTrigger value="results">Results</TabsTrigger>
            <TabsTrigger value="json">Raw JSON</TabsTrigger>
          </TabsList>

          <TabsContent value="results" className="mt-4 space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Overall score
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{report.overall_damage_score ?? '—'}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Parts affected
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">
                    {report.vehicle_damage_summary?.parts_affected ?? 0}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Coverage
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-lg font-semibold">
                    {report.survey_coverage?.status ?? '—'}
                  </p>
                  {report.survey_coverage?.missing_views?.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Missing: {report.survey_coverage.missing_views.join(', ')}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Damage summary</CardTitle>
              </CardHeader>
              <CardContent>
                <SurveyResultsTable clusters={report.damage_clusters} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Image scan</CardTitle>
              </CardHeader>
              <CardContent>
                <SurveyImageTable
                  surveyImages={data?.images}
                  reportImages={report.images}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="json" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Full report (m02.v1)</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="max-h-120 overflow-auto rounded-md bg-muted p-4 text-xs">
                  {JSON.stringify(report, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
