import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import AppLoader from './components/ui/AppLoader';
import SubtleLoader from './components/ui/SubtleLoader';
import ConfirmModal from './components/ui/ConfirmModal';
import AppAlertStack from './components/ui/AppAlertStack';
import GuidedDonateModal from './components/ui/GuidedDonateModal';
import NoiseOverlay from './components/layout/NoiseOverlay';
import SiteDataBootstrapper from './components/layout/SiteDataBootstrapper';
import PublicLayout from './components/layout/PublicLayout';
import ScrollToTop from './components/layout/ScrollToTop';

// Dummy Pages
import HomePage from './pages/HomePage';
import AboutPage from './pages/AboutPage';
import ContactPage from './pages/ContactPage';
import DonatePage from './pages/DonatePage';

// Dashboard Pages
import ProtectedRoute from './components/auth/ProtectedRoute';
import DashboardLayout from './components/dashboard/DashboardLayout';
import UserOverview from './pages/dashboard/UserOverview';
import UserSettings from './pages/dashboard/UserSettings';
import InstructorCourses from './pages/dashboard/courses/InstructorCourses';
import CreateCourseWizard from './pages/dashboard/courses/CreateCourseWizard';
import EnrolledCourses from './pages/dashboard/courses/EnrolledCourses';
import InstructorCourseAnalyticsPage from './pages/dashboard/courses/InstructorCourseAnalyticsPage';

// Auth Pages
import AuthProvider from './components/auth/AuthProvider';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import VerifyOtpPage from './pages/auth/VerifyOtpPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import CompleteProfilePage from './pages/auth/CompleteProfilePage';

// Public Pages
import CoursesPage from './pages/CoursesPage';
import CourseDetailsPage from './pages/CourseDetailsPage';
import CoursePlayerPage from './pages/CoursePlayerPage';
import NotFoundPage from './pages/NotFoundPage';

import { ReactLenis } from 'lenis/react';

import './App.css';

function App() {
  return (
    <ReactLenis root>
      <BrowserRouter>
        <ScrollToTop />
        {/* Routes */}
        <AuthProvider>
          <SiteDataBootstrapper>
            <Routes>
              {/* Public Routes with Navbar and Footer */}
              <Route element={<PublicLayout />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/contact" element={<ContactPage />} />
                <Route path="/donate" element={<DonatePage />} />
                <Route path="/courses" element={<CoursesPage />} />
                <Route path="/courses/:courseId" element={<CourseDetailsPage />} />
                
                {/* Auth Routes */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/verify-otp" element={<VerifyOtpPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/complete-profile" element={<CompleteProfilePage />} />
              </Route>

              {/* Protected Dashboard Routes */}
              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }>
                <Route index element={<UserOverview />} />
                <Route path="settings" element={<UserSettings />} />
                <Route path="enrolled" element={<EnrolledCourses />} />
                <Route path="courses" element={<InstructorCourses />} />
                <Route path="courses/:courseId/analytics" element={<InstructorCourseAnalyticsPage />} />
                <Route path="courses/builder" element={<CreateCourseWizard />} />
                <Route path="courses/builder/:courseId" element={<CreateCourseWizard />} />
              </Route>

              {/* Protected Learning Routes */}
              <Route path="/learn/:courseId" element={
                <ProtectedRoute>
                  <CoursePlayerPage />
                </ProtectedRoute>
              } />
              
              {/* Legacy / Alternate Learning Route */}
              <Route path="/courses/player/:courseId" element={
                <ProtectedRoute>
                  <CoursePlayerPage />
                </ProtectedRoute>
              } />
              
              {/* Fallback 404 Route */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </SiteDataBootstrapper>
        </AuthProvider>

        {/* Global UI Components */}
        <AppLoader />
        <SubtleLoader />
        <ConfirmModal />
        <GuidedDonateModal />
        <AppAlertStack />
        <NoiseOverlay />
      </BrowserRouter>
    </ReactLenis>
  )
}

export default App;
