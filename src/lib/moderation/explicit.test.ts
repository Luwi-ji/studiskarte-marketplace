import { describe, expect, it } from "vitest";
import { findBlocked } from "./explicit";

describe("findBlocked", () => {
  it("finds English, Filipino and Taglish profanity, however it is capitalised", () => {
    for (const text of ["FUCK this", "what a bitch", "Ang gago mo", "putangina mo", "tang ina mo", "Bobo ka", "ulol", "free porn", "Selling stuff, tarantado ka"]) {
      expect(findBlocked(text), text).not.toBeNull();
    }
  });

  it("finds slurs and harassment", () => {
    for (const text of ["you nigga", "such a faggot", "so retarded", "kill yourself", "kys", "kill urself"]) {
      expect(findBlocked(text), text).not.toBeNull();
    }
  });

  it("sees through numbers and symbols for letters, stretched letters, accents and invisible characters", () => {
    for (const text of ["sh1t", "@sshole", "f*ck", "b!tch", "sh#t", "puuuuta ka", "fuuuuck", "gagô", "g\u200bago", "mother-fucker", "FÜCK", "ｆｕｃｋ"]) {
      expect(findBlocked(text), text).not.toBeNull();
    }
  });

  it("sees through letters spread apart", () => {
    for (const text of ["p u t a", "p.u.t.a", "T A N G I N A", "f . u . c . k"]) {
      expect(findBlocked(text), text).not.toBeNull();
    }
  });

  it("catches longer forms that start with a stem no ordinary word has", () => {
    for (const text of ["fuckboy", "putanginamo", "kantotan", "tanginang yan", "motherfucking"]) {
      expect(findBlocked(text), text).not.toBeNull();
    }
  });

  it("lets ordinary listing words through, including ones that only contain or resemble a bad word", () => {
    const fine = [
      "Class notes and assistant professor handouts",
      "Scunthorpe",
      "Puto bumbong and leche flan",
      "Magna cum laude graduation gown",
      "Moby Dick, a novel",
      "Maine Coon cat tower",
      "Baby bottle nipple, 2 pieces",
      "Nude lipstick shade",
      "Peacock feather and cockatiel cage",
      "Hancock textbook, 9th edition",
      "Bass guitar with a strap",
      "Calculus textbook, 9th edition ₱450",
      "iPhone 15 Pro 256GB",
      "Shiitake mushroom growing kit",
      "Analysis of algorithms, 3rd edition",
      "Meet at the main gate, 3:00 PM",
      "",
    ];
    for (const text of fine) expect(findBlocked(text), text).toBeNull();
  });

  it("returns the word with its letters hidden, never whole", () => {
    expect(findBlocked("Ang gago mo")).toEqual({ masked: "g***" });
    expect(findBlocked("fuck")).toEqual({ masked: "f***" });
    expect(findBlocked("tang ina mo")?.masked).toBe("t***");
  });
});
