/**
 * cam-420-safe-dispatch-reverify.test.ts — independent QA re-verify of the
 * backend fix (301a009, `safeDispatchTool` wrapping `dispatchTool` inside
 * `executeToolCalls`, lib/ai/openrouter-client.ts) that resolved QA's
 * tracked Important defect (test.md Part 2). Unlike the backend's own new
 * tests (which mock `dispatchTool`/tool-registry generically), this file
 * mocks ONLY `@/lib/prisma` — the real `tool-registry`, the real
 * `openrouter-client` (incl. `safeDispatchTool`), and the REAL
 * `getMyBookings`/`getMyBookingDetail`/`getMyProfile`/`getMyWishlist`
 * implementations all run, through the REAL `POST` route handler.
 *
 * Re-verify items requested by the coordinator:
 *   (a) each of the 4 real authed personal tools throwing (via a rejecting
 *       Prisma call) yields a graceful turn end through the REAL route+loop
 *       — never an uncaught crash.
 *   (b) the raw error message/stack never reaches the client response body
 *       OR the server logs — only the tool name + error TYPE.
 *   (c) a tool that throws on EVERY round still terminates within
 *       MAX_AGENT_ITERATIONS (never spins past the cap).
 *   (d) teeth check — noted in the file header, not re-proved by reverting
 *       production code (QA does not write/un-write production code): the
 *       ORIGINAL scratch repro (pre-fix, session-local, deleted after
 *       confirmation) showed `await runAssistantTurnFromMessages(...)`
 *       itself REJECTS when the fix is absent — the exact same `await` +
 *       `.ok` assertion shape used below would fail the test (an unhandled
 *       rejection), not silently pass. The assertion has teeth by
 *       construction: there is no code path where a reverted fix leaves
 *       these tests green.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('server-only', () => ({}));

// ---------------------------------------------------------------------------
// Mock ONLY Prisma — everything else (tool-registry, openrouter-client, the
// 4 real tool modules, conversation-store) is REAL.
// ---------------------------------------------------------------------------
const mockPrisma = {
  $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(mockPrisma)),
  chatConversation: {
    count: vi.fn().mockResolvedValue(0),
    findFirst: vi.fn(),
    create: vi.fn().mockResolvedValue({ id: 'conv-reverify' }),
    delete: vi.fn(),
    update: vi.fn().mockResolvedValue({}),
  },
  chatMessage: {
    count: vi.fn().mockResolvedValue(0),
    findFirst: vi.fn().mockResolvedValue(null),
    create: vi
      .fn()
      .mockResolvedValueOnce({ id: 'u1' })
      .mockResolvedValueOnce({ id: 'a1' }),
  },
  booking: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
  wishlist: {
    findMany: vi.fn(),
  },
};
vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));

const mockAuth = vi.fn();
vi.mock('@/lib/auth', () => ({ auth: (...args: unknown[]) => mockAuth(...args) }));

const USER_ID = '550e8400-e29b-41d4-a716-446655440099';
const FAKE_KEY = 'sk-or-test-reverify';

function makeSession(userId: string) {
  return { user: { id: userId, email: 't@campvibe.com', name: 'Tester' } };
}
function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.77' },
    body: JSON.stringify(body),
  });
}
function res(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response;
}
function assistantMessage(content: string | null, toolCalls?: unknown[]) {
  return { choices: [{ message: { role: 'assistant', content, tool_calls: toolCalls } }] };
}
function toolCall(id: string, name: string) {
  return { id, type: 'function', function: { name, arguments: '{}' } };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.chatConversation.count.mockResolvedValue(0);
  mockPrisma.chatConversation.create.mockResolvedValue({ id: 'conv-reverify' });
  mockPrisma.chatConversation.findFirst.mockResolvedValue({ id: 'conv-reverify' }); // appendTurn's ownership check
  mockPrisma.chatMessage.count.mockResolvedValue(0);
  mockPrisma.chatMessage.findFirst.mockResolvedValue(null);
  mockPrisma.chatMessage.create
    .mockReset()
    .mockResolvedValueOnce({ id: 'u1' })
    .mockResolvedValueOnce({ id: 'a1' });
  mockPrisma.chatConversation.update.mockResolvedValue({});
  process.env.OPENROUTER_API_KEY = FAKE_KEY;
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.OPENROUTER_API_KEY;
});

const { POST } = await import('@/app/api/ai/chat/route');

describe('(a)+(b) each of the 4 real authed personal tools throwing -> graceful turn end through the REAL route+loop+registry', () => {
  it.each([
    { tool: 'getMyBookings', reject: () => mockPrisma.booking.findMany.mockRejectedValueOnce(new Error('conn reset: internal-db-secret-abc123')) },
    { tool: 'getMyBookingDetail', reject: () => mockPrisma.booking.findFirst.mockRejectedValueOnce(new Error('conn reset: internal-db-secret-abc123')) },
    { tool: 'getMyProfile', reject: () => mockPrisma.user.findUnique.mockRejectedValueOnce(new Error('conn reset: internal-db-secret-abc123')) },
    { tool: 'getMyWishlist', reject: () => mockPrisma.wishlist.findMany.mockRejectedValueOnce(new Error('conn reset: internal-db-secret-abc123')) },
  ])('[security/reliability] $tool throwing resolves gracefully (200, real final answer), never an uncaught route crash', async ({ tool, reject }) => {
    mockAuth.mockResolvedValueOnce(makeSession(USER_ID));
    reject();
    const args = tool === 'getMyBookingDetail' ? JSON.stringify({ bookingId: '550e8400-e29b-41d4-a716-446655440077' }) : '{}';
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(res(assistantMessage(null, [{ id: 'c1', type: 'function', function: { name: tool, arguments: args } }])))
      .mockResolvedValueOnce(res(assistantMessage('ขอโทษค่ะ ไม่สามารถดึงข้อมูลได้ในตอนนี้ค่ะ')));
    vi.stubGlobal('fetch', mockFetch);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await POST(makeRequest({ message: 'ขอดูข้อมูลของฉันหน่อย' }));
    const body = await response.json();

    // Graceful continuation ALL THE WAY through the real route — never an
    // uncaught exception (which would otherwise reject this await or throw
    // out of POST entirely).
    expect(response.status).toBe(200);
    expect(body.answer).toBe('ขอโทษค่ะ ไม่สามารถดึงข้อมูลได้ในตอนนี้ค่ะ');
    expect(mockFetch).toHaveBeenCalledTimes(2); // the follow-up round ran — the loop was never aborted

    // (b) no raw error message/stack anywhere: not in the client response...
    expect(JSON.stringify(body)).not.toContain('internal-db-secret-abc123');
    // ...not in the follow-up request body sent to the model...
    const followUpBody = JSON.parse((mockFetch.mock.calls[1][1] as RequestInit).body as string);
    expect(JSON.stringify(followUpBody)).not.toContain('internal-db-secret-abc123');
    // ...and not in the server logs (only toolName + errorType per the fix).
    const loggedLines = errSpy.mock.calls.map((c) => String(c[0]));
    expect(loggedLines.some((l) => l.includes('internal-db-secret-abc123'))).toBe(false);
    expect(loggedLines.some((l) => l.includes('ai_tool_execution_threw') && l.includes(tool))).toBe(true);

    errSpy.mockRestore();
  });
});

describe('(c) a tool that throws on EVERY round still terminates within MAX_AGENT_ITERATIONS — never spins past the cap', () => {
  it('[boundary] 4 rounds of a throwing getMyBookings call, forced-final on the last, terminates with a handled result (not an uncaught crash, not >4 fetch calls)', async () => {
    mockAuth.mockResolvedValueOnce(makeSession(USER_ID));
    mockPrisma.booking.findMany.mockRejectedValue(new Error('always fails'));

    const mockFetch = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      const parsedBody = JSON.parse(init.body as string) as { tool_choice?: string };
      // Forced-final round (tool_choice:'none') still defensively carries a
      // tool_call in this mock — the engine must ignore it (CAM-416 lineage).
      return res(
        assistantMessage(
          parsedBody.tool_choice === 'none' ? 'ขอโทษค่ะ ยังไม่พบข้อมูลตอนนี้ค่ะ' : null,
          [toolCall(`c-${mockFetch.mock.calls.length}`, 'getMyBookings')]
        )
      );
    });
    vi.stubGlobal('fetch', mockFetch);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await POST(makeRequest({ message: 'จองของฉันมีอะไรบ้าง' }));
    const body = await response.json();

    // Terminates within the cap — never an infinite loop, never more than 4
    // completion calls (MAX_AGENT_ITERATIONS), regardless of the tool
    // throwing on every single round.
    expect(mockFetch).toHaveBeenCalledTimes(4);
    expect(response.status).toBe(200);
    expect(body.answer).toBe('ขอโทษค่ะ ยังไม่พบข้อมูลตอนนี้ค่ะ');

    const forcedFinalBody = JSON.parse((mockFetch.mock.calls[3][1] as RequestInit).body as string);
    expect(forcedFinalBody.tool_choice).toBe('none');

    errSpy.mockRestore();
  });
});

describe('(d) fix is NOT weakened — the wrapper preserves every OTHER dispatchTool outcome unchanged', () => {
  it('[normal] a SUCCEEDING real tool call still resolves its real data (positive control — safeDispatchTool does not mask success)', async () => {
    mockAuth.mockResolvedValueOnce(makeSession(USER_ID));
    mockPrisma.booking.findMany.mockResolvedValueOnce([]);
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(res(assistantMessage(null, [toolCall('c1', 'getMyBookings')])))
      .mockResolvedValueOnce(res(assistantMessage('คุณยังไม่มีการจองค่ะ')));
    vi.stubGlobal('fetch', mockFetch);

    const response = await POST(makeRequest({ message: 'จองของฉันมีอะไรบ้าง' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.answer).toBe('คุณยังไม่มีการจองค่ะ');
    expect(mockPrisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: USER_ID } })
    );
  });

  it('[error/validation] an UNKNOWN tool name (never registered) still resolves unknown_tool — not swallowed into tool_error', async () => {
    mockAuth.mockResolvedValueOnce(makeSession(USER_ID));
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(res(assistantMessage(null, [toolCall('c1', 'totallyMadeUpToolName')])))
      .mockResolvedValueOnce(res(assistantMessage('ขอโทษค่ะ ไม่พบข้อมูลค่ะ')));
    vi.stubGlobal('fetch', mockFetch);

    const response = await POST(makeRequest({ message: 'hi' }));
    expect(response.status).toBe(200);

    const followUpBody = JSON.parse((mockFetch.mock.calls[1][1] as RequestInit).body as string);
    const toolMsg = followUpBody.messages.find(
      (m: { role: string; tool_call_id?: string }) => m.role === 'tool' && m.tool_call_id === 'c1'
    );
    expect(JSON.parse(toolMsg.content)).toEqual({
      ok: false,
      code: 'unknown_tool',
      message: 'Unknown tool: totallyMadeUpToolName',
    });
  });
});
