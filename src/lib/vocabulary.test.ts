import { describe, it, expect } from "vitest";
import { 
  cleanWordForPractice, 
  checkVocabMatch, 
  generateLetterGaps, 
  getGappedDisplayWithInput 
} from "../components/widgets/Vocabulary";

describe("Vocabulary Helper Functions", () => {
  describe("cleanWordForPractice", () => {
    it("should strip (to) prefixes and keep the core word", () => {
      expect(cleanWordForPractice("(to) play ball")).toBe("play ball");
      expect(cleanWordForPractice("to run")).toBe("run");
    });

    it("should strip German sich prefixes", () => {
      expect(cleanWordForPractice("(sich) beeilen")).toBe("beeilen");
      expect(cleanWordForPractice("sich freuen")).toBe("freuen");
    });

    it("should trim and clean extra spaces", () => {
      expect(cleanWordForPractice("  (to)   make   a   bed  ")).toBe("make a bed");
    });
  });

  describe("checkVocabMatch", () => {
    it("should match strings space-insensitively", () => {
      expect(checkVocabMatch("lay all", "layall")).toBe(true);
      expect(checkVocabMatch("layall", "layall")).toBe(true);
      expect(checkVocabMatch("  play   ball  ", "play ball")).toBe(true);
    });

    it("should ignore to/sich prefixes when matching", () => {
      expect(checkVocabMatch("to play ball", "play ball")).toBe(true);
      expect(checkVocabMatch("play ball", "(to) play ball")).toBe(true);
      expect(checkVocabMatch("beeilen", "sich beeilen")).toBe(true);
    });
  });

  describe("generateLetterGaps", () => {
    it("should generate the correct initial gaps for a single word", () => {
      const { display, missing, totalGaps } = generateLetterGaps("run", 0);
      expect(display).toBe("r _ _");
      expect(missing).toBe("un");
      expect(totalGaps).toBe(2);
    });

    it("should generate the correct gaps for multi-word phrases", () => {
      const { display, missing, totalGaps } = generateLetterGaps("play ball", 0);
      expect(display).toBe("p _ _ _   b _ _ _");
      expect(missing).toBe("layall");
      expect(totalGaps).toBe(6);
    });

    it("should respect revealedCount for hints", () => {
      const { display, missing, totalGaps } = generateLetterGaps("play ball", 2);
      expect(display).toBe("p l a _   b _ _ _");
      expect(missing).toBe("yall");
      expect(totalGaps).toBe(6);
    });
  });

  describe("getGappedDisplayWithInput", () => {
    it("should fill typed characters in the gaps in real time", () => {
      expect(getGappedDisplayWithInput("play ball", "la", 0)).toBe("p l a _   b _ _ _");
      expect(getGappedDisplayWithInput("play ball", "lay a", 0)).toBe("p l a y   b a _ _");
      expect(getGappedDisplayWithInput("play ball", "layall", 0)).toBe("p l a y   b a l l");
    });

    it("should combine hints and user inputs correctly", () => {
      // With 2 letters revealed as hints ('l', 'a'), typing 'y' and 'a' should fill subsequent gaps
      expect(getGappedDisplayWithInput("play ball", "ya", 2)).toBe("p l a y   b a _ _");
    });
  });
});
