import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { DarkTheme, NavigationContainer, Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from '@expo/vector-icons/Ionicons';
import ApplyLeaveScreen from '../screens/leave/ApplyLeaveScreen';
import CaptureScreen from '../screens/CaptureScreen';
import HistoryScreen from '../screens/HistoryScreen';
import HomeScreen from '../screens/HomeScreen';
import LeaveHomeScreen from '../screens/leave/LeaveHomeScreen';
import LeaveRequestsScreen from '../screens/leave/LeaveRequestsScreen';
import LoginScreen from '../screens/LoginScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SummaryScreen from '../screens/SummaryScreen';
import { useAuth } from '../store/AuthContext';
import { useNotifications } from '../store/NotificationsContext';
import { colors, font } from '../theme';
import type { LeaveStackParamList, MainTabParamList, RootStackParamList } from './types';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const LeaveStack = createNativeStackNavigator<LeaveStackParamList>();

const navTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.primary,
    background: colors.bg,
    card: colors.card,
    text: colors.text,
    border: colors.border,
    notification: colors.danger,
  },
};

const stackScreenOptions = {
  headerStyle: { backgroundColor: colors.bg },
  headerTitleStyle: { color: colors.text, fontWeight: '700' as const },
  headerTintColor: colors.text,
  headerShadowVisible: false,
  contentStyle: { backgroundColor: colors.bg },
};

function iconFor(route: keyof MainTabParamList, focused: boolean): keyof typeof Ionicons.glyphMap {
  switch (route) {
    case 'Home':
      return focused ? 'home' : 'home-outline';
    case 'History':
      return focused ? 'time' : 'time-outline';
    case 'Summary':
      return focused ? 'stats-chart' : 'stats-chart-outline';
    case 'Leave':
      return focused ? 'calendar' : 'calendar-outline';
    case 'Alerts':
      return focused ? 'notifications' : 'notifications-outline';
    case 'Profile':
      return focused ? 'person' : 'person-outline';
  }
}

function LeaveNavigator() {
  return (
    <LeaveStack.Navigator screenOptions={stackScreenOptions}>
      <LeaveStack.Screen name="LeaveHome" component={LeaveHomeScreen} options={{ title: 'Leave' }} />
      <LeaveStack.Screen
        name="ApplyLeave"
        component={ApplyLeaveScreen}
        options={{ title: 'Apply for leave' }}
      />
      <LeaveStack.Screen
        name="LeaveRequests"
        component={LeaveRequestsScreen}
        options={{ title: 'My requests' }}
      />
    </LeaveStack.Navigator>
  );
}

function MainTabs() {
  const { unreadCount } = useNotifications();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        ...stackScreenOptions,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700' },
        tabBarIcon: ({ focused, color, size }) => (
          <Ionicons name={iconFor(route.name, focused)} size={size ?? 22} color={color} />
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Today' }} />
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen name="Summary" component={SummaryScreen} />
      <Tab.Screen
        name="Leave"
        component={LeaveNavigator}
        options={{ headerShown: false, title: 'Leave' }}
      />
      <Tab.Screen
        name="Alerts"
        component={NotificationsScreen}
        options={{
          title: 'Alerts',
          tabBarBadge: unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount) : undefined,
          tabBarBadgeStyle: {
            backgroundColor: colors.danger,
            color: colors.white,
            fontSize: 10,
            fontWeight: '700',
          },
        }}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function SplashView() {
  return (
    <View style={styles.splash}>
      <View style={styles.splashBadge}>
        <Ionicons name="construct" size={30} color={colors.white} />
      </View>
      <Text style={styles.splashTitle}>RELAY Attendance</Text>
      <ActivityIndicator color={colors.primary} style={styles.splashSpinner} />
    </View>
  );
}

export default function RootNavigator() {
  const { status, user } = useAuth();

  if (status === 'loading') return <SplashView />;

  return (
    <NavigationContainer theme={navTheme}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <RootStack.Screen name="Main" component={MainTabs} />
            <RootStack.Screen
              name="Capture"
              component={CaptureScreen}
              options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
            />
          </>
        ) : (
          <RootStack.Screen name="Login" component={LoginScreen} options={{ animation: 'fade' }} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashBadge: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashTitle: { color: colors.text, fontSize: font.title, fontWeight: '800', marginTop: 16 },
  splashSpinner: { marginTop: 24 },
});
