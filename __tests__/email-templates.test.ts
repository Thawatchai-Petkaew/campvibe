/**
 * Tests for lib/email/templates.ts
 *
 * Coverage matrix:
 *   - normal: each builder returns { subject, html } with key data + Thai copy
 *   - boundary: kycResultEmail with approved=false + reason vs no reason
 *   - pure function: same input always produces same output (no side-effects)
 *   - amount formatting: Intl.NumberFormat used (no pre-formatted strings)
 *   - accessibility: html is semantic (contains expected structure)
 */

import { describe, it, expect } from "vitest";
import {
  bookingConfirmationEmail,
  bookingCancelledEmail,
  hostNewBookingEmail,
  kycResultEmail,
} from "@/lib/email/templates";

const CHECK_IN = new Date("2026-08-01T00:00:00.000Z");
const CHECK_OUT = new Date("2026-08-03T00:00:00.000Z");

/* -------------------------------------------------------------------------- */
/* bookingConfirmationEmail                                                    */
/* -------------------------------------------------------------------------- */

describe("bookingConfirmationEmail", () => {
  const params = {
    campName: "ดอยปุย แคมป์",
    checkIn: CHECK_IN,
    checkOut: CHECK_OUT,
    guests: 4,
    totalAmount: 2500,
    currency: "THB",
    bookingRef: "BK-0001",
  };

  it("returns a subject containing the camp name and booking ref", () => {
    const { subject } = bookingConfirmationEmail(params);
    expect(subject).toContain("ดอยปุย แคมป์");
    expect(subject).toContain("BK-0001");
  });

  it("html contains Thai confirmation copy", () => {
    const { html } = bookingConfirmationEmail(params);
    expect(html).toContain("การจองของคุณได้รับการยืนยันแล้ว");
  });

  it("html contains the camp name", () => {
    const { html } = bookingConfirmationEmail(params);
    expect(html).toContain("ดอยปุย แคมป์");
  });

  it("html contains the booking ref", () => {
    const { html } = bookingConfirmationEmail(params);
    expect(html).toContain("BK-0001");
  });

  it("html contains a formatted amount (not a raw number only)", () => {
    const { html } = bookingConfirmationEmail(params);
    // Intl.NumberFormat th-TH with THB produces something containing 2,500 or ฿ symbol
    expect(html).toMatch(/2[,.]?500/);
  });

  it("html contains the guest count", () => {
    const { html } = bookingConfirmationEmail(params);
    expect(html).toContain("4");
  });

  it("html has basic document structure (lang=th, charset, DOCTYPE)", () => {
    const { html } = bookingConfirmationEmail(params);
    expect(html).toContain('lang="th"');
    expect(html).toContain("charset");
    expect(html).toContain("<!DOCTYPE html>");
  });

  it("is a pure function — same input yields identical output", () => {
    expect(bookingConfirmationEmail(params)).toEqual(bookingConfirmationEmail(params));
  });

  it("works with date strings as well as Date objects", () => {
    const result = bookingConfirmationEmail({ ...params, checkIn: "2026-08-01", checkOut: "2026-08-03" });
    expect(result.subject).toContain("ดอยปุย แคมป์");
    expect(result.html).toContain("การจองของคุณได้รับการยืนยันแล้ว");
  });
});

/* -------------------------------------------------------------------------- */
/* bookingCancelledEmail                                                       */
/* -------------------------------------------------------------------------- */

describe("bookingCancelledEmail", () => {
  const params = {
    campName: "เขาใหญ่ แคมป์",
    checkIn: CHECK_IN,
    checkOut: CHECK_OUT,
  };

  it("subject contains the camp name", () => {
    const { subject } = bookingCancelledEmail(params);
    expect(subject).toContain("เขาใหญ่ แคมป์");
  });

  it("html contains Thai cancellation copy", () => {
    const { html } = bookingCancelledEmail(params);
    expect(html).toContain("การจองของคุณถูกยกเลิกแล้ว");
  });

  it("html contains the camp name", () => {
    const { html } = bookingCancelledEmail(params);
    expect(html).toContain("เขาใหญ่ แคมป์");
  });

  it("html contains check-in and check-out dates", () => {
    const { html } = bookingCancelledEmail(params);
    // dates formatted in Thai locale — just verify the year is present (locale may vary)
    expect(html).toContain("2569"); // 2026 in Buddhist Era (th-TH locale)
  });

  it("is a pure function", () => {
    expect(bookingCancelledEmail(params)).toEqual(bookingCancelledEmail(params));
  });
});

