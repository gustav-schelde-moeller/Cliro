export type NotificationItem = {
  id: string;
  actorName: string;
  text: string;
  companyName: string | null;
  href: string | null;
  createdAt: string;
  unread: boolean;
};

export type FollowUpItem = { key: string; name: string; date: string; href: string };

export type NotificationsPayload = { items: NotificationItem[]; unread: number; followUps: FollowUpItem[] };
