import { useEffect, useState } from "react";

interface DesktopNotificationInput {
  title: string;
  body: string;
  tag?: string;
}

const getPermission = (): NotificationPermission | "unsupported" => {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }

  return window.Notification.permission;
};

export function useDesktopNotifications() {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    getPermission()
  );

  useEffect(() => {
    setPermission(getPermission());
  }, []);

  const requestPermission = async () => {
    if (permission === "unsupported") {
      return permission;
    }

    const nextPermission = await window.Notification.requestPermission();
    setPermission(nextPermission);
    return nextPermission;
  };

  const notify = ({ title, body, tag }: DesktopNotificationInput) => {
    if (permission !== "granted" || typeof window === "undefined" || !("Notification" in window)) {
      return;
    }

    const notification = new window.Notification(title, {
      body,
      tag
    });

    window.setTimeout(() => notification.close(), 6_000);
  };

  return {
    permission,
    supported: permission !== "unsupported",
    requestPermission,
    notify
  };
}
