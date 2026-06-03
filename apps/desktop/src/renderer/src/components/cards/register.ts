import { registerCard } from "./registry";
import { TaskSummaryCard } from "./TaskSummaryCard";
import { NotesPinnedCard } from "./NotesPinnedCard";
import { ActivityCard } from "./ActivityCard";
import { QuickActionsCard } from "./QuickActionsCard";
import { DailyBriefCard } from "./DailyBriefCard";
import { UpcomingEventsCard } from "./UpcomingEventsCard";
import { RecentMailCard } from "./RecentMailCard";
import { ReportStatusCard } from "./ReportStatusCard";
import { AgentActivityCard } from "./AgentActivityCard";
import { ViewFilteredNotesCard } from "@renderer/components/views/ViewFilteredNotesCard";
import { ViewFilteredTasksCard } from "@renderer/components/views/ViewFilteredTasksCard";
import { ViewChatCard } from "@renderer/components/views/ViewChatCard";

registerCard({ id: "activity", title: "Recent activity", Component: ActivityCard });
registerCard({ id: "upcoming-events", title: "Upcoming events", Component: UpcomingEventsCard });
registerCard({ id: "recent-mail", title: "Recent mail", Component: RecentMailCard });
registerCard({ id: "reports", title: "Reports", Component: ReportStatusCard });
registerCard({ id: "task-summary", title: "Tasks", Component: TaskSummaryCard });
registerCard({ id: "pinned-notes", title: "Pinned notes", Component: NotesPinnedCard });
registerCard({ id: "quick-actions", title: "Quick add", Component: QuickActionsCard });
registerCard({ id: "daily-brief", title: "Daily brief", Component: DailyBriefCard });
registerCard({ id: "agent-activity", title: "Agent activity", Component: AgentActivityCard });

// View-context cards (visible in pickers; behaviour depends on ViewContext).
registerCard({
  id: "view:filtered-notes",
  title: "View notes (filtered)",
  Component: ViewFilteredNotesCard
});
registerCard({
  id: "view:filtered-tasks",
  title: "View tasks (filtered)",
  Component: ViewFilteredTasksCard
});
registerCard({ id: "view:chat", title: "View chat", Component: ViewChatCard });
