import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  Capture: { mode: 'in' | 'out' };
};

export type MainTabParamList = {
  Home: undefined;
  History: undefined;
  Summary: undefined;
  Leave: undefined;
  Alerts: undefined;
  Profile: undefined;
};

export type LeaveStackParamList = {
  LeaveHome: undefined;
  ApplyLeave: undefined;
  LeaveRequests: undefined;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;
