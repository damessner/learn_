import MultipleChoice from "./MultipleChoice";
import DragDrop from "./DragDrop";
import GapFill from "./GapFill";
import Categorization from "./Categorization";
import ExploreImageMap from "./ExploreImageMap";
import ClickableChoice from "./ClickableChoice";
import Matching from "./Matching";
import MediaOnly from "./MediaOnly";
import InstructionOnly from "./InstructionOnly";
import OpenQuestion from "./OpenQuestion";
import Ordering from "./Ordering";
import ImageHotspotQuiz from "./ImageHotspotQuiz";
import InteractiveReading from "./InteractiveReading";
import Vocabulary from "./Vocabulary";
import { WidgetProps } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const WIDGET_REGISTRY: Record<string, React.FC<WidgetProps<any>>> = {
  "multiple-choice": MultipleChoice,
  "drag-drop": DragDrop,
  "gap-fill": GapFill,
  "categorization": Categorization,
  "explore-image-map": ExploreImageMap,
  "clickable-choice": ClickableChoice,
  "matching": Matching,
  "media": MediaOnly,
  "instruction": InstructionOnly,
  "open-question": OpenQuestion,
  "ordering": Ordering,
  "image-hotspot-quiz": ImageHotspotQuiz,
  "interactive-reading": InteractiveReading,
  "vocabulary": Vocabulary,
};

export type { WidgetProps };
export * from "./types";
