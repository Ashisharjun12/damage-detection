import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, X, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  createSurvey,
  uploadFileDirect,
  registerImage,
} from '@/api/client';

function makeImageId(index) {
  return `img_${Date.now()}_${index}`;
}

export function UploadPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const addFiles = useCallback((fileList) => {
    const files = Array.from(fileList || []);
    const next = files.map((file, i) => ({
      id: makeImageId(i),
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setItems((prev) => [...prev, ...next]);
  }, []);

  const onFileInput = (e) => {
    addFiles(e.target.files);
    e.target.value = '';
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  };

  const removeItem = (id) => {
    setItems((prev) => {
      const item = prev.find((x) => x.id === id);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((x) => x.id !== id);
    });
  };

  const uploadImages = async () => {
    if (!items.length) {
      setStatus('Add at least one vehicle image');
      return;
    }

    setLoading(true);
    setStatus('Creating survey...');

    try {
      const created = await createSurvey();
      const surveyId = created.data.survey_id;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        setStatus(`Uploading image ${i + 1} of ${items.length}...`);
        const uploaded = await uploadFileDirect(surveyId, item.file);
        await registerImage(surveyId, item.id, uploaded.data.publicUrl, null, {
          publicId: uploaded.data.publicId,
          originalName: item.file.name,
          mimeType: item.file.type,
          size: item.file.size,
        });
      }

      navigate(`/surveys/${surveyId}`);
    } catch (err) {
      setStatus(err.message || 'Upload failed');
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Upload vehicle images</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add photos, upload to storage, then start analysis on the survey page.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select images</CardTitle>
          <CardDescription>
            AI detects camera angle automatically. Analysis starts only after you click Start analyzing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={[
              'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 transition-colors',
              dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25',
            ].join(' ')}
          >
            <Upload className="size-10 text-muted-foreground" />
            <div className="text-center">
              <p className="font-medium">Drop images here</p>
              <p className="text-sm text-muted-foreground">JPEG, PNG, WebP — multiple files supported</p>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => document.getElementById('file-upload')?.click()}
              disabled={loading}
            >
              Browse files
            </Button>
            <input
              id="file-upload"
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={onFileInput}
              disabled={loading}
            />
          </div>

          {items.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{items.length} image(s) ready</p>
                <Badge variant="secondary">{items.length} selected</Badge>
              </div>
              <ul className="grid gap-3 sm:grid-cols-2">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="flex gap-3 rounded-lg border bg-card p-3"
                  >
                    <div className="size-20 shrink-0 overflow-hidden rounded-md bg-muted">
                      {item.previewUrl ? (
                        <img
                          src={item.previewUrl}
                          alt={item.file.name}
                          className="size-full object-cover"
                        />
                      ) : (
                        <div className="flex size-full items-center justify-center">
                          <ImageIcon className="size-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(item.file.size / 1024).toFixed(0)} KB
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeItem(item.id)}
                      disabled={loading}
                      aria-label="Remove image"
                    >
                      <X className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Button onClick={uploadImages} disabled={loading || !items.length}>
            {loading ? 'Uploading...' : 'Upload images'}
          </Button>
          {status && <p className="text-sm text-muted-foreground">{status}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
