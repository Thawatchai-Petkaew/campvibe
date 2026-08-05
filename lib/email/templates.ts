/**
 * Pure email template builders — server-side only.
 *
 * Each builder is a pure function returning { subject, html }.
 * Amounts are formatted via Intl.NumberFormat (Atomic Data pattern — no
 * pre-formatted strings passed in; currency kept separate from amount).
 * HTML is inline-styled and semantic for maximum email-client compatibility.
 * Copy is Thai (user-facing); no em-dash, no jargon.
 */

/** Shared inline styles */
const styles = {
  body: 'font-family: Sarabun, Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 0;',
  container: 'max-width: 560px; margin: 32px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.08);',
  header: 'background: #1a6b3c; padding: 24px 32px;',
  headerText: 'color: #ffffff; font-size: 20px; font-weight: 700; margin: 0;',
  body_inner: 'padding: 32px;',
  h2: 'font-size: 16px; font-weight: 700; color: #1a1a1a; margin: 0 0 16px;',
  p: 'font-size: 14px; color: #444444; line-height: 1.6; margin: 0 0 8px;',
  label: 'font-size: 12px; color: #888888; margin: 0;',
  value: 'font-size: 15px; color: #1a1a1a; font-weight: 600; margin: 0 0 16px;',
  divider: 'border: none; border-top: 1px solid #eeeeee; margin: 24px 0;',
  footer: 'padding: 16px 32px; background: #f9f9f9; font-size: 12px; color: #888888; text-align: center;',
} as const;

function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d);
}

/**
 * CAM-685 — host-facing templates receive a deep link that is a relative
 * path (e.g. lib/notifications/copy.ts's bookingHighlightLink, already used
 * for the in-app Notification row's `link` field). An email needs an
 * absolute URL to be clickable from an inbox; this repo has no per-env
 * base-URL config yet (CAM-685's scope is exactly RESEND_API_KEY /
 * EMAIL_FROM / EMAIL_HOST_NOTIFICATIONS — see env.example), so this mirrors
 * lib/email/client.ts's existing fallback-domain precedent
 * ("noreply@campvibe.app") rather than inventing a new env var out of scope.
 * A path that is already absolute (e.g. a future caller passes a full URL)
 * is left untouched.
 */
const APP_ORIGIN = 'https://campvibe.app';
function absoluteAppUrl(path: string): string {
  return /^https?:\/\//.test(path) ? path : `${APP_ORIGIN}${path}`;
}