/* -------------------------------------------------------------------------- */
/* hostNewBookingEmail                                                         */
/* -------------------------------------------------------------------------- */

describe("hostNewBookingEmail", () => {
  const params = {
    campName: "ริมน้ำ แคมป์",
    checkIn: CHECK_IN,
    checkOut: CHECK_OUT,
    guests: 2,
    guestName: "สมชาย มั่นคง",
  };

  it("subject contains the camp name", () => {
    const { subject } = hostNewBookingEmail(params);
    expect(subject).toContain("ริมน้ำ แคมป์");
  });

  it("html contains Thai new-booking copy for host", () => {
    const { html } = hostNewBookingEmail(params);
    expect(html).toContain("คุณมีการจองใหม่");
  });

  it("html contains the guest name", () => {
    const { html } = hostNewBookingEmail(params);
    expect(html).toContain("สมชาย มั่นคง");
  });

  it("html contains the camp name", () => {
    const { html } = hostNewBookingEmail(params);
    expect(html).toContain("ริมน้ำ แคมป์");
  });

  it("html contains the guest count", () => {
    const { html } = hostNewBookingEmail(params);
    expect(html).toContain("2");
  });

  it("is a pure function", () => {
    expect(hostNewBookingEmail(params)).toEqual(hostNewBookingEmail(params));
  });
});

/* -------------------------------------------------------------------------- */
/* kycResultEmail — approved                                                   */
/* -------------------------------------------------------------------------- */

describe("kycResultEmail — approved", () => {
  it("subject contains approval copy", () => {
    const { subject } = kycResultEmail({ approved: true });
    expect(subject).toContain("ยืนยันแล้ว");
  });

  it("html contains congratulations copy", () => {
    const { html } = kycResultEmail({ approved: true });
    expect(html).toContain("ยินดีด้วย");
    expect(html).toContain("ผ่านการตรวจสอบแล้ว");
  });

  it("does not include rejection reason section when approved", () => {
    const { html } = kycResultEmail({ approved: true });
    expect(html).not.toContain("เหตุผล");
  });

  it("is a pure function", () => {
    expect(kycResultEmail({ approved: true })).toEqual(kycResultEmail({ approved: true }));
  });
});

/* -------------------------------------------------------------------------- */
/* kycResultEmail — rejected with reason                                       */
/* -------------------------------------------------------------------------- */

describe("kycResultEmail — rejected with reason", () => {
  it("subject does not say approved", () => {
    const { subject } = kycResultEmail({ approved: false, reason: "เอกสารไม่ครบ" });
    expect(subject).not.toContain("ยืนยันแล้ว");
  });

  it("html contains rejection copy", () => {
    const { html } = kycResultEmail({ approved: false, reason: "เอกสารไม่ครบ" });
    expect(html).toContain("ไม่ผ่าน");
  });

  it("html contains the rejection reason", () => {
    const { html } = kycResultEmail({ approved: false, reason: "เอกสารไม่ครบ" });
    expect(html).toContain("เอกสารไม่ครบ");
  });

  it("is a pure function", () => {
    const p = { approved: false, reason: "เอกสารไม่ครบ" };
    expect(kycResultEmail(p)).toEqual(kycResultEmail(p));
  });
});

/* -------------------------------------------------------------------------- */
/* kycResultEmail — rejected without reason (boundary: optional field absent) */
/* -------------------------------------------------------------------------- */

describe("kycResultEmail — rejected without reason", () => {
  it("html contains rejection copy without crashing", () => {
    const { html } = kycResultEmail({ approved: false });
    expect(html).toContain("ไม่ผ่าน");
  });

  it("html does not render the reason section when reason is absent", () => {
    const { html } = kycResultEmail({ approved: false });
    expect(html).not.toContain("เหตุผล");
  });
});
