import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppLayout } from '@/layouts/AppLayout';
import { UploadPage } from '@/pages/UploadPage';
import { SurveyDetailPage } from '@/pages/SurveyDetailPage';
import { SurveyListPage } from '@/pages/SurveyListPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<UploadPage />} />
          <Route path="surveys" element={<SurveyListPage />} />
          <Route path="surveys/:surveyId" element={<SurveyDetailPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
