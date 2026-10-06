import { expect, it, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerDealActionTools, DEAL_ACTION_TOOL_NAMES } from "../src/tools/deal-actions.js";

function setup(writeMode: "disabled" | "preview" | "live", user = true) {
  const handlers = new Map<string, (input: any) => Promise<any>>();
  const rawRequest = vi.fn().mockImplementation(async (input) => input.method === "GET" ? { opportunity_data: [{ id: 123, won_at: "2026-10-05" }] } : { success: true });
  const createHistory = vi.fn().mockResolvedValue({ message: { id: 91 } });
  const getLoggedUser = vi.fn().mockResolvedValue({ data: { user: user ? { id: 7 } : [] } });
  registerDealActionTools({ registerTool: (name: string, _config: any, call: any) => handlers.set(name, call) } as unknown as McpServer, { writeMode, v1: { rawRequest, createHistory, getLoggedUser } } as never);
  return { handlers, rawRequest, createHistory, getLoggedUser };
}
it("registers no deal actions in disabled mode", () => expect(setup("disabled").handlers.size).toBe(0));
it("previews all actions without any request or user lookup", async () => {
  const s = setup("preview", false);
  const inputs = [{ id: 123 }, { id: 123, id_loss: 2, loss_reason: "Example" }, { entity: "OPPORTUNITY", id: 123, message: "Example" }, { entity: "LEAD", id: 123, message: "Example", receiver: 7, action: 2, data: "2026-10-05 12:00:00" }];
  for (let i = 0; i < DEAL_ACTION_TOOL_NAMES.length; i++) expect((await s.handlers.get(DEAL_ACTION_TOOL_NAMES[i])!(inputs[i])).structuredContent.data.executed).toBe(false);
  expect(s.rawRequest).not.toHaveBeenCalled(); expect(s.createHistory).not.toHaveBeenCalled(); expect(s.getLoggedUser).not.toHaveBeenCalled();
});
it("requires extra confirmation for commercial closure", async () => {
  const s = setup("live");
  for (const name of DEAL_ACTION_TOOL_NAMES.slice(0, 2)) await s.handlers.get(name)!({ id: 123, id_loss: 2, loss_reason: "Example" });
  expect(s.rawRequest).not.toHaveBeenCalled();
});
it("sends the observed win payload once and rereads without claiming business success", async () => {
  const s = setup("live");
  const r = await s.handlers.get("leads2b_win_opportunity")!({ id: 123, confirm_destructive: true });
  expect(s.rawRequest).toHaveBeenNthCalledWith(1, { method: "PUT", path: "/opportunity/winOpportunity/123", body: { cloneOpportunity: "NOT_CLONE", createAfterSale: "false", afterSalePipeline: null, idRouter: null, idUser: null } });
  expect(s.rawRequest).toHaveBeenNthCalledWith(2, { method: "GET", path: "/opportunity/index/123" });
  expect(r.structuredContent.data).toMatchObject({ executed: true, outcome: "request_accepted", readback: { status: "fetched" } });
});
it("sends loss with a reason without cloning, reactivation or workflow termination", async () => {
  const s = setup("live");
  await s.handlers.get("leads2b_lose_opportunity")!({ id: 123, id_loss: 2, loss_reason: "Example", confirm_destructive: true });
  expect(s.rawRequest).toHaveBeenNthCalledWith(1, { method: "PUT", path: "/opportunity/opportunityLost", body: { id_opportunity: 123, id_loss: 2, exclusion_reason: "Example", cloning_opportunity: false, finishWorkflowInstances: false, reactivate_lead: false } });
});
it("creates a note using the logged user and reads its entity history", async () => {
  const s = setup("live");
  await s.handlers.get("leads2b_create_note")!({ entity: "OPPORTUNITY", id: 123, message: "Example" });
  expect(s.createHistory).toHaveBeenCalledExactlyOnceWith({ entity: "OPPORTUNITY", id_entity: 123, option: "comment", message: "Example", receiver: 7 });
  expect(s.rawRequest).toHaveBeenCalledWith({ method: "GET", path: "/history/index/", query: { entity: "OPPORTUNITY", id_entity: 123, limit: 25, offset: 0 } });
});
it("creates an activity with explicit receiver, action and naive API timestamp", async () => {
  const s = setup("live");
  await s.handlers.get("leads2b_create_activity")!({ entity: "LEAD", id: 123, receiver: 7, action: 2, data: "2026-10-05 12:00:00", message: "Example" });
  expect(s.createHistory).toHaveBeenCalledExactlyOnceWith({ entity: "LEAD", id_entity: 123, option: "action", message: "Example", receiver: 7, action: 2, data: "2026-10-05 12:00:00", final_date: null });
});
it("stops all actions without user context", async () => {
  const s = setup("live", false);
  const r = await s.handlers.get("leads2b_create_note")!({ entity: "LEAD", id: 123, message: "Example" });
  expect(r.isError).toBe(true); expect(s.createHistory).not.toHaveBeenCalled(); expect(s.rawRequest).not.toHaveBeenCalled();
});
it("does not repeat a failed mutation and preserves the error with readback", async () => {
  const s = setup("live"); s.rawRequest.mockRejectedValueOnce(new Error("ambiguous"));
  const r = await s.handlers.get("leads2b_win_opportunity")!({ id: 123, confirm_destructive: true });
  expect(r.isError).toBe(true); expect(s.rawRequest).toHaveBeenCalledTimes(2);
  expect(r.structuredContent).toMatchObject({ writeState: { requestSent: true, outcome: "unknown", automaticRetry: false }, readback: { status: "fetched" } });
});
it("rejects business failures delivered as HTTP success", async () => {
  const s = setup("live"); s.createHistory.mockResolvedValueOnce({ message: "required_activity_type" });
  const r = await s.handlers.get("leads2b_create_note")!({ entity: "LEAD", id: 123, message: "Example" });
  expect(r.isError).toBe(true); expect(r.structuredContent.data.outcome).toBe("rejected");
});

