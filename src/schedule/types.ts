export type ScheduleEventType = 'game' | 'practice';
export type StaffRole = 'head_coach' | 'assistant_coach';
export type AssignmentStatus = 'pending' | 'confirmed' | 'declined';

export type ScheduleEvent = {
  id: string;
  school_id: string;
  team_id: string;
  event_type: ScheduleEventType;
  title: string;
  starts_at: string;
  ends_at: string;
  location: string | null;
  opponent_name: string | null;
  is_home: boolean | null;
  goalie_coach_attending: boolean | null;
  game_id: string | null;
  practice_plan_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type EventStaffAssignment = {
  id: string;
  event_id: string;
  coach_user_id: string;
  coach_name: string;
  coach_email: string;
  coach_role: StaffRole;
  status: AssignmentStatus;
  decline_reason: string | null;
  coach_note: string | null;
};

export type EventPrivateNote = {
  id: string;
  event_id: string;
  sender_user_id: string;
  sender_name: string;
  recipient_user_id: string;
  recipient_name: string;
  body: string;
  created_at: string;
  updated_at: string;
};

