export type ThemeMode = "light" | "dark";
export type BoardType = "task" | "thought";
export type Importance = "none" | "Low" | "Medium" | "High";
export type FlowMode = "web" | "chain";

export type Board = {
  id: string;
  name: string;
  type: BoardType;
};

export type Step = {
  id: number;
  title: string;
  minutes: number;
  done: boolean;
  x: number;
  y: number;
};

export type Draft = {
  id: number;
  title: string;
  body: string;
  dueDate: string;
  minutes: number;
  importance: Importance;
  aiSteps: Step[];
  boardId: string;
  boardType: BoardType;
  boardName: string;
  savedAt: string;
};

export type Note = {
  id: number;
  boardId: string;
  type: BoardType;
  title: string;
  body: string;
  dueDate?: string;
  minutes?: number;
  importance?: Importance;
  createdAt: string;
  completed: boolean;
  x: number;
  y: number;
  steps: Step[];
  showFlow: boolean;
  flowMode: FlowMode;
  linkedNoteIds: number[];
};
