import { registerCard } from "./registry";
import { TaskSummaryCard } from "./TaskSummaryCard";
import { NotesPinnedCard } from "./NotesPinnedCard";
import { ActivityCard } from "./ActivityCard";
import { QuickActionsCard } from "./QuickActionsCard";
import { DailyBriefCard } from "./DailyBriefCard";
import { UpcomingEventsCard } from "./UpcomingEventsCard";
import { RecentMailCard } from "./RecentMailCard";
import { ReportStatusCard } from "./ReportStatusCard";

registerCard({ id: "activity", title: "Recent activity", Component: ActivityCard });
registerCard({ id: "upcoming-events", title: "Upcoming events", Component: UpcomingEventsCard });
registerCard({ id: "recent-mail", title: "Recent mail", Component: RecentMailCard });
registerCard({ id: "reports", title: "Reports", Component: ReportStatusCard });
registerCard({ id: "task-summary", title: "Tasks", Component: TaskSummaryCard });
registerCard({ id: "pinned-notes", title: "Pinned notes", Component: NotesPinnedCard });
registerCard({ id: "quick-actions", title: "Quick add", Component: QuickActionsCard });
registerCard({ id: "daily-brief", title: "Daily brief", Component: DailyBriefCard });
