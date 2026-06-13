export interface WidgetProps<T> {
  config: T;
  assetsPath: string; // Base URL path to query assets (e.g., /api/exercises/farm-animals/assets/)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  savedState?: any; // Optional previous state to restore
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onChange: (state: any, isComplete: boolean, score: number) => void;
  isReadOnly?: boolean; // True when reviewing past submissions or previewing
}

export interface MultipleChoiceConfig {
  id: string;
  title: string;
  description?: string;
  type: "multiple-choice";
  questions: Array<{
    id: string;
    question: string;
    options: string[];
    correctOptionIndex: number;
    media?: string;
  }>;
}

export interface DragDropConfig {
  id: string;
  title: string;
  description?: string;
  type: "drag-drop";
  text: string; // e.g. "The [cow] says [moo]."
  distractors?: string[];
}

export interface GapFillConfig {
  id: string;
  title: string;
  description?: string;
  type: "gap-fill";
  text: string; // e.g. "The sun <<shines##shone##shined>> in the sky. Yesterday it <<rained>>."
}

export interface CategorizationConfig {
  id: string;
  title: string;
  description?: string;
  type: "categorization";
  categories: string[];
  items: Array<{
    id: string;
    name: string;
    category: string;
    media?: string;
  }>;
}

export interface ExploreImageMapConfig {
  id: string;
  title: string;
  description?: string;
  type: "explore-image-map";
  startScene: string;
  scenes: Record<
    string,
    {
      image: string;
      hotspots: Array<{
        id: string;
        shape: "circle" | "rect" | "polygon";
        coords: number[];
        action: {
          type: "play-audio" | "change-scene";
          audio?: string;
          scene?: string;
        };
        popupText?: string;
        label?: string;
      }>;
    }
  >;
  gameMode?: {
    enabled: boolean;
    challenges: Array<{
      id: string;
      promptText: string;
      promptAudio?: string;
      targetLabel: string;
      successAudio?: string;
      failAudio?: string;
    }>;
  };
}

export interface ClickableChoiceConfig {
  id: string;
  title: string;
  description?: string;
  type: "clickable-choice";
  choices: string[];
  statements: Array<{
    id: string;
    text: string;
    correctChoice: string;
    media?: string;
  }>;
}

export interface MatchingConfig {
  id: string;
  title: string;
  description?: string;
  type: "matching";
  pairs: Array<{
    id: string;
    leftText?: string;
    leftMedia?: string;
    rightText: string;
  }>;
}

export interface MediaConfig {
  id: string;
  title: string;
  description?: string;
  type: "media";
  media: string;
}

export interface InstructionConfig {
  id: string;
  title: string;
  description?: string;
  type: "instruction";
  text: string;
}

export interface OpenQuestionConfig {
  id: string;
  title: string;
  description?: string;
  type: "open-question";
  question: string;
  keywords: string[];
  required?: string[];
  bonus?: string[];
  forbidden?: string[];
  spellingTolerance?: string;
  allowAudio?: boolean;
  allowImage?: boolean;
}

export interface OrderingConfig {
  id: string;
  title: string;
  description?: string;
  type: "ordering";
  question: string;
  elements: string[];
}

export interface ImageHotspotQuizConfig {
  id: string;
  title: string;
  description?: string;
  type: "image-hotspot-quiz";
  backgroundImage: string;
  shuffleTasks?: boolean;
  hotspots: Array<{
    id: string;
    name: string;
    shape: "circle" | "rect";
    coords: number[];
  }>;
  tasks: Array<{
    id: string;
    promptText: string;
    promptAudio?: string;
    targetHotspotId: string;
    targetHotspotIds?: string[];
  }>;
}

export interface InteractiveReadingConfig {
  id: string;
  title: string;
  description?: string;
  type: "interactive-reading";
  startPage: string;
  pages: Record<
    string,
    {
      title?: string;
      text: string;
      media?: string;
      choices: Array<{
        text: string;
        nextPageId: string;
      }>;
      questions: Array<{
        id: string;
        type: "multiple-choice" | "open-question";
        prompt: string;
        options?: string[];
        correctOptionIdx?: number;
        keywords?: string[];
      }>;
    }
  >;
}

export interface VocabularyConfig {
  id: string;
  title: string;
  description?: string;
  type: "vocabulary";
  vocabList: Array<{
    word: string;
    translation: string;
    image?: string;
  }>;
  pictureSupplementation?: boolean;
}

export interface WritingCoachConfig {
  id: string;
  title: string;
  description?: string;
  type: "writing-coach";
  prompt: string;
  systemPrompt?: string;
  criteria: Array<{
    id: string;
    name: string;
    description: string;
    tip?: string;
  }>;
}

export interface LiveQuizConfig {
  id: string;
  title: string;
  description?: string;
  type: "live-quiz";
  questions: Array<{
    id: string;
    type: "single-choice" | "multiple-choice" | "word-ordering" | "text-input";
    questionText: string;
    timeLimit: number; // in seconds
    media?: string;
    options?: string[]; // for choice types
    correctOptionIdx?: number; // for single-choice
    correctOptionIndices?: number[]; // for multiple-choice
    words?: string[]; // for word ordering
    acceptedAnswers?: string[]; // for text-input
  }>;
}

export type WidgetConfig =
  | MultipleChoiceConfig
  | DragDropConfig
  | GapFillConfig
  | CategorizationConfig
  | ExploreImageMapConfig
  | ClickableChoiceConfig
  | MatchingConfig
  | MediaConfig
  | InstructionConfig
  | OpenQuestionConfig
  | OrderingConfig
  | ImageHotspotQuizConfig
  | InteractiveReadingConfig
  | VocabularyConfig
  | WritingCoachConfig
  | LiveQuizConfig;


