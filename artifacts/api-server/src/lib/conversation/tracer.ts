import crypto from "node:crypto";

export type TraceStage =
  | "frontend_input"
  | "backend_received"
  | "context_retrieval"
  | "analysis"
  | "safety"
  | "llm_request"
  | "llm_response"
  | "post_processing"
  | "fallback"
  | "final_response";

export interface StageLog {
  stage: TraceStage;
  timestamp: string;
  durationMs?: number;
  data: Record<string, any>;
}

export interface RequestTrace {
  requestId: string;
  startTime: string;
  endTime?: string;
  totalDurationMs?: number;
  pipeline: StageLog[];
  result?: {
    success: boolean;
    response: string;
    source: "llm" | "fallback" | "safety" | "mock";
  };
  failures: Array<{
    stage: TraceStage;
    error: string;
    handled: boolean;
  }>;
}

class RequestTracer {
  private traces = new Map<string, RequestTrace>();
  private maxTraces = 200;

  createTrace(requestId?: string): string {
    const id = requestId || crypto.randomUUID();
    const trace: RequestTrace = {
      requestId: id,
      startTime: new Date().toISOString(),
      pipeline: [],
      failures: [],
    };
    this.traces.set(id, trace);

    // Evict old traces if cache exceeds limit
    if (this.traces.size > this.maxTraces) {
      const firstKey = this.traces.keys().next().value;
      if (firstKey) this.traces.delete(firstKey);
    }

    return id;
  }

  recordStage(requestId: string, stage: TraceStage, data: Record<string, any>, durationMs?: number): void {
    let trace = this.traces.get(requestId);
    if (!trace) {
      this.createTrace(requestId);
      trace = this.traces.get(requestId)!;
    }

    const logEntry: StageLog = {
      stage,
      timestamp: new Date().toISOString(),
      durationMs,
      data,
    };

    trace.pipeline.push(logEntry);

    // Formatted structured console debug output
    const isDebugEnabled = process.env.DEBUG_LOG_REQUESTS !== "false";
    if (isDebugEnabled) {
      console.log(`[Debug] REQUEST_ID: ${requestId}`);
      console.log(`[Debug] STAGE: ${stage}`);
      console.log(`[Debug]   data: ${JSON.stringify(data, null, 2).replace(/\n/g, "\n  ")}`);
    }
  }

  recordFailure(requestId: string, stage: TraceStage, error: string, handled = true): void {
    const trace = this.traces.get(requestId);
    if (trace) {
      trace.failures.push({ stage, error, handled });
    }
  }

  finalizeTrace(requestId: string, response: string, source: "llm" | "fallback" | "safety" | "mock", success = true): void {
    const trace = this.traces.get(requestId);
    if (trace) {
      trace.endTime = new Date().toISOString();
      const startMs = new Date(trace.startTime).getTime();
      const endMs = new Date(trace.endTime).getTime();
      trace.totalDurationMs = Math.max(0, endMs - startMs);
      trace.result = {
        success,
        response,
        source,
      };

      this.recordStage(requestId, "final_response", {
        content: response.slice(0, 150) + (response.length > 150 ? "..." : ""),
        source,
        totalDurationMs: trace.totalDurationMs,
      });
    }
  }

  getTrace(requestId: string): RequestTrace | null {
    return this.traces.get(requestId) ?? null;
  }

  getAllTraces(): RequestTrace[] {
    return Array.from(this.traces.values());
  }
}

export const requestTracer = new RequestTracer();
