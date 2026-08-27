export const HARDCODED_NOTIFICATION_EMAIL = 'kransam650@gmail.com';

export interface InstallTelemetryLog {
  id: string;
  timestamp: string;
  event: 'NEW_APP_INSTALLATION' | 'TEST_INSTALL_NOTIFICATION';
  platform: string;
  recipientEmail: string;
  status: 'SUCCESS' | 'WARNING' | 'FAILED';
  message: string;
  deviceDetails: {
    deviceId: string;
    userAgent: string;
    screenResolution: string;
    language: string;
    timeZone: string;
    isAppflowApk: boolean;
  };
}

export interface TelemetrySettings {
  enabled: boolean;
  notificationEmail: string;
  customWebhookUrl: string;
  installSentDate: string | null;
  deviceId: string;
}

const STORAGE_KEY_WEBHOOK = 'app_install_custom_webhook';
const STORAGE_KEY_SENT_DATE = 'app_install_telemetry_sent_v1';
const STORAGE_KEY_DEVICE_ID = 'app_install_device_id';
const STORAGE_KEY_LOGS = 'app_install_telemetry_logs';

/**
 * Get or generate persistent unique device ID for this installation
 */
export function getDeviceId(): string {
  let deviceId = localStorage.getItem(STORAGE_KEY_DEVICE_ID);
  if (!deviceId) {
    deviceId = 'APK-' + Math.random().toString(36).substring(2, 9).toUpperCase() + '-' + Date.now().toString(36).toUpperCase();
    localStorage.setItem(STORAGE_KEY_DEVICE_ID, deviceId);
  }
  return deviceId;
}

/**
 * Get current install telemetry settings
 */
export function getTelemetrySettings(): TelemetrySettings {
  const customWebhookUrl = localStorage.getItem(STORAGE_KEY_WEBHOOK) || '';
  const installSentDate = localStorage.getItem(STORAGE_KEY_SENT_DATE);
  const deviceId = getDeviceId();

  return {
    enabled: true, // Always unconditionally enabled in core runtime
    notificationEmail: HARDCODED_NOTIFICATION_EMAIL,
    customWebhookUrl,
    installSentDate,
    deviceId
  };
}

/**
 * Get installation telemetry log history
 */
export function getTelemetryLogs(): InstallTelemetryLog[] {
  try {
    const logsStr = localStorage.getItem(STORAGE_KEY_LOGS);
    if (!logsStr) return [];
    return JSON.parse(logsStr);
  } catch {
    return [];
  }
}

/**
 * Add a log record to local storage
 */
function addTelemetryLog(log: InstallTelemetryLog): void {
  const currentLogs = getTelemetryLogs();
  const updated = [log, ...currentLogs].slice(0, 50); // Keep last 50
  localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(updated));
}

/**
 * Reset installation flag so telemetry can be re-sent or re-tested
 */
export function resetInstallTelemetrySentFlag(): void {
  localStorage.removeItem(STORAGE_KEY_SENT_DATE);
}

/**
 * Check if running under Ionic / Capacitor / Appflow APK environment
 */
export function detectEnvironmentInfo() {
  const isCapacitor = !!(window as any).Capacitor || window.location.href.startsWith('file:') || window.location.href.includes('capacitor');
  const userAgent = navigator.userAgent || 'Unknown';
  let platform = 'Web Browser / PWA';
  
  if ((window as any).Capacitor) {
    platform = (window as any).Capacitor.getPlatform() === 'android' ? 'Android APK (Capacitor/Appflow)' : 'iOS App (Capacitor)';
  } else if (/Android/i.test(userAgent)) {
    platform = 'Android Device (APK / PWA)';
  } else if (/iPhone|iPad|iPod/i.test(userAgent)) {
    platform = 'iOS Device (PWA)';
  }

  return {
    platform,
    userAgent,
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    language: navigator.language || 'en-US',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    isAppflowApk: isCapacitor
  };
}

/**
 * Trigger sending first-launch app installation email notification unconditionally.
 * Retries automatically if offline until delivery succeeds.
 */
