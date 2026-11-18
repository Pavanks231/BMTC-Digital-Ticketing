import { Route, Routes } from 'react-router-dom';
import AppHeader from './components/AppHeader.jsx';
import AppFooter from './components/AppFooter.jsx';
import HomePage from './pages/HomePage.jsx';
import PassengerPage from './pages/PassengerPage.jsx';
import ConductorPage from './pages/ConductorPage.jsx';
import TransitPage from './pages/TransitPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

export default function App() {
  return (
    <div className="app-shell">
      <AppHeader />
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/passenger" element={<PassengerPage />} />
          <Route path="/conductor" element={<ConductorPage />} />
          <Route path="/routes" element={<TransitPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <AppFooter />
    </div>
  );
}
