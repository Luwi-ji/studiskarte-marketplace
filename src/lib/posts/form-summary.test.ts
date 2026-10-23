import { describe, expect, it } from "vitest";
import { MEETUP_HOURS_MESSAGE } from "@/lib/deals/handover";
import { parsePostEdit } from "./schema";
import {
  audienceSummary,
  describeDays,
  handoverSummary,
  paymentSummary,
  quantitySummary,
  sameDays,
  summarizeAvailability,
  timePresets,
  timeProblem,
} from "./form-summary";

const weekly = (weekday: number, startTime = "09:00", endTime = "17:00") => ({ kind: "weekly" as const, weekday, startTime, endTime });

describe("describeDays", () => {
  it("names every day, weekends, ranges and loose days", () => {
    expect(describeDays([0, 1, 2, 3, 4, 5, 6])).toBe("Every day");
    expect(describeDays([6, 0])).toBe("Weekends");
    expect(describeDays([5, 4, 3, 2, 1])).toBe("Mon-Fri");
    expect(describeDays([1, 3, 5])).toBe("Mon, Wed, Fri");
    expect(describeDays([1, 2, 3, 6])).toBe("Mon-Wed, Sat");
    expect(describeDays([1, 2])).toBe("Mon, Tue");
    // Sunday ends the week, so Saturday and Sunday with Friday make one run.
    expect(describeDays([5, 6, 0])).toBe("Fri-Sun");
  });
});

describe("summarizeAvailability", () => {
  it("is one line with the days and the shared time", () => {
    expect(summarizeAvailability([1, 2, 3, 4, 5].map((day) => weekly(day)))).toBe("Mon-Fri, 9:00 AM to 5:00 PM");
    expect(summarizeAvailability([0, 1, 2, 3, 4, 5, 6].map((day) => weekly(day, "13:30", "20:00")))).toBe("Every day, 1:30 PM to 8:00 PM");
  });

  it("says when the times differ, when none are set and when nothing is chosen", () => {
    expect(summarizeAvailability([weekly(1), weekly(2, "10:00", "12:00")])).toBe("Mon, Tue, times differ");
    expect(summarizeAvailability([weekly(1, "", "")])).toBe("Mon, choose a time");
    expect(summarizeAvailability([])).toBe("Choose your days");
  });

  it("lists up to three dates and counts more", () => {
    const date = (day: string) => ({ kind: "date" as const, date: day, startTime: "09:00", endTime: "10:00" });
    expect(summarizeAvailability([date("2026-10-18"), date("2026-10-16")])).toBe("Oct 16, Oct 18, 9:00 AM to 10:00 AM");
    expect(summarizeAvailability(["01", "02", "03", "04"].map((d) => date(`2026-10-${d}`)))).toBe("4 dates, 9:00 AM to 10:00 AM");
  });
});

describe("sameDays", () => {
  it("compares sets of days whatever the order", () => {
    expect(sameDays([5, 1, 2, 3, 4], [1, 2, 3, 4, 5])).toBe(true);
    expect(sameDays([1, 2, 3], [1, 2, 3, 4, 5])).toBe(false);
  });
});

describe("timeProblem", () => {
  it("asks for both times and an end after the start", () => {
    expect(timeProblem({ startTime: "", endTime: "10:00" }, false)).toBe("Choose a start and an end time.");
    expect(timeProblem({ startTime: "10:00", endTime: "10:00" }, false)).toBe("The end time must be after the start time.");
    expect(timeProblem({ startTime: "09:00", endTime: "10:00" }, false)).toBeUndefined();
  });

  it("holds a post with meet-ups to meet-up hours", () => {
    expect(timeProblem({ startTime: "05:00", endTime: "10:00" }, true)).toBe(MEETUP_HOURS_MESSAGE);
    expect(timeProblem({ startTime: "05:00", endTime: "10:00" }, false)).toBeUndefined();
  });
});

describe("timePresets", () => {
  it("never offers a range the server would refuse", () => {
    for (const meetup of [true, false]) {
      for (const preset of timePresets(meetup)) expect(timeProblem({ startTime: preset.start, endTime: preset.end }, meetup)).toBeUndefined();
    }
  });
});

describe("row summaries", () => {
  it("reads the current choice", () => {
    expect(quantitySummary("5", false)).toBe("5");
    expect(quantitySummary("", false)).toBe("1");
    expect(quantitySummary("5", true)).toBe("No limit");
    expect(handoverSummary(true, true)).toBe("Meet-up and delivery");
    expect(handoverSummary(false, true)).toBe("Delivery");
    expect(handoverSummary(false, false)).toBe("Choose one");
    expect(paymentSummary({ paymentCash: true, paymentOnline: true, paymentOther: false })).toBe("Cash, Online payment");
    expect(paymentSummary({ paymentCash: false, paymentOnline: false, paymentOther: false })).toBe("Choose one");
    expect(audienceSummary(false)).toBe("Students only");
    expect(audienceSummary(true)).toBe("Students and others");
  });
});

describe("the form's availability against the schema", () => {
  it("saves the shape it always did: one entry per day, each with its own times", () => {
    const result = parsePostEdit(
      {
        title: "Calculator",
        description: "Works",
        categoryId: "services",
        priceKind: "amount",
        priceAmount: "100",
        quantity: "1",
        condition: "used_good",
        exchangeMeetup: true,
        exchangeDelivery: false,
        meetupLocation: "Main gate",
        paymentCash: true,
        availability: [1, 2, 3, 4, 5].map((day) => weekly(day, "08:00", "12:00")),
        photos: [{ id: "5b0c2a7e-6d3f-4c1a-9e8b-1f2a3b4c5d6e", caption: "" }],
      },
      () => ({ requiresCondition: false }),
    );
    expect(result.ok && result.data.availability).toEqual([1, 2, 3, 4, 5].map((day) => weekly(day, "08:00", "12:00")));
  });
});