it("rejects unsafe IDs, invalid dates and reversed activity intervals before requests", async () => {
  const s = setup("live");
  for (const input of [
    { id: "../123", entity: "LEAD", message: "Example", receiver: 7, action: 2, data: "2026-10-05 12:00:00" },
    { id: 123, entity: "LEAD", message: "Example", receiver: 7, action: 2, data: "2026-02-30 12:00:00" },
    { id: 123, entity: "LEAD", message: "Example", receiver: 7, action: 2, data: "2026-10-05 12:00:00", final_date: "2026-10-05 11:00:00" }
  ]) expect((await s.handlers.get("leads2b_create_activity")!(input)).isError).toBe(true);
  expect(s.getLoggedUser).not.toHaveBeenCalled(); expect(s.createHistory).not.toHaveBeenCalled();
});
it("keeps accepted request outcome when its readback fails", async () => {
  const s = setup("live"); s.rawRequest.mockResolvedValueOnce({ success: true }).mockRejectedValueOnce(new Error("read denied"));
  const r = await s.handlers.get("leads2b_win_opportunity")!({ id: 123, confirm_destructive: true });
  expect(r.structuredContent.data).toMatchObject({ outcome: "request_accepted", readback: { status: "failed" } });
  expect(s.rawRequest).toHaveBeenCalledTimes(2);
});

it("keeps an HTTP accepted response with an informational message from becoming a rejection", async () => {
  const s = setup("live"); s.createHistory.mockResolvedValueOnce({ message: "created" } as never);
  const r = await s.handlers.get("leads2b_create_note")!({ entity: "LEAD", id: 123, message: "Example" });
  expect(r.isError).toBeUndefined();
  expect(r.structuredContent.data).toMatchObject({ executed: true, outcome: "request_accepted" });
  expect(s.createHistory).toHaveBeenCalledTimes(1);
});