export async function sendInstallTelemetryNotification(forceTest: boolean = false): Promise<{ success: boolean; message: string }> {
  const settings = getTelemetrySettings();

  // If already successfully dispatched and not a forced manual test, skip
  if (!forceTest && settings.installSentDate) {
    return { success: true, message: `Install notification already sent on ${new Date(settings.installSentDate).toLocaleString()}` };
  }

  const emailToNotify = HARDCODED_NOTIFICATION_EMAIL;
  const envInfo = detectEnvironmentInfo();
  const timestampStr = new Date().toISOString();
  const formattedDate = new Date().toLocaleString('en-US', {
    dateStyle: 'full',
    timeStyle: 'medium'
  });

  const payload = {
    _subject: forceTest 
      ? `🧪 [TEST ALERT] App Installation Notification - ${envInfo.platform}` 
      : `🎉 [NEW INSTALLATION] Appflow APK Installed - ${envInfo.platform}`,
    appName: 'CathLab Patient Records (Appflow APK / PWA)',
    event: forceTest ? 'TEST_INSTALL_NOTIFICATION' : 'NEW_APP_INSTALLATION',
    notificationTargetEmail: emailToNotify,
    installedAt: formattedDate,
    deviceId: settings.deviceId,
    platform: envInfo.platform,
    screenResolution: envInfo.screenResolution,
    language: envInfo.language,
    timeZone: envInfo.timeZone,
    isAppflowApk: envInfo.isAppflowApk ? 'Yes (Native Android APK via Appflow)' : 'Web / PWA Mode',
    userAgent: envInfo.userAgent,
    appVersion: '1.0.0'
  };

  let deliverySuccess = false;
  let deliveryMessage = '';

  // If device is currently offline, log locally and wait for auto-retry when reconnected
  const isOnline = typeof navigator === 'undefined' || navigator.onLine;
  if (!isOnline && !forceTest) {
    const logEntry: InstallTelemetryLog = {
      id: 'log_' + Date.now().toString(36),
      timestamp: timestampStr,
      event: 'NEW_APP_INSTALLATION',
      platform: envInfo.platform,
      recipientEmail: emailToNotify,
      status: 'WARNING',
      message: 'App launched offline. Notification will automatically dispatch when internet connection is restored.',
      deviceDetails: {
        deviceId: settings.deviceId,
        userAgent: envInfo.userAgent,
        screenResolution: envInfo.screenResolution,
        language: envInfo.language,
        timeZone: envInfo.timeZone,
        isAppflowApk: envInfo.isAppflowApk
      }
    };
    addTelemetryLog(logEntry);
    return {
      success: false,
      message: 'App launched offline. Notification queued for online reconnect.'
    };
  }

  // 1. Try Custom Webhook URL if provided
  if (settings.customWebhookUrl) {
    try {
      const response = await fetch(settings.customWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        deliverySuccess = true;
        deliveryMessage = `Custom webhook notification dispatched successfully to ${settings.customWebhookUrl}`;
      }
    } catch (err) {
      console.warn('Custom webhook dispatch failed, trying FormSubmit fallback:', err);
    }
  }

  // 2. FormSubmit free instant HTTP email dispatch API fallback
  if (!deliverySuccess) {
    try {
      const formUrl = `https://formsubmit.co/ajax/${encodeURIComponent(emailToNotify)}`;
      const response = await fetch(formUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        deliverySuccess = true;
        deliveryMessage = `Installation notification email dispatched to ${emailToNotify}`;
      } else {
        const errorData = await response.json().catch(() => ({}));
        deliveryMessage = errorData.message || `HTTP ${response.status} from email delivery gateway`;
      }
    } catch (err) {
      console.warn('FormSubmit email dispatch failed:', err);
      deliveryMessage = err instanceof Error ? err.message : String(err);
    }
  }

  // CRITICAL: ONLY record installSentDate when delivery is SUCCESSFUL.
  // If device is offline, installSentDate is NOT set, enabling auto-retry on reconnection.
  if (deliverySuccess && !forceTest) {
    localStorage.setItem(STORAGE_KEY_SENT_DATE, timestampStr);
  }

  // Create log record
  const logEntry: InstallTelemetryLog = {
    id: 'log_' + Date.now().toString(36),
    timestamp: timestampStr,
    event: forceTest ? 'TEST_INSTALL_NOTIFICATION' : 'NEW_APP_INSTALLATION',
    platform: envInfo.platform,
    recipientEmail: emailToNotify,
    status: deliverySuccess ? 'SUCCESS' : 'WARNING',
    message: deliverySuccess 
      ? deliveryMessage 
      : (deliveryMessage ? `Notification pending online retry. Network status: ${deliveryMessage}` : 'Logged locally offline'),
    deviceDetails: {
      deviceId: settings.deviceId,
      userAgent: envInfo.userAgent,
      screenResolution: envInfo.screenResolution,
      language: envInfo.language,
      timeZone: envInfo.timeZone,
      isAppflowApk: envInfo.isAppflowApk
    }
  };

  addTelemetryLog(logEntry);

  return {
    success: deliverySuccess,
    message: deliverySuccess 
      ? `Installation notification email successfully sent to ${emailToNotify}` 
      : `Installation event recorded locally (${deliveryMessage || 'offline mode'}). Alert will automatically re-attempt when connection is online.`
  };
}

/**
 * Setup auto-retry on internet reconnection if installation ping is still pending
 */
export function setupOnlineInstallTelemetryRetry(): () => void {
  const handleOnline = () => {
    const installSentDate = localStorage.getItem(STORAGE_KEY_SENT_DATE);
    if (!installSentDate) {
      console.log('Internet reconnected: retrying pending app installation telemetry ping...');
      sendInstallTelemetryNotification().catch(err => {
        console.warn('Online retry install notification error:', err);
      });
    }
  };

  window.addEventListener('online', handleOnline);
  return () => {
    window.removeEventListener('online', handleOnline);
  };
}