function layout(title: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="${styles.body}">
  <div style="${styles.container}">
    <div style="${styles.header}">
      <h1 style="${styles.headerText}">CampVibe</h1>
    </div>
    <div style="${styles.body_inner}">
      ${content}
    </div>
    <div style="${styles.footer}">
      อีเมลนี้ส่งโดยระบบอัตโนมัติ กรุณาอย่าตอบกลับ
    </div>
  </div>
</body>
</html>`;
}

/* -------------------------------------------------------------------------- */
/* Template: Booking confirmation (to camper)                                  */
/* -------------------------------------------------------------------------- */

export interface BookingConfirmationParams {
  campName: string;
  checkIn: Date | string;
  checkOut: Date | string;
  guests: number;
  totalAmount: number;
  currency: string;
  bookingRef: string;
}

export interface EmailTemplate {
  subject: string;
  html: string;
}

export function bookingConfirmationEmail(params: BookingConfirmationParams): EmailTemplate {
  const subject = `ยืนยันการจอง ${params.campName} — รหัส ${params.bookingRef}`;
  const content = `
    <h2 style="${styles.h2}">การจองของคุณได้รับการยืนยันแล้ว</h2>
    <p style="${styles.p}">ขอบคุณที่จองกับ CampVibe เราได้รับการจองของคุณเรียบร้อยแล้ว</p>
    <hr style="${styles.divider}">
    <p style="${styles.label}">สถานที่แคมป์</p>
    <p style="${styles.value}">${params.campName}</p>
    <p style="${styles.label}">วันเช็กอิน</p>
    <p style="${styles.value}">${formatDate(params.checkIn)}</p>
    <p style="${styles.label}">วันเช็กเอาต์</p>
    <p style="${styles.value}">${formatDate(params.checkOut)}</p>
    <p style="${styles.label}">จำนวนผู้เข้าพัก</p>
    <p style="${styles.value}">${params.guests} คน</p>
    <p style="${styles.label}">ยอดรวม</p>
    <p style="${styles.value}">${formatAmount(params.totalAmount, params.currency)}</p>
    <hr style="${styles.divider}">
    <p style="${styles.label}">รหัสการจอง</p>
    <p style="${styles.value}">${params.bookingRef}</p>
    <p style="${styles.p}">หากมีข้อสงสัยสามารถติดต่อเราได้ที่ support@campvibe.app</p>
  `;
  return { subject, html: layout(subject, content) };
}

/* -------------------------------------------------------------------------- */
/* Template: Booking cancelled (to camper)                                     */
/* -------------------------------------------------------------------------- */

export interface BookingCancelledParams {
  campName: string;
  checkIn: Date | string;
  checkOut: Date | string;
}

export function bookingCancelledEmail(params: BookingCancelledParams): EmailTemplate {
  const subject = `ยกเลิกการจอง ${params.campName}`;
  const content = `
    <h2 style="${styles.h2}">การจองของคุณถูกยกเลิกแล้ว</h2>
    <p style="${styles.p}">เราขอแจ้งให้ทราบว่าการจองของคุณถูกยกเลิกเรียบร้อยแล้ว</p>
    <hr style="${styles.divider}">
    <p style="${styles.label}">สถานที่แคมป์</p>
    <p style="${styles.value}">${params.campName}</p>
    <p style="${styles.label}">วันเช็กอิน</p>
    <p style="${styles.value}">${formatDate(params.checkIn)}</p>
    <p style="${styles.label}">วันเช็กเอาต์</p>
    <p style="${styles.value}">${formatDate(params.checkOut)}</p>
    <hr style="${styles.divider}">
    <p style="${styles.p}">หากคุณไม่ได้เป็นผู้ยกเลิก หรือต้องการความช่วยเหลือเพิ่มเติม กรุณาติดต่อ support@campvibe.app</p>
  `;
  return { subject, html: layout(subject, content) };
}

/* -------------------------------------------------------------------------- */
/* Template: New booking notification (to host)                                */
/* -------------------------------------------------------------------------- */

export interface HostNewBookingParams {
  campName: string;
  checkIn: Date | string;
  checkOut: Date | string;
  guests: number;
  /**
   * Optional — omitted from the email body when absent. lib/notifications/
   * host-email.ts (CAM-685) does not plumb guest identity into this event by
   * design, matching the PDPA-minimal-disclosure pattern already established
   * for the in-app Notification copy layer (lib/notifications/copy.ts).
   */
  guestName?: string;
  /** Deep link to the booking, e.g. lib/notifications/copy.ts's
   *  bookingHighlightLink('/dashboard/bookings?highlight=<id>'); rendered as
   *  a CTA button (CAM-74 AC#2/AC#4 — the email must link to the booking). */
  bookingUrl: string;
}

export function hostNewBookingEmail(params: HostNewBookingParams): EmailTemplate {
  const subject = `มีการจองใหม่สำหรับ ${params.campName}`;
  const content = `
    <h2 style="${styles.h2}">คุณมีการจองใหม่</h2>
    <p style="${styles.p}">มีผู้เข้าพักรายใหม่จองแคมป์ของคุณผ่าน CampVibe</p>
    <hr style="${styles.divider}">
    <p style="${styles.label}">สถานที่แคมป์</p>
    <p style="${styles.value}">${params.campName}</p>
    <p style="${styles.label}">วันเช็กอิน</p>
    <p style="${styles.value}">${formatDate(params.checkIn)}</p>
    <p style="${styles.label}">วันเช็กเอาต์</p>
    <p style="${styles.value}">${formatDate(params.checkOut)}</p>
    <p style="${styles.label}">จำนวนผู้เข้าพัก</p>
    <p style="${styles.value}">${params.guests} คน</p>
    ${
      params.guestName
        ? `<p style="${styles.label}">ชื่อผู้เข้าพัก</p>
    <p style="${styles.value}">${params.guestName}</p>`
        : ''
    }
    <hr style="${styles.divider}">
    <p style="${styles.p}">กรุณาตรวจสอบและยืนยันการจองผ่านลิงก์ด้านล่าง</p>
    <p style="margin: 24px 0;">
      <a href="${absoluteAppUrl(params.bookingUrl)}" style="display: inline-block; background: #1a6b3c; color: #ffffff; padding: 12px 24px; border-radius: 6px; font-size: 14px; font-weight: 600; text-decoration: none;">ดูรายละเอียดการจอง</a>
    </p>
  `;
  return { subject, html: layout(subject, content) };
}

/* -------------------------------------------------------------------------- */
/* Template: Booking cancelled (to host)                                       */
/* -------------------------------------------------------------------------- */

export interface HostBookingCancelledParams {
  campName: string;
  checkIn: Date | string;
  checkOut: Date | string;
  /** Deep link to the booking — see HostNewBookingParams.bookingUrl. */
  bookingUrl: string;
}

/**
 * CAM-685 — the HOST-facing sibling of bookingCancelledEmail (:121, sent to
 * the camper). Fired only when a CAMPER cancels their own booking (never a
 * host-initiated cancel — see lib/notifications/host-email.ts's
 * decideHostEmail, CAM-74 AC#5).
 */
export function hostBookingCancelledEmail(params: HostBookingCancelledParams): EmailTemplate {
  const subject = `มีการยกเลิกการจองที่ ${params.campName}`;
  const content = `
    <h2 style="${styles.h2}">มีการยกเลิกการจอง</h2>
    <p style="${styles.p}">ผู้เข้าพักได้ยกเลิกการจองที่แคมป์ของคุณผ่าน CampVibe</p>
    <hr style="${styles.divider}">
    <p style="${styles.label}">สถานที่แคมป์</p>
    <p style="${styles.value}">${params.campName}</p>
    <p style="${styles.label}">วันเช็กอิน</p>
    <p style="${styles.value}">${formatDate(params.checkIn)}</p>
    <p style="${styles.label}">วันเช็กเอาต์</p>
    <p style="${styles.value}">${formatDate(params.checkOut)}</p>
    <hr style="${styles.divider}">
    <p style="${styles.p}">กรุณาตรวจสอบรายละเอียดผ่านลิงก์ด้านล่าง</p>
    <p style="margin: 24px 0;">
      <a href="${absoluteAppUrl(params.bookingUrl)}" style="display: inline-block; background: #1a6b3c; color: #ffffff; padding: 12px 24px; border-radius: 6px; font-size: 14px; font-weight: 600; text-decoration: none;">ดูรายละเอียดการจอง</a>
    </p>
  `;
  return { subject, html: layout(subject, content) };
}

/* -------------------------------------------------------------------------- */
/* Template: KYC result (to host)                                              */
/* -------------------------------------------------------------------------- */

export interface KycResultParams {
  approved: boolean;
  reason?: string;
}

export function kycResultEmail(params: KycResultParams): EmailTemplate {
  if (params.approved) {
    const subject = 'บัญชีของคุณได้รับการยืนยันแล้ว — CampVibe';
    const content = `
      <h2 style="${styles.h2}">ยินดีด้วย! บัญชีของคุณผ่านการตรวจสอบแล้ว</h2>
      <p style="${styles.p}">ขณะนี้คุณสามารถลงประกาศแคมป์และรับการจองได้ทันทีผ่าน CampVibe</p>
      <hr style="${styles.divider}">
      <p style="${styles.p}">หากมีข้อสงสัยสามารถติดต่อเราได้ที่ support@campvibe.app</p>
    `;
    return { subject, html: layout(subject, content) };
  }

  const subject = 'ผลการตรวจสอบบัญชี — CampVibe';
  const content = `
    <h2 style="${styles.h2}">การตรวจสอบบัญชีของคุณไม่ผ่าน</h2>
    <p style="${styles.p}">ขออภัย เอกสารของคุณไม่ผ่านการตรวจสอบในขณะนี้</p>
    ${
      params.reason
        ? `<hr style="${styles.divider}">
           <p style="${styles.label}">เหตุผล</p>
           <p style="${styles.value}">${params.reason}</p>`
        : ''
    }
    <hr style="${styles.divider}">
    <p style="${styles.p}">กรุณาแก้ไขข้อมูลและยื่นเอกสารใหม่อีกครั้ง หากต้องการความช่วยเหลือ ติดต่อ support@campvibe.app</p>
  `;
  return { subject, html: layout(subject, content) };
}
