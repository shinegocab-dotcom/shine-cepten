import React from 'react';
import { AppShell } from './components/AppShell';
import { DriverErrorBoundary } from './components/ErrorBoundary';
import {
  LoginOtpScreen,
  OnboardingScreen,
  RegistrationScreen,
  SplashScreen,
} from './screens/AuthOnboardingScreens';
import {
  DocumentUploadScreen,
  KycDecisionScreen,
  KycPendingScreen,
  PersonalDetailsScreen,
  VehicleDetailsScreen,
  VehicleSelectionScreen,
} from './screens/KycOnboardingScreens';
import {
  DashboardScreen,
  IncomingRideScreen,
  OnlineModeScreen,
  RideAcceptDecisionScreen,
} from './screens/DispatchScreens';
import { CaptainAiScreen } from './screens/CaptainAiScreen';
import {
  ActiveRideScreen,
  CustomerDetailsScreen,
  PickupNavigationScreen,
  PickupOtpScreen,
  RideCompletionScreen,
} from './screens/ActiveTripScreens';
import {
  EarningsScreen,
  PayoutHistoryScreen,
  RatingsScreen,
  RideHistoryScreen,
  TopCaptainsScreen,
  WalletScreen,
} from './screens/FinanceHistoryScreens';
import {
  EmergencySosScreen,
  NotificationsScreen,
  ProfileScreen,
  SupportScreen,
} from './screens/AccountSafetyScreens';
import { DriverAppProvider, useDriverApp } from './state/DriverAppContext';

const ScreenRouter: React.FC = () => {
  const { currentScreen } = useDriverApp();

  switch (currentScreen) {
    case 'splash':
      return <SplashScreen />;
    case 'onboarding':
      return <OnboardingScreen />;
    case 'login_otp':
      return <LoginOtpScreen />;
    case 'registration':
      return <RegistrationScreen />;
    case 'personal_details':
      return <PersonalDetailsScreen />;
    case 'vehicle_selection':
      return <VehicleSelectionScreen />;
    case 'vehicle_details':
      return <VehicleDetailsScreen />;
    case 'document_upload':
      return <DocumentUploadScreen />;
    case 'kyc_pending':
      return <KycPendingScreen />;
    case 'kyc_decision':
      return <KycDecisionScreen />;
    case 'dashboard':
      return <DashboardScreen />;
    case 'online_mode':
      return <OnlineModeScreen />;
    case 'ai_copilot':
      return <CaptainAiScreen />;
    case 'incoming_ride':
      return <IncomingRideScreen />;
    case 'ride_accept_decision':
      return <RideAcceptDecisionScreen />;
    case 'pickup_navigation':
      return <PickupNavigationScreen />;
    case 'customer_details':
      return <CustomerDetailsScreen />;
    case 'pickup_otp':
      return <PickupOtpScreen />;
    case 'active_ride':
      return <ActiveRideScreen />;
    case 'ride_completion':
      return <RideCompletionScreen />;
    case 'earnings':
      return <EarningsScreen />;
    case 'wallet':
      return <WalletScreen />;
    case 'payout_history':
      return <PayoutHistoryScreen />;
    case 'ride_history':
      return <RideHistoryScreen />;
    case 'ratings':
      return <RatingsScreen />;
    case 'top_captains':
      return <TopCaptainsScreen />;
    case 'notifications':
      return <NotificationsScreen />;
    case 'profile':
      return <ProfileScreen />;
    case 'support':
      return <SupportScreen />;
    case 'emergency_sos':
      return <EmergencySosScreen />;
    default:
      return <DashboardScreen />;
  }
};

export const DriverApp: React.FC = () => (
  <DriverErrorBoundary>
    <DriverAppProvider>
      <AppShell>
        <ScreenRouter />
      </AppShell>
    </DriverAppProvider>
  </DriverErrorBoundary>
);

export default DriverApp;
